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
console.log("cronEnabled:", config.cronEnabled);
console.log("cronSnapshot:", config.cronSnapshot);
console.log("cronDistribute:", config.cronDistribute);

if (config.cronEnabled) {
  cron.schedule(config.cronSnapshot, async () => {
    console.log("Snapshot cron tick.");
    try {
      console.log("Starting snapshot job...");
      // ide a snapshot hívás
      console.log("Snapshot job finished.");
    } catch (error) {
      console.error("Snapshot job failed:", error);
    }
  });

  cron.schedule(config.cronDistribute, async () => {
    console.log("Distribution cron tick.");
    try {
      console.log("Starting distribution job...");
      const result = await processPendingRewardEvent();
      console.log("Distribution result:", result);
      console.log("Distribution job finished.");
    } catch (error) {
      console.error("Distribution job failed:", error);
    }
  });
}