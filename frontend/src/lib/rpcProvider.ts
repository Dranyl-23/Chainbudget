import { ethers } from "ethers";

/**
 * Resilient JSON-RPC provider for Polygon Amoy Testnet (Chain ID: 80002).
 * Provides multi-tier fallback across several public RPC endpoints,
 * per-request timeouts to prevent UI freezing, and an internal server proxy
 * fallback when browser extensions (ad blockers/privacy shields) or CORS
 * block client-side Web3 HTTP requests.
 */

export const AMOY_RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_RPC_URL,
  "https://rpc-amoy.polygon.technology",
  "https://polygon-amoy.drpc.org",
  "https://rpc.ankr.com/polygon_amoy",
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://1rpc.io/amoy",
  "https://polygon-amoy.gateway.tenderly.co",
].filter(Boolean) as string[];

let _currentRpcIndex = 0;
let _provider: ethers.JsonRpcProvider | null = null;

function createProviderForUrl(url: string): ethers.JsonRpcProvider {
  const req = new ethers.FetchRequest(url);
  req.timeout = 7000; // 7-second timeout per RPC attempt
  return new ethers.JsonRpcProvider(req, 80002, { staticNetwork: true });
}

export function getAmoyProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const url = AMOY_RPC_ENDPOINTS[_currentRpcIndex % AMOY_RPC_ENDPOINTS.length];
    _provider = createProviderForUrl(url);
  }
  return _provider;
}

/** Rotates to the next available RPC endpoint if the current one fails */
export function rotateAmoyProvider(): ethers.JsonRpcProvider {
  _currentRpcIndex = (_currentRpcIndex + 1) % AMOY_RPC_ENDPOINTS.length;
  const nextUrl = AMOY_RPC_ENDPOINTS[_currentRpcIndex];
  _provider = createProviderForUrl(nextUrl);
  return _provider;
}

/**
 * Executes an async operation with automatic RPC rotation across all candidate endpoints.
 * Only throws if every single endpoint fails.
 */
export async function executeWithRpcFallback<T>(
  operation: (provider: ethers.JsonRpcProvider) => Promise<T>
): Promise<T> {
  let lastError: unknown = null;
  const total = AMOY_RPC_ENDPOINTS.length;

  for (let attempt = 0; attempt < total; attempt++) {
    const provider = getAmoyProvider();
    try {
      return await operation(provider);
    } catch (err: unknown) {
      lastError = err;
      rotateAmoyProvider();
    }
  }

  throw lastError || new Error("All Amoy RPC endpoints failed");
}

/**
 * Fetches native balance on Amoy with multi-RPC fallback.
 */
export async function fetchAmoyBalance(address: string): Promise<bigint> {
  return executeWithRpcFallback(async (provider) => {
    return await provider.getBalance(address);
  });
}

export interface TxDetails {
  status: "success" | "failed" | "pending";
  blockNumber?: number;
  timestamp?: string;
  from?: string;
  to?: string;
  gasFee?: string;
}

/**
 * Highly resilient transaction fetcher:
 * 1. Tries window.ethereum (if user has MetaMask/wallet on Amoy - 0 CORS)
 * 2. Tries public RPC rotation with 7s timeouts
 * 3. Falls back to Next.js server-side proxy route (/api/rpc/tx?hash=...)
 *    which eliminates browser CORS & ad-blocker restrictions entirely.
 */
export async function fetchTxWithFallback(txHash: string): Promise<TxDetails> {
  // Strategy 1: If browser has window.ethereum on Amoy (80002 / 0x13882), try directly
  if (typeof window !== "undefined") {
    try {
      const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string> } }).ethereum;
      if (eth && typeof eth.request === "function") {
        const chainId = await eth.request({ method: "eth_chainId" }).catch(() => null);
        if (chainId === "0x13882" || chainId === "80002") {
          const walletProvider = new ethers.BrowserProvider(eth as unknown as ethers.Eip1193Provider);
          const [tx, receipt] = await Promise.all([
            walletProvider.getTransaction(txHash),
            walletProvider.getTransactionReceipt(txHash),
          ]);
          if (tx || receipt) {
            return await formatTxDetails(tx, receipt, walletProvider);
          }
        }
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 2: Multi-RPC client rotation with short timeouts
  try {
    const result = await executeWithRpcFallback(async (provider) => {
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash),
      ]);

      if (!tx && !receipt) {
        throw new Error("Transaction not found on this node");
      }

      return await formatTxDetails(tx, receipt, provider);
    });

    return result;
  } catch (clientErr) {
    console.warn("[Amoy RPC] Client-side fetch failed across RPCs, attempting server proxy fallback...", clientErr);
  }

  // Strategy 3: Server-side proxy route (/api/rpc/tx)
  // Bypasses browser CORS, adblockers, and privacy shields
  try {
    const res = await fetch(`/api/rpc/tx?hash=${encodeURIComponent(txHash)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return data as TxDetails;
    }
  } catch (proxyErr) {
    console.error("[Amoy RPC] Server proxy also failed:", proxyErr);
  }

  throw new Error("Unable to fetch live transaction data. Public RPC nodes may be experiencing high congestion.");
}

async function formatTxDetails(
  tx: ethers.TransactionResponse | null,
  receipt: ethers.TransactionReceipt | null,
  provider: ethers.Provider
): Promise<TxDetails> {
  if (!receipt && !tx) {
    return { status: "pending" };
  }

  if (!receipt) {
    return {
      status: "pending",
      from: tx?.from,
      to: tx?.to || "Contract Creation",
    };
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
      // Non-critical
    }
  }

  let gasFeeInMatic = "0";
  if (receipt.gasUsed && tx?.gasPrice) {
    const feeWei = receipt.gasUsed * tx.gasPrice;
    gasFeeInMatic = ethers.formatEther(feeWei);
  }

  return {
    status: receipt.status === 1 ? "success" : "failed",
    blockNumber: receipt.blockNumber,
    timestamp: timestampStr,
    from: tx?.from || receipt.from,
    to: tx?.to || receipt.to || "Contract Creation",
    gasFee: parseFloat(gasFeeInMatic).toFixed(6),
  };
}
