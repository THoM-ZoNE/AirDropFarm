import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { createSnapshot } from "./snapshotService.js";
import { distributeSnapshot } from "./distributionService.js";

export async function registerRewardEvent(input: {
  source: string;
  grossPayoutRaw: bigint;
  sourceTx?: string;
  notes?: string;
}) {
  if (input.grossPayoutRaw < config.minRewardPayoutRaw) {
    throw new Error(
      `Reward is below MIN_REWARD_PAYOUT_RAW for ${config.payoutSymbol}.`
    );
  }

  return prisma.rewardEvent.create({
    data: {
      source: input.source,
      sourceTx: input.sourceTx,
      grossPayoutRaw: input.grossPayoutRaw,
      payoutMint: config.payoutMint,
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
    return {
      ok: true,
      message: "No pending reward event."
    };
  }

  if (reward.payoutMint !== config.payoutMint) {
    throw new Error(
      `Reward payout mint (${reward.payoutMint}) does not match PAYOUT_MINT.`
    );
  }

  const snapshot = await createSnapshot(
    reward.grossPayoutRaw,
    reward.sourceTx ?? undefined
  );

  await prisma.rewardEvent.update({
    where: { id: reward.id },
    data: {
      status: config.autoDistribute
        ? "snapshot_created"
        : "awaiting_distribution",
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