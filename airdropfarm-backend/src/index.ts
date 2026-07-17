import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import { config } from "./lib/config.js";
import { requireAdmin } from "./lib/adminAuth.js";
import { createSnapshot } from "./services/snapshotService.js";
import { distributeSnapshot } from "./services/distributionService.js";
import { CronExpressionParser } from "cron-parser";
import {
  registerRewardEvent,
  processPendingRewardEvent
} from "./services/rewardService.js";

const app = express();

// Middleware — only once, in the correct order
app.use(cors({
  origin: "*" // on the devnet is allowed; in production, restrict to your domain
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

  const decimals = 6;
  const totalUsdc = Number(totalPayoutRaw) / 10 ** decimals;
  const avgUsdc = holders === 0 ? 0 : totalUsdc / holders;

  const now = new Date();
  let nextSnapshotAt: number | null = null;
  let nextDistributionAt: number | null = null;

  try {
    const snap = CronExpressionParser.parse(config.cronSnapshot, {
      currentDate: now
    });
    nextSnapshotAt = snap.next().toDate().getTime();
  } catch {}

  try {
    const dist = CronExpressionParser.parse(config.cronDistribute, {
      currentDate: now
    });
    nextDistributionAt = dist.next().toDate().getTime();
  } catch {}

  res.json({
    totalHolders: holders,
    totalRounds: rounds,
    totalUsdcDistributed: totalUsdc,
    avgUsdcPerHolder: avgUsdc,
    totalPayoutDistributedRaw: totalPayoutRaw.toString(),
    avgPayoutRawPerHolder:
      holders === 0 ? "0" : (totalPayoutRaw / BigInt(holders)).toString(),
    serverTime: now.getTime(),
    nextSnapshotAt,
    nextDistributionAt,
    snapshotCron: config.cronSnapshot,
    distributionCron: config.cronDistribute
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