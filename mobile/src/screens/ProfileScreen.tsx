import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  triggerLightHaptic,
  triggerErrorHaptic,
  triggerSuccessHaptic,
  authenticateWithBiometrics,
} from '../lib/biometrics';
import ThemeSelectorModal from '../components/ThemeSelectorModal';
import appConfig from '../../app.json';

const APP_VERSION = appConfig?.expo?.version || '1.1.3';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const { colors, isDark, themeMode } = useTheme();
  const navigation = useNavigation<any>();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [mintingSbt, setMintingSbt] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showAllMemberships, setShowAllMemberships] = useState(false);

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    await triggerSuccessHaptic();
    Alert.alert('Copied!', `${label} copied to clipboard.`);
  };

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

      {/* Organization Memberships Section (Option 2: Compact Top 2 Preview + View All Toggle) */}
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="border rounded-3xl p-4 mb-6 shadow-sm"
      >
        <View className="flex-row items-center justify-between mb-3 px-1">
          <View className="flex-row items-center gap-2">
            <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.textPrimary }} className="font-bold text-base">Memberships</Text>
          </View>
          <View 
            style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
            className="px-2.5 py-0.5 rounded-full border"
          >
            <Text style={{ color: colors.primary }} className="text-xs font-bold">
              {user?.memberships?.length || 0} Active
            </Text>
          </View>
        </View>

        {user?.memberships && user.memberships.length > 0 ? (
          <View>
            {(showAllMemberships ? user.memberships : user.memberships.slice(0, 2)).map((m: any, idx: number) => {
              const badge = getRoleBadge(m.roleLevel || 3);
              const orgName = m.organization?.name || m.organizationName || 'Organization Member';

              return (
                <View
                  key={m._id || idx}
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : colors.backgroundSecondary,
                    borderColor: colors.border,
                  }}
                  className="p-3.5 rounded-2xl border mb-2.5 flex-row items-center justify-between"
                >
                  {/* Left: Compact Squircle Avatar + Org Name & Role */}
                  <View className="flex-row items-center flex-1 mr-3">
                    <View 
                      style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
                      className="w-10 h-10 rounded-xl items-center justify-center mr-3 border"
                    >
                      <Text style={{ color: colors.primary }} className="font-black text-base">
                        {orgName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: colors.textPrimary }} className="font-bold text-sm" numberOfLines={1}>
                        {orgName}
                      </Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <Text style={{ color: badge.color }} className="text-[11px] font-bold">
                          {m.roleLabel || 'Member'}
                        </Text>
                        <Text style={{ color: colors.textMuted }} className="text-[10px]">•</Text>
                        <Text style={{ color: colors.textSecondary }} className="text-[11px] font-medium">
                          {m.roleLevel === 1 ? 'Founder' : m.roleLevel === 2 ? 'Manager' : 'Core'} (L{m.roleLevel || 3})
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right: SBT Pill or Mint ID */}
                  {m.hasSBT ? (
                    <View 
                      style={{ backgroundColor: colors.successBg, borderColor: colors.successBorder }}
                      className="flex-row items-center px-2 py-1 rounded-full border"
                    >
                      <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                      <Text style={{ color: colors.success }} className="text-[9px] font-extrabold ml-1 uppercase">SBT</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handleMintSbt}
                      disabled={mintingSbt}
                      style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '60' }}
                      className="flex-row items-center px-2.5 py-1 rounded-full border"
                    >
                      {mintingSbt ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <View className="flex-row items-center">
                          <Ionicons name="sparkles-outline" size={11} color={colors.primary} />
                          <Text style={{ color: colors.primary }} className="text-[9px] font-extrabold ml-1 uppercase">Mint</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* Toggle Show All / Show Less Button if > 2 orgs */}
            {user.memberships.length > 2 && (
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  setShowAllMemberships(!showAllMemberships);
                }}
                activeOpacity={0.7}
                style={{
                  backgroundColor: colors.cardGlass,
                  borderColor: colors.borderSubtle,
                }}
                className="py-2.5 px-4 rounded-xl border flex-row items-center justify-center mt-1"
              >
                <Text style={{ color: colors.primary }} className="font-bold text-xs mr-1.5">
                  {showAllMemberships 
                    ? 'Show Less' 
                    : `View All (${user.memberships.length}) Organizations`}
                </Text>
                <Ionicons 
                  name={showAllMemberships ? 'chevron-up' : 'chevron-down'} 
                  size={14} 
                  color={colors.primary} 
                />
              </TouchableOpacity>
            )}
          </View>
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
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('NetworkStatus');
            }}
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
              triggerLightHaptic();
              navigation.navigate('SecurityKeys');
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

          {/* Data Privacy Notice */}
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
                <Text style={{ color: colors.textSecondary }} className="text-xs">Compliance & DPO contact</Text>
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
          {/* Send Feedback & Bug Report */}
          <TouchableOpacity 
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('Feedback');
            }}
            activeOpacity={0.7}
            style={{ borderBottomColor: colors.borderSubtle }}
            className="flex-row items-center justify-between p-3.5 border-b"
          >
            <View className="flex-row items-center gap-3">
              <View 
                style={{ backgroundColor: '#F59E0B20', borderColor: '#F59E0B40' }}
                className="w-9 h-9 rounded-xl items-center justify-center border"
              >
                <Ionicons name="chatbubbles-outline" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">Send Feedback & Bug Report</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs">Report issues, suggestions, or ratings</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

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
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('About');
            }}
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

      {/* ── MODAL: Sign Out Confirmation Modal ── */}
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
