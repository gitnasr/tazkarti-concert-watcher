import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { STATE_FILE_PATH } from "./constants.js";
import type { FaultKind, WatcherState } from "./types.js";
import { describeError } from "./utils.js";

export const DEFAULT_STATE: WatcherState = {
  alertedEventIds: [],
  alertedShowIds: [],
  activeFault: null,
};

export function mergeUniqueNumbers(existing: number[], additions: number[]): number[] {
  return Array.from(new Set([...existing, ...additions]));
}

export function cloneState(state: WatcherState): WatcherState {
  return {
    alertedEventIds: [...state.alertedEventIds],
    alertedShowIds: [...state.alertedShowIds],
    activeFault: state.activeFault ? { ...state.activeFault } : null,
  };
}

export async function ensureStateFile(): Promise<void> {
  await mkdir(dirname(STATE_FILE_PATH), { recursive: true });

  try {
    await readFile(STATE_FILE_PATH, "utf8");
  } catch (error) {
    const readError = error as NodeJS.ErrnoException;
    if (readError.code !== "ENOENT") {
      throw error;
    }

    await saveState(DEFAULT_STATE);
  }
}

export async function loadState(): Promise<WatcherState> {
  await ensureStateFile();

  try {
    const raw = await readFile(STATE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<WatcherState>;

    return {
      alertedEventIds: Array.isArray(parsed.alertedEventIds)
        ? parsed.alertedEventIds.filter(
            (value): value is number => typeof value === "number",
          )
        : [],
      alertedShowIds: Array.isArray(parsed.alertedShowIds)
        ? parsed.alertedShowIds.filter(
            (value): value is number => typeof value === "number",
          )
        : [],
      activeFault:
        parsed.activeFault &&
        typeof parsed.activeFault === "object" &&
        typeof parsed.activeFault.kind === "string" &&
        typeof parsed.activeFault.message === "string" &&
        typeof parsed.activeFault.sinceMs === "number" &&
        typeof parsed.activeFault.lastAlertMs === "number" &&
        typeof parsed.activeFault.escalated === "boolean"
          ? {
              kind: parsed.activeFault.kind as FaultKind,
              message: parsed.activeFault.message,
              sinceMs: parsed.activeFault.sinceMs,
              lastAlertMs: parsed.activeFault.lastAlertMs,
              escalated: parsed.activeFault.escalated,
            }
          : null,
    };
  } catch (error) {
    console.error(
      `[state] Failed to read ${STATE_FILE_PATH}, resetting watcher state: ${describeError(error)}`,
    );
    await saveState(DEFAULT_STATE);
    return cloneState(DEFAULT_STATE);
  }
}

export async function saveState(state: WatcherState): Promise<void> {
  await mkdir(dirname(STATE_FILE_PATH), { recursive: true });
  await writeFile(STATE_FILE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
