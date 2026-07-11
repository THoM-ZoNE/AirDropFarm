import {
  Connection,
  Keypair,
  PublicKey,
  Transaction
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { config } from "./config.js";

export const connection = new Connection(config.rpcUrl, "confirmed");

export const distributor = Keypair.fromSecretKey(
  config.distributorSecretKey
);

export type HolderRecord = {
  owner: string;
  mint: string;
  rawAmount: bigint;
};

export type PayoutItem = {
  owner: string;
  amountRaw: bigint;
};

function assertSupportedTokenProgram(programId: PublicKey) {
  if (
    !programId.equals(TOKEN_PROGRAM_ID) &&
    !programId.equals(TOKEN_2022_PROGRAM_ID)
  ) {
    throw new Error(
      `Unsupported token program: ${programId.toBase58()}`
    );
  }
}

async function getMintProgramId(mint: PublicKey) {
  const accountInfo = await connection.getAccountInfo(mint, "confirmed");

  if (!accountInfo) {
    throw new Error(`Mint not found: ${mint.toBase58()}`);
  }

  assertSupportedTokenProgram(accountInfo.owner);
  return accountInfo.owner;
}

export async function getAllTokenHoldersByMint(
  mintAddress: string
): Promise<HolderRecord[]> {
  const mint = new PublicKey(mintAddress);

  const response = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      {
        memcmp: {
          offset: 0,
          bytes: mint.toBase58()
        }
      }
    ]
  });

  const holders: HolderRecord[] = [];

  for (const account of response) {
    const data = account.account.data;
    const owner = new PublicKey(data.subarray(32, 64)).toBase58();
    const rawAmount = data.readBigUInt64LE(64);

    if (rawAmount > 0n) {
      holders.push({
        owner,
        mint: mintAddress,
        rawAmount
      });
    }
  }

  return holders;
}

export async function getPayoutMintInfo() {
  const mint = new PublicKey(config.payoutMint);
  const tokenProgramId = await getMintProgramId(mint);

  const mintInfo = await getMint(
    connection,
    mint,
    "confirmed",
    tokenProgramId
  );

  return {
    mint,
    tokenProgramId,
    decimals: mintInfo.decimals
  };
}

export async function assertDistributorSolReserve(
  extraAccountsToCreate: number
) {
  const balance = await connection.getBalance(
    distributor.publicKey,
    "confirmed"
  );

  const minimumRequired =
    config.minSolFeeReserveLamports +
    BigInt(extraAccountsToCreate) * 2_100_000n;

  if (BigInt(balance) < minimumRequired) {
    throw new Error(
      `Insufficient SOL for transaction fees and token-account creation. ` +
        `Need at least ${minimumRequired.toString()} lamports; ` +
        `wallet has ${balance.toString()}.`
    );
  }
}

export async function sendUsdcBatch(items: PayoutItem[]) {
  if (items.length === 0) {
    return {
      signature: "NO_RECIPIENTS",
      simulatedPayoutRaw: 0n
    };
  }

  const { mint, tokenProgramId, decimals } = await getPayoutMintInfo();

  const sourceAta = getAssociatedTokenAddressSync(
    mint,
    distributor.publicKey,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const sourceAccount = await getAccount(
    connection,
    sourceAta,
    "confirmed",
    tokenProgramId
  );

  const totalPayoutRaw = items.reduce(
    (total, item) => total + item.amountRaw,
    0n
  );

  if (sourceAccount.amount < totalPayoutRaw) {
    throw new Error(
      `Insufficient ${config.payoutSymbol} balance. ` +
        `Need ${totalPayoutRaw.toString()} raw units; ` +
        `wallet has ${sourceAccount.amount.toString()}.`
    );
  }

  const latest = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: distributor.publicKey,
    ...latest
  });

  let potentiallyNewAccounts = 0;

  for (const item of items) {
    if (item.amountRaw <= 0n) {
      continue;
    }

    const owner = new PublicKey(item.owner);

    const destinationAta = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const destinationInfo = await connection.getAccountInfo(
      destinationAta,
      "confirmed"
    );

    if (!destinationInfo) {
      potentiallyNewAccounts += 1;

      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          distributor.publicKey,
          destinationAta,
          owner,
          mint,
          tokenProgramId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    transaction.add(
      createTransferCheckedInstruction(
        sourceAta,
        mint,
        destinationAta,
        distributor.publicKey,
        item.amountRaw,
        decimals,
        [],
        tokenProgramId
      )
    );
  }

  await assertDistributorSolReserve(potentiallyNewAccounts);

  if (config.dryRun) {
    return {
      signature: "DRY_RUN",
      simulatedPayoutRaw: totalPayoutRaw
    };
  }

  const signature = await connection.sendTransaction(
    transaction,
    [distributor],
    { preflightCommitment: "confirmed" }
  );

  await connection.confirmTransaction(
    {
      signature,
      ...latest
    },
    "confirmed"
  );

  return {
    signature,
    payoutRaw: totalPayoutRaw
  };
}