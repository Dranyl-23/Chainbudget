/**
 * OrgChatInfoScreen.tsx
 *
 * Messenger-style "Chat Info" details screen for Organization Group Chat.
 * Features large avatar with direct photo uploader, quick action buttons,
 * expandable accordions for Chat Info, Members, Pinned Announcements, and Governance.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Linking,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';

const BACKEND_BASE = 'https://chainbudget-api.fly.dev';

function formatAvatarUrl(uri?: string) {
  if (!uri || typeof uri !== 'string') return undefined;
  if (uri.startsWith('data:image/') || uri.startsWith('blob:')) {
    return uri;
  }
  if (uri.startsWith('/uploads')) {
    return `${BACKEND_BASE}${uri}`;
  }
  if (uri.includes('localhost:5001') || uri.includes('127.0.0.1:5001')) {
    return uri.replace(/http:\/\/(localhost|127\.0\.0\.1):5001/, BACKEND_BASE);
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }
  return undefined;
}

export default function OrgChatInfoScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { organizations, refreshOrgs } = useOrg();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();

  const orgId = route.params?.orgId;
  const currentOrg = organizations.find((o) => o._id === orgId) || organizations[0];

  const currentMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === orgId
  );
  const userRoleLevel = currentMembership?.roleLevel || 4;

  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | undefined>(currentOrg?.logo);

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

  // Accordion toggle states (Messenger style)
  const [openSection, setOpenSection] = useState<{ [key: string]: boolean }>({
    chatInfo: true,
    members: false,
    pinned: false,
    privacy: false,
  });

  const toggleSection = (key: string) => {
    triggerLightHaptic();
    setOpenSection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchDetails = useCallback(async () => {
    if (!orgId) return;
    try {
      const [orgRes, membersRes, pinRes] = await Promise.all([
        api.get(`/organizations/${orgId}`),
        api.get(`/users/${orgId}/members`),
        api.get(`/chat/${orgId}/pinned`),
      ]);

      setOrgDetails(orgRes.data);
      if (orgRes.data?.logoUrl) {
        setOrgLogoUrl(orgRes.data.logoUrl);
      }

      const formattedMembers = (membersRes.data || []).map((u: any) => {
        const m = u.memberships?.find(
          (mem: any) => (mem.organization?._id || mem.organization) === orgId
        );
        return {
          _id: u._id,
          displayName: u.displayName || u.email?.split('@')[0] || 'Member',
          avatarUrl: u.avatarUrl,
          email: u.email,
          walletAddress: u.walletAddress,
          roleLevel: m?.roleLevel || 4,
          roleLabel:
            m?.roleLabel ||
            (m?.roleLevel === 1 ? 'President' : m?.roleLevel === 2 ? 'Auditor' : m?.roleLevel === 3 ? 'Treasurer' : 'Member'),
        };
      });

      setMembers(formattedMembers);
      setPinnedMessages(pinRes.data?.pinned || []);
    } catch (err) {
      console.warn('[OrgChatInfo] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Live WebSocket update for organization profile
  useEffect(() => {
    const unsub = on('org_updated', (data: { orgId: string; logoUrl?: string; name?: string }) => {
      if (data.orgId === orgId) {
        if (data.logoUrl) setOrgLogoUrl(data.logoUrl);
        if (data.name) setOrgDetails((prev: any) => ({ ...prev, name: data.name }));
      }
    });

    return () => {
      unsub();
    };
  }, [orgId, on]);

  // Upload organization profile photo
  const handleChangeOrgPhoto = async () => {
    if (userRoleLevel > 2) {
      Alert.alert(
        'Permission Notice',
        'Only Organization Officers (Level 1 President & Level 2 Admins) can change the organization picture.'
      );
      return;
    }

    Alert.alert(
      'Organization Picture',
      'Choose an option to update this organization\'s profile picture',
      [
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Gallery access is needed to pick a picture.');
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
    setIsUploadingLogo(true);
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
        setOrgLogoUrl(uploadedUrl);
        await refreshOrgs();
        await triggerSuccessHaptic();
        triggerEmblemSuccessModal(uploadedUrl);
      }
    } catch (err: any) {
      console.warn('[uploadPhoto error]', err?.response?.data || err.message);
      Alert.alert('Error', err?.response?.data?.error || 'Failed to upload photo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    await triggerSuccessHaptic();
    Alert.alert('Copied!', `${label} copied to clipboard.`);
  };

  const getRoleBadge = (level: number, label?: string) => {
    switch (level) {
      case 1:
        return { label: label || 'President', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' };
      case 2:
        return { label: label || 'Auditor', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' };
      case 3:
        return { label: label || 'Treasurer', bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' };
      default:
        return { label: label || 'Member', bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7' };
    }
  };

  const resolvedLogo = formatAvatarUrl(orgLogoUrl || orgDetails?.logoUrl || currentOrg?.logo);
  const orgName = orgDetails?.name || currentOrg?.name || 'Organization';

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── TOP HEADER BAR ── */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 6, marginLeft: -6 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>
          Chat info
        </Text>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── PROFILE HEADER (Messenger Style) ── */}
        <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20 }}>
          <TouchableOpacity
            onPress={handleChangeOrgPhoto}
            activeOpacity={0.85}
            style={{ position: 'relative', marginBottom: 14 }}
          >
            <View
              style={{
                width: 86,
                height: 86,
                borderRadius: 43,
                borderWidth: 3,
                borderColor: colors.primary,
                overflow: 'hidden',
                backgroundColor: colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {isUploadingLogo ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : resolvedLogo ? (
                <Image source={{ uri: resolvedLogo }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800' }}>
                  {orgName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>

            {/* Camera badge to change image */}
            {userRoleLevel <= 2 && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: isDark ? '#0F172A' : '#FFFFFF',
                }}
              >
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 20, marginBottom: 4, textAlign: 'center' }}>
            {orgName}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
            {members.length > 0 ? `${members.length} members` : 'Organization Group'} • Active
          </Text>

          {/* ── QUICK ACTION BUTTONS ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 20 }}>
            {/* Search */}
            <TouchableOpacity
              onPress={() => navigation.navigate('OrgChat', { orgId, initialSearch: true })}
              style={{ alignItems: 'center', gap: 6 }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="search" size={20} color={colors.textPrimary} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>Search</Text>
            </TouchableOpacity>

            {/* Change Picture */}
            {userRoleLevel <= 2 && (
              <TouchableOpacity
                onPress={handleChangeOrgPhoto}
                style={{ alignItems: 'center', gap: 6 }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="image-outline" size={20} color={colors.primary} />
                </View>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Change Pic</Text>
              </TouchableOpacity>
            )}

            {/* Members Screen */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Members', { orgId })}
              style={{ alignItems: 'center', gap: 6 }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="people" size={20} color={colors.textPrimary} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600' }}>Members</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ACCORDION SECTION 1: CHAT INFO ── */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            onPress={() => toggleSection('chatInfo')}
            style={[styles.sectionHeader, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Chat info</Text>
            </View>
            <Ionicons
              name={openSection.chatInfo ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {openSection.chatInfo && (
            <View style={[styles.sectionBody, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC' }]}>
              {orgDetails?.description ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Description</Text>
                  <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{orgDetails.description}</Text>
                </View>
              ) : null}

              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Organization Wallet Address</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(orgDetails?.treasuryWallet || orgDetails?.walletAddress || '0x...', 'Wallet Address')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                    {orgDetails?.treasuryWallet || orgDetails?.walletAddress || 'Not set'}
                  </Text>
                  <Ionicons name="copy-outline" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>High-Value Threshold</Text>
                  <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
                    ₱{Number(orgDetails?.highValueThreshold || 5000).toLocaleString()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Approvals Required</Text>
                  <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
                    {orgDetails?.requiredApprovals || 2} Signatures
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── ACCORDION SECTION 2: CHAT MEMBERS ── */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            onPress={() => toggleSection('members')}
            style={[styles.sectionHeader, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Chat members ({members.length})
              </Text>
            </View>
            <Ionicons
              name={openSection.members ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {openSection.members && (
            <View style={[styles.sectionBody, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC' }]}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : members.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>No members found</Text>
              ) : (
                members.slice(0, 10).map((m: any, idx: number) => {
                  const badge = getRoleBadge(m.roleLevel, m.roleLabel);
                  const mName = m.displayName || 'Member';
                  const mAvatar = formatAvatarUrl(m.avatarUrl);
                  return (
                    <View
                      key={m._id || idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                        borderBottomWidth: idx < members.length - 1 ? 1 : 0,
                        borderBottomColor: colors.borderSubtle,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: colors.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {mAvatar ? (
                            <Image source={{ uri: mAvatar }} style={{ width: 32, height: 32 }} />
                          ) : (
                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                              {mName.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                          {mName}
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: badge.bg,
                          paddingHorizontal: 8,
                          paddingVertical: 2.5,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: badge.text, fontSize: 10, fontWeight: '700' }}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* ── ACCORDION SECTION 3: PINNED ANNOUNCEMENTS ── */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            onPress={() => toggleSection('pinned')}
            style={[styles.sectionHeader, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="pin-outline" size={20} color="#EAB308" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Pinned announcements ({pinnedMessages.length})
              </Text>
            </View>
            <Ionicons
              name={openSection.pinned ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {openSection.pinned && (
            <View style={[styles.sectionBody, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC' }]}>
              {pinnedMessages.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  No pinned announcements yet
                </Text>
              ) : (
                pinnedMessages.map((pin: any) => (
                  <View
                    key={pin._id}
                    style={{
                      padding: 10,
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      borderColor: 'rgba(234, 179, 8, 0.25)',
                      borderWidth: 1,
                      borderRadius: 12,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 18 }}>
                      {pin.content}
                    </Text>
                    <Text style={{ color: '#EAB308', fontSize: 10, fontWeight: '600', marginTop: 4 }}>
                      Pinned by {pin.sender?.displayName || 'Officer'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* ── ACCORDION SECTION 4: PRIVACY & SUPPORT ── */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            onPress={() => toggleSection('privacy')}
            style={[styles.sectionHeader, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Privacy & governance</Text>
            </View>
            <Ionicons
              name={openSection.privacy ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {openSection.privacy && (
            <View style={[styles.sectionBody, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC' }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>
                This organization operates on a decentralized multi-signature governance protocol. All fund disbursements and approvals are immutably logged on-chain.
              </Text>

              <TouchableOpacity
                onPress={() => navigation.navigate('HelpFaq')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
              >
                <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                  Help & Governance FAQs
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

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
                {uploadedEmblemUrl || orgLogoUrl ? (
                  <Image
                    source={{ uri: uploadedEmblemUrl || orgLogoUrl }}
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
                {orgDetails?.name || currentOrg?.name || 'Organization'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '600',
  },
});
