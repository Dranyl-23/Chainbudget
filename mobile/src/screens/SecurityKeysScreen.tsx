import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { useTheme } from '../context/ThemeContext';
import { getPrivateKey, getMnemonic } from '../lib/secureStorage';
import { triggerLightHaptic, triggerErrorHaptic, triggerSuccessHaptic, authenticateWithBiometrics } from '../lib/biometrics';

export default function SecurityKeysScreen() {
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<'menu' | 'phrase' | 'privateKey'>('menu');
  const [keys, setKeys] = useState<{ privateKey: string; mnemonic: string } | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);

  useEffect(() => {
    if (activeTab === 'phrase' || activeTab === 'privateKey') {
      ScreenCapture.preventScreenCaptureAsync();
    } else {
      ScreenCapture.allowScreenCaptureAsync();
    }

    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, [activeTab]);

  const fetchKeys = async (target: 'phrase' | 'privateKey') => {
    await triggerLightHaptic();
    const promptMessage =
      target === 'privateKey'
        ? 'Authenticate with Biometrics / PIN to Export Private Key'
        : 'Authenticate with Biometrics / PIN to View Recovery Phrase';

    const auth = await authenticateWithBiometrics(promptMessage);
    if (!auth.success) {
      if (auth.error && auth.error !== 'Authentication canceled') {
        Alert.alert('Authentication Failed', auth.error);
      }
      return;
    }

    setIsLoadingKeys(true);
    try {
      let mnemonic = keys?.mnemonic;
      let privateKey = keys?.privateKey;

      if (!mnemonic || !privateKey) {
        const [loadedMnemonic, loadedPrivateKey] = await Promise.all([
          getMnemonic(),
          getPrivateKey(),
        ]);
        mnemonic = loadedMnemonic || undefined;
        privateKey = loadedPrivateKey || undefined;
      }

      if (target === 'phrase' && !mnemonic) {
        Alert.alert(
          'Seed Phrase Not Found',
          'No 12-word seed phrase is stored on this device. If you imported your account or created it on another browser, please restore using your original recovery phrase.'
        );
        return;
      }

      if (target === 'privateKey' && !privateKey) {
        Alert.alert(
          'Private Key Not Found',
          'No wallet private key was found in this device\'s secure storage.'
        );
        return;
      }

      setKeys({
        mnemonic: mnemonic || '',
        privateKey: privateKey || '',
      });
      setActiveTab(target);
    } catch (err: any) {
      Alert.alert('Authentication Error', err.message || 'Could not retrieve wallet keys.');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    await triggerSuccessHaptic();

    // Auto-clear clipboard in 60 seconds
    setTimeout(async () => {
      try {
        await Clipboard.setStringAsync('');
      } catch {}
    }, 60000);

    Alert.alert(
      '🔒 Copied to Clipboard',
      `${label} copied. For your security, the clipboard will automatically be cleared in 60 seconds.`
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Banner */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 20,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.05,
          shadowRadius: 10,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: 'rgba(249, 115, 22, 0.15)',
              borderColor: 'rgba(249, 115, 22, 0.3)',
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shield-checkmark" size={24} color="#f97316" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>
              Web3 Hardware Vault
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Non-Custodial BIP-39 Cryptographic Storage
            </Text>
          </View>
        </View>

        <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 }}>
          Your cryptographic keys never touch external servers. They are generated and stored exclusively within the physical device's SecureStore keychain.
        </Text>
      </View>

      {/* Main Mode 1: Selection Menu */}
      {activeTab === 'menu' && (
        <View>
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
            Security Credentials
          </Text>

          {/* Option 1: View Seed Phrase */}
          <TouchableOpacity
            onPress={() => fetchKeys('phrase')}
            disabled={isLoadingKeys}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              padding: 18,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: 'rgba(249, 115, 22, 0.15)',
                  borderColor: 'rgba(249, 115, 22, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="document-text-outline" size={22} color="#f97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>
                  Backup Recovery Seed Phrase
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  12-word secret mnemonic for wallet recovery
                </Text>
              </View>
            </View>
            {isLoadingKeys ? (
              <ActivityIndicator color="#f97316" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          {/* Option 2: Export Private Key */}
          <TouchableOpacity
            onPress={() => fetchKeys('privateKey')}
            disabled={isLoadingKeys}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              padding: 18,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="key-outline" size={22} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>
                  Export Wallet Private Key
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Raw 256-bit hexadecimal private key
                </Text>
              </View>
            </View>
            {isLoadingKeys ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          {/* Hardware Security Verification Box */}
          <View
            style={{
              backgroundColor: colors.primaryMuted,
              borderColor: colors.primary + '30',
              borderWidth: 1,
              borderRadius: 18,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Ionicons name="lock-closed" size={22} color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 }}>
              Biometric verification (Face ID / Fingerprint) is strictly required before sensitive keys can be decrypted in memory.
            </Text>
          </View>
        </View>
      )}

      {/* Main Mode 2: Seed Phrase Display */}
      {activeTab === 'phrase' && keys && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 11.5,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}
            >
              12-Word Secret Recovery Phrase
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTab('menu')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="arrow-back" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Back to Menu</Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 22,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {keys.mnemonic.split(' ').map((word, index) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    width: '48%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: '#F97316', fontFamily: 'monospace', fontSize: 12, fontWeight: '700', marginRight: 8 }}>
                    {index + 1}.
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontFamily: 'monospace', fontSize: 14, fontWeight: '600' }}>
                    {word}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => copyToClipboard(keys.mnemonic, 'Recovery Seed Phrase')}
              activeOpacity={0.8}
              style={{
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                borderColor: 'rgba(249, 115, 22, 0.5)',
                borderWidth: 1.5,
                borderRadius: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                gap: 8,
              }}
            >
              <Ionicons name="copy-outline" size={18} color="#F97316" />
              <Text style={{ color: '#F97316', fontWeight: '800', fontSize: 14 }}>
                Copy 12-Word Phrase
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
              Warning: Never Share Your Secret Phrase
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11.5, lineHeight: 16 }}>
              Anyone with these 12 words can access and transfer your funds. ChainBudget staff will never ask for your recovery phrase.
            </Text>
          </View>
        </View>
      )}

      {/* Main Mode 3: Private Key Display */}
      {activeTab === 'privateKey' && keys && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 11.5,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}
            >
              Raw Private Key
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTab('menu')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="arrow-back" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Back to Menu</Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 22,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
              Hexadecimal Key:
            </Text>
            <View
              style={{
                backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : colors.backgroundSecondary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  color: '#EF4444',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 18,
                  fontWeight: '600',
                }}
              >
                {keys.privateKey}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => copyToClipboard(keys.privateKey, 'Private Key')}
              activeOpacity={0.8}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                borderColor: 'rgba(239, 68, 68, 0.5)',
                borderWidth: 1.5,
                borderRadius: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="copy-outline" size={18} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 14 }}>
                Copy Private Key
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
              High Risk Security Item
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11.5, lineHeight: 16 }}>
              This private key controls your on-chain wallet. Do not paste it in untrusted apps or websites.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
