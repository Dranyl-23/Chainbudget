import { ethers } from "ethers";

/**
 * Singleton JSON-RPC provider for Polygon Amoy Testnet.
 * Avoids creating multiple provider instances that can trigger
 * rate limiting on public RPC endpoints.
 */

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology";

let _provider: ethers.JsonRpcProvider | null = null;

export function getAmoyProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return _provider;
}
