import { FEED_URL } from "./constants.js";
import {
  HttpStatusError,
  InvalidJsonError,
  InvalidPayloadError,
  RequestTimeoutError,
} from "./errors.js";
import type { EventRecord, RuntimeState, ShowRecord } from "./types.js";
import { describeError } from "./utils.js";

function sanitizeShows(value: unknown): ShowRecord[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new InvalidPayloadError("Event shows must be an array when present.");
  }

  return value.map((show, index) => {
    if (!show || typeof show !== "object") {
      throw new InvalidPayloadError(`Show ${index} is not an object.`);
    }

    const record = show as Record<string, unknown>;

    if (typeof record.id !== "number") {
      throw new InvalidPayloadError(`Show ${index} is missing a numeric id.`);
    }

    return {
      id: record.id,
      name: typeof record.name === "string" ? record.name : undefined,
      portalStatus:
        typeof record.portalStatus === "number" ? record.portalStatus : undefined,
    };
  });
}

function sanitizeEventsPayload(payload: unknown): EventRecord[] {
  if (!Array.isArray(payload)) {
    throw new InvalidPayloadError("Feed payload must be a JSON array.");
  }

  return payload.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new InvalidPayloadError(`Event ${index} is not an object.`);
    }

    const record = entry as Record<string, unknown>;

    if (typeof record.id !== "number") {
      throw new InvalidPayloadError(`Event ${index} is missing a numeric id.`);
    }

    if (typeof record.name !== "string" || !record.name.trim()) {
      throw new InvalidPayloadError(`Event ${index} is missing a name.`);
    }

    const venue =
      record.venue && typeof record.venue === "object"
        ? {
            name:
              typeof (record.venue as Record<string, unknown>).name === "string"
                ? ((record.venue as Record<string, unknown>).name as string)
                : null,
          }
        : null;

    return {
      id: record.id,
      name: record.name,
      description:
        typeof record.description === "string"
          ? record.description
          : typeof record.summary === "string"
            ? record.summary
            : undefined,
      startDate: typeof record.startDate === "string" ? record.startDate : undefined,
      minimumPrice:
        typeof record.minimumPrice === "number" ? record.minimumPrice : undefined,
      venue,
      shows: sanitizeShows(record.shows),
    };
  });
}

export async function fetchEvents(
  runtime: RuntimeState,
  timeoutMs: number,
): Promise<EventRecord[]> {
  const controller = new AbortController();
  runtime.activeFetchController = controller;
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(FEED_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HttpStatusError(response.status, response.statusText);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch (error) {
      throw new InvalidJsonError(
        `Tazkarti returned invalid JSON: ${describeError(error)}`,
      );
    }

    return sanitizeEventsPayload(payload);
  } catch (error) {
    if (timedOut) {
      throw new RequestTimeoutError(
        `Tazkarti feed request timed out after ${timeoutMs / 1_000}s.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);

    if (runtime.activeFetchController === controller) {
      runtime.activeFetchController = null;
    }
  }
}
