import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { createSnapshot } from "./snapshotService.js";
import { distributeSnapshot } from "./distributionService.js";

export async function registerRewardEvent(input: {
  source: string;
  grossLamports: bigint;
  sourceTx?: string;
  notes?: string;
}) {
  if (input.grossLamports < config.minRewardLamports) {
    throw new Error("Reward too small.");
  }

  return prisma.rewardEvent.create({
    data: {
      source: input.source,
      sourceTx: input.sourceTx,
      grossLamports: input.grossLamports,
      status: "pending",
      notes: input.notes
    }
  });
}

export async function processPendingRewardEvent() {
  const reward = await prisma.rewardEvent.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" }
  });

  if (!reward) {
    return { ok: true, message: "No pending reward event." };
  }

  const snapshot = await createSnapshot(reward.grossLamports, reward.sourceTx ?? undefined);

  await prisma.rewardEvent.update({
    where: { id: reward.id },
    data: {
      status: config.autoDistribute ? "snapshot_created" : "awaiting_distribution",
      snapshotId: snapshot.id
    }
  });

  if (config.autoDistribute) {
    await distributeSnapshot(snapshot.id);

    await prisma.rewardEvent.update({
      where: { id: reward.id },
      data: {
        status: "distributed",
        distributedAt: new Date()
      }
    });
  }

  return {
    ok: true,
    rewardEventId: reward.id,
    snapshotId: snapshot.id
  };
}