import { NTFY_TIMEOUT_MS } from "./constants.js";
import { HttpStatusError } from "./errors.js";
import { fetchWithTimeout } from "./http.js";
import type { NotificationInput, WatcherConfig } from "./types.js";

export function resolveNtfyEndpoint(input: string): string {
  const trimmed = input.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://ntfy.sh/${encodeURIComponent(trimmed)}`;
}

export async function sendNtfyNotification(
  config: WatcherConfig,
  notification: NotificationInput,
): Promise<void> {
  const headers = new Headers({
    Title: notification.title,
    Priority: notification.priority,
    Tags: notification.tags.join(","),
    "Content-Type": "text/plain; charset=utf-8",
  });

  if (config.ntfyToken?.trim()) {
    headers.set("Authorization", `Bearer ${config.ntfyToken.trim()}`);
  }

  const response = await fetchWithTimeout(
    fetch,
    config.ntfyEndpoint,
    {
      method: "POST",
      headers,
      body: notification.message,
    },
    NTFY_TIMEOUT_MS,
    `ntfy notification request timed out after ${NTFY_TIMEOUT_MS / 1_000}s.`,
  );

  if (!response.ok) {
    throw new HttpStatusError(response.status, response.statusText);
  }
}
