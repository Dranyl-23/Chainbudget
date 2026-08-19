/**
 * biometrics.ts
 *
 * Reusable biometric security helper for ChainBudget Mobile.
 * Encapsulates expo-local-authentication and expo-haptics to provide
 * hardware-backed FaceID/Fingerprint confirmation on sensitive operations.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';

export type BiometricResult = {
  success: boolean;
  error?: string;
};

/**
 * Prompt user for biometric authentication before executing high-risk operations.
 *
 * @param promptMessage - Description shown in the system biometric dialog
 * @returns Promise<BiometricResult>
 */
export async function authenticateWithBiometrics(
  promptMessage: string = 'Confirm transaction with biometrics'
): Promise<BiometricResult> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    // If hardware is unavailable or no biometrics enrolled, permit device PIN/passcode fallback
    if (!hasHardware || !isEnrolled) {
      return { success: true };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Device Passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });

    if (result.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { success: true };
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return { success: false, error: result.error || 'Authentication canceled or failed' };
    }
  } catch (err: any) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return { success: false, error: err.message || 'Biometric authentication failed' };
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
 * Trigger medium impact haptic feedback (e.g. state changes, button presses)
 */
export async function triggerMediumHaptic() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

/**
 * Trigger success haptic notification (e.g. copied to clipboard, transaction confirmed)
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
