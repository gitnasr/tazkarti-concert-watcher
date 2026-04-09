import { FAULT_ESCALATION_MS } from "./constants.js";
import {
  HttpStatusError,
  InvalidJsonError,
  InvalidPayloadError,
  RequestTimeoutError,
} from "./errors.js";
import type {
  FaultInfo,
  FaultSnapshot,
  FaultTransition,
  WatcherState,
} from "./types.js";
import { cloneState } from "./state.js";
import { describeError } from "./utils.js";

export function classifyFault(error: unknown): FaultInfo | null {
  if (error instanceof HttpStatusError) {
    if (error.status === 403) {
      return {
        kind: "http-403",
        message: "Tazkarti returned HTTP 403 and may be blocking the watcher.",
      };
    }

    if (error.status === 429) {
      return {
        kind: "http-429",
        message: "Tazkarti returned HTTP 429 and is rate limiting the watcher.",
      };
    }

    if (error.status >= 500) {
      return {
        kind: "http-5xx",
        message: `Tazkarti returned server error ${error.status}.`,
      };
    }

    return null;
  }

  if (error instanceof RequestTimeoutError) {
    return {
      kind: "timeout",
      message: error.message,
    };
  }

  if (error instanceof InvalidJsonError) {
    return {
      kind: "invalid-json",
      message: error.message,
    };
  }

  if (error instanceof InvalidPayloadError) {
    return {
      kind: "invalid-payload",
      message: error.message,
    };
  }

  return {
    kind: "network",
    message: describeError(error),
  };
}

export function updateFaultState(
  state: WatcherState,
  nowMs: number,
  fault: FaultInfo | null,
): { state: WatcherState; transition: FaultTransition | null } {
  const nextState = cloneState(state);
  const activeFault = nextState.activeFault;

  if (!fault) {
    if (!activeFault) {
      return { state: nextState, transition: null };
    }

    nextState.activeFault = null;
    return {
      state: nextState,
      transition: {
        type: "recovered",
        snapshot: activeFault,
        durationMs: nowMs - activeFault.sinceMs,
      },
    };
  }

  if (!activeFault || activeFault.kind !== fault.kind) {
    const snapshot: FaultSnapshot = {
      ...fault,
      sinceMs: nowMs,
      lastAlertMs: nowMs,
      escalated: false,
    };

    nextState.activeFault = snapshot;
    return {
      state: nextState,
      transition: {
        type: "entered",
        snapshot,
        previous: activeFault,
      },
    };
  }

  const currentFault =
    activeFault.message === fault.message
      ? activeFault
      : {
          ...activeFault,
          message: fault.message,
        };

  nextState.activeFault = currentFault;

  if (
    !currentFault.escalated &&
    nowMs - currentFault.sinceMs >= FAULT_ESCALATION_MS
  ) {
    const snapshot: FaultSnapshot = {
      ...currentFault,
      escalated: true,
      lastAlertMs: nowMs,
    };

    nextState.activeFault = snapshot;
    return {
      state: nextState,
      transition: {
        type: "escalated",
        snapshot,
        durationMs: nowMs - activeFault.sinceMs,
      },
    };
  }

  return { state: nextState, transition: null };
}
