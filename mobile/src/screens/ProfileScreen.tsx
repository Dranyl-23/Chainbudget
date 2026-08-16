import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { getPrivateKey, getMnemonic } from '../lib/secureStorage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const navigation = useNavigation();

  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  // Vault state
  const [activeTab, setActiveTab] = useState<'menu' | 'phrase' | 'privateKey'>('menu');
  const [keys, setKeys] = useState<{privateKey: string, mnemonic: string} | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);

  const fetchKeys = async (target: 'phrase' | 'privateKey') => {
    setIsLoadingKeys(true);
    try {
      // Read keys directly from hardware-backed SecureStore on this device.
      // getMnemonic() and getPrivateKey() each trigger biometric authentication.
      // No network request is made — keys never leave the device.
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
    Alert.alert('Copied!', `${label} copied to clipboard.`);
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
      const type = match ? `image/${match[1]}` : `image/jpeg`;

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
      Alert.alert('Upload Failed', 'There was an error uploading your profile picture.');
    } finally {
      setIsUploading(false);
    }
  };

  const getRoleBadge = (level: number) => {
    switch (level) {
      case 1:
        return { label: 'Level 1: Executive Approver', color: '#e879f9', bg: 'rgba(232, 121, 249, 0.15)' };
      case 2:
        return { label: 'Level 2: Finance Officer', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
      case 3:
        return { label: 'Level 3: Member / Contributor', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' };
      default:
        return { label: 'Level 4: Viewer', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)' };
    }
  };

  return (
    <KeyboardAwareScrollView 
      className="flex-1 bg-[#09090b]"
      contentContainerStyle={{ padding: 16, paddingTop: (insets.top || 0) + 16, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      {/* Header */}
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white mb-1">My Account</Text>
        <Text className="text-white/50 text-xs">Profile, organization memberships, and security</Text>
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
      <View className="bg-white/5 border border-white/10 rounded-2xl p-6 items-center mb-6 relative overflow-hidden">
        
        <TouchableOpacity 
          className="w-24 h-24 rounded-full mb-3 border-2 border-fuchsia-500/50 relative overflow-hidden"
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
          className="text-white font-bold text-xl mb-1 text-center"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {user?.displayName?.replace(/\n/g, ' ')}
        </Text>
        <Text className="text-white/50 text-sm mb-4">{user?.email || 'No email provided'}</Text>
        
        {/* Wallet Address Pill */}
        <TouchableOpacity 
          onPress={() => copyToClipboard(user?.walletAddress || '', 'Wallet address')}
          activeOpacity={0.7}
          className="bg-black/60 px-4 py-2.5 rounded-full border border-cyan-500/40 w-full flex-row items-center justify-center"
        >
          <Ionicons name="wallet-outline" size={16} color="#22d3ee" />
          <Text className="text-cyan-400 font-mono text-xs ml-2 mr-2">
            {user?.walletAddress ? `${user.walletAddress.slice(0, 10)}...${user.walletAddress.slice(-8)}` : 'No Auto-Wallet'}
          </Text>
          <Ionicons name="copy-outline" size={14} color="#22d3ee" />
        </TouchableOpacity>
      </View>

      {/* Organization Memberships Section */}
      <View className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="ribbon-outline" size={22} color="#e879f9" />
            <Text className="text-white font-bold text-base">Memberships</Text>
          </View>
          <View className="bg-fuchsia-500/20 px-2.5 py-1 rounded-full border border-fuchsia-500/30">
            <Text className="text-fuchsia-400 text-xs font-bold">
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
                colors={['#1a1a24', '#0d0d12']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <View className="flex-row justify-between items-start mb-4">
                  {/* Left: Avatar & Text */}
                  <View className="flex-row flex-1 mr-2">
                    <View className="w-12 h-12 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30 items-center justify-center mr-3 shadow-sm">
                      <Text className="text-fuchsia-400 font-extrabold text-xl">
                        {orgName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 justify-center">
                      <Text className="text-white font-extrabold text-lg tracking-wide" numberOfLines={1}>{orgName}</Text>
                      <Text className="text-white/60 text-xs mt-0.5 font-medium">{m.roleLabel || 'Member'}</Text>
                    </View>
                  </View>

                  {/* Right: SBT Verified Pill */}
                  <View className="flex-row items-center bg-emerald-500/15 px-2 py-1.5 rounded-lg border border-emerald-500/40">
                    <Ionicons name="shield-checkmark" size={12} color="#34d399" />
                    <Text className="text-emerald-400 text-[9px] font-bold ml-1 uppercase tracking-widest">SBT Verified</Text>
                  </View>
                </View>

                {/* Role Badge (Bottom Full Width) */}
                <View 
                  style={{ backgroundColor: badge.bg, borderColor: 'rgba(255,255,255,0.05)' }}
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
          <Text className="text-white/50 text-xs text-center py-3">
            No active organization memberships found.
          </Text>
        )}
      </View>

      {/* Settings Menu List */}
      <View className="bg-white/5 border border-white/10 rounded-2xl p-2 mb-6">
        <Text className="text-white/50 text-xs font-bold uppercase tracking-widest px-4 pt-3 pb-2">Settings & Security</Text>

        {/* Security & Web3 Vault Item */}
        <TouchableOpacity 
          onPress={() => {
            setActiveTab('menu');
            setShowSecurityModal(true);
          }}
          activeOpacity={0.7}
          className="flex-row items-center justify-between p-4 border-b border-white/5"
        >
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-xl bg-orange-500/20 items-center justify-center border border-orange-500/30">
              <Ionicons name="shield-checkmark-outline" size={20} color="#f97316" />
            </View>
            <View>
              <Text className="text-white font-bold text-sm">Web3 Security & Keys</Text>
              <Text className="text-white/50 text-xs">Backup seed phrase & private key</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#666" />
        </TouchableOpacity>

        {/* Network Status Item */}
        <TouchableOpacity 
          onPress={() => setShowNetworkModal(true)}
          activeOpacity={0.7}
          className="flex-row items-center justify-between p-4 border-b border-white/5"
        >
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-xl bg-cyan-500/20 items-center justify-center border border-cyan-500/30">
              <Ionicons name="hardware-chip-outline" size={20} color="#22d3ee" />
            </View>
            <View>
              <Text className="text-white font-bold text-sm">Network Status</Text>
              <Text className="text-white/50 text-xs">Polygon Amoy & Relayer details</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#666" />
        </TouchableOpacity>

        {/* About Item */}
        <TouchableOpacity 
          onPress={() => setShowAboutModal(true)}
          activeOpacity={0.7}
          className="flex-row items-center justify-between p-4"
        >
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-xl bg-fuchsia-500/20 items-center justify-center border border-fuchsia-500/30">
              <Ionicons name="information-circle-outline" size={20} color="#e879f9" />
            </View>
            <View>
              <Text className="text-white font-bold text-sm">About ChainBudget</Text>
              <Text className="text-white/50 text-xs">v1.0.0 Capstone Edition</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        onPress={logout}
        activeOpacity={0.8}
        className="bg-red-500/10 border border-red-500/30 py-4 rounded-xl items-center flex-row justify-center gap-2 mb-10"
      >
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text className="text-red-400 font-bold text-base">Sign Out</Text>
      </TouchableOpacity>

      {/* ── MODAL 1: Professional Web3 Security Vault ── */}
      <Modal
        visible={showSecurityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSecurityModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#121215] border-t border-white/10 rounded-t-3xl p-6 max-h-[85%]">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-5">
              <View className="flex-row items-center gap-2">
                {activeTab !== 'menu' && (
                  <TouchableOpacity onPress={() => setActiveTab('menu')} className="mr-1">
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
                <Ionicons name="shield-checkmark" size={24} color="#f97316" />
                <Text className="text-white font-bold text-lg">
                  {activeTab === 'menu' && 'Web3 Vault Settings'}
                  {activeTab === 'phrase' && 'Recovery Seed Phrase'}
                  {activeTab === 'privateKey' && 'Export Private Key'}
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => setShowSecurityModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* TAB 1: MENU SELECTION */}
            {activeTab === 'menu' && (
              <View className="space-y-4">
                <Text className="text-white/60 text-xs leading-relaxed mb-4">
                  Select a security item to view. Each action requires device authentication (Biometrics or PIN).
                </Text>

                {/* Option 1: View Seed Phrase */}
                <TouchableOpacity
                  onPress={() => fetchKeys('phrase')}
                  disabled={isLoadingKeys}
                  activeOpacity={0.8}
                  className="bg-white/5 border border-white/10 p-4 rounded-xl flex-row items-center justify-between mb-3"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-orange-500/20 items-center justify-center border border-orange-500/30">
                      <Ionicons name="document-text-outline" size={22} color="#f97316" />
                    </View>
                    <View>
                      <Text className="text-white font-bold text-sm">Backup Recovery Seed Phrase</Text>
                      <Text className="text-white/50 text-xs">12-word secret mnemonic</Text>
                    </View>
                  </View>
                  {isLoadingKeys ? <ActivityIndicator color="#f97316" /> : <Ionicons name="chevron-forward" size={18} color="#666" />}
                </TouchableOpacity>

                {/* Option 2: Export Private Key */}
                <TouchableOpacity
                  onPress={() => fetchKeys('privateKey')}
                  disabled={isLoadingKeys}
                  activeOpacity={0.8}
                  className="bg-white/5 border border-white/10 p-4 rounded-xl flex-row items-center justify-between mb-6"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-red-500/20 items-center justify-center border border-red-500/30">
                      <Ionicons name="key-outline" size={22} color="#ef4444" />
                    </View>
                    <View>
                      <Text className="text-white font-bold text-sm">Export Wallet Private Key</Text>
                      <Text className="text-white/50 text-xs">Raw hex private key for import</Text>
                    </View>
                  </View>
                  {isLoadingKeys ? <ActivityIndicator color="#ef4444" /> : <Ionicons name="chevron-forward" size={18} color="#666" />}
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 2: SEED PHRASE DISPLAY (NUMBERED GRID) */}
            {activeTab === 'phrase' && keys && (
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text className="text-white/60 text-xs leading-relaxed mb-4">
                  Write down these 12 words in order. Keep them stored offline in a safe place.
                </Text>

                {/* 12 Word Grid */}
                <View className="flex-row flex-wrap justify-between mb-4">
                  {keys.mnemonic.split(' ').map((word, index) => (
                    <View 
                      key={index}
                      className="bg-black/60 border border-white/10 rounded-xl p-3 w-[48%] flex-row items-center mb-2"
                    >
                      <Text className="text-orange-400 font-mono text-xs font-bold mr-2">{index + 1}.</Text>
                      <Text className="text-white font-mono text-sm font-semibold">{word}</Text>
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
                <View className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl mb-4 flex-row items-center gap-2">
                  <Ionicons name="warning" size={20} color="#ef4444" />
                  <Text className="text-red-400 text-xs font-medium flex-1 ml-2">
                    Never share your Private Key with anyone. Anyone with this key can access your funds.
                  </Text>
                </View>

                <View className="bg-black/80 p-4 rounded-xl border border-red-500/40 mb-4">
                  <Text className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2">Private Key</Text>
                  <Text className="text-gray-200 font-mono text-xs leading-5" selectable>{keys.privateKey}</Text>
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
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      borderColor: 'rgba(239, 68, 68, 0.5)',
                      borderWidth: 1.5,
                      borderRadius: 16,
                      paddingVertical: 14,
                      marginTop: 10,
                      marginBottom: 16
                    }}
                  >
                    <Ionicons name="copy-outline" size={18} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 14, marginLeft: 8 }}>
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
        onRequestClose={() => setShowNetworkModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#121215] border-t border-white/10 rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-5">
              <View className="flex-row items-center gap-2">
                <Ionicons name="hardware-chip-outline" size={24} color="#22d3ee" />
                <Text className="text-white font-bold text-lg">Network & Protocol</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowNetworkModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View className="space-y-3 mb-6">
              <View className="flex-row items-center justify-between bg-black/40 p-4 rounded-xl border border-white/10 mb-2">
                <Text className="text-white/70 text-xs font-bold">Network Name</Text>
                <Text className="text-emerald-400 font-bold text-xs">Polygon Amoy Testnet</Text>
              </View>

              <View className="flex-row items-center justify-between bg-black/40 p-4 rounded-xl border border-white/10 mb-2">
                <Text className="text-white/70 text-xs font-bold">Chain ID</Text>
                <Text className="text-cyan-400 font-mono text-xs">80002</Text>
              </View>

              <View className="flex-row items-center justify-between bg-black/40 p-4 rounded-xl border border-white/10">
                <Text className="text-white/70 text-xs font-bold">Gasless Relayer</Text>
                <Text className="text-emerald-400 font-bold text-xs">Active (Zero-Gas for Users)</Text>
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
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#121215] border-t border-white/10 rounded-t-3xl p-6">
            <View className="items-center mb-6">
              <View className="items-center justify-center mb-4">
                <Image 
                  source={require('../../assets/3D-Chainbudget.png')} 
                  style={{ width: 140, height: 140 }} 
                  resizeMode="contain" 
                />
              </View>
              <Text className="text-2xl font-bold text-white mb-2">ChainBudget Mobile</Text>
              <Text className="text-fuchsia-400 font-bold mb-6">Version 1.0.0 (Capstone Edition)</Text>
            </View>
            <Text className="text-white/60 text-xs text-center leading-relaxed mb-6">
              A Transparent & Accountable On-Chain Budget Dissemination System powered by Polygon Blockchain, Asgardeo SSO, and AI Receipt Processing.
            </Text>

            <TouchableOpacity 
              onPress={() => setShowAboutModal(false)}
              className="bg-white/10 border border-white/20 py-3 px-8 rounded-xl"
            >
              <Text className="text-white font-bold text-sm">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAwareScrollView>
  );
}
