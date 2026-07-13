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
  ADMIN_API_KEY: z.string().min(6)
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
  adminApiKey: env.ADMIN_API_KEY
};