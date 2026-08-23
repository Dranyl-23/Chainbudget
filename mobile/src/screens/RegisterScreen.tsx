/**
 * RegisterScreen.tsx
 *
 * New user onboarding.
 *
 * Steps:
 *  1. User enters their name (and optionally email)
 *  2. Wallet is generated automatically in the background
 *  3. Public key + address registered with the backend
 *  4. User is redirected to the RecoveryPhrase backup screen
 *  5. After backup, session begins
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { generateAndStoreWallet } from '../lib/wallet';
import { registerWallet } from '../lib/auth';
import { loginWithWallet } from '../lib/auth';
import { useAuth } from '../context/AuthContext';

type Step = 'form' | 'generating' | 'done';

export default function RegisterScreen({ navigation }: any) {
  const { login } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (isSubmitting) return;
    const name = displayName.trim();
    if (!name) {
      Alert.alert('Name Required', 'Please enter your full name to continue.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      Alert.alert('Email Required', 'Please enter a valid email address to continue.');
      return;
    }
    if (!agreePrivacy) {
      Alert.alert('Privacy Consent Required', 'Please read and accept the Data Privacy Notice (RA 10173) to proceed.');
      return;
    }

    setIsSubmitting(true);
    setStep('generating');

    try {
      // 1. Generate wallet on-device (BIP-39/44) and persist to SecureStore
      const { address, publicKey } = await generateAndStoreWallet();

      // 2. Register public key + address with backend (private key NEVER sent)
      await registerWallet({
        walletAddress: address,
        publicKey,
        displayName: name,
        email: email.trim(),
      });

      // 3. Navigate to recovery phrase backup before logging in
      navigation.replace('RecoveryPhrase', { walletAddress: address, autoLogin: true });

    } catch (err: any) {
      setIsSubmitting(false);
      setStep('form');
      Alert.alert('Registration Failed', err.response?.data?.error || err.message || 'Something went wrong.');
    }
  };


  if (step === 'generating') {
    return (
      <LinearGradient colors={['#09090b', '#0d0d12']} style={styles.center}>
        <View style={styles.generatingCard}>
          <ActivityIndicator size="large" color="#e879f9" />
          <Text style={styles.generatingTitle}>Creating your secure wallet…</Text>
          <Text style={styles.generatingSubtitle}>
            Generating encryption keys on your device.{'\n'}This only takes a moment.
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <LinearGradient colors={['#09090b', '#0d0d12']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="person-add" size={32} color="#e879f9" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              A secure crypto wallet will be automatically created for you.
              No passwords, no seed phrases to memorize right now.
            </Text>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark" size={16} color="#34d399" />
            <Text style={styles.infoText}>
              Your private key is generated locally and stored securely on this device.
              It is never shared with anyone.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Juan dela Cruz"
                placeholderTextColor="#555"
                style={styles.input}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="juan@example.com"
                placeholderTextColor="#555"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
              />
              <Text style={styles.hint}>
                Used to link your account if your organization invited you by email.
              </Text>
            </View>

            {/* RA 10173 Data Privacy Act Consent Checkbox */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setAgreePrivacy(!agreePrivacy)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreePrivacy && styles.checkboxChecked]}>
                {agreePrivacy && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.consentText}>
                I acknowledge the{' '}
                <Text
                  style={styles.consentLink}
                  onPress={() => navigation.navigate('DataPrivacy')}
                >
                  Data Privacy Notice (RA 10173)
                </Text>{' '}
                and understand my private keys are stored non-custodially on this device.
              </Text>
            </TouchableOpacity>
          </View>

          {/* Create button */}
          <TouchableOpacity
            style={[
              styles.createBtn,
              (isSubmitting || !displayName.trim() || !email.trim() || !agreePrivacy) && styles.createBtnDisabled,
            ]}
            onPress={handleRegister}
            disabled={isSubmitting || !displayName.trim() || !email.trim() || !agreePrivacy}
            activeOpacity={0.85}
          >
            <Ionicons name="cube" size={20} color="#fff" />
            <Text style={styles.createBtnText}>{isSubmitting ? 'Creating Account...' : 'Create My Account'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Back to login</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { alignItems: 'center', marginBottom: 28 },
  iconWrap: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: 'rgba(232,121,249,0.1)',
    borderWidth: 1, borderColor: 'rgba(232,121,249,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(52,211,153,0.07)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.2)',
    borderRadius: 14, padding: 14, marginBottom: 28,
  },
  infoText: { flex: 1, fontSize: 13, color: 'rgba(52,211,153,0.9)', lineHeight: 20 },
  form: { gap: 20, marginBottom: 28 },
  fieldGroup: { gap: 6 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 16,
  },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#a855f7', paddingVertical: 16,
    borderRadius: 16, marginBottom: 16,
    shadowColor: '#a855f7', shadowOpacity: 0.35, shadowRadius: 12,
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  generatingCard: { alignItems: 'center', gap: 16 },
  generatingTitle: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  generatingSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxChecked: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  consentText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 },
  consentLink: { color: '#e879f9', fontWeight: '700', textDecorationLine: 'underline' },
});

