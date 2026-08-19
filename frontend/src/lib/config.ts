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

/**
 * Resolves a potentially relative document/image URL to an absolute URL.
 * Handles backend-relative paths by prepending BACKEND_URL.
 */
export function resolveDocumentUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return `${BACKEND_URL}${url}`;
}
