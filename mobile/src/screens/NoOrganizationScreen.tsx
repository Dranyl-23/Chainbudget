/**
 * NoOrganizationScreen.tsx
 * Shown when a user is authenticated but has no active organization memberships yet.
 * Includes:
 * 1. Active Verification Applications (real-time status tracker & resume button)
 * 2. Multi-step Organization Registration Launcher
 * 3. Share Identifier (email or wallet address) for organization invitations
 * 4. Check for membership pull-to-refresh
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { triggerSuccessHaptic, triggerLightHaptic } from '../lib/biometrics';

interface MyOrgApplication {
  id: string;
  type: string;
  displayName: string;
  status: string;
  currentStep: string;
  applicantMessage?: string;
  updatedAt?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft Incomplete', color: '#818CF8', bg: 'rgba(129, 140, 248, 0.15)' },
  submitted: { label: 'Submitted (Review Queue)', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' },
  under_review: { label: 'Under Super-Admin Review', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.15)' },
  needs_info: { label: 'Action Required (Changes Requested)', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  approved: { label: 'Verified & Approved', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  rejected: { label: 'Application Rejected', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
  revoked: { label: 'Verification Revoked', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

export default function NoOrganizationScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { on: onSocketEvent } = useSocket();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [applications, setApplications] = useState<MyOrgApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  const identifier = user?.email || user?.walletAddress || '';
  const identifierLabel = user?.email ? 'Email' : 'Wallet Address';

  const loadMyApplications = useCallback(async () => {
    try {
      const res = await api.get('/org-applications/mine');
      setApplications(res.data?.applications || []);
    } catch {
      // Non-critical background fetch failure
    } finally {
      setLoadingApps(false);
    }
  }, []);

  useEffect(() => {
    loadMyApplications();
  }, [loadMyApplications]);

  // Listen to live verification status updates
  useEffect(() => {
    const unsub = onSocketEvent('org_verification_updated', async (payload: any) => {
      showToast('Organization verification update received!', 'info');
      await loadMyApplications();
      if (payload?.status === 'approved') {
        await refreshUser();
      }
    });
    return unsub;
  }, [loadMyApplications, onSocketEvent, refreshUser, showToast]);

  const copyIdentifier = async () => {
    await Clipboard.setStringAsync(identifier);
    await triggerSuccessHaptic();
    setIsCopied(true);
    showToast(`${identifierLabel} copied to clipboard!`, 'info');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await triggerLightHaptic();
    try {
      await Promise.all([refreshUser(), loadMyApplications()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshUser, loadMyApplications]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          paddingTop: 60,
          paddingBottom: 48,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Icon */}
        <View
          style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
          className="w-20 h-20 rounded-3xl border items-center justify-center mb-5 shadow-sm"
        >
          <Ionicons name="shield-checkmark-outline" size={40} color={colors.primary} />
        </View>

        {/* Heading */}
        <Text style={{ color: colors.textPrimary }} className="text-2xl font-extrabold text-center mb-2">
          No Organization Yet
        </Text>
        <Text style={{ color: colors.textSecondary }} className="text-sm text-center leading-6 mb-6">
          Register your organization through the legitimacy verification process or get invited by an administrator.
        </Text>

        {/* ── Active Verification Applications Section ── */}
        {applications.length > 0 && (
          <View style={{ width: '100%', marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>
                Your Applications ({applications.length})
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Tap to inspect</Text>
            </View>

            <View style={{ gap: 10 }}>
              {applications.map((app) => {
                const cfg = STATUS_CONFIG[app.status] || {
                  label: app.status,
                  color: colors.primary,
                  bg: colors.primaryMuted,
                };
                return (
                  <TouchableOpacity
                    key={app.id}
                    onPress={() => {
                      triggerLightHaptic();
                      navigation.navigate('CreateOrganization', { applicationId: app.id });
                    }}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: app.status === 'needs_info' ? colors.warning : colors.border,
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 14,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDark ? 0.2 : 0.05,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                        {app.displayName || 'Untitled Draft'}
                      </Text>
                      <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '800' }}>{cfg.label}</Text>
                      </View>
                    </View>

                    {app.applicantMessage ? (
                      <Text style={{ color: colors.warning, fontSize: 11.5, marginBottom: 8 }} numberOfLines={2}>
                        Reviewer note: {app.applicantMessage}
                      </Text>
                    ) : (
                      <Text style={{ color: colors.textSecondary, fontSize: 11.5, marginBottom: 8 }}>
                        Category: {app.type ? app.type.replace('_', ' ') : 'Organization'}
                      </Text>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopColor: colors.border, borderTopWidth: 1 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 10.5 }}>
                        Updated: {app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : 'Recently'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '700' }}>
                          {app.status === 'needs_info' ? 'Update Documents' : 'View Status'}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Action: Create New Organization ── */}
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            navigation.navigate('CreateOrganization');
          }}
          style={{
            width: '100%',
            marginBottom: 20,
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 5,
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 20,
              paddingVertical: 16,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="shield-outline" size={22} color="#FFFFFF" />
            <Text
              style={{
                color: '#FFFFFF',
                fontWeight: '800',
                fontSize: 15,
                textAlign: 'center',
                includeFontPadding: false,
              }}
            >
              Start Verified Org Registration
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text
            style={{
              color: colors.textMuted,
              marginHorizontal: 14,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            OR JOIN EXISTING
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Step 1 — share identifier */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="w-full border rounded-3xl p-5 mb-4 shadow-sm"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 13, includeFontPadding: false }}>1</Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>
              Share your {identifierLabel}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginBottom: 14 }}>
            Give this to your organization admin so they can add you:
          </Text>
          <TouchableOpacity
            onPress={copyIdentifier}
            activeOpacity={0.7}
            style={{
              backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : colors.backgroundSecondary,
              borderColor: colors.primary + '40',
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 13,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: colors.primary,
                flex: 1,
                fontFamily: 'monospace',
                fontSize: 12,
                fontWeight: '700',
                marginRight: 8,
              }}
              numberOfLines={1}
            >
              {identifier}
            </Text>
            <Ionicons
              name={isCopied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={isCopied ? colors.success : colors.primary}
            />
          </TouchableOpacity>
          {isCopied && (
            <Text style={{ color: colors.success, fontSize: 12, marginTop: 8, textAlign: 'center', fontWeight: '700' }}>
              ✓ Copied to clipboard!
            </Text>
          )}
        </View>

        {/* Step 2 — wait */}
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="w-full border rounded-3xl p-5 mb-4 shadow-sm"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 13, includeFontPadding: false }}>2</Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>
              Wait for your invite
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginBottom: 14 }}>
            Once the admin adds you, pull down to refresh and your organization dashboard will appear automatically.
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: colors.primaryMuted,
              borderColor: colors.primary + '50',
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 13,
              paddingHorizontal: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13.5 }}>Check for Membership</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 20 }}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: '700' }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
