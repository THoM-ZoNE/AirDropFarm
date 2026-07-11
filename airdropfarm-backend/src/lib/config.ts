import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  RPC_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DISTRIBUTOR_SECRET_KEY_JSON: z.string().min(3),
  TOKEN_A_MINT: z.string().min(32),
  TOKEN_B_MINT: z.string().min(32),
  MIN_HOLDER_AMOUNT_RAW: z.coerce.bigint().default(1n),
  EXCLUDED_WALLETS: z.string().optional().default(""),
  BUYBACK_BPS: z.coerce.number().int().default(5500),
  TOKEN_B_POOL_BPS: z.coerce.number().int().default(1500),
  TOKEN_A_POOL_BPS: z.coerce.number().int().default(3000),
  DUAL_HOLDER_BONUS_BPS: z.coerce.number().int().default(500),
  SAFETY_BUFFER_BPS: z.coerce.number().int().default(300),
  EST_TX_FEE_LAMPORTS: z.coerce.bigint().default(10000n),
  MAX_INSTRUCTIONS_PER_TX: z.coerce.number().int().default(8),
  DRY_RUN: z.string().optional().default("true"),
  PORT: z.coerce.number().default(8787),
  CRON_ENABLED: z.string().optional().default("true"),
  CRON_SNAPSHOT: z.string().default("*/10 * * * *"),
  CRON_DISTRIBUTE: z.string().default("*/15 * * * *"),
  AUTO_DISTRIBUTE: z.string().optional().default("false"),
  MIN_REWARD_LAMPORTS: z.coerce.bigint().default(50000000n),
  BUYBACK_WALLET_ADDRESS: z.string().optional().default(""),
  ADMIN_API_KEY: z.string().min(6)
});

const env = schema.parse(process.env);
const bpsSum = env.BUYBACK_BPS + env.TOKEN_B_POOL_BPS + env.TOKEN_A_POOL_BPS;

if (bpsSum !== 10000) {
  throw new Error(`Pool basis points must equal 10000, got ${bpsSum}`);
}

export const config = {
  rpcUrl: env.RPC_URL,
  databaseUrl: env.DATABASE_URL,
  distributorSecretKey: Uint8Array.from(JSON.parse(env.DISTRIBUTOR_SECRET_KEY_JSON)),
  tokenAMint: env.TOKEN_A_MINT,
  tokenBMint: env.TOKEN_B_MINT,
  minHolderAmountRaw: env.MIN_HOLDER_AMOUNT_RAW,
  excludedWallets: env.EXCLUDED_WALLETS.split(",").map(x => x.trim()).filter(Boolean),
  buybackBps: env.BUYBACK_BPS,
  tokenBPoolBps: env.TOKEN_B_POOL_BPS,
  tokenAPoolBps: env.TOKEN_A_POOL_BPS,
  dualHolderBonusBps: env.DUAL_HOLDER_BONUS_BPS,
  safetyBufferBps: env.SAFETY_BUFFER_BPS,
  estTxFeeLamports: env.EST_TX_FEE_LAMPORTS,
  maxInstructionsPerTx: env.MAX_INSTRUCTIONS_PER_TX,
  dryRun: env.DRY_RUN === "true",
  port: env.PORT,
  cronEnabled: env.CRON_ENABLED === "true",
  cronSnapshot: env.CRON_SNAPSHOT,
  cronDistribute: env.CRON_DISTRIBUTE,
  autoDistribute: env.AUTO_DISTRIBUTE === "true",
  minRewardLamports: env.MIN_REWARD_LAMPORTS,
  buybackWalletAddress: env.BUYBACK_WALLET_ADDRESS,
  adminApiKey: env.ADMIN_API_KEY
};