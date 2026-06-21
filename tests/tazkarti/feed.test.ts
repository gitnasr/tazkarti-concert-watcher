import assert from "node:assert/strict";
import test from "node:test";
import { fetchEvents } from "../../src/tazkarti/feed.js";
import type { RuntimeState } from "../../src/tazkarti/types.js";

function createRuntimeState(): RuntimeState {
  return {
    stopped: false,
    pollCount: 0,
    activeFetchController: null,
    lastMatch: null,
    lastPollStartedAt: null,
    lastSuccessfulPollAt: null,
    sleepTimer: null,
    sleepResolve: null,
  };
}

test("maps feed summary into the event description used by matcher fallback", async () => {
  const originalFetch = globalThis.fetch;
  const runtime = createRuntimeState();

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          id: 1875,
          name: "EL Hekaya",
          summary:
            "<p>Celebrating the enduring legacy of Amr Diab in a live concert experience.</p>",
          shows: [],
        },
      ]),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )) as typeof fetch;

  try {
    const events = await fetchEvents(runtime, 1_000);

    assert.equal(events.length, 1);
    assert.equal(
      events[0]?.description,
      "<p>Celebrating the enduring legacy of Amr Diab in a live concert experience.</p>",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
