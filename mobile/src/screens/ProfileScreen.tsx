import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, BackHandler } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenCapture from 'expo-screen-capture';
import { Image } from 'react-native';
import { getPrivateKey, getMnemonic } from '../lib/secureStorage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerLightHaptic, triggerErrorHaptic, triggerSuccessHaptic, authenticateWithBiometrics } from '../lib/biometrics';
import ThemeSelectorModal from '../components/ThemeSelectorModal';
import appConfig from '../../app.json';

const APP_VERSION = appConfig?.expo?.version || '1.1.3';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const { colors, isDark, themeMode } = useTheme();
  const navigation = useNavigation<any>();


  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mintingSbt, setMintingSbt] = useState(false);
  
  // Vault state
  const [activeTab, setActiveTab] = useState<'menu' | 'phrase' | 'privateKey'>('menu');
  const [keys, setKeys] = useState<{privateKey: string, mnemonic: string} | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);

  // Prevent screenshots when viewing private keys/phrase
  useEffect(() => {
    if (showSecurityModal && (activeTab === 'phrase' || activeTab === 'privateKey')) {
      ScreenCapture.preventScreenCaptureAsync();
    } else {
      ScreenCapture.allowScreenCaptureAsync();
    }
  }, [showSecurityModal, activeTab]);


  const fetchKeys = async (target: 'phrase' | 'privateKey') => {
    await triggerLightHaptic();
    const promptMessage = target === 'privateKey'
      ? 'Authenticate with Biometrics / PIN to Export Private Key'
      : 'Authenticate with Biometrics / PIN to View Recovery Phrase';

    const auth = await authenticateWithBiometrics(promptMessage);
    if (!auth.success) {
      await triggerErrorHaptic();
      return;
    }

    await triggerSuccessHaptic();
    setIsLoadingKeys(true);
    try {
      if (!keys) {
        const [mnemonic, privateKey] = await Promise.all([
          getMnemonic(),
          getPrivateKey(),
        ]);
        if (!mnemonic || !privateKey) {
          Alert.alert('Wallet Not Found', 'No wallet keys were found on this device. Please restore your account.');
          return;
        }
        setKeys({ privateKey, mnemonic });
      }
      setActiveTab(target);
    } catch (err: any) {
      Alert.alert('Authentication Failed', err.message || 'Could not retrieve wallet keys.');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    const isSensitive = label.toLowerCase().includes('private') || label.toLowerCase().includes('phrase');

    if (isSensitive) {
      // Auto-clear clipboard in 60 seconds
      setTimeout(async () => {
        try {
          await Clipboard.setStringAsync('');
        } catch {}
      }, 60000);

      Alert.alert('🔒 Copied to Clipboard', `${label} copied. For your security, the clipboard will automatically be wiped in 60 seconds.`);
    } else {
      Alert.alert('Copied!', `${label} copied to clipboard.`);
    }
  };


  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery access is required to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpeg';
      const type = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (uploadRes.data.documentUrl) {
        await api.put('/users/me', { avatarUrl: uploadRes.data.documentUrl });
        if (refreshUser) await refreshUser();
      }
    } catch (err: any) {
      console.error("Avatar Upload Error:", err);
      const reason = err.response?.data?.error || 'There was an error uploading your profile picture.';
      Alert.alert('Upload Failed', reason);
    } finally {
      setIsUploading(false);
    }
  };

  const handleMintSbt = async () => {
    await triggerLightHaptic();
    const auth = await authenticateWithBiometrics('Authorize Soulbound ID (SBT) Minting on Polygon Amoy');
    if (!auth.success) return;

    setMintingSbt(true);
    try {
      const res = await api.post('/auth/mint-sbt');
      await triggerSuccessHaptic();
      Alert.alert('SBT Minted!', 'Your non-transferable Soulbound Member ID has been verified and recorded on Polygon Amoy testnet.');
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      await triggerErrorHaptic();
      Alert.alert('Minting Failed', err.response?.data?.error || 'Failed to mint Soulbound Token.');
    } finally {
      setMintingSbt(false);
    }
  };

  const getRoleBadge = (level: number) => {
    switch (level) {
      case 1:
        return { label: 'Level 1: Executive Approver', color: colors.primary, bg: colors.primaryMuted };
      case 2:
        return { label: 'Level 2: Finance Officer', color: colors.accentBlue, bg: colors.infoBg };
      case 3:
        return { label: 'Level 3: Member / Contributor', color: colors.success, bg: colors.successBg };
      default:
        return { label: 'Level 4: Viewer', color: colors.textMuted, bg: colors.cardGlass };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView 
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingTop: (insets.top || 0) + 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
      {/* Header */}
      <View className="mb-6">
        <Text style={{ color: colors.textPrimary }} className="text-2xl font-bold mb-1">My Account</Text>
        <Text style={{ color: colors.textSecondary }} className="text-xs">Profile, organization memberships, and security</Text>
      </View>

      {/* ── Backup Reminder Banner ─────────────────────────────────────────── */}
      {user && !user.hasBackedUpPhrase && (
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('RecoveryPhrase', {
            walletAddress: user.walletAddress,
            autoLogin: false,
          })}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: 'rgba(251,191,36,0.08)',
            borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.35)',
            borderRadius: 16, padding: 14, marginBottom: 16,
          }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: 'rgba(251,191,36,0.15)',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Ionicons name="warning" size={18} color="#fbbf24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fbbf24', fontWeight: '700', fontSize: 13, marginBottom: 2 }}>
              Back up your recovery phrase
            </Text>
            <Text style={{ color: 'rgba(251,191,36,0.7)', fontSize: 12, lineHeight: 18 }}>
              If you lose this device, you'll lose access to your account without a backup. Tap to back up now.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(251,191,36,0.5)" />
        </TouchableOpacity>
      )}

      {/* User Identity Card */}
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="border rounded-3xl p-6 items-center mb-6 relative overflow-hidden shadow-sm"
      >
        <TouchableOpacity 
          style={{ borderColor: colors.primary }}
          className="w-24 h-24 rounded-full mb-3 border-2 relative overflow-hidden"
          onPress={handlePickImage}
          disabled={isUploading}
        >
          <Image 
            source={{ 
              uri: user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=e879f9&color=fff&size=200` 
            }} 
            className="w-full h-full rounded-full" 
          />
          
          <View className="absolute bottom-0 w-full bg-black/60 items-center justify-center py-1">
            {isUploading ? (
              <ActivityIndicator size="small" color="#e879f9" />
            ) : (
              <Ionicons name="camera" size={14} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        <Text 
          style={{ color: colors.textPrimary }}
          className="font-bold text-xl mb-1 text-center"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {user?.displayName?.replace(/\n/g, ' ')}
        </Text>
        <Text style={{ color: colors.textSecondary }} className="text-sm mb-4">{user?.email || 'No email provided'}</Text>
        
        {/* Wallet Address Pill */}
        <TouchableOpacity 
          onPress={() => copyToClipboard(user?.walletAddress || '', 'Wallet address')}
          activeOpacity={0.7}
          style={{ 
            backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : colors.backgroundSecondary,
            borderColor: colors.accentCyan + '60',
          }}
          className="px-4 py-2.5 rounded-full border w-full flex-row items-center justify-center"
        >
          <Ionicons name="wallet-outline" size={16} color={colors.accentCyan} />
          <Text style={{ color: colors.accentCyan }} className="font-mono text-xs ml-2 mr-2 font-bold">
            {user?.walletAddress ? `${user.walletAddress.slice(0, 10)}...${user.walletAddress.slice(-8)}` : 'No Auto-Wallet'}
          </Text>
          <Ionicons name="copy-outline" size={14} color={colors.accentCyan} />
        </TouchableOpacity>
      </View>

      {/* Organization Memberships Section */}
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="border rounded-3xl p-5 mb-6 shadow-sm"
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
            <Text style={{ color: colors.textPrimary }} className="font-bold text-base">Memberships</Text>
          </View>
          <View 
            style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
            className="px-2.5 py-1 rounded-full border"
          >
            <Text style={{ color: colors.primary }} className="text-xs font-bold">
              {user?.memberships?.length || 0} Active
            </Text>
          </View>
        </View>

        {user?.memberships && user.memberships.length > 0 ? (
          user.memberships.map((m: any, idx: number) => {
            const badge = getRoleBadge(m.roleLevel || 3);
            const orgName = m.organization?.name || m.organizationName || 'Organization Member';

            return (
              <LinearGradient
                key={m._id || idx}
                colors={isDark ? ['#1a1a24', '#0d0d12'] : ['#ffffff', '#f1f5f9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row justify-between items-start mb-4">
                  {/* Left: Avatar & Text */}
                  <View className="flex-row flex-1 mr-2">
                    <View 
                      style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
                      className="w-12 h-12 rounded-2xl items-center justify-center mr-3 shadow-sm border"
                    >
                      <Text style={{ color: colors.primary }} className="font-extrabold text-xl">
                        {orgName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 justify-center">
                      <Text style={{ color: colors.textPrimary }} className="font-extrabold text-lg tracking-wide" numberOfLines={1}>{orgName}</Text>
                      <Text style={{ color: colors.textSecondary }} className="text-xs mt-0.5 font-medium">{m.roleLabel || 'Member'}</Text>
                    </View>
                  </View>

                  {/* Right: SBT Verified Pill or Mint Button */}
                  {m.hasSBT ? (
                    <View 
                      style={{ backgroundColor: colors.successBg, borderColor: colors.successBorder }}
                      className="flex-row items-center px-2 py-1.5 rounded-lg border"
                    >
                      <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                      <Text style={{ color: colors.success }} className="text-[9px] font-bold ml-1 uppercase tracking-widest">SBT Verified</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handleMintSbt}
                      disabled={mintingSbt}
                      style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary }}
                      className="flex-row items-center px-2.5 py-1.5 rounded-lg border"
                    >
                      {mintingSbt ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                          <Text style={{ color: colors.primary }} className="text-[9px] font-bold ml-1 uppercase tracking-wider">Mint ID</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Role Badge (Bottom Full Width) */}
                <View 
                  style={{ backgroundColor: badge.bg, borderColor: colors.borderSubtle }}
                  className="px-3 py-2.5 rounded-xl border flex-row items-center justify-center"
                >
                  <Ionicons name="star" size={14} color={badge.color} />
                  <Text style={{ color: badge.color }} className="text-xs font-bold ml-2 tracking-wide uppercase">
                    {badge.label}
                  </Text>
                </View>
              </LinearGradient>
            );
          })
        ) : (
          <Text style={{ color: colors.textMuted }} className="text-xs text-center py-3">
            No active organization memberships found.
          </Text>
        )}
      </View>

      {/* Settings Menu List */}
      {/* ── SECTION 1: PREFERENCES & NETWORK ── */}
      <View className="mb-5">
        <Text style={{ color: colors.textMuted }} className="text-xs font-bold uppercase tracking-widest px-2 mb-2">
          Preferences & Network
        </Text>
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="border rounded-2xl p-1 shadow-sm overflow-hidden"
        >
          {/* Appearance & Theme Item */}
          <TouchableOpacity 
            onPress={() => {
              triggerLightHaptic();
              setShowThemeModal(true);
            }}
            activeOpacity={0.7}
            style={{ borderBottomColor: colors.borderSubtle }}
            className="flex-row items-center justify-between p-3.5 border-b"
          >
            <View className="flex-row items-center gap-3">
              <View 
                style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
                className="w-9 h-9 rounded-xl items-center justify-center border"
              >
                <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Appearance & Theme</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs">
                  {themeMode === 'system' ? `System (${isDark ? 'Dark' : 'Light'})` : themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View 
                style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
                className="px-2.5 py-1 rounded-full border"
              >
                <Text style={{ color: colors.primary }} className="text-[11px] font-extrabold uppercase">
                  {themeMode}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Network Status Item */}
          <TouchableOpacity 
            onPress={() => setShowNetworkModal(true)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between p-3.5"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-cyan-500/20 items-center justify-center border border-cyan-500/30">
                <Ionicons name="hardware-chip-outline" size={20} color="#22d3ee" />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Network Status</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs">Polygon Amoy & Relayer details</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SECTION 2: SECURITY & PRIVACY ── */}
      <View className="mb-5">
        <Text style={{ color: colors.textMuted }} className="text-xs font-bold uppercase tracking-widest px-2 mb-2">
          Security & Privacy
        </Text>
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="border rounded-2xl p-1 shadow-sm overflow-hidden"
        >
          {/* Security & Web3 Vault Item */}
          <TouchableOpacity 
            onPress={() => {
              setActiveTab('menu');
              setShowSecurityModal(true);
            }}
            activeOpacity={0.7}
            style={{ borderBottomColor: colors.borderSubtle }}
            className="flex-row items-center justify-between p-3.5 border-b"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-orange-500/20 items-center justify-center border border-orange-500/30">
                <Ionicons name="shield-checkmark-outline" size={20} color="#f97316" />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Web3 Security & Keys</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs">Backup seed phrase & private key</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Data Privacy Notice (RA 10173) */}
          <TouchableOpacity 
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('DataPrivacy');
            }}
            activeOpacity={0.7}
            className="flex-row items-center justify-between p-3.5"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-emerald-500/20 items-center justify-center border border-emerald-500/30">
                <Ionicons name="lock-closed-outline" size={20} color="#10b981" />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Data Privacy & Security</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs">RA 10173 compliance & DPO contact</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SECTION 3: SUPPORT & ABOUT ── */}
      <View className="mb-6">
        <Text style={{ color: colors.textMuted }} className="text-xs font-bold uppercase tracking-widest px-2 mb-2">
          Support & About
        </Text>
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="border rounded-2xl p-1 shadow-sm overflow-hidden"
        >
          {/* Help & FAQs */}
          <TouchableOpacity 
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('HelpFaq');
            }}
            activeOpacity={0.7}
            style={{ borderBottomColor: colors.borderSubtle }}
            className="flex-row items-center justify-between p-3.5 border-b"
          >
            <View className="flex-row items-center gap-3">
              <View 
                style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
                className="w-9 h-9 rounded-xl items-center justify-center border"
              >
                <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Help & Knowledge Base</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs">FAQs, guides, and support channels</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* About Item */}
          <TouchableOpacity 
            onPress={() => setShowAboutModal(true)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between p-3.5"
          >
            <View className="flex-row items-center gap-3">
              <View 
                style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
                className="w-9 h-9 rounded-xl items-center justify-center border"
              >
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">About ChainBudget</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs">v{APP_VERSION} Capstone Edition</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>


      {/* Logout Button */}
      <TouchableOpacity
        onPress={() => {
          triggerLightHaptic();
          setShowLogoutModal(true);
        }}
        activeOpacity={0.8}
        style={{
          backgroundColor: colors.errorBg,
          borderColor: colors.errorBorder,
        }}
        className="border py-4 rounded-2xl items-center flex-row justify-center gap-2 mb-10"
      >
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={{ color: colors.error }} className="font-bold text-base">Sign Out</Text>
      </TouchableOpacity>

      {/* ── MODAL 1: Professional Web3 Security Vault ── */}
      <Modal
        visible={showSecurityModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowSecurityModal(false)}
      >
        <View 
          style={{ backgroundColor: colors.modalBackdrop }}
          className="flex-1 justify-end"
        >
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="border-t rounded-t-3xl p-6 max-h-[85%]"
          >
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-5">
              <View className="flex-row items-center gap-2">
                {activeTab !== 'menu' && (
                  <TouchableOpacity onPress={() => setActiveTab('menu')} className="mr-1">
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                )}
                <Ionicons name="shield-checkmark" size={24} color="#f97316" />
                <Text style={{ color: colors.textPrimary }} className="font-bold text-lg">
                  {activeTab === 'menu' && 'Web3 Vault Settings'}
                  {activeTab === 'phrase' && 'Recovery Seed Phrase'}
                  {activeTab === 'privateKey' && 'Export Private Key'}
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => setShowSecurityModal(false)}
                style={{ backgroundColor: colors.cardGlass }}
                className="w-8 h-8 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* TAB 1: MENU SELECTION */}
            {activeTab === 'menu' && (
              <View className="space-y-4">
                <Text style={{ color: colors.textSecondary }} className="text-xs leading-relaxed mb-4">
                  Select a security item to view. Each action requires device authentication (Biometrics or PIN).
                </Text>

                {/* Option 1: View Seed Phrase */}
                <TouchableOpacity
                  onPress={() => fetchKeys('phrase')}
                  disabled={isLoadingKeys}
                  activeOpacity={0.8}
                  style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
                  className="border p-4 rounded-2xl flex-row items-center justify-between mb-3"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-orange-500/20 items-center justify-center border border-orange-500/30">
                      <Ionicons name="document-text-outline" size={22} color="#f97316" />
                    </View>
                    <View>
                      <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Backup Recovery Seed Phrase</Text>
                      <Text style={{ color: colors.textMuted }} className="text-xs">12-word secret mnemonic</Text>
                    </View>
                  </View>
                  {isLoadingKeys ? <ActivityIndicator color="#f97316" /> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
                </TouchableOpacity>

                {/* Option 2: Export Private Key */}
                <TouchableOpacity
                  onPress={() => fetchKeys('privateKey')}
                  disabled={isLoadingKeys}
                  activeOpacity={0.8}
                  style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
                  className="border p-4 rounded-2xl flex-row items-center justify-between mb-6"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-red-500/20 items-center justify-center border border-red-500/30">
                      <Ionicons name="key-outline" size={22} color={colors.error} />
                    </View>
                    <View>
                      <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Export Wallet Private Key</Text>
                      <Text style={{ color: colors.textMuted }} className="text-xs">Raw hex private key for import</Text>
                    </View>
                  </View>
                  {isLoadingKeys ? <ActivityIndicator color={colors.error} /> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 2: SEED PHRASE DISPLAY (NUMBERED GRID) */}
            {activeTab === 'phrase' && keys && (
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={{ color: colors.textSecondary }} className="text-xs leading-relaxed mb-4">
                  Write down these 12 words in order. Keep them stored offline in a safe place.
                </Text>

                {/* 12 Word Grid */}
                <View className="flex-row flex-wrap justify-between mb-4">
                  {keys.mnemonic.split(' ').map((word, index) => (
                    <View 
                      key={index}
                      style={{ 
                        backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : colors.backgroundSecondary,
                        borderColor: colors.border,
                      }}
                      className="border rounded-xl p-3 w-[48%] flex-row items-center mb-2"
                    >
                      <Text className="text-orange-400 font-mono text-xs font-bold mr-2">{index + 1}.</Text>
                      <Text style={{ color: colors.textPrimary }} className="font-mono text-sm font-semibold">{word}</Text>
                    </View>
                  ))}
                </View>

                {/* Copy Button Wrapper */}
                <View style={{ paddingHorizontal: 4, width: '100%', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(keys.mnemonic, 'Recovery phrase')}
                    activeOpacity={0.7}
                    style={{ 
                      width: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(249, 115, 22, 0.15)',
                      borderColor: 'rgba(249, 115, 22, 0.5)',
                      borderWidth: 1.5,
                      borderRadius: 16,
                      paddingVertical: 14,
                      marginTop: 10,
                      marginBottom: 16
                    }}
                  >
                    <Ionicons name="copy-outline" size={18} color="#f97316" />
                    <Text style={{ color: '#f97316', fontWeight: 'bold', fontSize: 14, marginLeft: 8 }}>
                      Copy Seed Phrase
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* TAB 3: PRIVATE KEY DISPLAY */}
            {activeTab === 'privateKey' && keys && (
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <View 
                  style={{ backgroundColor: colors.errorBg, borderColor: colors.errorBorder }}
                  className="border p-3.5 rounded-xl mb-4 flex-row items-center gap-2"
                >
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <Text style={{ color: colors.error }} className="text-xs font-medium flex-1 ml-2">
                    Never share your Private Key with anyone. Anyone with this key can access your funds.
                  </Text>
                </View>

                <View 
                  style={{ 
                    backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : colors.backgroundSecondary,
                    borderColor: colors.errorBorder,
                  }}
                  className="p-4 rounded-xl border mb-4"
                >
                  <Text style={{ color: colors.error }} className="text-xs font-bold uppercase tracking-widest mb-2">Private Key</Text>
                  <Text style={{ color: colors.textPrimary }} className="font-mono text-xs leading-5" selectable>{keys.privateKey}</Text>
                </View>

                {/* Copy Button Wrapper */}
                <View style={{ paddingHorizontal: 4, width: '100%', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(keys.privateKey, 'Private key')}
                    activeOpacity={0.7}
                    style={{ 
                      width: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.errorBg,
                      borderColor: colors.errorBorder,
                      borderWidth: 1.5,
                      borderRadius: 16,
                      paddingVertical: 14,
                      marginTop: 10,
                      marginBottom: 16
                    }}
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.error} />
                    <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 14, marginLeft: 8 }}>
                      Copy Private Key
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL 2: Network Status ── */}
      <Modal
        visible={showNetworkModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowNetworkModal(false)}
      >
        <View 
          style={{ backgroundColor: colors.modalBackdrop }}
          className="flex-1 justify-end"
        >
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="border-t rounded-t-3xl p-6"
          >
            <View className="flex-row justify-between items-center mb-5">
              <View className="flex-row items-center gap-2">
                <Ionicons name="hardware-chip-outline" size={24} color={colors.accentCyan} />
                <Text style={{ color: colors.textPrimary }} className="font-bold text-lg">Network & Protocol</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowNetworkModal(false)}
                style={{ backgroundColor: colors.cardGlass }}
                className="w-8 h-8 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View className="space-y-3 mb-6">
              <View 
                style={{ 
                  backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
                  borderColor: colors.border,
                }}
                className="flex-row items-center justify-between p-4 rounded-xl border mb-2"
              >
                <Text style={{ color: colors.textSecondary }} className="text-xs font-bold">Network Name</Text>
                <Text style={{ color: colors.success }} className="font-bold text-xs">Polygon Amoy Testnet</Text>
              </View>

              <View 
                style={{ 
                  backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
                  borderColor: colors.border,
                }}
                className="flex-row items-center justify-between p-4 rounded-xl border mb-2"
              >
                <Text style={{ color: colors.textSecondary }} className="text-xs font-bold">Chain ID</Text>
                <Text style={{ color: colors.accentCyan }} className="font-mono text-xs font-bold">80002</Text>
              </View>

              <View 
                style={{ 
                  backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
                  borderColor: colors.border,
                }}
                className="flex-row items-center justify-between p-4 rounded-xl border"
              >
                <Text style={{ color: colors.textSecondary }} className="text-xs font-bold">Gasless Relayer</Text>
                <Text style={{ color: colors.success }} className="font-bold text-xs">Active (Zero-Gas for Users)</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 3: About ── */}
      <Modal
        visible={showAboutModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View 
          style={{ backgroundColor: colors.modalBackdrop }}
          className="flex-1 justify-end"
        >
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="border-t rounded-t-3xl p-6"
          >
            <View className="items-center mb-6">
              <View className="items-center justify-center mb-4">
                <Image 
                  source={require('../../assets/3D-Chainbudget.png')} 
                  style={{ width: 140, height: 140 }} 
                  resizeMode="contain" 
                />
              </View>
              <Text style={{ color: colors.textPrimary }} className="text-2xl font-bold mb-2">ChainBudget Mobile</Text>
              <Text style={{ color: colors.primary }} className="font-bold mb-6">Version {APP_VERSION} (Capstone Edition)</Text>
            </View>
            <Text style={{ color: colors.textSecondary }} className="text-xs text-center leading-relaxed mb-6">
              A Transparent & Accountable On-Chain Budget Dissemination System powered by Polygon Blockchain, Asgardeo SSO, and AI Receipt Processing.
            </Text>

            <TouchableOpacity 
              onPress={() => setShowAboutModal(false)}
              style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
              className="border py-3 px-8 rounded-xl items-center"
            >
              <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 4: Sign Out Confirmation Modal ── */}
      <Modal
        visible={showLogoutModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View 
          style={{ backgroundColor: colors.modalBackdrop }}
          className="flex-1 items-center justify-center p-6"
        >
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="w-full max-w-sm border rounded-3xl p-6 shadow-2xl items-center"
          >
            <Text style={{ color: colors.textPrimary }} className="text-xl font-extrabold text-center mb-2">
              Sign Out?
            </Text>

            <Text style={{ color: colors.textSecondary }} className="text-xs text-center leading-relaxed mb-5 px-2">
              Are you sure you want to sign out of ChainBudget? You will need to log back in to access your organization dashboards and wallets.
            </Text>

            {/* Warning if phrase not backed up */}
            {!user?.hasBackedUpPhrase && (
              <View 
                style={{ backgroundColor: colors.warningBg, borderColor: colors.warningBorder }}
                className="w-full rounded-2xl p-3.5 mb-5 flex-row items-center gap-2.5 border"
              >
                <Ionicons name="warning-outline" size={20} color={colors.warning} />
                <Text style={{ color: colors.warning }} className="text-xs flex-1 leading-snug font-medium">
                  Make sure you have backed up your recovery phrase before signing out!
                </Text>
              </View>
            )}

            {/* Action Buttons: Cancel vs Sign Out */}
            <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  setShowLogoutModal(false);
                }}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  height: 48,
                  backgroundColor: colors.cardGlass,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontWeight: '700',
                    fontSize: 14,
                    textAlign: 'center',
                    includeFontPadding: false,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await triggerErrorHaptic();
                  setShowLogoutModal(false);
                  logout();
                }}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  height: 48,
                  backgroundColor: '#DC2626',
                  borderColor: '#DC2626',
                  borderWidth: 1,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  shadowColor: '#DC2626',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#ffffff" />
                <Text
                  style={{
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: 14,
                    textAlign: 'center',
                    includeFontPadding: false,
                  }}
                >
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 5: Theme Selector Modal ── */}
      <ThemeSelectorModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </KeyboardAwareScrollView>
  </View>
  );
}
