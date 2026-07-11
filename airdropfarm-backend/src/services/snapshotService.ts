import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { getAllTokenHoldersByMint } from "../lib/solana.js";

const BPS = 10000n;

type Merged = {
  owner: string;
  inTokenA: boolean;
  inTokenB: boolean;
  tokenARaw: bigint;
  tokenBRaw: bigint;
  baseLamports: bigint;
  bonusLamports: bigint;
  finalLamports: bigint;
  bonusApplied: boolean;
};

function divBps(amount: bigint, bps: number) {
  return (amount * BigInt(bps)) / BPS;
}

function calcReservedFeeLamports(estimatedRecipients: number) {
  const txCount = Math.ceil(estimatedRecipients / config.maxInstructionsPerTx);
  return BigInt(txCount) * config.estTxFeeLamports;
}

function buildMergedDistribution(
  tokenA: { owner: string; rawAmount: bigint; mint: string }[],
  tokenB: { owner: string; rawAmount: bigint; mint: string }[],
  grossRewardLamports: bigint
) {
  const excluded = new Set(config.excludedWallets);

  const map = new Map<
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
    if (excluded.has(row.owner) || row.rawAmount < config.minHolderAmountRaw) continue;

    const current = map.get(row.owner) ?? {
      owner: row.owner,
      tokenARaw: 0n,
      tokenBRaw: 0n,
      inTokenA: false,
      inTokenB: false
    };

    current.tokenARaw += row.rawAmount;
    current.inTokenA = true;
    map.set(row.owner, current);
  }

  for (const row of tokenB) {
    if (excluded.has(row.owner) || row.rawAmount < config.minHolderAmountRaw) continue;

    const current = map.get(row.owner) ?? {
      owner: row.owner,
      tokenARaw: 0n,
      tokenBRaw: 0n,
      inTokenA: false,
      inTokenB: false
    };

    current.tokenBRaw += row.rawAmount;
    current.inTokenB = true;
    map.set(row.owner, current);
  }

  const all = [...map.values()];
  const estimatedRecipients = all.length;

  const reservedFeeLamports = calcReservedFeeLamports(estimatedRecipients);
  const reservedSafetyLamports = divBps(grossRewardLamports, config.safetyBufferBps);

  const distributableGross = grossRewardLamports - reservedFeeLamports - reservedSafetyLamports;
  if (distributableGross <= 0n) {
    throw new Error("Reward too small after reserves.");
  }

  const buybackLamports = divBps(distributableGross, config.buybackBps);
  const tokenBPoolLamports = divBps(distributableGross, config.tokenBPoolBps);
  const tokenAPoolLamports = distributableGross - buybackLamports - tokenBPoolLamports;

  const totalA = all.reduce((s, x) => s + x.tokenARaw, 0n);
  const totalB = all.reduce((s, x) => s + x.tokenBRaw, 0n);

  const merged: Merged[] = all
    .map((row) => {
      let baseA = 0n;
      let baseB = 0n;

      if (row.inTokenA && totalA > 0n) {
        baseA = (tokenAPoolLamports * row.tokenARaw) / totalA;
      }

      if (row.inTokenB && totalB > 0n) {
        baseB = (tokenBPoolLamports * row.tokenBRaw) / totalB;
      }

      const baseLamports = baseA + baseB;
      const bonusApplied = row.inTokenA && row.inTokenB;
      const bonusLamports = bonusApplied
        ? (baseLamports * BigInt(config.dualHolderBonusBps)) / BPS
        : 0n;

      const finalLamports = baseLamports + bonusLamports;

      return {
        owner: row.owner,
        inTokenA: row.inTokenA,
        inTokenB: row.inTokenB,
        tokenARaw: row.tokenARaw,
        tokenBRaw: row.tokenBRaw,
        baseLamports,
        bonusLamports,
        finalLamports,
        bonusApplied
      };
    })
    .filter((x) => x.finalLamports > 0n);

  const totalFinalLamports = merged.reduce((s, x) => s + x.finalLamports, 0n);
  const requiredTotal =
    reservedFeeLamports +
    reservedSafetyLamports +
    buybackLamports +
    totalFinalLamports;

  if (requiredTotal > grossRewardLamports) {
    const overflow = requiredTotal - grossRewardLamports;
    throw new Error(
      `Insufficient reward balance for bonus+reserves. Missing ${overflow.toString()} lamports.`
    );
  }

  return {
    reservedFeeLamports,
    reservedSafetyLamports,
    buybackLamports,
    tokenAPoolLamports,
    tokenBPoolLamports,
    holders: merged
  };
}

export async function createSnapshot(
  grossRewardLamports: bigint,
  sourceRewardTx?: string
) {
  const [holdersA, holdersB] = await Promise.all([
    getAllTokenHoldersByMint(config.tokenAMint),
    getAllTokenHoldersByMint(config.tokenBMint)
  ]);

  const result = buildMergedDistribution(
    holdersA,
    holdersB,
    grossRewardLamports
  );

  const snapshot = await prisma.snapshot.create({
    data: {
      sourceRewardTx,
      grossRewardLamports,
      reservedFeeLamports: result.reservedFeeLamports,
      reservedSafetyLamports: result.reservedSafetyLamports,
      buybackLamports: result.buybackLamports,
      tokenAPoolLamports: result.tokenAPoolLamports,
      tokenBPoolLamports: result.tokenBPoolLamports,
      tokenAMint: config.tokenAMint,
      tokenBMint: config.tokenBMint,
      holders: {
        create: result.holders.map((h) => ({
          owner: h.owner,
          inTokenA: h.inTokenA,
          inTokenB: h.inTokenB,
          tokenARaw: h.tokenARaw.toString(),
          tokenBRaw: h.tokenBRaw.toString(),
          baseLamports: h.baseLamports,
          bonusLamports: h.bonusLamports,
          finalLamports: h.finalLamports,
          bonusApplied: h.bonusApplied
        }))
      }
    },
    include: { holders: true }
  });

  return snapshot;
}