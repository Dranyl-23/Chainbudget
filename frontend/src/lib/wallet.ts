import { ethers } from "ethers";
import api from "./api";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 80002);

export interface WalletState {
  address: string;
  chainId: number;
  isConnected: boolean;
}

function getInjectedEthereumProvider(): any | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const ethereumProvider = window.ethereum as any;
  if (ethereumProvider.providers?.length) {
    return ethereumProvider.providers.find((p: any) => p.isMetaMask) || ethereumProvider;
  }
  return ethereumProvider;
}

export function getProvider(): ethers.BrowserProvider | null {
  const injectedProvider = getInjectedEthereumProvider();
  if (!injectedProvider) return null;
  return new ethers.BrowserProvider(injectedProvider);
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
  if (!window.ethereum) throw new Error("MetaMask not installed");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
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

export async function walletLogin(): Promise<{ token: string; user: any }> {
  if (typeof window === "undefined" || !window.ethereum) {
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
    } catch (accountError: any) {
      if (accountError?.code === 4001) {
        throw new Error("User rejected the request to connect MetaMask");
      }
      throw new Error(
        `Failed to request accounts: ${accountError?.message || String(accountError)}`
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
    } catch (networkError: any) {
      throw new Error(
        `Failed to switch to Polygon Amoy: ${networkError.message}`
      );
    }

    // ── Step 3: Get nonce from backend ───────────────────────────────────────
    let nonce: string;
    try {
      const nonceRes = await api.get(`/auth/nonce/${walletAddress}`);
      nonce = nonceRes.data.nonce;
      console.log("Got nonce:", nonce);
    } catch (nonceError: any) {
      throw new Error(
        `Failed to get nonce: ${nonceError.response?.data?.error || nonceError.message}`
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
    } catch (signError: any) {
      if (signError?.code === 4001) {
        throw new Error("User rejected the signature request");
      }
      throw new Error(
        `Failed to sign message: ${signError?.message || String(signError)}`
      );
    }

    // ── Step 5: Verify with backend ──────────────────────────────────────────
    let verifyRes;
    try {
      verifyRes = await api.post("/auth/verify", { walletAddress, signature });
    } catch (verifyError: any) {
      throw new Error(
        `Verification failed: ${verifyError.response?.data?.error || verifyError.message}`
      );
    }

    const { token, user } = verifyRes.data;

    // ── Step 6: Persist session ──────────────────────────────────────────────
    localStorage.setItem("cb_token", token);
    localStorage.setItem("cb_user", JSON.stringify(user));

    return { token, user };
  } catch (error: any) {
    console.error("Wallet login error:", error);
    throw error;
  }
}

export function getStoredUser(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("cb_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user.walletAddress || !user.id) {
      console.warn("Stored user object is malformed, clearing session");
      clearSession();
      return null;
    }
    return user;
  } catch (error) {
    console.error(
      "Failed to parse stored user:",
      error instanceof Error ? error.message : String(error)
    );
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("cb_token");
  localStorage.removeItem("cb_user");
}