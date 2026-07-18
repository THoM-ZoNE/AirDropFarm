import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  RPC_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),

  DISTRIBUTOR_SECRET_KEY_JSON: z.string().min(3),

  TOKEN_A_MINT: z.string().min(32),
  TOKEN_B_MINT: z.string().min(32),

  PAYOUT_MINT: z.string().min(32),
  PAYOUT_SYMBOL: z.string().default("USDC"),

  MIN_HOLDER_AMOUNT_RAW: z.coerce.bigint().default(1n),
  MIN_REWARD_PAYOUT_RAW: z.coerce.bigint().default(1_000_000n),

  EXCLUDED_WALLETS: z.string().optional().default(""),

  BUYBACK_BPS: z.coerce.number().int().min(0).max(10_000).default(5500),
  TOKEN_B_POOL_BPS: z.coerce.number().int().min(0).max(10_000).default(1500),
  TOKEN_A_POOL_BPS: z.coerce.number().int().min(0).max(10_000).default(3000),
  DUAL_HOLDER_BONUS_BPS: z.coerce.number().int().min(0).max(10_000).default(500),
  SAFETY_BUFFER_BPS: z.coerce.number().int().min(0).max(10_000).default(300),

  MAX_RECIPIENTS_PER_TX: z.coerce.number().int().min(1).max(8).default(4),

  MIN_SOL_FEE_RESERVE_LAMPORTS: z.coerce.bigint().default(50_000_000n),

  BUYBACK_WALLET_ADDRESS: z.string().optional().default(""),

  DRY_RUN: z.string().optional().default("true"),
  AUTO_DISTRIBUTE: z.string().optional().default("false"),

  CRON_ENABLED: z.string().optional().default("false"),
  CRON_SNAPSHOT: z.string().default("0 * * * *"),
  CRON_DISTRIBUTE: z.string().default("10 * * * *"),

  PORT: z.coerce.number().int().default(8787),
  ADMIN_API_KEY: z.string().min(6),

  CLAIM_ENABLED: z.string().optional().default("false"),
  CLAIM_CRON: z.string().default("*/2 * * * *"),
  CLAIM_PRIORITY_FEE: z.coerce.number().default(0.000001),
  CLAIM_DRY_RUN: z.string().optional().default("true"),
  PUMPPORTAL_TRADE_LOCAL_URL: z
    .string()
    .url()
    .default("https://pumpportal.fun/api/trade-local"),
  CREATOR_WALLET_PUBLIC_KEY: z.string().optional().default(""),
  CREATOR_WALLET_PRIVATE_KEY: z.string().optional().default(""),
  CLAIM_MIN_RAW: z.coerce.bigint().default(1_000_000n),
  CLAIM_MINT: z
    .string()
    .default("So11111111111111111111111111111111111111112"),
  CLAIM_LOCK_TTL_MS: z.coerce.number().default(120000),
  USDC_MINT: z.string().min(32),
  JUPITER_QUOTE_URL: z.string().url().default("https://quote-api.jup.ag/v6/quote"),
  JUPITER_SWAP_URL: z.string().url().default("https://quote-api.jup.ag/v6/swap"),
  SWAP_SLIPPAGE_BPS: z.coerce.number().int().min(1).max(5000).default(100),
  SWAP_MIN_SOL_RAW: z.coerce.bigint().default(1_000_000n)
});

const env = schema.parse(process.env);

const poolBpsSum =
  env.BUYBACK_BPS +
  env.TOKEN_A_POOL_BPS +
  env.TOKEN_B_POOL_BPS;

if (poolBpsSum !== 10_000) {
  throw new Error(
    `BUYBACK_BPS + TOKEN_A_POOL_BPS + TOKEN_B_POOL_BPS must equal 10000; got ${poolBpsSum}.`
  );
}

if (env.BUYBACK_BPS > 0 && !env.BUYBACK_WALLET_ADDRESS) {
  throw new Error(
    "BUYBACK_WALLET_ADDRESS is required when BUYBACK_BPS is greater than zero."
  );
}

if (env.CLAIM_ENABLED === "true") {
  if (!env.CREATOR_WALLET_PUBLIC_KEY) {
    throw new Error("CREATOR_WALLET_PUBLIC_KEY is required when CLAIM_ENABLED=true");
  }

  if (!env.CREATOR_WALLET_PRIVATE_KEY) {
    throw new Error("CREATOR_WALLET_PRIVATE_KEY is required when CLAIM_ENABLED=true");
  }
}

export const config = {
  rpcUrl: env.RPC_URL,
  databaseUrl: env.DATABASE_URL,

  distributorSecretKey: Uint8Array.from(
    JSON.parse(env.DISTRIBUTOR_SECRET_KEY_JSON)
  ),

  tokenAMint: env.TOKEN_A_MINT,
  tokenBMint: env.TOKEN_B_MINT,

  payoutMint: env.PAYOUT_MINT,
  payoutSymbol: env.PAYOUT_SYMBOL,

  minHolderAmountRaw: env.MIN_HOLDER_AMOUNT_RAW,
  minRewardPayoutRaw: env.MIN_REWARD_PAYOUT_RAW,

  excludedWallets: env.EXCLUDED_WALLETS
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),

  buybackBps: env.BUYBACK_BPS,
  tokenAPoolBps: env.TOKEN_A_POOL_BPS,
  tokenBPoolBps: env.TOKEN_B_POOL_BPS,
  dualHolderBonusBps: env.DUAL_HOLDER_BONUS_BPS,
  safetyBufferBps: env.SAFETY_BUFFER_BPS,

  maxRecipientsPerTx: env.MAX_RECIPIENTS_PER_TX,
  minSolFeeReserveLamports: env.MIN_SOL_FEE_RESERVE_LAMPORTS,

  buybackWalletAddress: env.BUYBACK_WALLET_ADDRESS,

  dryRun: env.DRY_RUN === "true",
  autoDistribute: env.AUTO_DISTRIBUTE === "true",

  cronEnabled: env.CRON_ENABLED === "true",
  cronSnapshot: env.CRON_SNAPSHOT,
  cronDistribute: env.CRON_DISTRIBUTE,

  port: env.PORT,
  adminApiKey: env.ADMIN_API_KEY,

  claimEnabled: env.CLAIM_ENABLED === "true",
  claimCron: env.CLAIM_CRON,
  claimPriorityFee: env.CLAIM_PRIORITY_FEE,
  claimDryRun: env.CLAIM_DRY_RUN === "true",
  pumpPortalTradeLocalUrl: env.PUMPPORTAL_TRADE_LOCAL_URL,
  creatorWalletPublicKey: env.CREATOR_WALLET_PUBLIC_KEY,
  creatorWalletPrivateKey: env.CREATOR_WALLET_PRIVATE_KEY,
  claimMinRaw: env.CLAIM_MIN_RAW,
  claimMint: env.CLAIM_MINT,
  claimLockTtlMs: env.CLAIM_LOCK_TTL_MS,

  usdcMint: env.USDC_MINT,
  jupiterQuoteUrl: env.JUPITER_QUOTE_URL,
  jupiterSwapUrl: env.JUPITER_SWAP_URL,
  swapSlippageBps: env.SWAP_SLIPPAGE_BPS,
  swapMinSolRaw: env.SWAP_MIN_SOL_RAW
};