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
import cors from "cors";

const app = express();

app.use(express.json());

app.use(cors({
  origin: "*" // devneten elfogadható; élesben szűkítsd le saját domainre
}));
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
  let totalPayoutRaw = 0n;

  for (const row of sent) {
    ownerSet.add(row.owner);
    totalPayoutRaw += row.payoutRawSent;
  }

  const holders = ownerSet.size;
  const rounds = await prisma.snapshot.count();

  res.json({
    totalHolders: holders,
    totalPayoutDistributedRaw: totalPayoutRaw.toString(),
    totalRounds: rounds,
    avgPayoutRawPerHolder:
      holders === 0 ? "0" : (totalPayoutRaw / BigInt(holders)).toString()
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
        id: reward.id,
        createdAt: reward.createdAt,
        source: reward.source,
        sourceTx: reward.sourceTx,
        grossPayoutRaw: reward.grossPayoutRaw.toString(),
        payoutMint: reward.payoutMint,
        status: reward.status,
        snapshotId: reward.snapshotId,
        distributedAt: reward.distributedAt,
        notes: reward.notes
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