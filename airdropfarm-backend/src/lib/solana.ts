import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { config } from "./config.js";

export const connection = new Connection(config.rpcUrl, "confirmed");
export const distributor = Keypair.fromSecretKey(config.distributorSecretKey);

export type HolderRecord = {
  owner: string;
  mint: string;
  rawAmount: bigint;
};

export async function getAllTokenHoldersByMint(mintAddress: string): Promise<HolderRecord[]> {
  const mint = new PublicKey(mintAddress);

  const response = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mint.toBase58() } }
    ]
  });

  const holders: HolderRecord[] = [];

  for (const account of response) {
    const data = account.account.data;
    const owner = new PublicKey(data.subarray(32, 64)).toBase58();
    const rawAmount = data.readBigUInt64LE(64);

    if (rawAmount > 0n) {
      holders.push({ owner, mint: mintAddress, rawAmount });
    }
  }

  return holders;
}

export async function sendSolBatch(items: { owner: string; lamports: bigint }[]) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: distributor.publicKey,
    ...latest
  });

  for (const item of items) {
    if (item.lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Lamports overflow for ${item.owner}`);
    }

    tx.add(
      SystemProgram.transfer({
        fromPubkey: distributor.publicKey,
        toPubkey: new PublicKey(item.owner),
        lamports: Number(item.lamports)
      })
    );
  }

  if (config.dryRun) {
    return {
      signature: "DRY_RUN",
      simulatedLamports: items.reduce((a, b) => a + b.lamports, 0n)
    };
  }

  const signature = await connection.sendTransaction(tx, [distributor]);
  await connection.confirmTransaction({ signature, ...latest }, "confirmed");

  return { signature };
}

export function lamportsToSol(lamports: bigint) {
  return Number(lamports) / LAMPORTS_PER_SOL;
}