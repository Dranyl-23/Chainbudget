/**
 * RestoreWalletScreen.tsx
 *
 * Account recovery via 12-word BIP-39 mnemonic.
 *
 * The user enters their recovery phrase → wallet is re-derived locally →
 * challenge-response login confirms the wallet exists on the backend.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { restoreWalletFromPhrase, validateMnemonic } from '../lib/wallet';
import { useAuth } from '../context/AuthContext';

export default function RestoreWalletScreen({ navigation }: any) {
  const { login } = useAuth();
  const [phrase, setPhrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const wordCount = phrase.trim() ? phrase.trim().split(/\s+/).length : 0;
  const isValid = wordCount === 12 && validateMnemonic(phrase);

  const handleRestore = async () => {
    if (!isValid) {
      Alert.alert('Invalid Phrase', 'Please enter a valid 12-word recovery phrase.');
      return;
    }

    setIsLoading(true);
    try {
      // Re-derive the wallet from the phrase and persist to SecureStore
      const { address } = await restoreWalletFromPhrase(phrase);

      // Authenticate with the backend using the restored wallet
      await login(address);
      // Success — AuthContext will update user and App.tsx will render the main navigator

    } catch (err: any) {
      const msg = err.message || 'Restore failed. Please check your recovery phrase.';
      if (msg.includes('not registered')) {
        Alert.alert(
          'Wallet Not Found',
          'This recovery phrase is not linked to any ChainBudget account. Make sure you are using the correct phrase.',
        );
      } else if (msg.includes('Invalid recovery phrase')) {
        Alert.alert('Invalid Phrase', msg);
      } else {
        Alert.alert('Restore Failed', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <LinearGradient colors={['#09090b', '#0d0d12']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Restore Account</Text>
            <Text style={styles.subtitle}>
              Enter your 12-word recovery phrase to restore access to your account on this device.
            </Text>
          </View>


          {/* Phrase input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Recovery Phrase</Text>
            <TextInput
              value={phrase}
              onChangeText={setPhrase}
              placeholder="word1 word2 word3 … word12"
              placeholderTextColor="#555"
              style={styles.phraseInput}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
            />

            {/* Word count indicator */}
            <View style={styles.wordCountRow}>
              <Text style={[
                styles.wordCount,
                wordCount === 12 ? styles.wordCountOk : styles.wordCountWarn,
              ]}>
                {wordCount}/12 words
              </Text>
              {isValid && <Ionicons name="checkmark-circle" size={16} color="#34d399" />}
            </View>
          </View>

          {/* Restore button */}
          <TouchableOpacity
            style={[(!isValid || isLoading) && styles.restoreBtnDisabled]}
            onPress={handleRestore}
            disabled={!isValid || isLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.restoreBtn}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="lock-open-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.restoreBtnText}>Restore Account</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  iconWrap: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
    borderRadius: 14, padding: 14, marginBottom: 28,
  },
  warningText: { flex: 1, fontSize: 13, color: 'rgba(251,191,36,0.9)', lineHeight: 20 },
  inputGroup: { marginBottom: 28 },
  label: {
    color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  phraseInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff',
    fontSize: 15, fontFamily: 'monospace', minHeight: 120,
  },
  wordCountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
  },
  wordCount: { fontSize: 13, fontWeight: '600' },
  wordCountOk: { color: '#34d399' },
  wordCountWarn: { color: 'rgba(255,255,255,0.4)' },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#38bdf8', paddingVertical: 16,
    borderRadius: 16, marginBottom: 16,
  },
  restoreBtnDisabled: { opacity: 0.35 },
  restoreBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
