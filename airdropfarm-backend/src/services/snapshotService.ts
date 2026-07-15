import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { getAllTokenHoldersByMint } from "../lib/solana.js";

const BPS = 10_000n;

type MergedDistribution = {
  owner: string;
  inTokenA: boolean;
  inTokenB: boolean;
  tokenARaw: bigint;
  tokenBRaw: bigint;
  basePayoutRaw: bigint;
  bonusPayoutRaw: bigint;
  finalPayoutRaw: bigint;
  bonusApplied: boolean;
};

function divBps(amount: bigint, bps: number) {
  return (amount * BigInt(bps)) / BPS;
}

function buildMergedDistribution(
  tokenA: { owner: string; rawAmount: bigint; mint: string }[],
  tokenB: { owner: string; rawAmount: bigint; mint: string }[],
  grossRewardPayoutRaw: bigint
) {
  const excluded = new Set(config.excludedWallets);

  const holders = new Map<
    string,
    {
      owner: string;
      tokenARaw: bigint;
      tokenBRaw: bigint;
      inTokenA: boolean;
      inTokenB: boolean;
    }
  >();

  for (const row of tokenA) {
    if (
      excluded.has(row.owner) ||
      row.rawAmount < config.minHolderAmountRaw
    ) {
      continue;
    }

    const current = holders.get(row.owner) ?? {
      owner: row.owner,
      tokenARaw: 0n,
      tokenBRaw: 0n,
      inTokenA: false,
      inTokenB: false
    };

    current.tokenARaw += row.rawAmount;
    current.inTokenA = true;

    holders.set(row.owner, current);
  }

  for (const row of tokenB) {
    if (
      excluded.has(row.owner) ||
      row.rawAmount < config.minHolderAmountRaw
    ) {
      continue;
    }

    const current = holders.get(row.owner) ?? {
      owner: row.owner,
      tokenARaw: 0n,
      tokenBRaw: 0n,
      inTokenA: false,
      inTokenB: false
    };

    current.tokenBRaw += row.rawAmount;
    current.inTokenB = true;

    holders.set(row.owner, current);
  }

  const all = [...holders.values()];

  if (all.length === 0) {
    throw new Error("No eligible holders found.");
  }

  const reservedSafetyPayoutRaw = divBps(
    grossRewardPayoutRaw,
    config.safetyBufferBps
  );

  const distributableAfterSafetyRaw =
    grossRewardPayoutRaw - reservedSafetyPayoutRaw;

  if (distributableAfterSafetyRaw <= 0n) {
    throw new Error("Reward is too small after the safety reserve.");
  }

  const buybackPayoutRaw = divBps(
    distributableAfterSafetyRaw,
    config.buybackBps
  );

  const holderPoolPayoutRaw =
    distributableAfterSafetyRaw - buybackPayoutRaw;

  if (holderPoolPayoutRaw <= 0n) {
    throw new Error("Reward is too small after safety reserve and buyback.");
  }

  const DUAL_MULTIPLIER_NUM = 2n;
  const DUAL_MULTIPLIER_DEN = 1n;

  const scored = all.map((row) => {
    const rawScore = row.tokenARaw + row.tokenBRaw;
    const bonusApplied = row.inTokenA && row.inTokenB;

    const weightedScore = bonusApplied
      ? (rawScore * DUAL_MULTIPLIER_NUM) / DUAL_MULTIPLIER_DEN
      : rawScore;

    const bonusPayoutRaw = 0n;

    return {
      owner: row.owner,
      inTokenA: row.inTokenA,
      inTokenB: row.inTokenB,
      tokenARaw: row.tokenARaw,
      tokenBRaw: row.tokenBRaw,
      rawScore,
      weightedScore,
      bonusApplied,
      bonusPayoutRaw
    };
  });

  const totalWeightedScore = scored.reduce(
    (sum, row) => sum + row.weightedScore,
    0n
  );

  if (totalWeightedScore <= 0n) {
    throw new Error("Total weighted score is zero.");
  }

  const merged: MergedDistribution[] = scored
    .map((row) => {
      const finalPayoutRaw =
        (holderPoolPayoutRaw * row.weightedScore) / totalWeightedScore;

      const basePayoutRaw = finalPayoutRaw;

      return {
        owner: row.owner,
        inTokenA: row.inTokenA,
        inTokenB: row.inTokenB,
        tokenARaw: row.tokenARaw,
        tokenBRaw: row.tokenBRaw,
        basePayoutRaw,
        bonusPayoutRaw: row.bonusPayoutRaw,
        finalPayoutRaw,
        bonusApplied: row.bonusApplied
      };
    })
    .filter((row) => row.finalPayoutRaw > 0n);

  const totalHolderPayoutRaw = merged.reduce(
    (sum, item) => sum + item.finalPayoutRaw,
    0n
  );

  const totalRequired =
    reservedSafetyPayoutRaw +
    buybackPayoutRaw +
    totalHolderPayoutRaw;

  if (totalRequired > grossRewardPayoutRaw) {
    throw new Error(
      `Reward cannot cover holder payouts and reserves. ` +
        `Missing ${(totalRequired - grossRewardPayoutRaw).toString()} raw units.`
    );
  }

  return {
    reservedSafetyPayoutRaw,
    buybackPayoutRaw,
    tokenAPoolPayoutRaw: 0n,
    tokenBPoolPayoutRaw: holderPoolPayoutRaw,
    holders: merged
  };
}

export async function createSnapshot(
  grossRewardPayoutRaw: bigint,
  sourceRewardTx?: string
) {
  const [holdersA, holdersB] = await Promise.all([
    getAllTokenHoldersByMint(config.tokenAMint),
    getAllTokenHoldersByMint(config.tokenBMint)
  ]);

  const result = buildMergedDistribution(
    holdersA,
    holdersB,
    grossRewardPayoutRaw
  );

  return prisma.snapshot.create({
    data: {
      sourceRewardTx,
      grossRewardPayoutRaw,

      payoutMint: config.payoutMint,
      payoutSymbol: config.payoutSymbol,

      reservedSafetyPayoutRaw: result.reservedSafetyPayoutRaw,
      buybackPayoutRaw: result.buybackPayoutRaw,
      tokenAPoolPayoutRaw: result.tokenAPoolPayoutRaw,
      tokenBPoolPayoutRaw: result.tokenBPoolPayoutRaw,

      tokenAMint: config.tokenAMint,
      tokenBMint: config.tokenBMint,

      holders: {
        create: result.holders.map((holder) => ({
          owner: holder.owner,
          inTokenA: holder.inTokenA,
          inTokenB: holder.inTokenB,
          tokenARaw: holder.tokenARaw,
          tokenBRaw: holder.tokenBRaw,
          basePayoutRaw: holder.basePayoutRaw,
          bonusPayoutRaw: holder.bonusPayoutRaw,
          finalPayoutRaw: holder.finalPayoutRaw,
          bonusApplied: holder.bonusApplied
        }))
      }
    },
    include: {
      holders: true
    }
  });
}