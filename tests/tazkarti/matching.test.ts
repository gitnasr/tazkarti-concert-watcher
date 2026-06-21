import assert from "node:assert/strict";
import test from "node:test";
import { RELEASE_MATCH_THRESHOLD } from "../../src/tazkarti/constants.js";
import { selectBestMatch } from "../../src/tazkarti/matching.js";
import { scoreCandidate } from "../../src/tazkarti/matching.js";
import type { EventRecord } from "../../src/tazkarti/types.js";

test("prefers description matches over stronger title-only matches", () => {
  const events: EventRecord[] = [
    {
      id: 1,
      name: "Summer Night Live",
      description: "An unforgettable Amr Diab concert in Cairo",
      shows: [],
    },
    {
      id: 2,
      name: "Amr Diab Festival",
      description: "Season finale celebration",
      shows: [],
    },
  ];

  const match = selectBestMatch("amr diab cairo concert", events);

  assert.ok(match);
  assert.equal(match.event.id, 1);
});

test("still matches by title when description is missing", () => {
  const events: EventRecord[] = [
    {
      id: 1,
      name: "Amr Diab Live",
      shows: [],
    },
    {
      id: 2,
      name: "Summer Night",
      description: "Open-air party",
      shows: [],
    },
  ];

  const match = selectBestMatch("amr diab", events);

  assert.ok(match);
  assert.equal(match.event.id, 1);
});

test("uses the title score directly when the title already matches at least 90%", () => {
  const events: EventRecord[] = [
    {
      id: 1,
      name: "Amr Diab Live",
      description: "Season finale celebration",
      shows: [],
    },
  ];

  const match = selectBestMatch("amr diab", events);
  const titleScore = scoreCandidate("amr diab", "Amr Diab Live");

  assert.ok(match);
  assert.equal(match.score, titleScore);
  assert.ok(match.score >= RELEASE_MATCH_THRESHOLD);
});

test("falls back to the description score when the title match is below 90%", () => {
  const events: EventRecord[] = [
    {
      id: 1,
      name: "Amr Diab Festival",
      description: "Season finale celebration",
      shows: [],
    },
  ];

  const match = selectBestMatch("amr diab cairo concert", events);
  const titleScore = scoreCandidate("amr diab cairo concert", "Amr Diab Festival");
  const descriptionScore = scoreCandidate(
    "amr diab cairo concert",
    "Season finale celebration",
  );

  assert.ok(match);
  assert.ok(titleScore < 0.9);
  assert.equal(match.score, descriptionScore);
});

test("treats empty descriptions as optional metadata instead of a failure case", () => {
  const events: EventRecord[] = [
    {
      id: 1,
      name: "Amr Diab Night",
      description: "",
      shows: [],
    },
  ];

  const match = selectBestMatch("amr diab night", events);

  assert.ok(match);
  assert.equal(match.event.id, 1);
});
