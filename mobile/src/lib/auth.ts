/**
 * auth.ts
 *
 * Web3 challenge-response authentication flow.
 *
 * Flow:
 *   1. GET /api/auth/nonce/{walletAddress} — server issues one-time nonce
 *   2. signLoginChallenge(nonce)           — ECDSA sign with device private key
 *   3. POST /api/auth/verify-signature     — server verifies, issues JWT
 *   4. storeSessionToken(jwt)              — persist JWT to SecureStore
 */

import axios from 'axios';
import { signLoginChallenge } from './wallet';
import { storeSessionToken, getSessionToken, clearAll } from './secureStorage';
import { API_URL } from './api';

/** User shape returned from the backend after successful auth */
export type AuthUser = {
  id: string;
  walletAddress: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  memberships: any[];
  isSuperAdmin: boolean;
  hasBackedUpPhrase: boolean;
};

/**
 * registerWallet
 *
 * Registers a newly generated wallet with the backend.
 * Called once after generateAndStoreWallet().
 * The private key is NEVER included — only public-facing wallet info.
 */
export async function registerWallet(params: {
  walletAddress: string;
  publicKey: string;
  displayName: string;
  email?: string;
}): Promise<{ userId: string }> {
  const res = await axios.post(`${API_URL}/auth/register`, params);
  return res.data;
}

/**
 * loginWithWallet
 *
 * Full challenge-response authentication sequence.
 * Returns the authenticated user profile and persists the JWT to SecureStore.
 *
 * Steps:
 *  1. Request nonce from backend
 *  2. Sign nonce with device private key (triggers biometric if enrolled)
 *  3. Submit signature to backend for verification
 *  4. Backend issues JWT → persisted to SecureStore
 */
export async function loginWithWallet(walletAddress: string): Promise<AuthUser> {
  // 1. Request one-time challenge
  const nonceRes = await axios.get(`${API_URL}/auth/nonce/${walletAddress}`);
  const { nonce } = nonceRes.data;

  // 2. Sign with device private key (biometric gate enforced by SecureStore)
  const signature = await signLoginChallenge(nonce);

  // 3. Submit for verification
  const verifyRes = await axios.post(`${API_URL}/auth/verify-signature`, {
    walletAddress,
    signature,
  });

  const { token, user } = verifyRes.data;

  // 4. Persist JWT — subsequent API calls use this
  await storeSessionToken(token);

  return user;
}

/**
 * fetchCurrentUser
 *
 * Validates the stored JWT by fetching /api/auth/me.
 * Returns the user profile or null if the token is invalid/expired.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const res = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.user;
  } catch (err: any) {
    if (err.response?.status === 401) {
      // Token expired — clear it
      await clearAll();
    }
    return null;
  }
}

/**
 * logout
 *
 * Clears all local wallet session data.
 * Note: The wallet keys (private key + mnemonic) are preserved in SecureStore
 * so the user can log back in without re-entering their recovery phrase.
 * Only the session JWT is cleared.
 */
export async function logout(): Promise<void> {
  // Clear only the session token, not the wallet keys
  // (user can log back in by signing a new challenge)
  const { STORAGE_KEYS } = await import('./secureStorage');
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_TOKEN);
}
