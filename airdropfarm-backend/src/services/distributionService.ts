import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { sendUsdcBatch } from "../lib/solana.js";

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups;
}

export async function distributeSnapshot(snapshotId: string) {
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
    include: { holders: true }
  });

  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  if (snapshot.payoutMint !== config.payoutMint) {
    throw new Error(
      `Snapshot payout mint (${snapshot.payoutMint}) does not match PAYOUT_MINT.`
    );
  }

  const groups = chunk(
    snapshot.holders,
    config.maxRecipientsPerTx
  );

  const results: Array<{
    type: "holders" | "buyback";
    signature?: string;
    error?: string;
    count: number;
  }> = [];

  for (const group of groups) {
    try {
      const transaction = await sendUsdcBatch(
        group.map((holder) => ({
          owner: holder.owner,
          amountRaw: holder.finalPayoutRaw
        }))
      );

      await prisma.distribution.createMany({
        data: group.map((holder) => ({
          snapshotId: snapshot.id,
          owner: holder.owner,
          recipientType: "holder",
          payoutRawSent: holder.finalPayoutRaw,
          txSignature: transaction.signature,
          status: "sent"
        }))
      });

      results.push({
        type: "holders",
        signature: transaction.signature,
        count: group.length
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown holder-distribution error";

      await prisma.distribution.createMany({
        data: group.map((holder) => ({
          snapshotId: snapshot.id,
          owner: holder.owner,
          recipientType: "holder",
          payoutRawSent: holder.finalPayoutRaw,
          status: "failed",
          errorMessage: message
        }))
      });

      results.push({
        type: "holders",
        error: message,
        count: group.length
      });
    }
  }

  if (snapshot.buybackPayoutRaw > 0n) {
    try {
      const transaction = await sendUsdcBatch([
        {
          owner: config.buybackWalletAddress,
          amountRaw: snapshot.buybackPayoutRaw
        }
      ]);

      await prisma.distribution.create({
        data: {
          snapshotId: snapshot.id,
          owner: config.buybackWalletAddress,
          recipientType: "buyback",
          payoutRawSent: snapshot.buybackPayoutRaw,
          txSignature: transaction.signature,
          status: "sent"
        }
      });

      results.push({
        type: "buyback",
        signature: transaction.signature,
        count: 1
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown buyback-distribution error";

      await prisma.distribution.create({
        data: {
          snapshotId: snapshot.id,
          owner: config.buybackWalletAddress,
          recipientType: "buyback",
          payoutRawSent: snapshot.buybackPayoutRaw,
          status: "failed",
          errorMessage: message
        }
      });

      results.push({
        type: "buyback",
        error: message,
        count: 1
      });
    }
  }

  return results;
}