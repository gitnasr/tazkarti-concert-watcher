import { hostname } from "node:os";
import { DEFAULT_POLL_INTERVAL_SECONDS, FEED_URL } from "./constants.js";
import { resolveNtfyEndpoint } from "./ntfy.js";
import type { RuntimeState, WatcherConfig } from "./types.js";
import { formatDuration } from "./utils.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPollIntervalSeconds(): number {
  const rawValue = process.env.POLL_INTERVAL_SECONDS?.trim();

  if (!rawValue) {
    return DEFAULT_POLL_INTERVAL_SECONDS;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("POLL_INTERVAL_SECONDS must be a positive number");
  }

  return value;
}

export function loadConfigFromEnv(): WatcherConfig {
  const targetName = getRequiredEnv("TARGET_NAME");
  const ntfyTarget = getRequiredEnv("NTFY_TOPIC");
  const pollIntervalSeconds = getPollIntervalSeconds();
  const ntfyToken = process.env.NTFY_TOKEN?.trim();

  return {
    targetName,
    ntfyEndpoint: resolveNtfyEndpoint(ntfyTarget),
    pollIntervalMs: pollIntervalSeconds * 1_000,
    ntfyToken: ntfyToken || undefined,
    host: hostname(),
  };
}

export function buildRuntimeState(): RuntimeState {
  return {
    stopped: false,
    pollCount: 0,
    activeFetchController: null,
    lastMatch: null,
    lastPollStartedAt: null,
    lastSuccessfulPollAt: null,
    sleepTimer: null,
    sleepResolve: null,
  };
}

export function logStartupSummary(config: WatcherConfig): void {
  console.log("[watcher] Starting Tazkarti watcher");
  console.log(`[watcher] Target: ${config.targetName}`);
  console.log(`[watcher] Feed: ${FEED_URL}`);
  console.log(`[watcher] ntfy: ${config.ntfyEndpoint}`);
  console.log(`[watcher] Poll interval: ${config.pollIntervalMs / 1_000}s`);
  console.log("[watcher] Mode: server / pm2-ready");
}

export function requestStop(runtime: RuntimeState, reason: string): void {
  if (runtime.stopped) {
    return;
  }

  runtime.stopped = true;

  if (runtime.activeFetchController) {
    runtime.activeFetchController.abort();
  }

  if (runtime.sleepTimer) {
    clearTimeout(runtime.sleepTimer);
    runtime.sleepTimer = null;
  }

  if (runtime.sleepResolve) {
    const resolveSleep = runtime.sleepResolve;
    runtime.sleepResolve = null;
    resolveSleep();
  }

  console.log(`[watcher] Stopping: ${reason}`);
}

export async function waitFor(runtime: RuntimeState, ms: number): Promise<void> {
  if (runtime.stopped) {
    return;
  }

  await new Promise<void>((resolvePromise) => {
    runtime.sleepResolve = resolvePromise;
    runtime.sleepTimer = setTimeout(() => {
      if (runtime.sleepTimer) {
        clearTimeout(runtime.sleepTimer);
      }

      runtime.sleepTimer = null;
      runtime.sleepResolve = null;
      resolvePromise();
    }, ms);
  });
}
