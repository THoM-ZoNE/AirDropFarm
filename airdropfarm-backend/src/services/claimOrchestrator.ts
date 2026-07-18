import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { claimCreatorFees } from "./claimService.js";
import { swapSolToUsdc } from "./swapService.js";
import { registerClaimedRewardEvent } from "./rewardService.js";
import { config } from "../lib/config.js";

const connection = new Connection(config.rpcUrl, "confirmed");

let claimRunning = false;
let lastClaimStartedAt = 0;

async function getSolBalanceRaw(wallet: string): Promise<bigint> {
  return BigInt(await connection.getBalance(new PublicKey(wallet), "confirmed"));
}

type ClaimResult =
  | {
      ok: true;
      dryRun: true;
      publicKey: string;
    }
  | {
      ok: true;
      signature: string;
      publicKey: string;
    };

function isDryRunClaim(
  value: ClaimResult
): value is Extract<ClaimResult, { dryRun: true }> {
  return "dryRun" in value && value.dryRun === true;
}

export async function claimAndRegisterRewardIfAny() {
  const now = Date.now();

  if (claimRunning && now - lastClaimStartedAt < config.claimLockTtlMs) {
    return {
      ok: false,
      skipped: true,
      reason: "claim already running"
    };
  }

  claimRunning = true;
  lastClaimStartedAt = now;

  try {
    const wallet = config.creatorWalletPublicKey;

    if (!wallet) {
      throw new Error("Missing CREATOR_WALLET_PUBLIC_KEY");
    }

    const before = await getSolBalanceRaw(wallet);
    const claim = (await claimCreatorFees()) as ClaimResult;

    if (isDryRunClaim(claim)) {
      return {
        ok: true,
        dryRun: true,
        beforeRaw: before.toString(),
        beforeSol: Number(before) / LAMPORTS_PER_SOL
      };
    }

    const after = await getSolBalanceRaw(wallet);
    const claimedRaw = after > before ? after - before : 0n;

    if (claimedRaw <= 0n) {
      return {
        ok: true,
        signature: claim.signature,
        claimedRaw: "0",
        skipped: true,
        reason: "no positive balance delta after claim"
      };
    }

    if (claimedRaw < config.swapMinSolRaw) {
      return {
        ok: true,
        signature: claim.signature,
        claimedRaw: claimedRaw.toString(),
        skipped: true,
        reason: "claimed SOL below swap threshold"
      };
    }

    const reserve = config.minSolFeeReserveLamports;
    const swappableRaw = claimedRaw > reserve ? claimedRaw - reserve : 0n;

    if (swappableRaw <= 0n) {
      return {
        ok: true,
        signature: claim.signature,
        claimedRaw: claimedRaw.toString(),
        skipped: true,
        reason: "nothing left after fee reserve"
      };
    }

    const swap = await swapSolToUsdc(swappableRaw);
    const usdcRaw = BigInt(swap.outAmountRaw);

    if (usdcRaw < config.minRewardPayoutRaw) {
      return {
        ok: true,
        signature: claim.signature,
        swapSignature: swap.signature,
        usdcRaw: usdcRaw.toString(),
        skipped: true,
        reason: "swapped USDC below MIN_REWARD_PAYOUT_RAW"
      };
    }

    const reward = await registerClaimedRewardEvent({
      sourceTx: swap.signature,
      grossPayoutRaw: usdcRaw,
      notes: `Automatic creator fee claim from ${claim.signature}, swapped from SOL to USDC`
    });

    return {
      ok: true,
      claimSignature: claim.signature,
      swapSignature: swap.signature,
      claimedRaw: claimedRaw.toString(),
      swappableRaw: swappableRaw.toString(),
      usdcRaw: usdcRaw.toString(),
      rewardEventId: reward.id
    };
  } finally {
    claimRunning = false;
  }
}