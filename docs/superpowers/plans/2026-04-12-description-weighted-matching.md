# Description-Weighted Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make event matching consider both title and description, with description weighted more strongly than title.

**Architecture:** Keep the existing string scorer in `src/tazkarti/matching.ts` as the low-level primitive, then add an event-level scorer that blends `event.name` and `event.description`. Extend the feed sanitizer and event type so description data is available to the matcher. Add a lightweight Node test runner setup using the existing `tsx` dependency so the behavior is covered by automated tests.

**Tech Stack:** TypeScript, Node.js built-in test runner, `tsx`

---

### Task 1: Add Matcher Regression Tests

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `tests/tazkarti/matching.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { selectBestMatch } from "../../src/tazkarti/matching.ts";
import type { EventRecord } from "../../src/tazkarti/types.ts";

test("prefers description matches over stronger title-only matches", () => {
  const events: EventRecord[] = [
    { id: 1, name: "Summer Night Live", description: "An unforgettable Amr Diab concert in Cairo", shows: [] },
    { id: 2, name: "Amr Diab Festival", description: "Season finale celebration", shows: [] },
  ];

  const match = selectBestMatch("amr diab cairo concert", events);

  assert.ok(match);
  assert.equal(match.event.id, 1);
});

test("still matches by title when description is missing", () => {
  const events: EventRecord[] = [
    { id: 1, name: "Amr Diab Live", shows: [] },
    { id: 2, name: "Summer Night", description: "Open-air party", shows: [] },
  ];

  const match = selectBestMatch("amr diab", events);

  assert.ok(match);
  assert.equal(match.event.id, 1);
});

test("treats empty descriptions as optional metadata instead of a failure case", () => {
  const events: EventRecord[] = [
    { id: 1, name: "Amr Diab Night", description: "", shows: [] },
  ];

  const match = selectBestMatch("amr diab night", events);

  assert.ok(match);
  assert.equal(match.event.id, 1);
});
```

- [ ] **Step 2: Run the test command to verify the new expectations fail**

Run: `node --import tsx --test tests/tazkarti/matching.test.ts`
Expected: FAIL because `EventRecord` does not yet support `description` and the matcher still only scores `event.name`

- [ ] **Step 3: Add a reusable test script and test type coverage**

```json
{
  "scripts": {
    "watch": "tsx src/watch-tazkarti.ts",
    "check": "tsc --noEmit",
    "test": "node --import tsx --test tests/**/*.test.ts"
  }
}
```

```json
{
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 4: Run the focused tests again to keep the failure signal clean**

Run: `npm test -- tests/tazkarti/matching.test.ts`
Expected: FAIL on the title-only matcher behavior, not on test runner setup

### Task 2: Implement Description-Weighted Matching

**Files:**
- Modify: `src/tazkarti/types.ts`
- Modify: `src/tazkarti/feed.ts`
- Modify: `src/tazkarti/matching.ts`
- Test: `tests/tazkarti/matching.test.ts`

- [ ] **Step 1: Extend the event type and feed sanitizer**

```ts
export type EventRecord = {
  id: number;
  name: string;
  description?: string;
  startDate?: string;
  minimumPrice?: number;
  venue?: { name?: string | null } | null;
  shows?: ShowRecord[];
};
```

```ts
return {
  id: record.id,
  name: record.name,
  description:
    typeof record.description === "string" ? record.description : undefined,
  startDate: typeof record.startDate === "string" ? record.startDate : undefined,
  minimumPrice:
    typeof record.minimumPrice === "number" ? record.minimumPrice : undefined,
  venue,
  shows: sanitizeShows(record.shows),
};
```

- [ ] **Step 2: Add an event-level scorer that weights description more heavily**

```ts
const DESCRIPTION_WEIGHT = 0.65;
const TITLE_WEIGHT = 0.35;

function scoreEvent(query: string, event: EventRecord): number {
  const titleScore = scoreCandidate(query, event.name);
  const descriptionScore = scoreCandidate(query, event.description ?? "");

  return titleScore * TITLE_WEIGHT + descriptionScore * DESCRIPTION_WEIGHT;
}
```

- [ ] **Step 3: Update best-match selection to use the blended event score**

```ts
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
```

- [ ] **Step 4: Run the focused tests to verify the implementation passes**

Run: `npm test -- tests/tazkarti/matching.test.ts`
Expected: PASS with all matcher tests green

### Task 3: Verify The Full Change

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the test command**

````md
## Test

```bash
npm test
```
````

- [ ] **Step 2: Run the complete verification commands**

Run: `npm test`
Expected: PASS

Run: `npm run check`
Expected: PASS
