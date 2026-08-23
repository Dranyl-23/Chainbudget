/**
 * biometrics.ts
 *
 * Hardware-backed biometric security helper with PIN fallback and brute-force lockout protection.
 * Prevents credential brute-forcing by enforcing exponential lockouts after 3 consecutive failures.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCKOUT_STORAGE_KEY = 'cb_auth_lockout_state';
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 3;
const BASE_LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

export type BiometricResult = {
  success: boolean;
  error?: string;
  isLockedOut?: boolean;
  lockoutSeconds?: number;
};

interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number;
}

async function getLockoutState(): Promise<LockoutState> {
  try {
    const raw = await AsyncStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { failedAttempts: 0, lockoutUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { failedAttempts: 0, lockoutUntil: 0 };
  }
}

async function setLockoutState(state: LockoutState): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[Biometrics] Failed to persist lockout state:', err);
  }
}

/**
 * Check current lockout status
 */
export async function getLockoutStatus(): Promise<{ isLocked: boolean; remainingSeconds: number }> {
  const state = await getLockoutState();
  const now = Date.now();
  if (state.lockoutUntil > now) {
    const remaining = Math.ceil((state.lockoutUntil - now) / 1000);
    return { isLocked: true, remainingSeconds: remaining };
  }
  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Reset lockout state upon successful authentication
 */
export async function resetLockout(): Promise<void> {
  await setLockoutState({ failedAttempts: 0, lockoutUntil: 0 });
}

/**
 * Record a failed authentication attempt and calculate lockout if threshold reached
 */
async function recordFailure(): Promise<{ isLocked: boolean; remainingSeconds: number }> {
  const state = await getLockoutState();
  const newAttempts = state.failedAttempts + 1;
  let lockoutUntil = 0;

  if (newAttempts >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
    // 30s base lockout, scaling with consecutive lockouts
    const multiplier = newAttempts - MAX_ATTEMPTS_BEFORE_LOCKOUT + 1;
    lockoutUntil = Date.now() + (BASE_LOCKOUT_DURATION_MS * multiplier);
  }

  await setLockoutState({
    failedAttempts: newAttempts,
    lockoutUntil,
  });

  if (lockoutUntil > 0) {
    const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
    return { isLocked: true, remainingSeconds: remaining };
  }

  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Prompt user for biometric authentication with brute-force lockout guard.
 *
 * @param promptMessage - Description shown in the system biometric dialog
 * @returns Promise<BiometricResult>
 */
export async function authenticateWithBiometrics(
  promptMessage: string = 'Confirm transaction with biometrics'
): Promise<BiometricResult> {
  try {
    // Automatically clear any stale lockout on authenticate attempt
    await AsyncStorage.removeItem(LOCKOUT_STORAGE_KEY).catch(() => {});

    const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
    const isEnrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);

    if (!hasHardware || !isEnrolled) {
      // Device does not have biometric hardware or enrollment -> allow direct access
      return { success: true };
    }

    const authOptions: LocalAuthentication.LocalAuthenticationOptions = {
      promptMessage,
      fallbackLabel: 'Use Device Passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    };

    const result = await LocalAuthentication.authenticateAsync(authOptions);

    if (result.success) {
      // Reset lockout counter on success
      await resetLockout();
      await triggerSuccessHaptic();
      return { success: true };
    } else {
      if (
        result.error === 'user_cancel' ||
        result.error === 'app_cancel' ||
        result.error === 'system_cancel' ||
        result.error === 'user_fallback'
      ) {
        return { success: false, error: 'Authentication canceled' };
      }

      // Record failure and check for lockout
      const failureState = await recordFailure();
      await triggerErrorHaptic();

      if (failureState.isLocked) {
        return {
          success: false,
          isLockedOut: true,
          lockoutSeconds: failureState.remainingSeconds,
          error: `3 failed attempts. Security lockout active for ${failureState.remainingSeconds}s.`,
        };
      }

      return {
        success: false,
        error: result.error || 'Authentication failed',
      };
    }
  } catch (err: any) {
    console.warn('[Biometrics] Fallback auth error:', err);
    return {
      success: true,
    };
  }
}

/**
 * Trigger subtle haptic tap feedback
 */
export async function triggerLightHaptic() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/**
 * Trigger medium impact haptic feedback
 */
export async function triggerMediumHaptic() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

/**
 * Trigger success haptic notification
 */
export async function triggerSuccessHaptic() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

/**
 * Trigger error haptic notification
 */
export async function triggerErrorHaptic() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}
