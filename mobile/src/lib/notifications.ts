/**
 * notifications.ts
 *
 * Push notification registration and handling for ChainBudget Mobile.
 *
 * Uses expo-notifications to:
 *   1. Request push permission from the OS (iOS requires explicit permission).
 *   2. Fetch an Expo Push Token (device-specific token used to send pushes).
 *   3. Register the token with the backend (POST /api/users/push-token).
 *   4. Configure how notifications are displayed when the app is in the foreground.
 *
 * The notification response handler (tap-to-navigate) is wired in App.tsx
 * using addNotificationResponseReceivedListener.
 *
 * Backend integration:
 *   The backend stores push tokens on the User model and uses the Expo Push API
 *   (https://exp.host/--/api/v2/push/send) to deliver push notifications.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';
import { API_URL } from './api';

// ── Expo Go guard ─────────────────────────────────────────────────────────────
// Remote push notifications were removed from Expo Go in SDK 53.
// All push code is silently skipped when running in Expo Go so the app
// doesn't generate console errors during development.
// In a development build (npx expo run:android / run:ios) or production
// binary, IS_EXPO_GO is false and push notifications work fully.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// ── Foreground notification behavior ──────────────────────────────────────────
// Show notifications even when the app is in the foreground.
// Guarded: setNotificationHandler is what triggers warnOfExpoGoPushUsage in Expo Go.
if (!IS_EXPO_GO) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ── Android notification channel ──────────────────────────────────────────────
// Required on Android 8+ (API 26+). Without a channel, no notifications appear.
export async function setupAndroidNotificationChannel() {
  // No-op in Expo Go — channel setup is only meaningful in dev/production builds
  if (IS_EXPO_GO) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#a21caf',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('chainbudget-default', {
      name: 'ChainBudget Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#a21caf', // ChainBudget fuchsia accent
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('chainbudget-approvals', {
      name: 'Approval Requests',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#22c55e',
      sound: 'default',
      description: 'High-priority notifications for pending transaction approvals',
    });

    await Notifications.setNotificationChannelAsync('chainbudget-dao', {
      name: 'DAO Governance & Voting',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: '#8b5cf6',
      sound: 'default',
      description: 'Alerts for new DAO proposals and voting rounds',
    });

    await Notifications.setNotificationChannelAsync('chainbudget-chat', {
      name: 'Organization Chat Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#38bdf8', // Sky/Cyan accent
      sound: 'default',
      description: 'Real-time organization chat messages and mentions',
    });
  }
}

/**
 * registerForPushNotifications
 *
 * Requests notification permission, fetches the Expo push token, and registers
 * it with the ChainBudget backend. Safe to call on every login — the backend
 * deduplicates tokens.
 *
 * Returns the Expo push token string, or null if:
 *   - Running in Expo Go (push removed in SDK 53)
 *   - Running on a simulator/emulator
 *   - User denied permission
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Remote push is not supported in Expo Go since SDK 53 — skip silently.
  // Build a dev client (npx expo run:android / run:ios) to test push notifications.
  if (IS_EXPO_GO) {
    console.log('[Notifications] Skipping push registration in Expo Go — use a dev build.');
    return null;
  }

  // Push notifications require a physical device
  if (!Device.isDevice) {
    console.log('[Notifications] Push tokens are not available on simulator/emulator.');
    return null;
  }

  await setupAndroidNotificationChannel();

  // Request permission (iOS shows a system dialog; Android 13+ also requires it)
  const existingSettings = (await Notifications.getPermissionsAsync()) as any;
  let existingStatus = existingSettings.status || (existingSettings.granted ? 'granted' : 'denied');
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const requestedSettings = (await Notifications.requestPermissionsAsync()) as any;
    finalStatus = requestedSettings.status || (requestedSettings.granted ? 'granted' : 'denied');
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Push notification permission denied.');
    return null;
  }

  // Get the Expo push token with the official EAS Project ID
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      '85dd7732-5fd7-438e-8e34-6d2246d7426a';

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const expoPushToken = tokenData.data;

    // Register the token with our backend
    await api.post('/users/push-token', {
      token: expoPushToken,
      platform: Platform.OS,
    });

    console.log('[Notifications] Push token registered:', expoPushToken);
    return expoPushToken;
  } catch (err: any) {
    console.warn('[Notifications] Failed to register push token:', err?.message || err);
    return null;
  }
}
