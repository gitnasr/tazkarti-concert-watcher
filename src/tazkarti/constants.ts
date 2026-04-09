import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FEED_URL = "https://www.tazkarti.com/data/events-list-json.json";
export const DEFAULT_POLL_INTERVAL_SECONDS = 30;
export const FETCH_TIMEOUT_MS = 15_000;
export const NTFY_TIMEOUT_MS = 10_000;
export const FAULT_ESCALATION_MS = 5 * 60 * 1_000;
export const RELEASE_MATCH_THRESHOLD = 0.57;
export const OBSERVABILITY_MATCH_THRESHOLD = 0.38;
export const SOUND_REPEAT_MS = 12_000;
export const STATE_FILE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/.local/watcher-state.json",
);
