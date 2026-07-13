import express from "express";
import { prisma } from "./lib/prisma.js";
import { config } from "./lib/config.js";
import { requireAdmin } from "./lib/adminAuth.js";
import { createSnapshot } from "./services/snapshotService.js";
import { distributeSnapshot } from "./services/distributionService.js";
import {
  registerRewardEvent,
  processPendingRewardEvent
} from "./services/rewardService.js";

const app = express();

app.use(express.json());

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.post("/snapshots", async (req, res) => {
  try {
    
    const grossRewardPayoutRaw = BigInt(req.body.grossRewardPayoutRaw);
    const sourceRewardTx = req.body.sourceRewardTx as string | undefined;
    const snapshot = await createSnapshot(
      grossRewardPayoutRaw,
      sourceRewardTx
    );

    res.json({
      snapshotId: snapshot.id,
  holders: snapshot.holders.length,
  buybackPayoutRaw: snapshot.buybackPayoutRaw.toString(),
  tokenAPoolPayoutRaw: snapshot.tokenAPoolPayoutRaw.toString(),
  tokenBPoolPayoutRaw: snapshot.tokenBPoolPayoutRaw.toString(),
  reservedSafetyPayoutRaw: snapshot.reservedSafetyPayoutRaw.toString()
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/snapshots/:id/distribute", async (req, res) => {
  try {
    const result = await distributeSnapshot(req.params.id);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/stats", async (_req, res) => {
  const sent = await prisma.distribution.findMany({
    where: { status: "sent" }
  });

  const ownerSet = new Set<string>();
  let totalLamports = 0n;

  for (const row of sent as Array<{ owner: string; payoutRawSent: bigint | string | number }>) {
  ownerSet.add(row.owner);
  totalLamports += BigInt(row.payoutRawSent);
}

  const holders = ownerSet.size;
  const rounds = await prisma.snapshot.count();

  res.json({
    totalHolders: holders,
    totalSolDistributed: Number(totalLamports) / 1_000_000_000,
    totalRounds: rounds,
    avgSolPerHolder:
      holders === 0
        ? 0
        : Number(totalLamports) / 1_000_000_000 / holders
  });
});

app.post("/admin/rewards", requireAdmin, async (req, res) => {
  try {
    const reward = await registerRewardEvent({
      source: req.body.source ?? "manual",
      grossPayoutRaw: BigInt(req.body.grossPayoutRaw),
      sourceTx: req.body.sourceTx,
      notes: req.body.notes
    });

    res.json({
      ok: true,
      reward: {
        ...reward,
        grossPayoutRaw: reward.grossPayoutRaw.toString()
      }
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/admin/process-next", requireAdmin, async (_req, res) => {
  try {
    const result = await processPendingRewardEvent();
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.listen(config.port, () => {
  console.log(`AirDropFarm backend listening on :${config.port}`);
});