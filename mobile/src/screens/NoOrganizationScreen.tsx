/**
 * NoOrganizationScreen.tsx — FP-9
 * Shown when a user is authenticated (has a wallet + JWT) but has no active
 * organization memberships yet.
 * Includes:
 * 1. Share identifier (email or wallet address)
 * 2. Create new organization modal (FP-9)
 * 3. Check for membership pull-to-refresh
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl, ScrollView, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';
import AnimatedToggleSwitch from '../components/AnimatedToggleSwitch';

const ORG_TYPES = [
  { value: 'student_org', label: 'Student Organization', icon: 'school-outline' },
  { value: 'barangay', label: 'Barangay / Local Gov', icon: 'business-outline' },
  { value: 'homeowners_association', label: 'Homeowners Assoc (HOA)', icon: 'key-outline' },
  { value: 'ngo', label: 'NGO / Non-Profit', icon: 'heart-outline' },
  { value: 'cooperative', label: 'Cooperative', icon: 'people-outline' },
  { value: 'church', label: 'Church / Religious', icon: 'home-outline' },
  { value: 'sports_club', label: 'Sports / Club', icon: 'trophy-outline' },
  { value: 'startup', label: 'Startup / Company', icon: 'rocket-outline' },
  { value: 'family', label: 'Family / Estate', icon: 'people-circle-outline' },
  { value: 'fundraising', label: 'Fundraising / Charity', icon: 'gift-outline' },
];

export default function NoOrganizationScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Org creation modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('student_org');
  const [orgDesc, setOrgDesc] = useState('');
  const [threshold, setThreshold] = useState('10000');
  const [approvals, setApprovals] = useState('2');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  const identifier = user?.email || user?.walletAddress || '';
  const identifierLabel = user?.email ? 'Email' : 'Wallet Address';

  const copyIdentifier = async () => {
    await Clipboard.setStringAsync(identifier);
    await triggerSuccessHaptic();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await triggerLightHaptic();
    try {
      await refreshUser();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshUser]);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      Alert.alert('Required', 'Please enter an organization name.');
      return;
    }

    setCreating(true);
    try {
      await api.post('/organizations', {
        name: orgName.trim(),
        type: orgType,
        description: orgDesc.trim() || undefined,
        highValueThreshold: Number(threshold) || 10000,
        requiredApprovals: Number(approvals) || 2,
        isPrivate,
      });
      await triggerSuccessHaptic();
      Alert.alert('Success', 'Organization created! Redirecting to dashboard...');
      setCreateModalVisible(false);
      await refreshUser();
    } catch (err: any) {
      await triggerErrorHaptic();
      Alert.alert('Error', err.response?.data?.error || 'Failed to create organization.');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
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
          <Ionicons name="business-outline" size={40} color={colors.primary} />
        </View>

        {/* Heading */}
        <Text style={{ color: colors.textPrimary }} className="text-2xl font-extrabold text-center mb-2">
          No Organization Yet
        </Text>
        <Text style={{ color: colors.textSecondary }} className="text-sm text-center leading-6 mb-6">
          Create your own organization or get invited to an existing one.
        </Text>

        {/* Action: Create Organization (FP-9) */}
        <TouchableOpacity
          onPress={() => setCreateModalVisible(true)}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingVertical: 16,
            paddingHorizontal: 24,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 20,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Create an Organization</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.textMuted, marginHorizontal: 12, fontSize: 12, fontWeight: '700' }}>OR JOIN EXISTING</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Step 1 — share identifier */}
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="w-full border rounded-3xl p-5 mb-4 shadow-sm"
        >
          <View className="flex-row items-center gap-3 mb-2.5">
            <View 
              style={{ backgroundColor: colors.primaryMuted }}
              className="w-7 h-7 rounded-full items-center justify-center"
            >
              <Text style={{ color: colors.primary }} className="font-extrabold text-xs">1</Text>
            </View>
            <Text style={{ color: colors.textPrimary }} className="font-bold text-base">Share your {identifierLabel}</Text>
          </View>
          <Text style={{ color: colors.textSecondary }} className="text-xs leading-5 mb-3.5">
            Give this to your organization admin so they can add you:
          </Text>
          <TouchableOpacity 
            onPress={copyIdentifier} 
            activeOpacity={0.7}
            style={{
              backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : colors.backgroundSecondary,
              borderColor: colors.primary + '40',
            }}
            className="flex-row items-center justify-between border rounded-2xl p-3.5"
          >
            <Text style={{ color: colors.primary }} className="flex-1 font-mono text-xs mr-2 font-bold" numberOfLines={1}>
              {identifier}
            </Text>
            <Ionicons
              name={isCopied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={isCopied ? colors.success : colors.primary}
            />
          </TouchableOpacity>
          {isCopied && (
            <Text style={{ color: colors.success }} className="text-xs mt-2 text-center font-bold">Copied to clipboard!</Text>
          )}
        </View>

        {/* Step 2 — wait */}
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="w-full border rounded-3xl p-5 mb-4 shadow-sm"
        >
          <View className="flex-row items-center gap-3 mb-2.5">
            <View 
              style={{ backgroundColor: colors.primaryMuted }}
              className="w-7 h-7 rounded-full items-center justify-center"
            >
              <Text style={{ color: colors.primary }} className="font-extrabold text-xs">2</Text>
            </View>
            <Text style={{ color: colors.textPrimary }} className="font-bold text-base">Wait for your invite</Text>
          </View>
          <Text style={{ color: colors.textSecondary }} className="text-xs leading-5 mb-4">
            Once the admin adds you, pull down to refresh and your organization dashboard will appear automatically.
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: colors.primaryMuted,
              borderColor: colors.primary + '50',
            }}
            className="flex-row items-center justify-center gap-2 border py-3.5 rounded-2xl"
            onPress={handleRefresh}
            disabled={isRefreshing}
            activeOpacity={0.8}
          >
            {isRefreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <View className="flex-row items-center gap-2">
                <Ionicons name="refresh" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary }} className="font-bold text-sm">Check for membership</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Info note */}
        <View 
          style={{ backgroundColor: colors.successBg, borderColor: colors.successBorder }}
          className="flex-row items-start gap-2 border rounded-2xl p-4 mb-8 w-full"
        >
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          <Text style={{ color: colors.success }} className="flex-1 text-xs leading-5 font-medium">
            Your wallet is secured on this device. Your membership will be linked automatically once the admin invites you.
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity onPress={handleLogout} className="flex-row items-center gap-1.5 py-2" activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted }} className="text-sm font-semibold">Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Create Organization Modal (FP-9) */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            maxHeight: '90%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="business" size={24} color={colors.primary} />
                <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>New Organization</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Organization Name */}
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Organization Name *</Text>
              <TextInput
                style={{
                  backgroundColor: colors.background, color: colors.textPrimary,
                  borderColor: colors.border, borderWidth: 1, borderRadius: 12,
                  padding: 14, marginBottom: 16, fontSize: 15,
                }}
                placeholder="e.g. CS Student Council, Green Earth NGO"
                placeholderTextColor={colors.textMuted}
                value={orgName}
                onChangeText={setOrgName}
              />

              {/* Organization Type */}
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8 }}>Organization Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {ORG_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setOrgType(t.value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      backgroundColor: orgType === t.value ? colors.primaryMuted : colors.background,
                      borderColor: orgType === t.value ? colors.primary : colors.border,
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name={t.icon as any}
                      size={14}
                      color={orgType === t.value ? colors.primary : colors.textMuted}
                    />
                    <Text style={{
                      color: orgType === t.value ? colors.primary : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: orgType === t.value ? '700' : '500',
                    }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Description (optional)</Text>
              <TextInput
                style={{
                  backgroundColor: colors.background, color: colors.textPrimary,
                  borderColor: colors.border, borderWidth: 1, borderRadius: 12,
                  padding: 14, marginBottom: 16, height: 70, fontSize: 14,
                }}
                placeholder="Brief description of the organization's mission..."
                placeholderTextColor={colors.textMuted}
                multiline
                value={orgDesc}
                onChangeText={setOrgDesc}
              />

              {/* Threshold & Approvals */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6, fontSize: 12 }}>
                    High-Value Threshold (₱)
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.background, color: colors.textPrimary,
                      borderColor: colors.border, borderWidth: 1, borderRadius: 12,
                      padding: 12, fontSize: 14,
                    }}
                    placeholder="10000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={threshold}
                    onChangeText={setThreshold}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6, fontSize: 12 }}>
                    Required Approvals
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.background, color: colors.textPrimary,
                      borderColor: colors.border, borderWidth: 1, borderRadius: 12,
                      padding: 12, fontSize: 14,
                    }}
                    placeholder="2"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={approvals}
                    onChangeText={setApprovals}
                  />
                </View>
              </View>

              {/* Privacy Toggle */}
              <TouchableOpacity
                onPress={() => setIsPrivate(!isPrivate)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.background,
                  borderColor: isPrivate ? colors.border : '#10B98135',
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 24,
                }}
              >
                <View style={{ flex: 1, marginRight: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={isPrivate ? 'lock-closed' : 'globe-outline'}
                      size={16}
                      color={isPrivate ? '#F59E0B' : '#10B981'}
                    />
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
                      {isPrivate ? 'Private Organization' : 'Public Transparency'}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3, lineHeight: 16 }}>
                    {isPrivate
                      ? 'Transactions and budgets will be hidden from the public explorer.'
                      : 'Transactions will be visible on the public transparency portal.'}
                  </Text>
                </View>
                <AnimatedToggleSwitch
                  value={!isPrivate}
                  onValueChange={(val) => setIsPrivate(!val)}
                  activeColor="#10B981"
                  inactiveColor={isDark ? '#334155' : '#CBD5E1'}
                />
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleCreateOrg}
                disabled={creating}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Create Organization</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
