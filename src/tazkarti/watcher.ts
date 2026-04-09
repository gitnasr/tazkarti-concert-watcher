import {
  FETCH_TIMEOUT_MS,
  OBSERVABILITY_MATCH_THRESHOLD,
  RELEASE_MATCH_THRESHOLD,
} from "./constants.js";
import { classifyFault, updateFaultState } from "./faults.js";
import { fetchEvents } from "./feed.js";
import { detectNewRelease, selectBestMatch } from "./matching.js";
import { sendNtfyNotification } from "./ntfy.js";
import { mergeUniqueNumbers, saveState } from "./state.js";
import type {
  FaultInfo,
  FaultTransition,
  MatchResult,
  ReleaseDecision,
  WatcherConfig,
  WatcherState,
  RunContext,
} from "./types.js";
import { describeError, formatDate, formatDuration, formatPrice } from "./utils.js";

function printClosestMatch(match: MatchResult | null): void {
  if (!match) {
    console.log("[match] No candidate events found in the feed.");
    return;
  }

  console.log(
    `[match] Closest candidate: "${match.event.name}" (score ${match.score.toFixed(3)})`,
  );
}

function updatePersistentReleaseState(
  state: WatcherState,
  release: ReleaseDecision,
): WatcherState {
  return {
    ...state,
    alertedEventIds: mergeUniqueNumbers(state.alertedEventIds, release.newEventIds),
    alertedShowIds: mergeUniqueNumbers(state.alertedShowIds, release.newShowIds),
  };
}

async function notifyRelease(
  config: WatcherConfig,
  match: MatchResult,
  release: ReleaseDecision,
): Promise<void> {
  const venue = match.event.venue?.name?.trim() || "venue unavailable";
  const detailParts = [
    `Event: ${match.event.name}`,
    `Venue: ${venue}`,
    `Start: ${formatDate(match.event.startDate)}`,
    `Minimum price: ${formatPrice(match.event.minimumPrice)}`,
    `Host: ${config.host}`,
    `Match score: ${match.score.toFixed(3)}`,
  ];

  if (release.newShowIds.length > 0) {
    detailParts.push(`New show ids: ${release.newShowIds.join(", ")}`);
  }

  console.log(`[release] Match detected: "${match.event.name}"`);

  try {
    await sendNtfyNotification(config, {
      title: "Tazkarti release detected",
      message: detailParts.join("\n"),
      priority: "urgent",
      tags: ["tickets", "release", "warning"],
    });
    console.log("[release] ntfy notification sent.");
  } catch (error) {
    console.error(`[release] ntfy notification failed: ${describeError(error)}`);
  }
}

async function notifyFaultTransition(
  config: WatcherConfig,
  transition: FaultTransition,
): Promise<void> {
  if (transition.type === "entered") {
    const prefix = transition.previous
      ? "Critical watcher fault changed"
      : "Critical watcher fault started";

    console.error(`[fault] ${transition.snapshot.message}`);

    try {
      await sendNtfyNotification(config, {
        title: prefix,
        message: [
          `Fault: ${transition.snapshot.kind}`,
          `Message: ${transition.snapshot.message}`,
          `Host: ${config.host}`,
          `Time: ${new Date(transition.snapshot.sinceMs).toLocaleString()}`,
        ].join("\n"),
        priority: "high",
        tags: ["warning", "rotating_light", "monitoring"],
      });
      console.log("[fault] ntfy notification sent.");
    } catch (error) {
      console.error(`[fault] ntfy notification failed: ${describeError(error)}`);
    }

    return;
  }

  if (transition.type === "escalated") {
    console.error(
      `[fault] Fault still active after ${formatDuration(transition.durationMs)}; escalating remote alert.`,
    );

    try {
      await sendNtfyNotification(config, {
        title: "Tazkarti watcher fault escalated",
        message: [
          `Fault: ${transition.snapshot.kind}`,
          `Message: ${transition.snapshot.message}`,
          `Duration: ${formatDuration(transition.durationMs)}`,
          `Host: ${config.host}`,
        ].join("\n"),
        priority: "urgent",
        tags: ["warning", "rotating_light", "sos"],
      });
      console.log("[fault] Escalation notification sent.");
    } catch (error) {
      console.error(`[fault] Escalation notification failed: ${describeError(error)}`);
    }

    return;
  }

  console.log(
    `[fault] Recovered after ${formatDuration(transition.durationMs)}: ${transition.snapshot.message}`,
  );

  try {
    await sendNtfyNotification(config, {
      title: "Tazkarti watcher recovered",
      message: [
        `Recovered fault: ${transition.snapshot.kind}`,
        `Previous message: ${transition.snapshot.message}`,
        `Duration: ${formatDuration(transition.durationMs)}`,
        `Host: ${config.host}`,
      ].join("\n"),
      priority: "high",
      tags: ["white_check_mark", "monitoring"],
    });
    console.log("[fault] Recovery notification sent.");
  } catch (error) {
    console.error(`[fault] Recovery notification failed: ${describeError(error)}`);
  }
}

async function handleHealthyPoll(
  context: RunContext,
  events: Parameters<typeof selectBestMatch>[1],
): Promise<void> {
  const { config, runtime, stateRef } = context;
  const bestMatch = selectBestMatch(config.targetName, events);
  runtime.lastMatch = bestMatch;
  runtime.lastSuccessfulPollAt = Date.now();

  if (bestMatch && bestMatch.score >= RELEASE_MATCH_THRESHOLD) {
    console.log(
      `[match] Best match: "${bestMatch.event.name}" (score ${bestMatch.score.toFixed(3)})`,
    );

    const release = detectNewRelease(bestMatch, stateRef.current);

    if (release.shouldAlert) {
      await notifyRelease(config, bestMatch, release);
      stateRef.current = updatePersistentReleaseState(stateRef.current, release);
      await saveState(stateRef.current);
    }
  } else if (bestMatch && bestMatch.score >= OBSERVABILITY_MATCH_THRESHOLD) {
    printClosestMatch(bestMatch);
  }

  const faultUpdate = updateFaultState(stateRef.current, Date.now(), null);
  stateRef.current = faultUpdate.state;

  if (faultUpdate.transition) {
    await saveState(stateRef.current);
    await notifyFaultTransition(config, faultUpdate.transition);
  }
}

async function handleFaultPoll(
  context: RunContext,
  fault: FaultInfo,
): Promise<void> {
  const { config, runtime, stateRef } = context;
  const faultUpdate = updateFaultState(stateRef.current, Date.now(), fault);
  stateRef.current = faultUpdate.state;
  runtime.lastMatch = null;
  await saveState(stateRef.current);

  if (faultUpdate.transition) {
    await notifyFaultTransition(config, faultUpdate.transition);
  } else {
    console.error(`[fault] Still unhealthy: ${fault.message}`);
  }
}

export async function runPollCycle(context: RunContext): Promise<void> {
  const { runtime } = context;
  runtime.pollCount += 1;
  runtime.lastPollStartedAt = Date.now();

  try {
    const events = await fetchEvents(runtime, FETCH_TIMEOUT_MS);

    if (runtime.stopped) {
      return;
    }

    await handleHealthyPoll(context, events);
  } catch (error) {
    if (runtime.stopped && error instanceof Error && error.name === "AbortError") {
      return;
    }

    const fault = classifyFault(error);

    if (!fault) {
      console.error(`[poll] Non-critical HTTP response ignored: ${describeError(error)}`);
      return;
    }

    await handleFaultPoll(context, fault);
  }
}
