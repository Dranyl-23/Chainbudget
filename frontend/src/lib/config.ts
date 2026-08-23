/**
 * Centralized configuration for environment-dependent values.
 * Eliminates hardcoded localhost fallbacks scattered across components.
 */

/** Backend base URL (without /api suffix) for Socket.IO, file URLs, etc. */
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:5001" : "");

/** Target chain ID as hex. Defaults to Polygon Amoy (0x13882). */
export const TARGET_CHAIN_ID_HEX =
  process.env.NEXT_PUBLIC_CHAIN_ID_HEX || "0x13882";

/** Explorer base URL (PolygonScan Amoy Testnet) */
export const EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://amoy.polygonscan.com";

/** Master ChainBudget Smart Contract Address */
export const MASTER_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x1887be6c9cc06ddddb125da24b9b554c18f0a1fb";

/**
 * Generates an explorer link for any smart contract or wallet address
 */
export function getExplorerAddressUrl(address?: string | null): string {
  const cleanAddr =
    address && address !== "0x0000000000000000000000000000000000000000"
      ? address
      : MASTER_CONTRACT_ADDRESS;
  return `${EXPLORER_BASE_URL}/address/${cleanAddr}`;
}

/**
 * Generates an explorer link for any on-chain transaction hash
 */
export function getExplorerTxUrl(txHash?: string | null): string {
  return txHash ? `${EXPLORER_BASE_URL}/tx/${txHash}` : EXPLORER_BASE_URL;
}

/**
 * Resolves a potentially relative document/image URL to an absolute URL.
 * Handles backend-relative paths by prepending BACKEND_URL.
 */
export function resolveDocumentUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return `${BACKEND_URL}${url}`;
}
