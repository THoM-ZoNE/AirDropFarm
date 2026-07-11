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
    const rewardLamports = BigInt(req.body.rewardLamports);
    const sourceRewardTx = req.body.sourceRewardTx as string | undefined;

    const snapshot = await createSnapshot(rewardLamports, sourceRewardTx);

    res.json({
      snapshotId: snapshot.id,
      holders: snapshot.holders.length,
      buybackLamports: snapshot.buybackLamports.toString(),
      tokenAPoolLamports: snapshot.tokenAPoolLamports.toString(),
      tokenBPoolLamports: snapshot.tokenBPoolLamports.toString(),
      reservedFeeLamports: snapshot.reservedFeeLamports.toString(),
      reservedSafetyLamports: snapshot.reservedSafetyLamports.toString()
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

  for (const row of sent as Array<{ owner: string; lamportsSent: bigint | string | number }>) {
    ownerSet.add(row.owner);
    totalLamports += BigInt(row.lamportsSent);
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
      grossLamports: BigInt(req.body.grossLamports),
      sourceTx: req.body.sourceTx,
      notes: req.body.notes
    });

    res.json({
      ok: true,
      reward: {
        ...reward,
        grossLamports: reward.grossLamports.toString()
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