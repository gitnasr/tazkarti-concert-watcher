import "dotenv/config";
import { buildRuntimeState, loadConfigFromEnv, logStartupSummary, requestStop, waitFor } from "./tazkarti/runtime.js";
import { ensureStateFile, loadState } from "./tazkarti/state.js";
import { describeError } from "./tazkarti/utils.js";
import { runPollCycle } from "./tazkarti/watcher.js";

async function main(): Promise<void> {
  await ensureStateFile();
  const runtime = buildRuntimeState();

  try {
    const config = loadConfigFromEnv();
    const stateRef = { current: await loadState() };
    const context = { config, runtime, stateRef };
    logStartupSummary(config);

    process.on("SIGINT", () => {
      requestStop(runtime, "SIGINT received");
    });

    process.on("SIGTERM", () => {
      requestStop(runtime, "SIGTERM received");
    });

    while (!runtime.stopped) {
      await runPollCycle(context);

      if (runtime.stopped) {
        break;
      }

      await waitFor(runtime, config.pollIntervalMs);
    }
  } finally {
    requestStop(runtime, "watcher shutdown");
  }
}

void main().catch((error) => {
  console.error(`[fatal] ${describeError(error)}`);
  process.exitCode = 1;
});
