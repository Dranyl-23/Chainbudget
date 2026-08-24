/**
 * TreasuryScreen.tsx — FP-4
 * Treasury settings: governance rules, live on-chain balance.
 * Level 1 (Executive) only.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Image,
  Modal, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { ethers } from 'ethers';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useTheme } from '../context/ThemeContext';
import { triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';

const AMOY_RPC = 'https://rpc-amoy.polygon.technology';

export default function TreasuryScreen() {
  const route = useRoute<any>();
  const { user, refreshUser } = useAuth();
  const { refreshOrgs } = useOrg();
  const { colors, isDark } = useTheme();
  const orgId: string = route.params?.orgId;

  const [org, setOrg] = useState<any>(null);
  const [chainBalance, setChainBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Custom Success Confirmation Modal State
  const [showEmblemSuccessModal, setShowEmblemSuccessModal] = useState(false);
  const [uploadedEmblemUrl, setUploadedEmblemUrl] = useState<string | null>(null);
  const emblemScaleAnim = useRef(new Animated.Value(0)).current;
  const emblemPulseAnim = useRef(new Animated.Value(1)).current;

  const triggerEmblemSuccessModal = (url: string) => {
    setUploadedEmblemUrl(url);
    setShowEmblemSuccessModal(true);
    emblemScaleAnim.setValue(0);
    Animated.spring(emblemScaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(emblemPulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(emblemPulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  };

  // Form
  const [threshold, setThreshold] = useState('');
  const [requiredApprovals, setRequiredApprovals] = useState('');

  // Check role
  const myMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === orgId
  );
  const roleLevel = myMembership?.roleLevel || 4;
  const isAuthorized = roleLevel <= 1 || user?.isSuperAdmin;

  useEffect(() => {
    if (orgId) fetchOrg();
  }, [orgId]);

  const fetchOrg = async () => {
    try {
      const res = await api.get(`/organizations/${orgId}`);
      const data = res.data?.organization || res.data;
      setOrg(data);
      setThreshold(String(data.highValueThreshold || ''));
      setRequiredApprovals(String(data.requiredApprovals || ''));
      if (data.treasuryContractAddress || data.contractAddress) {
        fetchChainBalance(data.treasuryContractAddress || data.contractAddress);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChainBalance = async (contractAddr: string) => {
    if (!contractAddr || !contractAddr.startsWith('0x')) return;
    setLoadingBalance(true);
    try {
      const provider = new ethers.JsonRpcProvider(AMOY_RPC);
      const bal = await provider.getBalance(contractAddr);
      setChainBalance(ethers.formatEther(bal));
    } catch {
      setChainBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrg().then(() => setRefreshing(false));
  };

  const handlePickAndChangeLogo = async () => {
    await triggerLightHaptic();
    Alert.alert(
      'Rebrand Organization Emblem',
      'Upload a new emblem or official logo for this organization',
      [
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Gallery access is needed to pick an emblem.');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });

            if (!result.canceled && result.assets[0]?.uri) {
              await uploadPhoto(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera access is needed to take a picture.');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });

            if (!result.canceled && result.assets[0]?.uri) {
              await uploadPhoto(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadPhoto = async (uri: string) => {
    setUploadingLogo(true);
    await triggerLightHaptic();
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'org-logo.jpg';
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

      const uploadedUrl = uploadRes.data?.documentUrl;
      if (uploadedUrl) {
        await api.patch(`/organizations/${orgId}`, { logoUrl: uploadedUrl });
        setOrg((prev: any) => ({ ...prev, logoUrl: uploadedUrl }));
        await triggerSuccessHaptic();
        if (refreshOrgs) await refreshOrgs();
        if (refreshUser) await refreshUser();
        triggerEmblemSuccessModal(uploadedUrl);
      }
    } catch (err: any) {
      console.warn('[uploadPhoto error]', err?.response?.data || err.message);
      await triggerErrorHaptic();
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update organization emblem.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!threshold || !requiredApprovals) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/organizations/${orgId}`, {
        highValueThreshold: Number(threshold),
        requiredApprovals: Number(requiredApprovals),
      });
      await triggerSuccessHaptic();
      Alert.alert('Saved', 'Treasury settings updated successfully.');
      fetchOrg();
    } catch (err: any) {
      await triggerErrorHaptic();
      Alert.alert('Error', err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="lock-closed-outline" size={56} color={colors.textMuted} />
        <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 20, marginTop: 16, textAlign: 'center' }}>
          Access Denied
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center', fontSize: 14 }}>
          Treasury settings are restricted to Executive Approvers (Level 1) only.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const contractAddr = org?.treasuryContractAddress || org?.contractAddress;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* Live Balance Card */}
      <View style={{
        backgroundColor: colors.surface, borderColor: colors.border,
        borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 20,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            Live Treasury Balance
          </Text>
          <TouchableOpacity onPress={() => contractAddr && fetchChainBalance(contractAddr)}>
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loadingBalance ? (
          <ActivityIndicator color={colors.primary} />
        ) : chainBalance !== null ? (
          <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '800' }}>
            {parseFloat(chainBalance).toFixed(4)} POL
          </Text>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            {contractAddr ? 'Unable to fetch balance' : 'No contract linked'}
          </Text>
        )}

        {contractAddr && (
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>
            {contractAddr.slice(0, 10)}...{contractAddr.slice(-8)}
          </Text>
        )}
      </View>

      {/* Organization Emblem & Rebranding */}
      <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18, marginBottom: 16 }}>
        Organization Branding & Emblem
      </Text>

      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <TouchableOpacity
          onPress={handlePickAndChangeLogo}
          disabled={uploadingLogo}
          activeOpacity={0.8}
          style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderColor: colors.primary,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {uploadingLogo ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : org?.logoUrl ? (
            <Image
              source={{ uri: org.logoUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="business" size={32} color={colors.primary} />
          )}

          {!uploadingLogo && (
            <View
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                backgroundColor: colors.primary,
                width: 20,
                height: 20,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: colors.surface,
              }}
            >
              <Ionicons name="camera" size={10} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15, marginBottom: 3 }}>
            {org?.name || 'Organization Emblem'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8, lineHeight: 16 }}>
            Update official emblem for public ledger, group chats, and directory.
          </Text>

          <TouchableOpacity
            onPress={handlePickAndChangeLogo}
            disabled={uploadingLogo}
            style={{
              backgroundColor: colors.primaryMuted,
              borderColor: colors.primary + '40',
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 10,
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="image-outline" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
              {org?.logoUrl ? 'Rebrand / Change Logo' : 'Upload Official Logo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Governance Settings */}
      <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18, marginBottom: 16 }}>
        Governance Rules
      </Text>

      <View style={{
        backgroundColor: colors.surface, borderColor: colors.border,
        borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 20,
      }}>
        <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>
          High-Value Threshold (PHP)
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
          Transactions above this amount require multi-sig approval.
        </Text>
        <TextInput
          style={{
            backgroundColor: colors.background, color: colors.textPrimary,
            borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 20,
          }}
          placeholder="e.g. 10000"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={threshold}
          onChangeText={setThreshold}
        />

        <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>
          Required Approvals
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
          Number of executive approvers needed (1–10).
        </Text>
        <TextInput
          style={{
            backgroundColor: colors.background, color: colors.textPrimary,
            borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12,
          }}
          placeholder="e.g. 2"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={requiredApprovals}
          onChangeText={(v) => {
            const n = parseInt(v);
            if (!v || (n >= 1 && n <= 10)) setRequiredApprovals(v);
          }}
        />
      </View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={{
          backgroundColor: colors.primary, padding: 16,
          borderRadius: 16, alignItems: 'center',
        }}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Save Changes</Text>
            </View>
          )
        }
      </TouchableOpacity>

      {/* ── CUSTOM EMBLEM REBRAND CONFIRMATION MODAL ── */}
      <Modal
        visible={showEmblemSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowEmblemSuccessModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Animated.View
            style={{
              transform: [{ scale: emblemScaleAnim }],
              backgroundColor: isDark ? '#13121d' : '#ffffff',
              borderColor: colors.border,
              borderWidth: 1.5,
              borderRadius: 28,
              padding: 24,
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* Glowing Pulse Ring + Emblem Avatar */}
            <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 18, marginTop: 4 }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.successBg || 'rgba(34, 197, 94, 0.15)',
                  borderWidth: 1.5,
                  borderColor: colors.successBorder || 'rgba(34, 197, 94, 0.3)',
                  transform: [{ scale: emblemPulseAnim }],
                }}
              />
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 26,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: '#10B981',
                  borderWidth: 2.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  shadowColor: '#10B981',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                {uploadedEmblemUrl || org?.logoUrl ? (
                  <Image
                    source={{ uri: uploadedEmblemUrl || org?.logoUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="business" size={36} color="#10B981" />
                )}
              </View>

              {/* Success Green Check Badge */}
              <View
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  backgroundColor: '#10B981',
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: isDark ? '#13121d' : '#ffffff',
                }}
              >
                <Ionicons name="checkmark" size={16} color="#ffffff" />
              </View>
            </View>

            {/* Title & Org Name */}
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 19,
                fontWeight: '900',
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              Emblem Rebranded!
            </Text>

            <View
              style={{
                backgroundColor: colors.primaryMuted,
                borderColor: colors.primary + '30',
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 3,
                borderRadius: 12,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontWeight: '800',
                }}
              >
                {org?.name || 'Organization'}
              </Text>
            </View>

            {/* Customized Message */}
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                textAlign: 'center',
                lineHeight: 18,
                marginBottom: 22,
                paddingHorizontal: 6,
              }}
            >
              Your new organization logo and custom emblem have been published to IPFS and synchronized across the Public Ledger, Group Chats, and Member Dashboards.
            </Text>

            {/* Confirm / Continue Button */}
            <TouchableOpacity
              onPress={async () => {
                await triggerSuccessHaptic();
                setShowEmblemSuccessModal(false);
              }}
              activeOpacity={0.85}
              style={{ width: '100%' }}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>
                  Done & Synchronized
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </ScrollView>
  );
}
