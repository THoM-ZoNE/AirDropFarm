import { createSnapshot } from "../services/snapshotService.js";

const rewardLamports = BigInt(process.argv[2] || "1000000000");
const rewardTx = process.argv[3];

const snapshot = await createSnapshot(rewardLamports, rewardTx);

console.log(
  JSON.stringify(
    {
      snapshotId: snapshot.id,
      holders: snapshot.holders.length,
      buybackPayoutRaw: snapshot.buybackPayoutRaw.toString(),
      tokenAPoolPayoutRaw: snapshot.tokenAPoolPayoutRaw.toString(),
      tokenBPoolPayoutRaw: snapshot.tokenBPoolPayoutRaw.toString()
    },
    null,
    2
  )
);