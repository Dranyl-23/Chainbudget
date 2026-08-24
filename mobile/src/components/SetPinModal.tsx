/**
 * SetPinModal.tsx
 *
 * Customized interactive 6-digit PIN Setup & Change Modal.
 * Supports:
 * - New PIN Setup (Create -> Confirm)
 * - Existing PIN Change (Verify Current -> Create New -> Confirm New)
 * - Instant validation, mismatch error shake, and celebration haptic.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLock } from '../context/AppLockContext';
import {
  triggerLightHaptic,
  triggerErrorHaptic,
  triggerSuccessHaptic,
} from '../lib/biometrics';

const { width } = Dimensions.get('window');
const PIN_LENGTH = 6;

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

interface SetPinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isChangingExisting?: boolean;
}

export default function SetPinModal({
  visible,
  onClose,
  onSuccess,
  isChangingExisting = false,
}: SetPinModalProps) {
  const insets = useSafeAreaInsets();
  const { hasPinSet, verifyPin, setPin } = useAppLock();

  // Steps: 'current' (if changing) -> 'create' -> 'confirm'
  const [step, setStep] = useState<'current' | 'create' | 'confirm'>(
    isChangingExisting && hasPinSet ? 'current' : 'create'
  );

  const [currentPinInput, setCurrentPinInput] = useState('');
  const [firstPinInput, setFirstPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep(isChangingExisting && hasPinSet ? 'current' : 'create');
      setCurrentPinInput('');
      setFirstPinInput('');
      setConfirmPinInput('');
      setErrorMessage(null);
    }
  }, [visible, isChangingExisting, hasPinSet]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const getActivePinString = () => {
    if (step === 'current') return currentPinInput;
    if (step === 'create') return firstPinInput;
    return confirmPinInput;
  };

  const handleKeyPress = async (digit: string) => {
    const currentVal = getActivePinString();
    if (currentVal.length >= PIN_LENGTH) return;

    await triggerLightHaptic();
    const nextVal = currentVal + digit;
    setErrorMessage(null);

    if (step === 'current') {
      setCurrentPinInput(nextVal);
      if (nextVal.length === PIN_LENGTH) {
        // Verify current PIN
        const isValid = await verifyPin(nextVal);
        if (isValid) {
          await triggerSuccessHaptic();
          setStep('create');
        } else {
          await triggerErrorHaptic();
          triggerShake();
          setErrorMessage('Current PIN is incorrect');
          setCurrentPinInput('');
        }
      }
    } else if (step === 'create') {
      setFirstPinInput(nextVal);
      if (nextVal.length === PIN_LENGTH) {
        await triggerLightHaptic();
        setTimeout(() => {
          setStep('confirm');
        }, 150);
      }
    } else if (step === 'confirm') {
      setConfirmPinInput(nextVal);
      if (nextVal.length === PIN_LENGTH) {
        if (nextVal === firstPinInput) {
          // PIN matched! Save it
          const saved = await setPin(nextVal);
          if (saved) {
            await triggerSuccessHaptic();
            Alert.alert(
              '🔒 PIN Configured',
              'Your 6-digit App Security PIN has been set and encrypted in secure storage.'
            );
            onSuccess?.();
            onClose();
          } else {
            setErrorMessage('Failed to save PIN. Please try again.');
          }
        } else {
          // Mismatch!
          await triggerErrorHaptic();
          triggerShake();
          setErrorMessage('PINs do not match. Please try again.');
          setConfirmPinInput('');
          setTimeout(() => {
            setStep('create');
            setFirstPinInput('');
          }, 800);
        }
      }
    }
  };

  const handleDelete = async () => {
    const currentVal = getActivePinString();
    if (currentVal.length > 0) {
      await triggerLightHaptic();
      const updated = currentVal.slice(0, -1);
      setErrorMessage(null);
      if (step === 'current') setCurrentPinInput(updated);
      else if (step === 'create') setFirstPinInput(updated);
      else setConfirmPinInput(updated);
    }
  };

  const buttonSize = width > 400 ? 76 : width > 360 ? 70 : 64;

  const activePin = getActivePinString();

  const titleText =
    step === 'current'
      ? 'Enter Current PIN'
      : step === 'create'
      ? 'Create a 6-Digit PIN'
      : 'Confirm Your 6-Digit PIN';

  const subtitleText =
    step === 'current'
      ? 'Verify your identity before setting a new PIN'
      : step === 'create'
      ? 'This PIN will be required whenever you open ChainBudget'
      : 'Re-enter your 6-digit PIN to confirm';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#090616', width: '100%', height: '100%' }}>
        {/* Background Gradient */}
        <LinearGradient
          colors={['#1e1045', '#0f0a26', '#090616']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        />

        <View
          style={{
            flex: 1,
            paddingTop: Math.max(insets.top, 24) + 8,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            paddingHorizontal: 24,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Top Bar with Cancel */}
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 4 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: 'rgba(255, 255, 255, 0.10)',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {/* Header & Pin Dots */}
          <View style={{ alignItems: 'center', width: '100%' }}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 20,
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: 'rgba(99, 102, 241, 0.4)',
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Ionicons name="key" size={28} color="#818cf8" />
            </View>

            <Text style={{ color: '#FFFFFF', fontSize: 21, fontWeight: '800', marginBottom: 4, textAlign: 'center' }}>
              {titleText}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 12.5, textAlign: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
              {subtitleText}
            </Text>

            {/* 6-Pin Dots */}
            <Animated.View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                marginVertical: 12,
                transform: [{ translateX: shakeAnim }],
              }}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, index) => {
                const isFilled = index < activePin.length;
                return (
                  <View
                    key={index}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: isFilled
                        ? '#818cf8'
                        : 'rgba(255, 255, 255, 0.08)',
                      borderColor: isFilled
                        ? '#c7d2fe'
                        : 'rgba(255, 255, 255, 0.2)',
                      borderWidth: 1.5,
                      alignItems: 'center',
                      justifyContent: 'center',
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

            {/* Error Message */}
            {errorMessage ? (
              <View
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#F87171', fontSize: 12, fontWeight: '700' }}>
                  {errorMessage}
                </Text>
              </View>
            ) : (
              <View style={{ height: 26 }} />
            )}
          </View>

          {/* Custom Numeric Keypad */}
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
                    <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700', includeFontPadding: false }}>
                      {key.digit}
                    </Text>
                    {key.letters ? (
                      <Text style={{ color: '#64748B', fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginTop: 1, includeFontPadding: false }}>
                        {key.letters}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Bottom Row: Empty, 0, Backspace */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              {/* Empty placeholder on Left */}
              <View style={{ width: buttonSize, height: buttonSize }} />

              {/* Digit 0 in Center */}
              <TouchableOpacity
                onPress={() => handleKeyPress('0')}
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
                <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700', includeFontPadding: false }}>
                  0
                </Text>
              </TouchableOpacity>

              {/* Backspace Delete on Right */}
              <TouchableOpacity
                onPress={handleDelete}
                disabled={activePin.length === 0}
                activeOpacity={0.65}
                style={{
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: buttonSize / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {activePin.length > 0 && (
                  <Ionicons name="backspace-outline" size={24} color="#94A3B8" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Step Indicator */}
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <View
              style={{
                width: step === 'create' ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: step === 'create' ? '#818cf8' : 'rgba(255, 255, 255, 0.2)',
              }}
            />
            <View
              style={{
                width: step === 'confirm' ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: step === 'confirm' ? '#818cf8' : 'rgba(255, 255, 255, 0.2)',
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
