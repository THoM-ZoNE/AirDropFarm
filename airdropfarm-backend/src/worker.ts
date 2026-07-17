import cron from "node-cron";
import { config } from "./lib/config.js";
import { processPendingRewardEvent } from "./services/rewardService.js";
import { claimAndRegisterRewardIfAny } from "./services/claimOrchestrator.js";
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

console.log("claimEnabled:", config.claimEnabled);
console.log("claimCron:", config.claimCron);
console.log("cronEnabled:", config.cronEnabled);
console.log("cronSnapshot:", config.cronSnapshot);
console.log("cronDistribute:", config.cronDistribute);

if (config.claimEnabled) {
  cron.schedule(config.claimCron, async () => {
    console.log("[claim-job] tick", new Date().toISOString());

    await runLockedJob("claim-job", async () => {
      console.log("[claim-job] Starting...");
      const result = await claimAndRegisterRewardIfAny();
      console.log("[claim-job] Result:", result);
      console.log("[claim-job] Finished.");
    });
  });

  console.log("[claim-job] Cron registered.");
} else {
  console.log("[claim-job] Disabled.");
}

if (config.cronEnabled) {
  cron.schedule(config.cronSnapshot, async () => {
    console.log("[snapshot-job] tick", new Date().toISOString());

    await runLockedJob("snapshot-job", async () => {
      console.log("[snapshot-job] Starting...");
      const result = await processPendingRewardEvent();
      console.log("[snapshot-job] Result:", result);
      console.log("[snapshot-job] Finished.");
    });
  });

  console.log("[snapshot-job] Cron registered.");
  console.log("Cron worker started.");
} else {
  console.log("Cron disabled.");
}