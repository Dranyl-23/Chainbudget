/**
 * wallet.ts
 *
 * HD wallet generation, key derivation, and signing using ethers.js v6.
 *
 * SECURITY CONTRACT:
 *  - The private key and mnemonic are NEVER sent to the backend.
 *  - They are generated locally using cryptographically secure entropy
 *    (react-native-get-random-values polyfills crypto.getRandomValues).
 *  - After generation they are immediately persisted to expo-secure-store
 *    (hardware-backed Keystore/Keychain) and cleared from JS memory ASAP.
 *  - The mnemonic is only read from SecureStore when the user explicitly
 *    requests it (backup screen) and is never stored in React state.
 *
 * Derivation:
 *   BIP-39 mnemonic (128-bit entropy → 12 words)
 *   BIP-44 path: m/44'/60'/0'/0/0  (Ethereum/Polygon compatible)
 */

import { ethers } from 'ethers';
import {
  storePrivateKey,
  storeMnemonic,
  storeWalletAddress,
  getPrivateKey,
  getMnemonic,
  getWalletAddress,
} from './secureStorage';

// BIP-44 derivation path for Ethereum / Polygon
const DERIVATION_PATH = "m/44'/60'/0'/0/0";

export type GeneratedWallet = {
  address: string;
  publicKey: string;
  // NOTE: privateKey and mnemonic are NOT returned here — they go straight to SecureStore
};

/**
 * generateAndStoreWallet
 *
 * Creates a new BIP-39/44 HD wallet from fresh entropy, persists the private
 * key + mnemonic to hardware-backed secure storage, and returns only the
 * public-facing values (address + publicKey).
 *
 * Call this once during user registration.
 */
export async function generateAndStoreWallet(): Promise<GeneratedWallet> {
  // 1. Generate 128-bit (12-word) BIP-39 mnemonic using secure entropy.
  //    react-native-get-random-values must be imported in the app entry point
  //    (App.tsx already does `import 'react-native-get-random-values'`).
  const mnemonic = ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));

  // 2. Derive HD wallet from BIP-44 path
  const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, DERIVATION_PATH);

  // 3. Persist sensitive material to hardware-backed storage BEFORE returning
  await Promise.all([
    storePrivateKey(hdWallet.privateKey),
    storeMnemonic(mnemonic),
    storeWalletAddress(hdWallet.address),
  ]);

  // 4. Return only public values — private key + mnemonic NEVER leave this function
  return {
    address: hdWallet.address,
    publicKey: hdWallet.publicKey,
  };
}

/**
 * restoreWalletFromPhrase
 *
 * Derives a wallet from an existing 12-word mnemonic (device restore flow).
 * Re-stores the derived keys in SecureStore.
 * Returns the public wallet address for backend verification.
 */
export async function restoreWalletFromPhrase(phrase: string): Promise<GeneratedWallet> {
  // Validate mnemonic before deriving
  if (!ethers.Mnemonic.isValidMnemonic(phrase.trim())) {
    throw new Error('Invalid recovery phrase. Please check all 12 words and try again.');
  }

  const hdWallet = ethers.HDNodeWallet.fromPhrase(phrase.trim(), undefined, DERIVATION_PATH);

  await Promise.all([
    storePrivateKey(hdWallet.privateKey),
    storeMnemonic(phrase.trim()),
    storeWalletAddress(hdWallet.address),
  ]);

  return {
    address: hdWallet.address,
    publicKey: hdWallet.publicKey,
  };
}

/**
 * signLoginChallenge
 *
 * Signs a backend-issued nonce string using the device's stored private key.
 * This is the ECDSA personal_sign (EIP-191 prefixed) used for authentication.
 *
 * On real devices this will trigger the biometric prompt via SecureStore.
 *
 * Returns the hex signature string.
 */
export async function signLoginChallenge(nonce: string): Promise<string> {
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error('No wallet found on this device. Please register or restore your wallet.');
  }

  const wallet = new ethers.Wallet(privateKey);
  const signature = await wallet.signMessage(nonce);
  return signature;
}

/**
 * signApprovalAction
 *
 * Signs an EIP-712 typed data approval message (used in ApprovalsScreen).
 * This replaces the insecure /api/auth/keys API call.
 *
 * Returns the hex signature string.
 */
export async function signApprovalAction(
  txId: string,
  action: 'approved' | 'rejected',
  amount: string,
  description: string
): Promise<string> {
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error('No wallet found on this device. Please restore your wallet.');
  }

  const wallet = new ethers.Wallet(privateKey);

  const domain = { name: 'ChainBudget', version: '1' };
  const types = {
    Approval: [
      { name: 'action',      type: 'string' },
      { name: 'txId',        type: 'string' },
      { name: 'amount',      type: 'string' },
      { name: 'description', type: 'string' },
    ],
  };
  const message = { action, txId, amount, description };

  const signature = await wallet.signTypedData(domain, types, message);
  return signature;
}

/**
 * signEscrowRelease
 *
 * Cryptographically signs an EIP-191 escrow release authorization message
 * using the payee's device-stored private key.
 *
 * Contract Verification Digest:
 *   keccak256(abi.encodePacked(contractAddress, chainId, onChainTxId, amountWei, supplierAddress, "ESCROW_RELEASE"))
 *
 * The resulting signature can be submitted gaslessly via the backend relayer.
 */
export async function signEscrowRelease(
  contractAddress: string,
  chainId: number | bigint,
  onChainTxId: number | string,
  amountWei: bigint | string,
  supplierAddress: string
): Promise<string> {
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error('No wallet found on this device. Please restore your wallet.');
  }

  const wallet = new ethers.Wallet(privateKey);

  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'uint256', 'uint256', 'address', 'string'],
    [
      ethers.getAddress(contractAddress),
      BigInt(chainId),
      BigInt(onChainTxId),
      BigInt(amountWei),
      ethers.getAddress(supplierAddress),
      'ESCROW_RELEASE'
    ]
  );

  const signature = await wallet.signMessage(ethers.getBytes(messageHash));
  return signature;
}

/**
 * getStoredWalletAddress
 *
 * Returns the locally stored wallet address without biometric prompt.
 * Used for display purposes and for making nonce requests.
 */
export async function getStoredWalletAddress(): Promise<string | null> {
  return getWalletAddress();
}

/**
 * validateMnemonic
 *
 * Checks if a user-entered phrase is a valid BIP-39 mnemonic.
 * Safe to call without triggering SecureStore.
 */
export function validateMnemonic(phrase: string): boolean {
  return ethers.Mnemonic.isValidMnemonic(phrase.trim());
}
