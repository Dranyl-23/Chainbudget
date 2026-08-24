/**
 * AppLockOverlay.tsx
 *
 * Ultra-Modern Customized App Lock Screen (GCash / Maya / Web3 Hardware Vault style).
 * Features:
 * - 6-digit animated PIN dots with glowing feedback
 * - Interactive numeric keypad with sub-letters
 * - Automatic biometric face scan / fingerprint authentication prompt
 * - Error shake animation with haptic feedback
 * - Brute-force lockout protection with countdown timer
 * - Fallback account sign out option
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Modal,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAppLock } from '../context/AppLockContext';
import {
  triggerLightHaptic,
  triggerMediumHaptic,
  triggerErrorHaptic,
  triggerSuccessHaptic,
} from '../lib/biometrics';

const { width } = Dimensions.get('window');
const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

const KEYPAD_ROWS = [
  [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
  ],
  [
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
  ],
  [
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
  ],
];

export default function AppLockOverlay() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const {
    isLocked,
    isBiometricEnabled,
    unlockWithBiometrics,
    unlockWithPin,
  } = useAppLock();

  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Auto-prompt biometrics when screen is locked
  useEffect(() => {
    if (isLocked && isBiometricEnabled && lockoutTimer === 0) {
      const timer = setTimeout(() => {
        unlockWithBiometrics().catch(() => {});
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isLocked, isBiometricEnabled, lockoutTimer, unlockWithBiometrics]);

  // Lockout countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            setErrorMessage(null);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockoutTimer]);

  // Logo gentle pulse animation
  useEffect(() => {
    if (isLocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isLocked, pulseAnim]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleKeyPress = async (digit: string) => {
    if (lockoutTimer > 0 || isVerifying) return;
    if (pin.length >= PIN_LENGTH) return;

    await triggerLightHaptic();
    const newPin = pin + digit;
    setPin(newPin);
    setErrorMessage(null);

    if (newPin.length === PIN_LENGTH) {
      setIsVerifying(true);
      setTimeout(async () => {
        const success = await unlockWithPin(newPin);
        if (success) {
          setPin('');
          setErrorMessage(null);
          setFailedAttempts(0);
        } else {
          await triggerErrorHaptic();
          triggerShake();
          const newFailed = failedAttempts + 1;
          setFailedAttempts(newFailed);
          setPin('');

          if (newFailed >= MAX_ATTEMPTS) {
            setLockoutTimer(LOCKOUT_SECONDS);
            setErrorMessage(`Too many failed attempts. Try again in ${LOCKOUT_SECONDS}s`);
          } else {
            setErrorMessage(`Incorrect PIN (${MAX_ATTEMPTS - newFailed} attempts left)`);
          }
        }
        setIsVerifying(false);
      }, 150);
    }
  };

  const handleDelete = async () => {
    if (lockoutTimer > 0 || isVerifying) return;
    if (pin.length > 0) {
      await triggerLightHaptic();
      setPin((prev) => prev.slice(0, -1));
      setErrorMessage(null);
    }
  };

  const handleBiometricPress = async () => {
    if (lockoutTimer > 0) return;
    await triggerLightHaptic();
    await unlockWithBiometrics();
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out of ChainBudget',
      'If you forgot your PIN, signing out will require you to log back in using your account credentials or restore using your 12-word recovery phrase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const buttonSize = width > 400 ? 76 : width > 360 ? 70 : 64;

  if (!isLocked) return null;

  const displayName = user?.displayName || 'Member';

  return (
    <Modal visible={isLocked} animationType="fade" transparent={false} statusBarTranslucent={true}>
      <View style={{ flex: 1, backgroundColor: '#090616', width: '100%', height: '100%' }}>
        {/* Background Ambient Glowing Rings */}
        <LinearGradient
          colors={['#1e1045', '#0f0a26', '#090616']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        />

        {/* Ambient Top Glow Orb */}
        <View
          style={{
            position: 'absolute',
            top: -60,
            alignSelf: 'center',
            width: width * 0.85,
            height: width * 0.85,
            borderRadius: (width * 0.85) / 2,
            backgroundColor: 'rgba(99, 102, 241, 0.18)',
            transform: [{ scaleX: 1.2 }],
          }}
        />

        <View
          style={{
            flex: 1,
            paddingTop: Math.max(insets.top, 24) + 16,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            paddingHorizontal: 24,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* ── HEADER & AVATAR SECTION ── */}
          <View style={{ alignItems: 'center', width: '100%' }}>
            {/* Animated Logo Shield Emblem */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 14 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 22,
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  borderWidth: 1.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6366f1',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <Ionicons name="shield-checkmark" size={34} color="#818cf8" />
              </View>
            </Animated.View>

            {/* Greeting & Subtitle */}
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 21,
                fontWeight: '900',
                letterSpacing: 0.3,
                marginBottom: 4,
                textAlign: 'center',
              }}
            >
              Welcome back, {displayName}
            </Text>
            <Text
              style={{
                color: '#94A3B8',
                fontSize: 12.5,
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              Enter your 6-digit App PIN to unlock ChainBudget
            </Text>

            {/* ── 6-PIN ANIMATED DOTS ── */}
            <Animated.View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                marginVertical: 10,
                transform: [{ translateX: shakeAnim }],
              }}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, index) => {
                const isFilled = index < pin.length;
                const isCurrent = index === pin.length && !isVerifying;

                return (
                  <View
                    key={index}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: isFilled
                        ? '#818cf8'
                        : isCurrent
                        ? 'rgba(99, 102, 241, 0.3)'
                        : 'rgba(255, 255, 255, 0.08)',
                      borderColor: isFilled
                        ? '#c7d2fe'
                        : isCurrent
                        ? '#6366f1'
                        : 'rgba(255, 255, 255, 0.2)',
                      borderWidth: 1.5,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: isFilled ? '#6366f1' : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: isFilled ? 0.8 : 0,
                      shadowRadius: 6,
                    }}
                  >
                    {isFilled && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </Animated.View>

            {/* Error or Lockout Message Banner */}
            {errorMessage ? (
              <View
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  marginTop: 6,
                }}
              >
                <Text style={{ color: '#F87171', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                  {errorMessage}
                </Text>
              </View>
            ) : lockoutTimer > 0 ? (
              <View
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  marginTop: 6,
                }}
              >
                <Text style={{ color: '#FBBF24', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                  ⏳ Security Lockout: {lockoutTimer}s
                </Text>
              </View>
            ) : (
              <View style={{ height: 24 }} />
            )}
          </View>

          {/* ── CUSTOM NUMERIC KEYPAD ── */}
          <View style={{ width: '100%', maxWidth: 290, alignItems: 'center' }}>
            {KEYPAD_ROWS.map((row, rowIdx) => (
              <View
                key={rowIdx}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  width: '100%',
                  marginBottom: 12,
                }}
              >
                {row.map((key) => (
                  <TouchableOpacity
                    key={key.digit}
                    onPress={() => handleKeyPress(key.digit)}
                    disabled={lockoutTimer > 0 || isVerifying}
                    activeOpacity={0.65}
                    style={{
                      width: buttonSize,
                      height: buttonSize,
                      borderRadius: buttonSize / 2,
                      backgroundColor: 'rgba(255, 255, 255, 0.07)',
                      borderColor: 'rgba(255, 255, 255, 0.14)',
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 24,
                        fontWeight: '700',
                        includeFontPadding: false,
                      }}
                    >
                      {key.digit}
                    </Text>
                    {key.letters ? (
                      <Text
                        style={{
                          color: '#64748B',
                          fontSize: 9,
                          fontWeight: '800',
                          letterSpacing: 1.1,
                          marginTop: 1,
                          includeFontPadding: false,
                        }}
                      >
                        {key.letters}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Row 4: Biometric on Left, 0 in Center, Delete on Right */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              {/* Left Key: Biometric Face/Fingerprint */}
              <TouchableOpacity
                onPress={handleBiometricPress}
                disabled={lockoutTimer > 0 || isVerifying || !isBiometricEnabled}
                activeOpacity={0.65}
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: buttonSize / 2,
                  backgroundColor: isBiometricEnabled
                    ? 'rgba(99, 102, 241, 0.18)'
                    : 'transparent',
                  borderColor: isBiometricEnabled
                    ? 'rgba(99, 102, 241, 0.4)'
                    : 'transparent',
                  borderWidth: isBiometricEnabled ? 1 : 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isBiometricEnabled && (
                  <Ionicons name="finger-print-outline" size={28} color="#818cf8" />
                )}
              </TouchableOpacity>

              {/* Center Key: Digit 0 */}
              <TouchableOpacity
                onPress={() => handleKeyPress('0')}
                disabled={lockoutTimer > 0 || isVerifying}
                activeOpacity={0.65}
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: buttonSize / 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.07)',
                  borderColor: 'rgba(255, 255, 255, 0.14)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 24,
                    fontWeight: '700',
                    includeFontPadding: false,
                  }}
                >
                  0
                </Text>
              </TouchableOpacity>

              {/* Right Key: Backspace Delete */}
              <TouchableOpacity
                onPress={handleDelete}
                disabled={lockoutTimer > 0 || isVerifying || pin.length === 0}
                activeOpacity={0.65}
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: buttonSize / 2,
                  backgroundColor: 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pin.length > 0 && (
                  <Ionicons name="backspace-outline" size={24} color="#94A3B8" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── EMERGENCY / FORGOT PIN FOOTER ── */}
          <View style={{ alignItems: 'center', width: '100%', marginTop: 10 }}>
            <TouchableOpacity
              onPress={handleSignOut}
              activeOpacity={0.7}
              style={{ paddingVertical: 10, paddingHorizontal: 16 }}
            >
              <Text
                style={{
                  color: '#64748B',
                  fontSize: 12.5,
                  fontWeight: '600',
                  textDecorationLine: 'underline',
                }}
              >
                Forgot PIN? Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
