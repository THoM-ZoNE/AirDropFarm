import { distributeSnapshot } from "../services/distributionService.js";
import { processPendingRewardEvent } from "../services/rewardService.js";

const snapshotId = process.argv[2];

if (!snapshotId) {
  throw new Error("Usage: npm run distribute -- SNAPSHOT_ID");
}

const result = await distributeSnapshot(snapshotId);
console.log("[runDistribution] started");

try {
  const result = await processPendingRewardEvent();
  console.log("[runDistribution] result", result);
  console.log("[runDistribution] finished");
} catch (error) {
  console.error("[runDistribution] failed", error);
  process.exit(1);
}