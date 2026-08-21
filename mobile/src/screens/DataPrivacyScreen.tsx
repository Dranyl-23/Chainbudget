/**
 * DataPrivacyScreen.tsx
 *
 * Comprehensive Data Privacy & Protection Notice for ChainBudget Mobile.
 * Formally structured and compliant with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173)
 * and Cybercrime Prevention Act of 2012 (Republic Act No. 10175).
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';
import ScaleButton from '../components/ScaleButton';

export default function DataPrivacyScreen() {
  const { colors, isDark } = useTheme();

  const handleOpenDpoEmail = () => {
    Linking.openURL('mailto:dpo@chainbudget.ph?subject=Data%20Privacy%20Inquiry%20(RA%2010173)');
  };

  const handleOpenWebPrivacy = () => {
    Linking.openURL('https://chainbudget.vercel.app/privacy');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View className="items-center mb-6 pt-2">
          <View
            style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
            className="w-16 h-16 rounded-3xl border items-center justify-center mb-3 shadow-sm"
          >
            <Ionicons name="shield-half" size={32} color={colors.primary} />
          </View>
          <Text style={{ color: colors.textPrimary }} className="text-2xl font-extrabold text-center">
            Data Privacy & Security Notice
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-xs text-center mt-1 px-2">
            In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173) & Cybercrime Prevention Act of 2012 (Republic Act No. 10175).
          </Text>
        </View>

        {/* Executive Summary Card */}
        <View
          style={{
            backgroundColor: colors.successBg,
            borderColor: colors.successBorder,
          }}
          className="border rounded-2xl p-4 mb-6"
        >
          <View className="flex-row items-center gap-2 mb-1.5">
            <Ionicons name="lock-closed" size={18} color={colors.success} />
            <Text style={{ color: colors.success }} className="font-extrabold text-sm">
              Non-Custodial Zero-Knowledge Principle
            </Text>
          </View>
          <Text style={{ color: colors.success }} className="text-xs leading-5">
            ChainBudget adheres strictly to the principles of <Text className="font-bold">Transparency, Legitimate Purpose, and Proportionality</Text>. Your private keys, mnemonic seed phrases, and biometric templates <Text className="font-bold">never leave your hardware device</Text> and are never transmitted to our servers.
          </Text>
        </View>

        {/* ── Section 1: What Personal Information We Collect ──────────────── */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="border rounded-3xl p-5 mb-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2.5 mb-3">
            <Ionicons name="folder-open" size={20} color={colors.primary} />
            <Text style={{ color: colors.textPrimary }} className="text-base font-extrabold">
              1. What Personal Information We Collect
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary }} className="text-xs leading-5 mb-3">
            We collect only the minimum personal data strictly necessary to fulfill decentralized financial governance:
          </Text>

          <View className="gap-2">
            {[
              { title: 'User Identity', desc: 'Display name, avatar photo, and email address (for organization invites and session management).' },
              { title: 'Cryptographic Identifiers', desc: 'Hardware-generated public key and public wallet address (0x...). Plaintext private keys and seed phrases are NEVER collected.' },
              { title: 'Transaction Artifacts', desc: 'Expense descriptions, uploaded physical receipt photographs, expense amounts, and category allocations.' },
              { title: 'Device & Audit Metadata', desc: 'Expo push notification device tokens, client IP addresses for brute-force rate-limiting, and immutable audit timestamps.' },
            ].map((item, idx) => (
              <View key={idx} className="flex-row items-start gap-2">
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text style={{ color: colors.textPrimary }} className="font-bold text-xs">{item.title}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-xs leading-4">{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Section 2: Why We Collect and How We Process ───────────────────── */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="border rounded-3xl p-5 mb-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2.5 mb-3">
            <Ionicons name="analytics" size={20} color={colors.accentBlue || '#38bdf8'} />
            <Text style={{ color: colors.textPrimary }} className="text-base font-extrabold">
              2. Purpose and Processing of Information
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary }} className="text-xs leading-5 mb-3">
            In accordance with RA 10173 Section 11 & Section 12, your personal information is processed exclusively for:
          </Text>

          <View className="gap-2">
            {[
              { icon: 'key-outline', text: 'Authenticating organization members via cryptographic challenge-response and session JWTs.' },
              { icon: 'receipt-outline', text: 'Extracting itemized financial expense data from receipts using Google Gemini AI optical character recognition.' },
              { icon: 'shield-checkmark-outline', text: 'Validating multi-signature EIP-712 cryptographic proofs before executing smart contract disbursements.' },
              { icon: 'notifications-outline', text: 'Dispatching critical operational push notifications (e.g. pending approvals, budget alerts).' },
              { icon: 'document-text-outline', text: 'Maintaining immutable tamper-evident audit logs of organizational governance decisions.' },
            ].map((item, idx) => (
              <View key={idx} className="flex-row items-start gap-2">
                <Ionicons name={item.icon as any} size={15} color={colors.textMuted} style={{ marginTop: 2 }} />
                <Text style={{ color: colors.textSecondary }} className="text-xs flex-1 leading-5">
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Section 3: Storage, Retention & Security ──────────────────────── */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="border rounded-3xl p-5 mb-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2.5 mb-3">
            <Ionicons name="server" size={20} color={colors.warning || '#fbbf24'} />
            <Text style={{ color: colors.textPrimary }} className="text-base font-extrabold">
              3. Storage, Retention & Security Measures
            </Text>
          </View>

          <View className="gap-3">
            <View>
              <Text style={{ color: colors.textPrimary }} className="font-bold text-xs mb-1">Storage Locations</Text>
              <Text style={{ color: colors.textSecondary }} className="text-xs leading-5">
                • Client Keystore: Encrypted in hardware SecureStore / iOS Keychain / Android KeyStore.{'\n'}
                • Cloud Database: MongoDB database with AES-256 encryption-at-rest.{'\n'}
                • Transport Layer: Strict TLS 1.3 encryption with certificate validation.
              </Text>
            </View>

            <View>
              <Text style={{ color: colors.textPrimary }} className="font-bold text-xs mb-1">Data Retention Period</Text>
              <Text style={{ color: colors.textSecondary }} className="text-xs leading-5">
                Personal profile data is retained for the active duration of your account. Financial transaction records and audit logs are retained for a statutory period of 5 years to comply with Philippine financial accounting and auditing regulations.
              </Text>
            </View>

            <View>
              <Text style={{ color: colors.textPrimary }} className="font-bold text-xs mb-1">Cybercrime Defenses (RA 10175)</Text>
              <Text style={{ color: colors.textSecondary }} className="text-xs leading-5">
                Multi-layered defenses include stateless HMAC-SHA256 CSRF verification, rate limiters against brute-force attacks, 3-strike biometric lockouts, 60s clipboard auto-clear, and multitasking background shielding.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Section 4: Data Subject Rights (RA 10173 Section 16) ───────────── */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="border rounded-3xl p-5 mb-5 shadow-sm"
        >
          <View className="flex-row items-center gap-2.5 mb-3">
            <Ionicons name="ribbon" size={20} color={colors.accentPurple || '#c084fc'} />
            <Text style={{ color: colors.textPrimary }} className="text-base font-extrabold">
              4. Your Rights as a Data Subject
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary }} className="text-xs leading-5 mb-3">
            Under Section 16 of Republic Act No. 10173, you hold the following inviolable statutory rights:
          </Text>

          <View className="gap-2">
            {[
              { name: 'Right to be Informed', desc: 'To know whether your personal information is being processed.' },
              { name: 'Right to Access', desc: 'To obtain reasonable access to your personal information upon demand.' },
              { name: 'Right to Object', desc: 'To object to processing, including automated processing or profiling.' },
              { name: 'Right to Erasure / Blocking', desc: 'To suspend, withdraw, or order the removal of your personal data.' },
              { name: 'Right to Rectification', desc: 'To dispute inaccuracies and have your data corrected immediately.' },
              { name: 'Right to Data Portability', desc: 'To obtain an electronic copy of your structured personal data.' },
              { name: 'Right to Damages', desc: 'To be indemnified for damages incurred due to inaccurate or unlawful processing.' },
            ].map((r, idx) => (
              <View key={idx} className="flex-row items-start gap-2">
                <Ionicons name="shield" size={14} color={colors.accentPurple || '#c084fc'} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text style={{ color: colors.textPrimary }} className="font-bold text-xs">{r.name}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-xs leading-4">{r.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Section 5: Data Protection Officer (DPO) Contact ───────────────── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.primary + '50',
          }}
          className="border rounded-3xl p-5 shadow-md"
        >
          <View className="flex-row items-center gap-3 mb-3">
            <View
              style={{ backgroundColor: colors.primaryMuted }}
              className="w-10 h-10 rounded-2xl items-center justify-center"
            >
              <Ionicons name="mail-open" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ color: colors.textPrimary }} className="text-base font-extrabold">
                Data Protection Officer (DPO)
              </Text>
              <Text style={{ color: colors.textSecondary }} className="text-xs">
                Inquiries, Rights Requests & Compliance
              </Text>
            </View>
          </View>

          <Text style={{ color: colors.textMuted }} className="text-xs leading-5 mb-4">
            To exercise any of your data subject rights (access, rectification, deletion, portability) or report privacy concerns, contact our designated Data Protection Officer:
          </Text>

          <View className="gap-2.5">
            <ScaleButton
              onPress={handleOpenDpoEmail}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="mail" size={18} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>
                Contact DPO (dpo@chainbudget.ph)
              </Text>
            </ScaleButton>

            <ScaleButton
              onPress={handleOpenWebPrivacy}
              style={{
                backgroundColor: colors.cardGlass,
                borderColor: colors.border,
                borderWidth: 1,
                paddingVertical: 14,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="globe-outline" size={18} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 13 }}>
                View Full Web Privacy Policy
              </Text>
            </ScaleButton>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
