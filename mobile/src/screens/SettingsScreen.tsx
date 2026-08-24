/**
 * SettingsScreen.tsx
 *
 * Dedicated App Settings & Security Hub for ChainBudget Mobile.
 * Includes:
 * - App Lock, 6-digit PIN configuration, and Biometrics management
 * - Privacy Mode & Balance Masking
 * - Web3 Security & Hardware Keychain access
 * - Appearance & Theme selection
 * - Network status & Push Notification settings
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  AppState,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useTheme } from '../context/ThemeContext';
import { useAppLock, LockTimeoutOption } from '../context/AppLockContext';
import { triggerLightHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '../lib/biometrics';
import SetPinModal from '../components/SetPinModal';
import ThemeSelectorModal from '../components/ThemeSelectorModal';
import AnimatedToggleSwitch from '../components/AnimatedToggleSwitch';
import appConfig from '../../app.json';

const APP_VERSION = appConfig.expo.version;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, logout, refreshUser } = useAuth();
  const { activeOrg, activeOrgId, refreshOrgs } = useOrg();
  const { colors, isDark, themeMode } = useTheme();
  const {
    isAppLockEnabled,
    isBiometricEnabled,
    hasPinSet,
    lockTimeout,
    maskBalance,
    setAppLockEnabled,
    setBiometricEnabled,
    setLockTimeoutOption,
    setMaskBalanceOption,
    removePin,
    lockNow,
  } = useAppLock();

  const [showPinModal, setShowPinModal] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [uploadingOrgLogo, setUploadingOrgLogo] = useState(false);

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

  const myMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === activeOrgId
  );
  const isOrgAdmin = (myMembership?.roleLevel ?? 4) <= 2 || user?.isSuperAdmin;

  // Camera permissions hook
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Permission states
  const [notifStatus, setNotifStatus] = useState<string>('undetermined');
  const [photosStatus, setPhotosStatus] = useState<string>('undetermined');
  const [biometricsStatus, setBiometricsStatus] = useState<boolean>(false);

  const checkAllPermissions = async () => {
    try {
      const notif = await Notifications.getPermissionsAsync().catch(() => null);
      if (notif) setNotifStatus(notif.status);

      const photos = await ImagePicker.getMediaLibraryPermissionsAsync().catch(() => null);
      if (photos) setPhotosStatus(photos.status);

      const hasBio = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const isEnrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      setBiometricsStatus(hasBio && isEnrolled);
    } catch (e) {
      console.warn('[Permissions check error]', e);
    }
  };

  useEffect(() => {
    checkAllPermissions();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkAllPermissions();
      }
    });
    return () => sub.remove();
  }, []);

  const handleRequestCamera = async () => {
    await triggerLightHaptic();
    const res = await requestCameraPermission();
    if (!res.granted) {
      Alert.alert(
        'Camera Permission',
        'Camera access is required to scan QR codes for payments and DAO invites. Would you like to enable it in device settings?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      await triggerSuccessHaptic();
    }
  };

  const handleRequestNotifications = async () => {
    await triggerLightHaptic();
    const res = await Notifications.requestPermissionsAsync();
    setNotifStatus(res.status);
    if (!res.granted) {
      Alert.alert(
        'Push Notifications',
        'Notifications keep you informed about fund approvals, DAO votes, and group messages. Enable them in device settings?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      await triggerSuccessHaptic();
    }
  };

  const handleRequestPhotos = async () => {
    await triggerLightHaptic();
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setPhotosStatus(res.status);
    if (!res.granted) {
      Alert.alert(
        'Photo Library Permission',
        'Photo access is used to upload receipts, liquidation proofs, and avatars. Enable it in device settings?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      await triggerSuccessHaptic();
    }
  };

  const handleToggleAppLock = async (value: boolean) => {
    await triggerLightHaptic();
    if (value) {
      if (!hasPinSet) {
        setIsChangingPin(false);
        setShowPinModal(true);
      } else {
        await setAppLockEnabled(true);
      }
    } else {
      Alert.alert(
        'Disable App Lock',
        'Are you sure you want to turn off App Lock? Your account will no longer ask for PIN or biometrics when opening the app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn Off',
            style: 'destructive',
            onPress: async () => {
              await setAppLockEnabled(false);
            },
          },
        ]
      );
    }
  };

  const handleOpenSetPin = () => {
    triggerLightHaptic();
    setIsChangingPin(hasPinSet);
    setShowPinModal(true);
  };

  const handleRemovePin = () => {
    triggerLightHaptic();
    Alert.alert(
      'Remove PIN',
      'This will remove your 6-digit PIN and disable App Lock.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removePin();
          },
        },
      ]
    );
  };

  const handleRebrandOrgLogo = async () => {
    if (!activeOrgId) {
      Alert.alert('No Active Organization', 'Please select or switch to an organization first.');
      return;
    }
    await triggerLightHaptic();
    Alert.alert(
      `Rebrand ${activeOrg?.name || 'Organization'} Emblem`,
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
              await uploadOrgLogo(result.assets[0].uri);
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
              await uploadOrgLogo(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadOrgLogo = async (uri: string) => {
    if (!activeOrgId) return;
    setUploadingOrgLogo(true);
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
        await api.patch(`/organizations/${activeOrgId}`, { logoUrl: uploadedUrl });
        await triggerSuccessHaptic();
        if (refreshOrgs) await refreshOrgs();
        if (refreshUser) await refreshUser();
        triggerEmblemSuccessModal(uploadedUrl);
      }
    } catch (err: any) {
      console.warn('[uploadOrgLogo error]', err?.response?.data || err.message);
      await triggerErrorHaptic();
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update organization emblem.');
    } finally {
      setUploadingOrgLogo(false);
    }
  };

  const formatTimeoutLabel = (timeout: LockTimeoutOption) => {
    switch (timeout) {
      case 'immediately':
        return 'Immediately upon exit';
      case '1m':
        return 'After 1 minute';
      case '5m':
        return 'After 5 minutes';
      case '15m':
        return 'After 15 minutes';
      default:
        return 'Immediately';
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: 16,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── SECTION: ACTIVE ORGANIZATION EMBLEM & BRANDING ── */}
      {activeOrg && isOrgAdmin && (
        <View style={{ marginBottom: 24 }}>
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
            Organization Branding & Emblem
          </Text>

          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 20,
              padding: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.3 : 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <TouchableOpacity
                onPress={handleRebrandOrgLogo}
                disabled={uploadingOrgLogo}
                activeOpacity={0.8}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  borderColor: colors.primary,
                  borderWidth: 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {uploadingOrgLogo ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : activeOrg.logoUrl ? (
                  <Image
                    source={{ uri: activeOrg.logoUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="business" size={26} color={colors.primary} />
                )}

                {!uploadingOrgLogo && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      backgroundColor: colors.primary,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: colors.surface,
                    }}
                  >
                    <Ionicons name="camera" size={9} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 2 }} numberOfLines={1}>
                  {activeOrg.name}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginBottom: 8 }}>
                  Change emblem or rebrand logo anytime.
                </Text>

                <TouchableOpacity
                  onPress={handleRebrandOrgLogo}
                  disabled={uploadingOrgLogo}
                  style={{
                    backgroundColor: colors.primaryMuted,
                    borderColor: colors.primary + '40',
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 10,
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Ionicons name="image-outline" size={13} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '700' }}>
                    {activeOrg.logoUrl ? 'Change Emblem' : 'Upload Logo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── SECTION 1: APP LOCK & BIOMETRICS ── */}
      <View style={{ marginBottom: 24 }}>
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
          App Security & PIN
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* App Lock Switch */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="lock-closed" size={20} color="#818cf8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  App Lock
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Require PIN or Biometrics on app launch
                </Text>
              </View>
            </View>
            <AnimatedToggleSwitch
              value={isAppLockEnabled && hasPinSet}
              onValueChange={handleToggleAppLock}
              activeColor="#6366f1"
              inactiveColor={colors.border}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 6-Digit PIN Action */}
          <TouchableOpacity
            onPress={handleOpenSetPin}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(249, 115, 22, 0.15)',
                  borderColor: 'rgba(249, 115, 22, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="key" size={20} color="#f97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  {hasPinSet ? 'Change 6-Digit PIN' : 'Set 6-Digit App PIN'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {hasPinSet ? 'Encrypted in hardware storage' : 'Configure secret Master PIN'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {hasPinSet && (
                <View
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800' }}>Active</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Biometrics Fast-Unlock Switch */}
          {hasPinSet && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    backgroundColor: 'rgba(34, 211, 238, 0.15)',
                    borderColor: 'rgba(34, 211, 238, 0.3)',
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="finger-print" size={20} color="#22d3ee" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                    Biometric Fast-Unlock
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Face ID / Fingerprint recognition
                  </Text>
                </View>
              </View>
              <AnimatedToggleSwitch
                value={isBiometricEnabled}
                onValueChange={async (val) => {
                  await setBiometricEnabled(val);
                }}
                activeColor="#22d3ee"
                inactiveColor={colors.border}
                thumbColor="#FFFFFF"
              />
            </View>
          )}

          {/* Auto-Lock Timeout Selector */}
          {hasPinSet && isAppLockEnabled && (
            <TouchableOpacity
              onPress={() => setShowTimeoutModal(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    borderColor: 'rgba(168, 85, 247, 0.3)',
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="time" size={20} color="#a855f7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                    Auto-Lock Timeout
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {formatTimeoutLabel(lockTimeout)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Test Lock App Now */}
          {hasPinSet && isAppLockEnabled && (
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                lockNow();
              }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="shield-outline" size={20} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                    Lock App Now
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Immediately test your lock screen
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── SECTION 2: PRIVACY & HARDWARE VAULT ── */}
      <View style={{ marginBottom: 24 }}>
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
          Privacy & Vault
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* Mask Balance Toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={maskBalance ? 'eye-off' : 'eye'} size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Mask Balances by Default
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Hide balance numbers on dashboard (Privacy Mode)
                </Text>
              </View>
            </View>
            <AnimatedToggleSwitch
              value={maskBalance}
              onValueChange={async (val) => {
                await setMaskBalanceOption(val);
              }}
              activeColor="#10b981"
              inactiveColor={colors.border}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Web3 Security & Keys */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('SecurityKeys');
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="hardware-chip" size={20} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Web3 Security & Keys
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Seed phrase backup & private key export
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Data Privacy & Terms */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('DataPrivacy');
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(148, 163, 184, 0.15)',
                  borderColor: 'rgba(148, 163, 184, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="document-text" size={20} color="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Data Privacy & Transparency
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Zero tracking policy & on-chain auditability
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SECTION 2.5: APP PERMISSIONS & ACCESS ── */}
      <View style={{ marginBottom: 24 }}>
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
          App Permissions & Device Access
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* Camera Access */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera" size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Camera Access
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Scan QR codes for payments & invites
                </Text>
              </View>
            </View>
            <AnimatedToggleSwitch
              value={cameraPermission?.granted ?? false}
              onValueChange={async (enable) => {
                if (enable) {
                  await handleRequestCamera();
                } else {
                  Alert.alert(
                    'Camera Permission',
                    'To disable camera access, please toggle it off in your device System Settings.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    ]
                  );
                }
              }}
              activeColor="#3b82f6"
              inactiveColor={colors.border}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Push Notifications */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  borderColor: 'rgba(236, 72, 153, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="notifications" size={20} color="#ec4899" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Push Notifications
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Live approval alerts & DAO updates
                </Text>
              </View>
            </View>
            <AnimatedToggleSwitch
              value={notifStatus === 'granted'}
              onValueChange={async (enable) => {
                if (enable) {
                  await handleRequestNotifications();
                } else {
                  Alert.alert(
                    'Push Notifications',
                    'To turn off push notifications, please toggle them off in your device System Settings.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    ]
                  );
                }
              }}
              activeColor="#ec4899"
              inactiveColor={colors.border}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Photo Library & Media */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  borderColor: 'rgba(139, 92, 246, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="images" size={20} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Photos & Media
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Upload receipt proofs & avatars
                </Text>
              </View>
            </View>
            <AnimatedToggleSwitch
              value={photosStatus === 'granted'}
              onValueChange={async (enable) => {
                if (enable) {
                  await handleRequestPhotos();
                } else {
                  Alert.alert(
                    'Photo Library Permission',
                    'To revoke photo access, please change permissions in your device System Settings.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    ]
                  );
                }
              }}
              activeColor="#8b5cf6"
              inactiveColor={colors.border}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Biometrics Sensor Hardware */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(20, 184, 166, 0.15)',
                  borderColor: 'rgba(20, 184, 166, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="finger-print" size={20} color="#14b8a6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Biometrics Hardware
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Fingerprint / Face ID sensor status
                </Text>
              </View>
            </View>
            <View
              style={{
                backgroundColor: biometricsStatus ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                borderColor: biometricsStatus ? 'rgba(16, 185, 129, 0.35)' : 'rgba(148, 163, 184, 0.35)',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: biometricsStatus ? '#10B981' : '#94A3B8',
                  fontSize: 11,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                }}
              >
                {biometricsStatus ? 'Ready' : 'Not Enrolled'}
              </Text>
            </View>
          </View>

          {/* Open System App Settings */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              Linking.openSettings();
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="settings-sharp" size={20} color="#818cf8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Device System Settings
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Manage system permissions in OS settings
                </Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SECTION 3: SYSTEM PREFERENCES ── */}
      <View style={{ marginBottom: 24 }}>
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
          Preferences & System
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* Appearance / Theme */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setShowThemeModal(true);
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  borderColor: 'rgba(236, 72, 153, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="color-palette" size={20} color="#ec4899" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Appearance & Theme
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {themeMode === 'system'
                    ? `System Default (${isDark ? 'Dark' : 'Light'})`
                    : themeMode === 'dark'
                    ? 'Dark Mode'
                    : 'Light Mode'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Network Status */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('NetworkStatus');
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(14, 165, 233, 0.15)',
                  borderColor: 'rgba(14, 165, 233, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="globe" size={20} color="#0ea5e9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Network & Blockchain Status
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Polygon Amoy Testnet (Chain ID 80002)
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SECTION 4: ABOUT & APP INFO ── */}
      <View style={{ marginBottom: 24 }}>
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
          Support & About
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* Help & FAQ */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('HelpFaq');
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="help-circle" size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Help & FAQ
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Guides on DAO governance and multi-sig
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Feedback */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('Feedback');
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chatbubbles" size={20} color="#10b981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  Send Feedback & Suggestions
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Help us improve ChainBudget Mobile
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* About */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.navigate('About');
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  borderColor: 'rgba(139, 92, 246, 0.3)',
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="information-circle" size={20} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14.5, fontWeight: '700', marginBottom: 2 }}>
                  About ChainBudget
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  v{APP_VERSION} • Non-Custodial Vault
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <SetPinModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        isChangingExisting={isChangingPin}
      />

      <ThemeSelectorModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />

      {/* Auto-Lock Timeout Picker Modal */}
      {showTimeoutModal && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          activeOpacity={1}
          onPress={() => setShowTimeoutModal(false)}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 24,
              padding: 20,
              width: '100%',
              maxWidth: 340,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 16 }}>
              Auto-Lock Timer
            </Text>
            {(['immediately', '1m', '5m', '15m'] as LockTimeoutOption[]).map((option) => {
              const selected = lockTimeout === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={async () => {
                    await setLockTimeoutOption(option);
                    setShowTimeoutModal(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    backgroundColor: selected
                      ? colors.primaryMuted
                      : 'transparent',
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.textPrimary,
                      fontWeight: selected ? '800' : '500',
                      fontSize: 14,
                    }}
                  >
                    {formatTimeoutLabel(option)}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      )}

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
                {uploadedEmblemUrl || activeOrg?.logoUrl ? (
                  <Image
                    source={{ uri: uploadedEmblemUrl || activeOrg?.logoUrl }}
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
                {activeOrg?.name || 'Organization'}
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
