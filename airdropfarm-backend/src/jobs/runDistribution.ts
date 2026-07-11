import { distributeSnapshot } from "../services/distributionService.js";

const snapshotId = process.argv[2];

if (!snapshotId) {
  throw new Error("Usage: npm run distribute -- SNAPSHOT_ID");
}

const result = await distributeSnapshot(snapshotId);
console.log(JSON.stringify(result, null, 2));