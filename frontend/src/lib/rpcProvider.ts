import { ethers } from "ethers";

/**
 * Singleton JSON-RPC provider for Polygon Amoy Testnet.
 * Provides automatic fallback across multiple public RPC endpoints
 * to protect against rate limiting or temporary RPC node outages.
 */

const AMOY_RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_RPC_URL,
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://polygon-amoy.drpc.org",
  "https://polygon-amoy.gateway.tenderly.co",
].filter(Boolean) as string[];

let _currentRpcIndex = 0;
let _provider: ethers.JsonRpcProvider | null = null;

export function getAmoyProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const url = AMOY_RPC_ENDPOINTS[_currentRpcIndex % AMOY_RPC_ENDPOINTS.length];
    _provider = new ethers.JsonRpcProvider(url, 80002, { staticNetwork: true });
  }
  return _provider;
}

/** Rotates to the next available RPC endpoint if the current one fails */
export function rotateAmoyProvider(): ethers.JsonRpcProvider {
  _currentRpcIndex = (_currentRpcIndex + 1) % AMOY_RPC_ENDPOINTS.length;
  const nextUrl = AMOY_RPC_ENDPOINTS[_currentRpcIndex];
  _provider = new ethers.JsonRpcProvider(nextUrl, 80002, { staticNetwork: true });
  return _provider;
}
