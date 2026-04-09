export function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function formatDate(value?: string): string {
  return value?.trim() ? value : "unknown date";
}

export function formatPrice(value?: number): string {
  return typeof value === "number" ? `${value} EGP` : "price unavailable";
}
