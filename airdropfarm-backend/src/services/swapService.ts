import bs58 from "bs58";
import {
  Connection,
  Keypair,
  VersionedTransaction
} from "@solana/web3.js";
import { config } from "../lib/config.js";

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const connection = new Connection(config.rpcUrl, "confirmed");

function getCreatorKeypair() {
  if (!config.creatorWalletPrivateKey) {
    throw new Error("Missing CREATOR_WALLET_PRIVATE_KEY");
  }

  return Keypair.fromSecretKey(bs58.decode(config.creatorWalletPrivateKey));
}

type JupiterQuoteResponse = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold?: string;
  swapMode?: string;
  slippageBps?: number;
  priceImpactPct?: string;
  routePlan?: unknown[];
};

type JupiterSwapResponse = {
  swapTransaction: string;
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
};

export async function swapSolToUsdc(inputAmountRaw: bigint) {
  if (inputAmountRaw <= 0n) {
    throw new Error("swapSolToUsdc inputAmountRaw must be greater than zero");
  }

  const keypair = getCreatorKeypair();
  const userPublicKey = keypair.publicKey.toBase58();

  const quoteUrl = new URL(config.jupiterQuoteUrl);
  quoteUrl.searchParams.set("inputMint", WSOL_MINT);
  quoteUrl.searchParams.set("outputMint", config.usdcMint);
  quoteUrl.searchParams.set("amount", inputAmountRaw.toString());
  quoteUrl.searchParams.set("slippageBps", String(config.swapSlippageBps));

  const quoteResp = await fetch(quoteUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!quoteResp.ok) {
    throw new Error(
      `Jupiter quote error: ${quoteResp.status} ${await quoteResp.text()}`
    );
  }

  const quote = (await quoteResp.json()) as JupiterQuoteResponse;

  if (!quote?.outAmount) {
    throw new Error("Jupiter quote returned no outAmount");
  }

  const swapResp = await fetch(config.jupiterSwapUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto"
    })
  });

  if (!swapResp.ok) {
    throw new Error(
      `Jupiter swap error: ${swapResp.status} ${await swapResp.text()}`
    );
  }

  const swapData = (await swapResp.json()) as JupiterSwapResponse;

  if (!swapData?.swapTransaction) {
    throw new Error("Jupiter swap response missing swapTransaction");
  }

  const txBuffer = Buffer.from(swapData.swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuffer);

  tx.sign([keypair]);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3
  });

  const latest = await connection.getLatestBlockhash("confirmed");

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight:
        swapData.lastValidBlockHeight ?? latest.lastValidBlockHeight
    },
    "confirmed"
  );

  return {
    ok: true,
    signature,
    inputMint: WSOL_MINT,
    outputMint: config.usdcMint,
    inAmountRaw: inputAmountRaw.toString(),
    outAmountRaw: quote.outAmount,
    quote
  };
}