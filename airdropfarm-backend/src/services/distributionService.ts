import { prisma } from "../lib/prisma.js";
import { sendSolBatch } from "../lib/solana.js";
import { config } from "../lib/config.js";

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function distributeSnapshot(snapshotId: string) {
  const snapshot = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
    include: { holders: true }
  });

  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  const groups = chunk(snapshot.holders, config.maxInstructionsPerTx);
  const results = [];

  for (const group of groups) {
    try {
      const tx = await sendSolBatch(
        group.map((h) => ({
          owner: h.owner,
          lamports: h.finalLamports
        }))
      );

      for (const h of group) {
        await prisma.distribution.create({
          data: {
            snapshotId: snapshot.id,
            owner: h.owner,
            lamportsSent: h.finalLamports,
            txSignature: tx.signature,
            status: "sent"
          }
        });
      }

      results.push({
        txSignature: tx.signature,
        count: group.length
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown distribution error";

      for (const h of group) {
        await prisma.distribution.create({
          data: {
            snapshotId: snapshot.id,
            owner: h.owner,
            lamportsSent: h.finalLamports,
            status: "failed",
            errorMessage: message
          }
        });
      }

      results.push({
        error: message,
        count: group.length
      });
    }
  }

  return results;
}