/**
 * HelpFaqScreen.tsx
 *
 * Comprehensive Help Center & Frequently Asked Questions for ChainBudget Mobile.
 * Covers authentication, non-custodial wallet security, DAO approvals, blockchain operations,
 * troubleshooting, and customer support channels.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';
import ScaleButton from '../components/ScaleButton';

interface FaqItem {
  question: string;
  answer: string;
  category: 'auth' | 'wallet' | 'transactions' | 'troubleshooting' | 'security';
}

const FAQ_DATA: FaqItem[] = [
  // ── Authentication & Account ───────────────────────────────────────────────
  {
    category: 'auth',
    question: 'How do I create and secure an account?',
    answer:
      'ChainBudget uses non-custodial Web3 identity. When you register, a secure cryptographic key pair (BIP-39/44 standard) is generated directly on your physical device and stored in hardware-isolated SecureStore. You do not need a traditional password.',
  },
  {
    category: 'auth',
    question: 'Can I restore my account on a new phone?',
    answer:
      'Yes! Use the 12-word Recovery Phrase generated when you created your account. Go to "Restore Existing Wallet" on the login screen, enter your 12 words in order, and your account, identity, and DAO permissions will be restored immediately.',
  },
  {
    category: 'auth',
    question: 'What happens if I lose my 12-word recovery phrase?',
    answer:
      'Because ChainBudget is non-custodial and decentralized, no central server or staff member holds a copy of your private key. If you lose your device AND your 12-word recovery phrase, your account cannot be recovered. Always store your phrase offline in a secure, fireproof location.',
  },

  // ── Wallet & Blockchain ───────────────────────────────────────────────────
  {
    category: 'wallet',
    question: 'Which blockchain network does ChainBudget run on?',
    answer:
      'ChainBudget operates on the Polygon Amoy Testnet (Chain ID: 80002) and Polygon PoS mainnet, providing ultra-low gas fees, sub-second finality, and enterprise-grade smart contract transparency.',
  },
  {
    category: 'wallet',
    question: 'What is a Soulbound Member ID (SBT)?',
    answer:
      'A Soulbound Token (SBT) is a non-transferable cryptographic credential minted on the Polygon blockchain. It certifies your verified identity and role level (Level 1 Executive, Level 2 Finance, Level 3 Member) within your DAO or organization.',
  },
  {
    category: 'wallet',
    question: 'Does ChainBudget store my private keys on its servers?',
    answer:
      'NO. Your private keys never leave your device. All blockchain interactions and approvals use client-side EIP-712 cryptographic signatures. The server only receives mathematical verification proofs and public addresses.',
  },

  // ── Transactions & Multi-Sig Approvals ────────────────────────────────────
  {
    category: 'transactions',
    question: 'How does the Multi-Signature (Multi-Sig) approval workflow work?',
    answer:
      'Transactions exceeding the organization’s high-value threshold (e.g. ₱10,000) require multiple independent cryptographic signatures from Level 1 Executive Approvers and Level 2 Finance Officers before funds can be released from the DAO treasury.',
  },
  {
    category: 'transactions',
    question: 'How do I submit a fund request or expense report?',
    answer:
      'Navigate to the Request tab or tap "Scan" on the dashboard. Use the AI Receipt Scanner to photograph physical receipts and automatically extract vendor, amount, and budget categories. Review the details, confirm with biometrics, and submit for executive approval.',
  },
  {
    category: 'transactions',
    question: 'What is smart contract escrow release?',
    answer:
      'For milestone-based disbursements, funds are locked in an on-chain escrow smart contract. Once proof-of-work or physical receipts are attached and verified by designated approvers, the smart contract automatically releases the escrowed funds to the payee.',
  },

  // ── Security Best Practices ────────────────────────────────────────────────
  {
    category: 'security',
    question: 'How does ChainBudget protect against brute-force attacks?',
    answer:
      'The mobile app enforces an automated security lockout after 3 consecutive failed biometric or PIN attempts. Additionally, the backend implements strict IP-level rate limiters, stateless HMAC-SHA256 CSRF protection, and audit logging.',
  },
  {
    category: 'security',
    question: 'Why does my clipboard auto-clear after 60 seconds?',
    answer:
      'To prevent malicious background apps from reading your sensitive seed phrase or private key from the OS clipboard, ChainBudget automatically wipes clipboard memory after 60 seconds and shields views during multitasking.',
  },

  // ── Troubleshooting ────────────────────────────────────────────────────────
  {
    category: 'troubleshooting',
    question: 'Why does the app say "Offline Mode"?',
    answer:
      'ChainBudget features offline data persistence. When your device loses internet connectivity, the app serves cached snapshots and disables mutating actions until a secure connection is re-established.',
  },
  {
    category: 'troubleshooting',
    question: 'Why am I not receiving push notifications?',
    answer:
      'Ensure notification permissions are enabled in your device settings under Settings → ChainBudget → Notifications. Note that remote push notifications on Android require a standalone development or production build.',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Topics', icon: 'apps-outline' },
  { id: 'auth', label: 'Account', icon: 'person-outline' },
  { id: 'wallet', label: 'Wallet & Web3', icon: 'wallet-outline' },
  { id: 'transactions', label: 'Approvals', icon: 'checkmark-circle-outline' },
  { id: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: 'construct-outline' },
];

export default function HelpFaqScreen() {
  const { colors, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredFaqs = FAQ_DATA.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleExpand = (idx: number) => {
    triggerLightHaptic();
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const handleOpenEmail = () => {
    Linking.openURL('mailto:support@chainbudget.org?subject=ChainBudget%20Support%20Request');
  };

  const handleOpenCommunity = () => {
    Linking.openURL('https://github.com/Dranyl-23/Chainbudget');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Hero */}
        <View className="items-center mb-6 pt-2">
          <View
            style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
            className="w-16 h-16 rounded-3xl border items-center justify-center mb-3 shadow-sm"
          >
            <Ionicons name="help-buoy" size={32} color={colors.primary} />
          </View>
          <Text style={{ color: colors.textPrimary }} className="text-2xl font-extrabold text-center">
            Help & Knowledge Base
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-xs text-center mt-1 px-4">
            Guides, technical answers, and security instructions for ChainBudget Mobile.
          </Text>
        </View>

        {/* Search Bar */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="flex-row items-center border rounded-2xl px-4 py-3 mb-4 shadow-sm"
        >
          <Ionicons name="search" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search FAQs, topics, keywords..."
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: colors.textPrimary, flex: 1, fontSize: 14 }}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6 -mx-1 flex-row"
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  triggerLightHaptic();
                  setSelectedCategory(cat.id);
                }}
                style={{
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                }}
                className="flex-row items-center border rounded-xl px-3.5 py-2 mx-1 shadow-sm"
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isSelected ? '#ffffff' : colors.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    color: isSelected ? '#ffffff' : colors.textSecondary,
                    fontWeight: isSelected ? '700' : '500',
                    fontSize: 12,
                  }}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* FAQ Accordion List */}
        <View className="mb-8">
          <Text style={{ color: colors.textPrimary }} className="text-base font-bold mb-3">
            Frequently Asked Questions ({filteredFaqs.length})
          </Text>

          {filteredFaqs.length === 0 ? (
            <View
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="p-8 rounded-2xl border items-center justify-center"
            >
              <Ionicons name="help-circle-outline" size={40} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary }} className="font-semibold text-sm mt-2">
                No matching questions found
              </Text>
              <Text style={{ color: colors.textMuted }} className="text-xs mt-1 text-center">
                Try searching for another topic or contact support directly.
              </Text>
            </View>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <View
                  key={idx}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: isExpanded ? colors.primary + '60' : colors.border,
                  }}
                  className="border rounded-2xl mb-3 overflow-hidden shadow-sm"
                >
                  <TouchableOpacity
                    onPress={() => toggleExpand(idx)}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-between p-4"
                  >
                    <Text
                      style={{ color: isExpanded ? colors.primary : colors.textPrimary }}
                      className="font-bold text-sm flex-1 pr-3"
                    >
                      {faq.question}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={isExpanded ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View
                      style={{
                        borderTopColor: colors.borderSubtle,
                        backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : colors.backgroundSecondary,
                      }}
                      className="border-t px-4 py-3.5"
                    >
                      <Text
                        style={{ color: colors.textSecondary }}
                        className="text-xs leading-5"
                      >
                        {faq.answer}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Contact & Support Section */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.primary + '40',
          }}
          className="border rounded-3xl p-5 shadow-md"
        >
          <View className="flex-row items-center gap-3 mb-3">
            <View
              style={{ backgroundColor: colors.primaryMuted }}
              className="w-10 h-10 rounded-2xl items-center justify-center"
            >
              <Ionicons name="headset" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ color: colors.textPrimary }} className="text-base font-extrabold">
                Need Further Assistance?
              </Text>
              <Text style={{ color: colors.textSecondary }} className="text-xs">
                Our support and engineering teams are ready to help.
              </Text>
            </View>
          </View>

          <Text style={{ color: colors.textMuted }} className="text-xs leading-5 mb-4">
            If you encounter security anomalies, transaction execution delays, or need organization onboarding support, contact us through our official channels:
          </Text>

          <View className="gap-2.5">
            <ScaleButton
              onPress={handleOpenEmail}
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
                Email Support (support@chainbudget.org)
              </Text>
            </ScaleButton>

            <ScaleButton
              onPress={handleOpenCommunity}
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
              <Ionicons name="logo-github" size={18} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 13 }}>
                GitHub Project & Issues
              </Text>
            </ScaleButton>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
