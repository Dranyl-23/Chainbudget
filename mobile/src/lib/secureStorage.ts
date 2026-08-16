/**
 * secureStorage.ts
 *
 * Typed abstraction over expo-secure-store.
 * All wallet-sensitive data is stored here — NEVER in AsyncStorage.
 *
 * expo-secure-store uses:
 *   Android — Android Keystore + EncryptedSharedPreferences (hardware-backed TEE)
 *   iOS     — Keychain with Secure Enclave (hardware-backed)
 *
 * Keys that require biometric authentication are flagged with
 * { requireAuthentication: true } which triggers FaceID/TouchID/PIN
 * before the value is decrypted and returned.
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

// ── Storage key names ──────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  PRIVATE_KEY:   'cb_private_key',    // secp256k1 hex private key  (biometric-gated)
  MNEMONIC:      'cb_mnemonic',       // BIP-39 12-word phrase       (biometric-gated)
  WALLET_ADDRESS:'cb_wallet_addr',    // public wallet address       (no gate)
  SESSION_TOKEN: 'cb_session_token',  // ChainBudget backend JWT     (no gate)
} as const;

// ── Private helpers ────────────────────────────────────────────────────────────

async function getBiometricOptions(): Promise<SecureStore.SecureStoreOptions> {
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return { requireAuthentication: isEnrolled };
}

const STANDARD_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: false,
};

// ── Public API ─────────────────────────────────────────────────────────────────

/** Store the private key (hardware-encrypted, biometric-gated if available). */
export async function storePrivateKey(privateKey: string): Promise<void> {
  const options = await getBiometricOptions();
  await SecureStore.setItemAsync(STORAGE_KEYS.PRIVATE_KEY, privateKey, options);
}

/**
 * Retrieve the private key.
 * On physical devices with biometrics, this triggers a biometric prompt.
 * Returns null if not found or authentication fails.
 */
export async function getPrivateKey(): Promise<string | null> {
  try {
    const options = await getBiometricOptions();
    return await SecureStore.getItemAsync(STORAGE_KEYS.PRIVATE_KEY, options);
  } catch {
    return null;
  }
}

/** Store the BIP-39 mnemonic (hardware-encrypted, biometric-gated if available). */
export async function storeMnemonic(mnemonic: string): Promise<void> {
  const options = await getBiometricOptions();
  await SecureStore.setItemAsync(STORAGE_KEYS.MNEMONIC, mnemonic, options);
}

/**
 * Retrieve the mnemonic for wallet restoration.
 * Biometric-gated — only call when displaying to the user.
 */
export async function getMnemonic(): Promise<string | null> {
  try {
    const options = await getBiometricOptions();
    return await SecureStore.getItemAsync(STORAGE_KEYS.MNEMONIC, options);
  } catch {
    return null;
  }
}

/** Store the public wallet address (no biometric gate needed — it is public info). */
export async function storeWalletAddress(address: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.WALLET_ADDRESS, address.toLowerCase(), STANDARD_OPTIONS);
}

/** Retrieve the wallet address quickly (no biometric prompt). */
export async function getWalletAddress(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.WALLET_ADDRESS, STANDARD_OPTIONS);
}

/** Persist the backend session JWT. */
export async function storeSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_TOKEN, token, STANDARD_OPTIONS);
}

/** Retrieve the backend session JWT. */
export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.SESSION_TOKEN, STANDARD_OPTIONS);
}

/** Clear ALL wallet data from secure storage (logout / account removal). */
export async function clearAll(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.PRIVATE_KEY),
    SecureStore.deleteItemAsync(STORAGE_KEYS.MNEMONIC),
    SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_ADDRESS),
    SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_TOKEN),
  ]);
}

/** Returns true if a wallet has been generated on this device. */
export async function hasWallet(): Promise<boolean> {
  const addr = await getWalletAddress();
  return !!addr;
}

/** Returns true if a session token exists (may still be expired). */
export async function hasSession(): Promise<boolean> {
  const token = await getSessionToken();
  return !!token;
}
