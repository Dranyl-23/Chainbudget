/**
 * NoOrganizationScreen.tsx
 *
 * Shown when a user is authenticated (has a wallet + JWT) but has no active
 * organization memberships yet.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { triggerSuccessHaptic, triggerLightHaptic } from '../lib/biometrics';

export default function NoOrganizationScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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
          paddingTop: 80,
          paddingBottom: 48,
          paddingHorizontal: 28,
        }}
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
          className="w-20 h-20 rounded-3xl border items-center justify-center mb-6 shadow-sm"
        >
          <Ionicons name="business-outline" size={40} color={colors.primary} />
        </View>

        {/* Heading */}
        <Text style={{ color: colors.textPrimary }} className="text-2xl font-extrabold text-center mb-2">
          Not in any organization yet
        </Text>
        <Text style={{ color: colors.textSecondary }} className="text-sm text-center leading-6 mb-8">
          You need to be invited by an organization admin before you can access ChainBudget features.
        </Text>

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
              <>
                <Ionicons name="refresh" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary }} className="font-bold text-sm">Check for membership</Text>
              </>
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
    </View>
  );
}
