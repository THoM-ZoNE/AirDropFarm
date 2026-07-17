import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { claimCreatorFees } from "./claimService.js";
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

    if (claimedRaw < config.claimMinRaw) {
      return {
        ok: true,
        signature: claim.signature,
        claimedRaw: claimedRaw.toString(),
        skipped: true,
        reason: "claimed amount below claimMinRaw"
      };
    }

    const reward = await registerClaimedRewardEvent({
      sourceTx: claim.signature,
      grossPayoutRaw: claimedRaw,
      notes: "Automatic creator fee claim"
    });

    return {
      ok: true,
      signature: claim.signature,
      claimedRaw: claimedRaw.toString(),
      rewardEventId: reward.id
    };
  } finally {
    claimRunning = false;
  }
}