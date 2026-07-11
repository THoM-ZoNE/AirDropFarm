import cron from "node-cron";
import { config } from "./lib/config.js";
import { processPendingRewardEvent } from "./services/rewardService.js";
import { acquireLock, releaseLock } from "./services/lockService.js";

async function runLockedJob(key: string, fn: () => Promise<void>) {
  const acquired = await acquireLock(key);
  if (!acquired) return;

  try {
    await fn();
  } catch (err) {
    console.error(`[${key}] failed`, err);
  } finally {
    await releaseLock(key);
  }
}

if (config.cronEnabled) {
  cron.schedule(config.cronSnapshot, async () => {
    await runLockedJob("snapshot-job", async () => {
      await processPendingRewardEvent();
    });
  });

  cron.schedule(config.cronDistribute, async () => {
    await runLockedJob("distribution-job", async () => {
      console.log("Distribution cron tick.");
    });
  });

  console.log("Cron worker started.");
} else {
  console.log("Cron disabled.");
}