import type {
  EventRecord,
  MatchResult,
  ReleaseDecision,
  WatcherState,
} from "./types.js";

const TITLE_CONFIDENCE_THRESHOLD = 0.9;

export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeNormalized(value: string): string[] {
  if (!value) {
    return [];
  }

  return value.split(" ").filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;

    for (let column = 1; column <= b.length; column += 1) {
      const temp = previous[column];
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;

      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + cost,
      );

      diagonal = temp;
    }
  }

  return previous[b.length];
}

function stringSimilarity(a: string, b: string): number {
  if (!a && !b) {
    return 1;
  }

  if (!a || !b) {
    return 0;
  }

  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function tokenOverlapScore(query: string, candidate: string): number {
  const queryTokens = tokenizeNormalized(query);
  const candidateTokens = tokenizeNormalized(candidate);

  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const exactMatches = queryTokens.filter((token) =>
    candidateTokens.includes(token),
  ).length;

  return exactMatches / queryTokens.length;
}

function fuzzyTokenCoverage(query: string, candidate: string): number {
  const queryTokens = tokenizeNormalized(query);
  const candidateTokens = tokenizeNormalized(candidate);

  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  let total = 0;

  for (const queryToken of queryTokens) {
    let best = 0;

    for (const candidateToken of candidateTokens) {
      best = Math.max(best, stringSimilarity(queryToken, candidateToken));
    }

    total += best;
  }

  return total / queryTokens.length;
}

function containmentScore(query: string, candidate: string): number {
  if (!query || !candidate) {
    return 0;
  }

  if (query === candidate) {
    return 1;
  }

  if (candidate.includes(query) || query.includes(candidate)) {
    const ratio =
      Math.min(query.length, candidate.length) /
      Math.max(query.length, candidate.length);
    return 0.85 + ratio * 0.15;
  }

  return 0;
}

export function scoreCandidate(queryValue: string, candidateValue: string): number {
  const query = normalizeName(queryValue);
  const candidate = normalizeName(candidateValue);

  if (!query || !candidate) {
    return 0;
  }

  const contains = containmentScore(query, candidate);
  const wholeStringSimilarity = stringSimilarity(query, candidate);
  const exactOverlap = tokenOverlapScore(query, candidate);
  const fuzzyOverlap = fuzzyTokenCoverage(query, candidate);

  const blended =
    wholeStringSimilarity * 0.18 +
    exactOverlap * 0.16 +
    fuzzyOverlap * 0.46 +
    Math.max(exactOverlap, fuzzyOverlap) * 0.2;

  return Math.max(contains, Math.min(1, blended));
}

function scoreEvent(query: string, event: EventRecord): number {
  const titleScore = scoreCandidate(query, event.name);

  if (titleScore >= TITLE_CONFIDENCE_THRESHOLD) {
    return titleScore;
  }

  return scoreCandidate(query, event.description ?? "");
}

export function selectBestMatch(
  query: string,
  events: EventRecord[],
): MatchResult | null {
  let best: MatchResult | null = null;

  for (const event of events) {
    const score = scoreEvent(query, event);

    if (!best || score > best.score) {
      best = {
        event,
        score,
        matchedShowIds: (event.shows ?? []).map((show) => show.id),
      };
    }
  }

  return best;
}

export function detectNewRelease(
  match: MatchResult,
  state: WatcherState,
): ReleaseDecision {
  const newEventIds = state.alertedEventIds.includes(match.event.id)
    ? []
    : [match.event.id];
  const newShowIds = match.matchedShowIds.filter(
    (showId) => !state.alertedShowIds.includes(showId),
  );

  return {
    shouldAlert: newEventIds.length > 0 || newShowIds.length > 0,
    newEventIds,
    newShowIds,
  };
}
