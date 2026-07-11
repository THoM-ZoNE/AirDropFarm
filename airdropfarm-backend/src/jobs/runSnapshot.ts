import { createSnapshot } from "../services/snapshotService.js";

const rewardLamports = BigInt(process.argv[2] || "1000000000");
const rewardTx = process.argv[3];

const snapshot = await createSnapshot(rewardLamports, rewardTx);

console.log(
  JSON.stringify(
    {
      snapshotId: snapshot.id,
      holders: snapshot.holders.length,
      buybackLamports: snapshot.buybackLamports.toString(),
      tokenAPoolLamports: snapshot.tokenAPoolLamports.toString(),
      tokenBPoolLamports: snapshot.tokenBPoolLamports.toString()
    },
    null,
    2
  )
);