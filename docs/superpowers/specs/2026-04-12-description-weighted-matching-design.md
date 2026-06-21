# Description-Weighted Event Matching

## Goal

Update the Tazkarti watcher so event matching checks both the event title and the event description, with the description contributing more strongly to the final match score.

## Current State

- `selectBestMatch()` in `src/tazkarti/matching.ts` only scores `event.name`.
- `EventRecord` in `src/tazkarti/types.ts` does not include a description field.
- The feed sanitizer in `src/tazkarti/feed.ts` currently parses name, dates, price, venue, and shows, but not description.

## Proposed Change

1. Extend the feed model to carry an optional `description?: string`.
2. Parse `description` from the Tazkarti feed when it is present and a string.
3. Keep the existing low-level string scorer as the primitive matcher.
4. Add a field-aware event scorer that calculates:
   - `titleScore = scoreCandidate(query, event.name)`
   - `descriptionScore = scoreCandidate(query, event.description ?? "")`
5. Blend the two scores with description weighted more heavily than title.

Recommended initial weighting:

- `descriptionScore`: `0.65`
- `titleScore`: `0.35`

## Why This Approach

- It directly supports the requested behavior instead of relying on title-only matching.
- It keeps the existing matching algorithm intact, which lowers risk.
- It gives explicit control over the stronger description influence.
- It behaves predictably when descriptions are missing because the title still contributes.

## Alternatives Considered

### Concatenate Title And Description

Combine title and description into one string and run the existing scorer once.

Why not chosen:

- Long descriptions can distort the score in hard-to-predict ways.
- It removes clear control over how much each field matters.

### Best Field Wins

Score title and description separately, then take the larger value.

Why not chosen:

- It can overreact to weak accidental matches in one field.
- It does not reflect the requested “description is stronger” rule as clearly as weighted blending.

## Error Handling

- Missing descriptions should be treated as empty strings.
- Non-string description values from the feed should be ignored rather than causing payload validation failure.

## Testing Plan

Add automated tests covering:

1. An event whose title is weak but description matches strongly should outrank title-only candidates.
2. An event with no description should still be matchable by title.
3. Events with descriptions present should not throw or degrade behavior when the description is empty.

## Scope

This change is limited to feed parsing, event typing, match scoring, and related tests. It does not change alerting, state persistence, or notification formatting.
