import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import api from '../lib/api';

export default function ReceiveScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { initialOrgId } = route.params || {};

  const [mode, setMode] = useState<'personal' | 'treasury'>('personal');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(initialOrgId || null);
  const [customAmount, setCustomAmount] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    try {
      const res = await api.get('/organizations');
      const orgs = res.data || [];
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0]._id);
      }
    } catch {}
  };

  const selectedOrg = organizations.find((o) => o._id === selectedOrgId);

  // Determine active address
  const activeAddress =
    mode === 'personal'
      ? user?.walletAddress || '0x0000000000000000000000000000000000000000'
      : selectedOrg?.vaultAddress || selectedOrg?.contractAddress || user?.walletAddress || '0x0000000000000000000000000000000000000000';

  // Construct standard Ethereum Payment URI if amount is specified
  const qrValue =
    customAmount && Number(customAmount) > 0
      ? `ethereum:${activeAddress}?value=${customAmount}`
      : activeAddress;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(activeAddress);
    await triggerSuccessHaptic();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    await triggerLightHaptic();
    try {
      const message =
        customAmount && Number(customAmount) > 0
          ? `Requesting ${customAmount} MATIC to ChainBudget address: ${activeAddress}`
          : `My ChainBudget deposit address: ${activeAddress}`;
      await Share.share({
        message,
        title: 'ChainBudget Payment Address',
      });
    } catch (err: any) {
      Alert.alert('Share Error', err.message);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: 16,
        paddingBottom: Math.max(insets.bottom, 24) + 48,
        paddingHorizontal: 20,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Target Toggle: Personal Wallet vs Org Treasury */}
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="flex-row p-1 rounded-2xl mb-6 border shadow-sm"
      >
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            setMode('personal');
          }}
          style={{
            backgroundColor: mode === 'personal' ? colors.primaryMuted : 'transparent',
            borderColor: mode === 'personal' ? colors.primary : 'transparent',
          }}
          className={`flex-1 py-3 rounded-xl items-center border`}
        >
          <Text
            style={{ color: mode === 'personal' ? colors.primary : colors.textMuted }}
            className="font-bold text-sm"
          >
            Personal Wallet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            setMode('treasury');
          }}
          style={{
            backgroundColor: mode === 'treasury' ? colors.infoBg : 'transparent',
            borderColor: mode === 'treasury' ? colors.accentCyan : 'transparent',
          }}
          className={`flex-1 py-3 rounded-xl items-center border`}
        >
          <Text
            style={{ color: mode === 'treasury' ? colors.accentCyan : colors.textMuted }}
            className="font-bold text-sm"
          >
            Org Treasury
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode Sub-Header if in treasury mode with multiple orgs */}
      {mode === 'treasury' && organizations.length > 1 && (
        <View className="mb-4">
          <Text style={{ color: colors.textMuted }} className="text-xs uppercase tracking-wider mb-2 font-bold">
            Select Organization
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {organizations.map((org) => (
              <TouchableOpacity
                key={org._id}
                onPress={() => {
                  triggerLightHaptic();
                  setSelectedOrgId(org._id);
                }}
                style={{
                  backgroundColor: selectedOrgId === org._id ? colors.infoBg : colors.surface,
                  borderColor: selectedOrgId === org._id ? colors.accentCyan : colors.border,
                }}
                className="px-4 py-2 rounded-xl border"
              >
                <Text style={{ color: selectedOrgId === org._id ? colors.accentCyan : colors.textSecondary }} className="text-xs font-semibold">
                  {org.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* QR Code Container */}
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="items-center justify-center border p-6 rounded-3xl mb-6 shadow-sm"
      >
        <View className="bg-white p-4 rounded-2xl shadow-xl mb-4 border border-gray-200">
          <QRCode
            value={qrValue}
            size={200}
            color="#09090b"
            backgroundColor="#ffffff"
          />
        </View>

        <Text style={{ color: colors.textPrimary }} className="font-bold text-base text-center mb-1">
          {mode === 'personal'
            ? 'Your Polygon Amoy Address'
            : `${selectedOrg?.name || 'Organization'} Treasury`}
        </Text>
        <Text style={{ color: colors.textMuted }} className="text-xs text-center mb-4">
          Scan with any Web3 wallet to transfer MATIC
        </Text>

        {/* Address Display Box */}
        <TouchableOpacity
          onPress={handleCopy}
          activeOpacity={0.7}
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="flex-row items-center border px-4 py-3 rounded-xl w-full justify-between"
        >
          <Text style={{ color: colors.textPrimary }} className="text-xs font-mono flex-1 mr-2" numberOfLines={1}>
            {activeAddress}
          </Text>
          <View className="flex-row items-center gap-1">
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={16}
              color={copied ? colors.success : colors.primary}
            />
            <Text style={{ color: copied ? colors.success : colors.primary }} className="text-xs font-bold">
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Optional Amount Request Input */}
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="border p-4 rounded-2xl mb-6 shadow-sm"
      >
        <Text style={{ color: colors.textPrimary }} className="font-bold text-sm mb-2 flex-row items-center">
          <Ionicons name="pricetag-outline" size={14} color={colors.primary} /> Request Specific Amount (Optional)
        </Text>
        <View 
          style={{ 
            backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="flex-row items-center border rounded-xl px-4 py-2"
        >
          <TextInput
            placeholder="0.00"
            placeholderTextColor={colors.inputPlaceholder}
            keyboardType="decimal-pad"
            value={customAmount}
            onChangeText={setCustomAmount}
            style={{ color: colors.textPrimary }}
            className="flex-1 text-base font-bold"
          />
          <Text style={{ color: colors.textMuted }} className="text-sm font-bold ml-2">MATIC</Text>
        </View>
      </View>

      {/* Action Buttons: Unified Symmetrical Buttons */}
      <View className="flex-row gap-3 mb-6">
        {/* Primary Action: Copy Address (Gradient Button) */}
        <TouchableOpacity
          onPress={handleCopy}
          activeOpacity={0.8}
          style={{ flex: 1, height: 52, borderRadius: 16 }}
        >
          <LinearGradient
            colors={copied ? ['#16a34a', '#15803d'] : [colors.primary, colors.accentPurple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 12,
            }}
          >
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color="#ffffff"
            />
            <Text className="text-white font-extrabold text-sm tracking-wide">
              {copied ? 'Copied!' : 'Copy Address'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Secondary Action: Share (Glassmorphic Button with Matching Height) */}
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.7}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 16,
            backgroundColor: colors.cardGlass,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="share-social-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.textPrimary }} className="font-extrabold text-sm tracking-wide">
            Share
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
