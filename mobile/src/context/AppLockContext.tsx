/**
 * AppLockContext.tsx
 *
 * Hardware-backed App Lock Security Manager for ChainBudget Mobile.
 * Manages 6-digit PIN encryption, biometric fallback, and automatic background timeout locking.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useAuth } from './AuthContext';
import {
  authenticateWithBiometrics,
  triggerLightHaptic,
  triggerSuccessHaptic,
  triggerErrorHaptic,
} from '../lib/biometrics';

const PIN_STORE_KEY = 'cb_app_lock_pin_hash';
const APP_LOCK_ENABLED_KEY = 'cb_app_lock_enabled';
const BIOMETRIC_ENABLED_KEY = 'cb_app_lock_biometric_enabled';
const LOCK_TIMEOUT_KEY = 'cb_app_lock_timeout';
const MASK_BALANCE_KEY = 'cb_app_mask_balance';

export type LockTimeoutOption = 'immediately' | '1m' | '5m' | '15m';

interface AppLockContextType {
  isLocked: boolean;
  isAppLockEnabled: boolean;
  isBiometricEnabled: boolean;
  hasPinSet: boolean;
  lockTimeout: LockTimeoutOption;
  maskBalance: boolean;
  setIsLocked: (locked: boolean) => void;
  setAppLockEnabled: (enabled: boolean) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setLockTimeoutOption: (option: LockTimeoutOption) => Promise<void>;
  setMaskBalanceOption: (masked: boolean) => Promise<void>;
  setPin: (pin: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  removePin: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockNow: () => void;
}

const AppLockContext = createContext<AppLockContextType>({
  isLocked: false,
  isAppLockEnabled: false,
  isBiometricEnabled: true,
  hasPinSet: false,
  lockTimeout: 'immediately',
  maskBalance: false,
  setIsLocked: () => {},
  setAppLockEnabled: async () => {},
  setBiometricEnabled: async () => {},
  setLockTimeoutOption: async () => {},
  setMaskBalanceOption: async () => {},
  setPin: async () => false,
  verifyPin: async () => false,
  removePin: async () => {},
  unlockWithBiometrics: async () => false,
  unlockWithPin: async () => false,
  lockNow: () => {},
});

export function useAppLock() {
  return useContext(AppLockContext);
}

// Native fast SHA-256 salt & hash helper for hardware PIN verification
async function hashPin(pin: string): Promise<string> {
  const salt = 'chainbudget_secure_pin_salt_2026';
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + pin);
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [isLocked, setIsLocked] = useState(false);
  const [isAppLockEnabled, setIsAppLockEnabledState] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabledState] = useState(true);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [lockTimeout, setLockTimeoutState] = useState<LockTimeoutOption>('immediately');
  const [maskBalance, setMaskBalanceState] = useState(false);

  const backgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Load user preferences on mount and when user session changes
  useEffect(() => {
    async function loadSettings() {
      if (!user) {
        setIsLocked(false);
        setIsAppLockEnabledState(false);
        setHasPinSet(false);
        return;
      }

      try {
        const [savedPin, savedEnabled, savedBio, savedTimeout, savedMask] = await Promise.all([
          SecureStore.getItemAsync(PIN_STORE_KEY),
          AsyncStorage.getItem(APP_LOCK_ENABLED_KEY),
          AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY),
          AsyncStorage.getItem(LOCK_TIMEOUT_KEY),
          AsyncStorage.getItem(MASK_BALANCE_KEY),
        ]);

        const hasPin = Boolean(savedPin);
        const lockEnabled = savedEnabled === 'true' && hasPin;
        const bioEnabled = savedBio !== 'false';
        const timeout = (savedTimeout as LockTimeoutOption) || 'immediately';
        const mask = savedMask === 'true';

        setHasPinSet(hasPin);
        setIsAppLockEnabledState(lockEnabled);
        setIsBiometricEnabledState(bioEnabled);
        setLockTimeoutState(timeout);
        setMaskBalanceState(mask);

        // If lock is enabled, lock on initial app launch
        if (lockEnabled) {
          setIsLocked(true);
        }
      } catch (err) {
        console.warn('[AppLockContext] Error loading lock settings:', err);
      }
    }

    loadSettings();
  }, [user]);

  // Monitor AppState to trigger lock on background -> active transition
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        // App went to background
        backgroundTimeRef.current = Date.now();
      }

      if (
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextAppState === 'active'
      ) {
        // App came to foreground
        if (isAppLockEnabled && hasPinSet) {
          const bgTime = backgroundTimeRef.current;
          if (bgTime) {
            const elapsedMs = Date.now() - bgTime;
            let shouldLock = false;

            if (lockTimeout === 'immediately') {
              shouldLock = elapsedMs > 1500; // Small grace period for biometric dialogs
            } else if (lockTimeout === '1m') {
              shouldLock = elapsedMs > 60 * 1000;
            } else if (lockTimeout === '5m') {
              shouldLock = elapsedMs > 5 * 60 * 1000;
            } else if (lockTimeout === '15m') {
              shouldLock = elapsedMs > 15 * 60 * 1000;
            }

            if (shouldLock) {
              setIsLocked(true);
            }
          }
        }
        backgroundTimeRef.current = null;
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAppLockEnabled, hasPinSet, lockTimeout]);

  const setPin = useCallback(async (pin: string): Promise<boolean> => {
    if (pin.length !== 6) return false;
    try {
      const hashed = await hashPin(pin);
      await SecureStore.setItemAsync(PIN_STORE_KEY, hashed);
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, 'true');
      setHasPinSet(true);
      setIsAppLockEnabledState(true);
      await triggerSuccessHaptic();
      return true;
    } catch (err) {
      console.error('[AppLockContext] Failed to set PIN:', err);
      await triggerErrorHaptic();
      return false;
    }
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const storedHash = await SecureStore.getItemAsync(PIN_STORE_KEY);
      if (!storedHash) return false;
      const inputHash = await hashPin(pin);
      return storedHash === inputHash;
    } catch (err) {
      console.error('[AppLockContext] Error verifying PIN:', err);
      return false;
    }
  }, []);

  const removePin = useCallback(async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(PIN_STORE_KEY);
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, 'false');
      setHasPinSet(false);
      setIsAppLockEnabledState(false);
      setIsLocked(false);
      await triggerLightHaptic();
    } catch (err) {
      console.error('[AppLockContext] Error removing PIN:', err);
    }
  }, []);

  const setAppLockEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
      setIsAppLockEnabledState(enabled);
      if (!enabled) {
        setIsLocked(false);
      }
      await triggerLightHaptic();
    } catch (err) {
      console.error('[AppLockContext] Error saving app lock state:', err);
    }
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
      setIsBiometricEnabledState(enabled);
      await triggerLightHaptic();
    } catch (err) {
      console.error('[AppLockContext] Error saving biometric state:', err);
    }
  }, []);

  const setLockTimeoutOption = useCallback(async (option: LockTimeoutOption): Promise<void> => {
    try {
      await AsyncStorage.setItem(LOCK_TIMEOUT_KEY, option);
      setLockTimeoutState(option);
      await triggerLightHaptic();
    } catch (err) {
      console.error('[AppLockContext] Error saving lock timeout:', err);
    }
  }, []);

  const setMaskBalanceOption = useCallback(async (masked: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(MASK_BALANCE_KEY, masked ? 'true' : 'false');
      setMaskBalanceState(masked);
      await triggerLightHaptic();
    } catch (err) {
      console.error('[AppLockContext] Error saving mask balance option:', err);
    }
  }, []);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!isBiometricEnabled) return false;
    try {
      const result = await authenticateWithBiometrics('Unlock ChainBudget with Biometrics');
      if (result.success) {
        setIsLocked(false);
        await triggerSuccessHaptic();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [isBiometricEnabled]);

  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const valid = await verifyPin(pin);
    if (valid) {
      setIsLocked(false);
      await triggerSuccessHaptic();
      return true;
    } else {
      await triggerErrorHaptic();
      return false;
    }
  }, [verifyPin]);

  const lockNow = useCallback(() => {
    if (isAppLockEnabled && hasPinSet) {
      setIsLocked(true);
    }
  }, [isAppLockEnabled, hasPinSet]);

  return (
    <AppLockContext.Provider
      value={{
        isLocked,
        isAppLockEnabled,
        isBiometricEnabled,
        hasPinSet,
        lockTimeout,
        maskBalance,
        setIsLocked,
        setAppLockEnabled,
        setBiometricEnabled,
        setLockTimeoutOption,
        setMaskBalanceOption,
        setPin,
        verifyPin,
        removePin,
        unlockWithBiometrics,
        unlockWithPin,
        lockNow,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
}
