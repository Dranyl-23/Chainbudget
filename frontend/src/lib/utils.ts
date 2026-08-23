import axios from "axios";

/**
 * Safely extracts a user-readable error message from an unknown error object.
 * Handles AxiosError, Error instances, and backend API JSON error responses.
 */
export function getErrorMessage(err: unknown, fallback = "An unexpected error occurred"): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.response?.data?.message || err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return fallback;
}

/**
 * Truncates an Ethereum wallet address for display (e.g. 0x1234...5678).
 */
export function formatShortAddress(address?: string | null): string {
  if (!address) return "";
  const clean = address.trim();
  if (clean.length <= 10) return clean;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

/**
 * Formats currency in Philippine Peso (PHP)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}
