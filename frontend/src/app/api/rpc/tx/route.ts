import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

/**
 * Server-side Polygon Amoy RPC proxy for transaction lookup.
 * 
 * Why this is needed:
 * Client-side browser requests to public Web3 RPC nodes frequently fail with
 * "TypeError: Failed to fetch" due to:
 *   1. CORS policy headers missing on RPC node 429/503 responses
 *   2. Ad-blockers or privacy shields (Brave, uBlock) blocking third-party RPC domains
 *   3. Rate limiting and temporary node downtime
 *
 * Running this query server-side eliminates CORS and ad-blocker restrictions entirely,
 * sequentially attempting multiple RPC nodes with short timeouts.
 */

const SERVER_AMOY_RPCS = [
  process.env.NEXT_PUBLIC_RPC_URL,
  "https://rpc-amoy.polygon.technology",
  "https://polygon-amoy.drpc.org",
  "https://rpc.ankr.com/polygon_amoy",
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://1rpc.io/amoy",
].filter(Boolean) as string[];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("hash");

  if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json(
      { error: "Invalid transaction hash format. Must be a 66-character hex string starting with 0x." },
      { status: 400 }
    );
  }

  let lastError: Error | null = null;

  for (const rpcUrl of SERVER_AMOY_RPCS) {
    try {
      const fetchReq = new ethers.FetchRequest(rpcUrl);
      fetchReq.timeout = 5000; // 5-second timeout per RPC

      const provider = new ethers.JsonRpcProvider(fetchReq, 80002, { staticNetwork: true });

      const [tx, receipt] = await Promise.all([
        provider.getTransaction(hash),
        provider.getTransactionReceipt(hash),
      ]);

      if (!tx && !receipt) {
        // Might not be indexed yet on this node, try next
        continue;
      }

      if (!receipt) {
        return NextResponse.json({
          status: "pending",
          from: tx?.from,
          to: tx?.to || "Contract Creation",
        });
      }

      let timestampStr = "Unknown";
      if (receipt.blockNumber) {
        try {
          const block = await provider.getBlock(receipt.blockNumber);
          if (block) {
            timestampStr = new Date(block.timestamp * 1000).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
          }
        } catch {
          // Block lookup is non-critical
        }
      }

      let gasFeeInMatic = "0";
      if (receipt.gasUsed && tx?.gasPrice) {
        const feeWei = receipt.gasUsed * tx.gasPrice;
        gasFeeInMatic = ethers.formatEther(feeWei);
      }

      return NextResponse.json({
        status: receipt.status === 1 ? "success" : "failed",
        blockNumber: receipt.blockNumber,
        timestamp: timestampStr,
        from: tx?.from || receipt.from,
        to: tx?.to || receipt.to || "Contract Creation",
        gasFee: parseFloat(gasFeeInMatic).toFixed(6),
      });
    } catch (err) {
      lastError = err as Error;
    }
  }

  return NextResponse.json(
    {
      error:
        lastError?.message ||
        "Could not fetch transaction details from public Polygon Amoy nodes.",
    },
    { status: 502 }
  );
}
