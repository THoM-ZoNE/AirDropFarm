import cron from "node-cron";
import { config } from "./lib/config.js";
import { processPendingRewardEvent } from "./services/rewardService.js";
import { acquireLock, releaseLock } from "./services/lockService.js";

async function runLockedJob(key: string, fn: () => Promise<void>) {
  const acquired = await acquireLock(key);
  if (!acquired) {
    console.log(`[${key}] already running, skipping.`);
    return;
  }
  try {
    await fn();
  } catch (err) {
    console.error(`[${key}] failed`, err);
  } finally {
    await releaseLock(key);
  }
}

console.log("cronEnabled:", config.cronEnabled);
console.log("cronSnapshot:", config.cronSnapshot);
console.log("cronDistribute:", config.cronDistribute);

if (config.cronEnabled) {
  // Snapshot cron: reward eventet keres és snapshotot készít
  cron.schedule(config.cronSnapshot, async () => {
    console.log("[snapshot-job] Snapshot cron tick.", new Date().toISOString());
    await runLockedJob("snapshot-job", async () => {
      console.log("[snapshot-job] Starting...");
      const result = await processPendingRewardEvent();
      console.log("[snapshot-job] Result:", result);
      console.log("[snapshot-job] Finished.");
    });
  });

  // Distribution cron: ugyanaz a processPendingRewardEvent kezeli
  // az autoDistribute flaget, tehát nem kell külön distribution trigger
  cron.schedule(config.cronDistribute, async () => {
    console.log("[distribution-job] Distribution cron tick.", new Date().toISOString());
    await runLockedJob("distribution-job", async () => {
      console.log("[distribution-job] Starting...");
      const result = await processPendingRewardEvent();
      console.log("[distribution-job] Result:", result);
      console.log("[distribution-job] Finished.");
    });
  });

  console.log("Cron worker started.");
} else {
  console.log("Cron disabled.");
}