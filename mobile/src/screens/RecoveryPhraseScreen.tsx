/**
 * RecoveryPhraseScreen.tsx
 *
 * Displays the 12-word BIP-39 recovery phrase after account creation.
 * Reads the mnemonic from SecureStore (biometric-gated).
 *
 * Security Features:
 * - Hardware screenshot prevention (ScreenCapture.preventScreenCaptureAsync)
 * - 60-second automated clipboard memory wipe
 * - AppState background veil / privacy blur preventing OS switcher leaks
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ScrollView,
  ActivityIndicator, StyleSheet, AppState, AppStateStatus,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { getMnemonic } from '../lib/secureStorage';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import ScaleButton from '../components/ScaleButton';

type Props = {
  route?: { params?: { walletAddress?: string; autoLogin?: boolean } };
  navigation?: any;
};

export default function RecoveryPhraseScreen({ route, navigation }: Props) {
  const walletAddress = route?.params?.walletAddress;
  const autoLogin = route?.params?.autoLogin;
  const { login } = useAuth();

  const [words, setWords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [clearTimerSeconds, setClearTimerSeconds] = useState<number | null>(null);
  const [isBackgroundShieldActive, setIsBackgroundShieldActive] = useState(false);

  const clipboardTimeoutRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  useEffect(() => {
    // 1. Prevent hardware screenshots
    ScreenCapture.preventScreenCaptureAsync();
    loadPhrase();

    // 2. Listen to AppState to shield sensitive view during OS multitasking / background
    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        setIsBackgroundShieldActive(true);
      } else if (nextAppState === 'active') {
        setIsBackgroundShieldActive(false);
      }
    });

    return () => {
      ScreenCapture.allowScreenCaptureAsync();
      appStateSub.remove();
      // Wipe clipboard if copied on screen exit for security
      if (clipboardTimeoutRef.current) {
        clearTimeout(clipboardTimeoutRef.current);
        clearInterval(countdownIntervalRef.current);
        Clipboard.setStringAsync('');
      }
    };
  }, []);

  const loadPhrase = async () => {
    setIsLoading(true);
    try {
      const mnemonic = await getMnemonic();
      if (!mnemonic) {
        Alert.alert('Error', 'Could not load recovery phrase. Please try again.');
        navigation.goBack();
        return;
      }
      setWords(mnemonic.split(' '));
    } catch {
      Alert.alert('Authentication Required', 'Please authenticate to view your recovery phrase.');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const copyPhrase = async () => {
    if (words.length === 0) return;
    await Clipboard.setStringAsync(words.join(' '));
    setIsCopied(true);

    // Clear existing timer if any
    if (clipboardTimeoutRef.current) clearTimeout(clipboardTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Start 60-second automated clipboard wipe
    setClearTimerSeconds(60);
    countdownIntervalRef.current = setInterval(() => {
      setClearTimerSeconds((prev) => {
        if (prev !== null && prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          return null;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);

    clipboardTimeoutRef.current = setTimeout(async () => {
      await Clipboard.setStringAsync('');
      setIsCopied(false);
      setClearTimerSeconds(null);
    }, 60000);

    Alert.alert(
      '🔒 Copied (Auto-Clears in 60s)',
      'Your recovery phrase was copied. For your security, the clipboard will automatically be wiped in 60 seconds.',
      [{ text: 'Understood' }]
    );
  };

  const handleDone = useCallback(async () => {
    if (clipboardTimeoutRef.current) {
      clearTimeout(clipboardTimeoutRef.current);
      clearInterval(countdownIntervalRef.current);
      await Clipboard.setStringAsync('');
    }

    try {
      await api.post('/auth/confirm-backup');
    } catch {
      // Non-fatal
    }

    if (autoLogin && walletAddress) {
      try {
        await login(walletAddress);
      } catch (err: any) {
        Alert.alert('Login Failed', err.message || 'Could not complete sign in.');
      }
    } else {
      navigation?.goBack();
    }
  }, [autoLogin, walletAddress, login, navigation]);

  if (isLoading) {
    return (
      <LinearGradient colors={['#09090b', '#0d0d12']} style={styles.center}>
        <ActivityIndicator size="large" color="#e879f9" />
        <Text style={styles.loadingText}>Authenticating with secure enclave…</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#09090b', '#0d0d12']} style={{ flex: 1 }}>
      {/* Background Multitasking Privacy Shield */}
      {isBackgroundShieldActive && (
        <View style={styles.privacyShield}>
          <Ionicons name="shield-checkmark" size={64} color="#e879f9" />
          <Text style={styles.privacyShieldTitle}>ChainBudget Security Shield</Text>
          <Text style={styles.privacyShieldText}>Sensitive key material protected</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="document-text" size={32} color="#f97316" />
          </View>
          <Text style={styles.title}>Backup Recovery Phrase</Text>
          <Text style={styles.subtitle}>
            Write down these 12 words in order and store them somewhere safe.
            This is the only way to restore your account on a new device.
          </Text>
        </View>

        {/* Warning */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={16} color="#fbbf24" />
          <Text style={styles.warningText}>
            Never share this phrase with anyone. ChainBudget staff will never ask for it.
          </Text>
        </View>

        {/* 12-word grid */}
        <View style={styles.wordGrid}>
          {words.map((word, idx) => (
            <View key={idx} style={styles.wordCard}>
              <Text style={styles.wordNum}>{idx + 1}.</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>

        {/* Copy button */}
        <ScaleButton onPress={copyPhrase} style={styles.copyBtn}>
          <Ionicons name={isCopied ? 'checkmark' : 'copy-outline'} size={18} color="#f97316" />
          <Text style={styles.copyBtnText}>
            {isCopied
              ? clearTimerSeconds !== null
                ? `Copied (Wipes in ${clearTimerSeconds}s)`
                : 'Copied!'
              : 'Copy Phrase'}
          </Text>
        </ScaleButton>

        {/* 60s Clipboard Notification */}
        {clearTimerSeconds !== null && (
          <View style={styles.timerBadge}>
            <Ionicons name="timer-outline" size={14} color="#38bdf8" />
            <Text style={styles.timerBadgeText}>
              Clipboard auto-clear active: {clearTimerSeconds} seconds remaining
            </Text>
          </View>
        )}

        {/* Confirmation checkbox */}
        <TouchableOpacity
          style={styles.confirmRow}
          onPress={() => setIsConfirmed(!isConfirmed)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isConfirmed && styles.checkboxChecked]}>
            {isConfirmed && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.confirmText}>
            I have written down or saved my recovery phrase.
          </Text>
        </TouchableOpacity>

        {/* Done / Skip */}
        <ScaleButton
          style={[styles.doneBtn, !isConfirmed && styles.doneBtnDisabled]}
          onPress={handleDone}
          disabled={!isConfirmed}
        >
          <Text style={styles.doneBtnText}>
            {autoLogin ? 'Done — Enter App' : 'Done'}
          </Text>
        </ScaleButton>

        {!autoLogin && (
          <TouchableOpacity onPress={handleDone} style={styles.skipBtn}>
            <Text style={styles.skipBtnText}>Remind me later</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  header: { alignItems: 'center', marginBottom: 20 },
  iconWrap: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
    borderRadius: 14, padding: 14, marginBottom: 24,
  },
  warningText: { flex: 1, fontSize: 13, color: 'rgba(251,191,36,0.9)', lineHeight: 20 },
  wordGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    gap: 8, marginBottom: 20,
  },
  wordCard: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
  },
  wordNum: { color: '#f97316', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', minWidth: 22 },
  wordText: { color: '#fff', fontFamily: 'monospace', fontSize: 14, fontWeight: '600' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 14, paddingVertical: 14, marginBottom: 12,
  },
  copyBtnText: { color: '#f97316', fontWeight: '700', fontSize: 14 },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 20,
  },
  timerBadgeText: { color: '#38bdf8', fontSize: 12, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 24 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxChecked: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  confirmText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 22 },
  doneBtn: {
    backgroundColor: '#a855f7', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
  },
  doneBtnDisabled: { opacity: 0.35 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipBtnText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  privacyShield: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090b',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  privacyShieldTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 8,
  },
  privacyShieldText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
});
