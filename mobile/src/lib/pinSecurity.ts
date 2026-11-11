/**
 * pinSecurity.ts
 *
 * Salted PBKDF2-HMAC-SHA256 key derivation and SecureStore-persisted exponential
 * lockout enforcement for the ChainBudget Mobile App Lock.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { ethers } from 'ethers';

export const PIN_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 5;
export const BASE_LOCKOUT_SECONDS = 30;
export const MAX_LOCKOUT_SECONDS = 900; // 15 minutes cap

const PBKDF2_ITERATIONS = 15000;
const LOCKOUT_STORE_KEY = 'cb_app_lock_lockout_v1';
const LEGACY_STATIC_SALT = 'chainbudget_secure_pin_salt_2026';

export interface PinLockoutState {
  failedAttempts: number;
  lockoutCount: number;
  lockedUntil: number;
  remainingSeconds: number;
}

export interface PinAttemptResult {
  success: boolean;
  remainingAttempts: number;
  lockoutRemainingSeconds: number;
  lockedOut: boolean;
  upgradedHash?: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Derive a salted PBKDF2-HMAC-SHA256 digest for a 6-digit PIN.
 * Format: v2$pbkdf2$<iterations>$<saltHex>$<digestHex>
 */
export async function hashPinWithSalt(pin: string): Promise<string> {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const saltHex = bytesToHex(saltBytes);
  const digest = ethers.pbkdf2(
    ethers.toUtf8Bytes(pin),
    ethers.toUtf8Bytes(saltHex),
    PBKDF2_ITERATIONS,
    32,
    'sha256'
  );
  return `v2$pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${digest}`;
}

async function verifyStoredPinHash(
  pin: string,
  storedHash: string
): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (storedHash.startsWith('v2$pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 5) return { valid: false };
    const iterations = Number(parts[2]);
    const saltHex = parts[3];
    const expectedDigest = parts[4];
    if (!Number.isInteger(iterations) || iterations < 1000 || !saltHex || !expectedDigest) {
      return { valid: false };
    }
    const computed = ethers.pbkdf2(
      ethers.toUtf8Bytes(pin),
      ethers.toUtf8Bytes(saltHex),
      iterations,
      32,
      'sha256'
    );
    return { valid: timingSafeEqualString(computed, expectedDigest) };
  }

  // Legacy v1 format migration check: static-salt single-round SHA-256
  const legacyDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    LEGACY_STATIC_SALT + pin
  );
  if (!timingSafeEqualString(legacyDigest, storedHash)) {
    return { valid: false };
  }

  const upgradedHash = await hashPinWithSalt(pin);
  return { valid: true, upgradedHash };
}

/**
 * Load persistent PIN lockout counters from hardware-backed SecureStore.
 */
export async function getPinLockoutState(): Promise<PinLockoutState> {
  try {
    const raw = await SecureStore.getItemAsync(LOCKOUT_STORE_KEY);
    if (!raw) {
      return { failedAttempts: 0, lockoutCount: 0, lockedUntil: 0, remainingSeconds: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<PinLockoutState>;
    const failedAttempts =
      typeof parsed.failedAttempts === 'number' && parsed.failedAttempts >= 0
        ? Math.floor(parsed.failedAttempts)
        : 0;
    const lockoutCount =
      typeof parsed.lockoutCount === 'number' && parsed.lockoutCount >= 0
        ? Math.floor(parsed.lockoutCount)
        : 0;
    const lockedUntil =
      typeof parsed.lockedUntil === 'number' && parsed.lockedUntil > 0
        ? parsed.lockedUntil
        : 0;
    const remainingSeconds =
      lockedUntil > Date.now() ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;
    return { failedAttempts, lockoutCount, lockedUntil, remainingSeconds };
  } catch {
    return { failedAttempts: 0, lockoutCount: 0, lockedUntil: 0, remainingSeconds: 0 };
  }
}

export async function clearPinLockout(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LOCKOUT_STORE_KEY);
  } catch {
    // Ignore storage cleanup errors
  }
}

/**
 * Verify a PIN while strictly enforcing persistent SecureStore lockout & exponential backoff.
 */
export async function attemptPinVerification(
  pin: string,
  storedHash: string
): Promise<PinAttemptResult> {
  const state = await getPinLockoutState();
  if (state.remainingSeconds > 0) {
    return {
      success: false,
      remainingAttempts: 0,
      lockoutRemainingSeconds: state.remainingSeconds,
      lockedOut: true,
    };
  }

  const { valid, upgradedHash } = await verifyStoredPinHash(pin, storedHash);
  if (valid) {
    await clearPinLockout();
    return {
      success: true,
      remainingAttempts: MAX_PIN_ATTEMPTS,
      lockoutRemainingSeconds: 0,
      lockedOut: false,
      upgradedHash,
    };
  }

  const priorExpired = state.lockedUntil > 0 && state.lockedUntil <= Date.now();
  const nextFailed = priorExpired ? 1 : state.failedAttempts + 1;

  if (nextFailed >= MAX_PIN_ATTEMPTS) {
    const nextLockoutCount = state.lockoutCount + 1;
    const durationSec = Math.min(
      BASE_LOCKOUT_SECONDS * 2 ** (nextLockoutCount - 1),
      MAX_LOCKOUT_SECONDS
    );
    const lockedUntil = Date.now() + durationSec * 1000;
    await SecureStore.setItemAsync(
      LOCKOUT_STORE_KEY,
      JSON.stringify({
        failedAttempts: 0,
        lockoutCount: nextLockoutCount,
        lockedUntil,
      })
    );
    return {
      success: false,
      remainingAttempts: 0,
      lockoutRemainingSeconds: durationSec,
      lockedOut: true,
    };
  }

  await SecureStore.setItemAsync(
    LOCKOUT_STORE_KEY,
    JSON.stringify({
      failedAttempts: nextFailed,
      lockoutCount: state.lockoutCount,
      lockedUntil: 0,
    })
  );
  return {
    success: false,
    remainingAttempts: MAX_PIN_ATTEMPTS - nextFailed,
    lockoutRemainingSeconds: 0,
    lockedOut: false,
  };
}
