import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import appConfig from '../../app.json';

const APP_VERSION = appConfig.expo.version;

export default function AboutScreen() {
  const { colors, isDark } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand Hero Card */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 26,
          padding: 24,
          alignItems: 'center',
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <Image
          source={require('../../assets/3D-Chainbudget.png')}
          style={{ width: 130, height: 130, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
          ChainBudget Mobile
        </Text>
        <View
          style={{
            backgroundColor: colors.primaryMuted,
            borderColor: colors.primary + '40',
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 4,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
            Version {APP_VERSION} (Capstone Edition)
          </Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
          A Transparent & Accountable On-Chain Budget Dissemination System with Gasless Multi-Signature Approvals, Two-Party Escrow, and AI-Powered Verification.
        </Text>
      </View>

      {/* Highlights & Key Modules */}
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11.5,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        Key System Features
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 22,
          padding: 16,
          marginBottom: 20,
          gap: 14,
        }}
      >
        {[
          {
            icon: 'shield-checkmark',
            color: '#10B981',
            title: 'Polygon Smart Contracts',
            desc: 'Every fund allocation and disbursement is permanently recorded on Polygon Amoy testnet.',
          },
          {
            icon: 'finger-print',
            color: '#6366F1',
            title: 'Non-Custodial Cryptography',
            desc: 'Private keys and BIP-39 mnemonic phrases are hardware-isolated in on-device SecureStore.',
          },
          {
            icon: 'people',
            color: '#0284C7',
            title: 'DAO Governance & Soulbound SBTs',
            desc: 'Role-based multi-tier approval thresholds for enterprise and student organizations.',
          },
          {
            icon: 'sparkles',
            color: '#F59E0B',
            title: 'Gemini AI Receipt OCR',
            desc: 'Automated invoice validation, anomaly detection, and budget discrepancy flagging.',
          },
        ].map((feat, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: feat.color + '18',
                borderColor: feat.color + '30',
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={feat.icon as any} size={20} color={feat.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13.5, fontWeight: '700', marginBottom: 2 }}>
                {feat.title}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>
                {feat.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Tech Stack Badges */}
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11.5,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        Technology Stack
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 24,
        }}
      >
        {[
          'React Native (Expo)',
          'Polygon POS',
          'Solidity',
          'Node.js / Express',
          'MongoDB Atlas',
          'Pinata IPFS',
          'Google Gemini AI',
          'Ethers.js v6',
          'Tailwind / NativeWind',
        ].map((tech, idx) => (
          <View
            key={idx}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
              {tech}
            </Text>
          </View>
        ))}
      </View>

      {/* Project & University Footer */}
      <View
        style={{
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 16,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
          ChainBudget Research & Development
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11.5, textAlign: 'center', lineHeight: 16 }}>
          Undergraduate Capstone Project • College of Information and Computing Sciences
        </Text>
      </View>
    </ScrollView>
  );
}
