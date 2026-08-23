import { ethers } from "ethers";
import api from "./api";
import type { User } from "@/context/AuthContext";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 80002);

export interface WalletState {
  address: string;
  chainId: number;
  isConnected: boolean;
}

export type InjectedProvider = NonNullable<Window["ethereum"]>;

export interface Eip1193RpcError extends Error {
  code: number;
  data?: unknown;
}

interface ApiErrorResponse {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
}

function getInjectedEthereumProvider(): InjectedProvider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const ethereumProvider = window.ethereum;
  if (ethereumProvider.providers?.length) {
    return ethereumProvider.providers.find((p: InjectedProvider) => p.isMetaMask) || ethereumProvider;
  }
  return ethereumProvider;
}

export function getProvider(): ethers.BrowserProvider | null {
  const injectedProvider = getInjectedEthereumProvider();
  if (!injectedProvider) return null;
  return new ethers.BrowserProvider(injectedProvider as ethers.Eip1193Provider);
}

export function isMetaMaskInstalled(): boolean {
  return typeof window !== "undefined" && Boolean(getInjectedEthereumProvider());
}

export async function connectWallet(): Promise<WalletState> {
  const provider = getProvider();
  if (!provider) throw new Error("MetaMask is not installed");

  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    address: address.toLowerCase(),
    chainId: Number(network.chainId),
    isConnected: true,
  };
}

export async function switchToAmoy(): Promise<void> {
  const ethereumProvider = getInjectedEthereumProvider();
  if (!ethereumProvider) throw new Error("MetaMask not installed");

  try {
    await ethereumProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
  } catch (switchError: unknown) {
    const rpcError = switchError as Eip1193RpcError;
    if (rpcError.code === 4902) {
      await ethereumProvider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${CHAIN_ID.toString(16)}`,
            chainName: "Polygon Amoy Testnet",
            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
            rpcUrls: ["https://rpc-amoy.polygon.technology/"],
            blockExplorerUrls: ["https://amoy.polygonscan.com/"],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

export async function linkWallet(): Promise<{ user: User }> {
  if (typeof window === "undefined") {
    throw new Error("MetaMask is not installed");
  }

  try {
    const ethereumProvider = getInjectedEthereumProvider();
    if (!ethereumProvider) throw new Error("MetaMask is not installed");

    // ── Step 1: Request account access ──────────────────────────────────────
    let accounts: string[];
    try {
      accounts = (await ethereumProvider.request({
        method: "eth_requestAccounts",
      })) as string[];
    } catch (accountError: unknown) {
      const rpcErr = accountError as Eip1193RpcError;
      if (rpcErr?.code === 4001) {
        throw new Error("User rejected the request to connect MetaMask");
      }
      throw new Error(
        `Failed to request accounts: ${rpcErr?.message || String(accountError)}`
      );
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please unlock MetaMask.");
    }

    // ✅ Wait for MetaMask to fully authorize the account
    await new Promise((resolve) => setTimeout(resolve, 500));

    // ✅ Confirm account is actually accessible before signing
    const confirmedAccounts = (await ethereumProvider.request({
      method: "eth_accounts",
    })) as string[];

    if (!confirmedAccounts || confirmedAccounts.length === 0) {
      throw new Error("MetaMask account not authorized. Please try again.");
    }

    const walletAddress = confirmedAccounts[0].toLowerCase();
    console.log("Connected wallet:", walletAddress);

    // ── Step 2: Switch to Polygon Amoy ───────────────────────────────────────
    try {
      await switchToAmoy();
    } catch (networkError: unknown) {
      const err = networkError as Error;
      throw new Error(
        `Failed to switch to Polygon Amoy: ${err.message || String(networkError)}`
      );
    }

    // ── Step 3: Get nonce from backend ───────────────────────────────────────
    let nonce: string;
    try {
      const nonceRes = await api.get<{ nonce: string }>(`/auth/nonce/${walletAddress}`);
      nonce = nonceRes.data.nonce;
      console.log("Got nonce:", nonce);
    } catch (nonceError: unknown) {
      const apiErr = nonceError as ApiErrorResponse;
      throw new Error(
        `Failed to get nonce: ${apiErr.response?.data?.error || apiErr.message || String(nonceError)}`
      );
    }

    // ── Step 4: Sign with personal_sign (matches backend's verifyMessage) ───
    let signature: string;
    try {
      // Encode nonce to hex for JSON-RPC 2.0 compliance
      const messageHex = ethers.hexlify(ethers.toUtf8Bytes(nonce));
      signature = (await ethereumProvider.request({
        method: "personal_sign",
        params: [messageHex, walletAddress],
      })) as string;
      console.log("Signature obtained:", signature);
    } catch (signError: unknown) {
      const rpcErr = signError as Eip1193RpcError;
      if (rpcErr?.code === 4001) {
        throw new Error("User rejected the signature request");
      }
      throw new Error(
        `Failed to sign message: ${rpcErr?.message || String(signError)}`
      );
    }

    // ── Step 5: Verify and Link with backend ──────────────────────────────────
    let linkRes;
    try {
      linkRes = await api.post<{ user: User }>("/auth/link-wallet", { walletAddress, signature });
    } catch (verifyError: unknown) {
      const apiErr = verifyError as ApiErrorResponse;
      throw new Error(
        `Linking failed: ${apiErr.response?.data?.error || apiErr.message || String(verifyError)}`
      );
    }

    const { user } = linkRes.data;

    return { user };
  } catch (error: unknown) {
    console.error("Wallet login error:", error);
    throw error;
  }
}

/**
 * getStoredUser
 *
 * CRIT-2: User state is no longer stored in localStorage. This function now
 * always returns null — session restoration is handled by GET /api/auth/session
 * (the Next.js HttpOnly cookie route) in AuthContext.
 *
 * @deprecated Use AuthContext.user instead.
 */
export function getStoredUser(): null {
  return null;
}

/**
 * clearSession
 *
 * CRIT-2: Clears local state. The HttpOnly session cookie is cleared by calling
 * DELETE /api/auth/session from AuthContext.logout().
 */
export function clearSession(): void {
  // No-op: no sensitive data is stored in localStorage anymore.
  // The session cookie is managed server-side via DELETE /api/auth/session.
  if (typeof window !== "undefined") {
    // Clear any legacy keys that may exist from a previous app version
    localStorage.removeItem("cb_token");
    localStorage.removeItem("cb_user");
    localStorage.removeItem("cb_active_org");
  }
}