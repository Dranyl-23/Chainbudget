/**
 * contracts.ts
 *
 * Centralized Blockchain Protocol & Smart Contract Configuration.
 * Single Source of Truth (SSOT) across the Mobile Application.
 * Supports Environment Variables (EXPO_PUBLIC_*) with live Backend Discovery.
 */

import api from '../lib/api';

export interface ProtocolNetworkInfo {
  name: string;
  chainId: number;
  hexChainId: string;
  currency: string;
  rpcUrl: string;
  explorerUrl: string;
  consensus: string;
}

export interface ProtocolContractsInfo {
  masterTreasury: string;
  daoGovernance: string;
  sbtMembership: string;
}

export interface ProtocolRelayerInfo {
  status: string;
  type: string;
}

export interface LiveProtocolResponse {
  success: boolean;
  network: ProtocolNetworkInfo;
  contracts: ProtocolContractsInfo;
  relayer: ProtocolRelayerInfo;
}

// ── Fallback Single Source of Truth Configuration ──────────────────────────────
export const PROTOCOL_CONFIG: LiveProtocolResponse = {
  success: true,
  network: {
    name: 'Polygon Amoy (POS Testnet)',
    chainId: Number(process.env.EXPO_PUBLIC_CHAIN_ID || 80002),
    hexChainId: '0x13882',
    currency: 'POL (Polygon Ecosystem Token)',
    rpcUrl: process.env.EXPO_PUBLIC_AMOY_RPC || 'https://rpc-amoy.polygon.technology',
    explorerUrl: process.env.EXPO_PUBLIC_EXPLORER_URL || 'https://amoy.polygonscan.com',
    consensus: 'Bor + Heimdall (Proof-of-Stake)',
  },
  contracts: {
    masterTreasury: process.env.EXPO_PUBLIC_CONTRACT_ADDRESS || '0x1887be6c9cc06ddddb125da24b9b554c18f0a1fb',
    daoGovernance: process.env.EXPO_PUBLIC_DAO_CONTRACT_ADDRESS || '0x0b15187c87a9c3f8588753c123b7071a9548cc9c',
    sbtMembership: process.env.EXPO_PUBLIC_SBT_CONTRACT_ADDRESS || '0x7a376e224276988e3b01aae7a5b17c8c14e94031',
  },
  relayer: {
    status: 'Active',
    type: 'Sponsored Gasless Meta-Tx',
  },
};

/**
 * Generates an explorer link for any smart contract or wallet address
 */
export function getExplorerAddressUrl(address: string, baseUrl = PROTOCOL_CONFIG.network.explorerUrl): string {
  const cleanAddr = address && address !== '0x0000000000000000000000000000000000000000'
    ? address
    : PROTOCOL_CONFIG.contracts.masterTreasury;
  return `${baseUrl}/address/${cleanAddr}`;
}

/**
 * Generates an explorer link for any on-chain transaction hash
 */
export function getExplorerTxUrl(txHash: string, baseUrl = PROTOCOL_CONFIG.network.explorerUrl): string {
  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Dynamically fetches live protocol discovery info from the backend.
 * Falls back gracefully to centralized PROTOCOL_CONFIG if offline or unreachable.
 */
export async function fetchLiveProtocolConfig(): Promise<LiveProtocolResponse> {
  try {
    const res = await api.get('/public/protocol');
    if (res.data && res.data.success) {
      return res.data;
    }
  } catch {
    // Graceful offline fallback
  }

  return PROTOCOL_CONFIG;
}
