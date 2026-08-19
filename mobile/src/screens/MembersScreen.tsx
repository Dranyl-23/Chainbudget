import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { SkeletonTransactionList } from '../components/SkeletonLoader';
import { triggerSuccessHaptic } from '../lib/biometrics';

export default function MembersScreen() {
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const { orgId } = route.params || {};

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchMembers();
    } else {
      setLoading(false);
    }
  }, [orgId]);

  const fetchMembers = async () => {
    try {
      const res = await api.get(`/users/${orgId}/members`);
      const data = Array.isArray(res.data) ? res.data : res.data.members || [];
      setMembers(data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers().then(() => setRefreshing(false));
  };

  const copyAddress = async (addr: string) => {
    if (!addr) return;
    await Clipboard.setStringAsync(addr);
    await triggerSuccessHaptic();
    Alert.alert('Copied!', 'Member wallet address copied to clipboard.');
  };

  const getRoleBadge = (roleLevel: number, customLabel?: string) => {
    if (customLabel) {
      return {
        label: customLabel,
        bg: colors.primaryMuted,
        text: colors.primary,
        border: colors.primary + '40',
      };
    }
    switch (roleLevel) {
      case 1:
        return {
          label: 'Founder (L1)',
          bg: colors.primaryMuted,
          text: colors.primary,
          border: colors.primary + '40',
        };
      case 2:
        return {
          label: 'Manager (L2)',
          bg: colors.infoBg,
          text: colors.accentBlue,
          border: colors.infoBorder,
        };
      case 3:
        return {
          label: 'Core (L3)',
          bg: colors.successBg,
          text: colors.success,
          border: colors.successBorder,
        };
      default:
        return {
          label: 'Member',
          bg: colors.cardGlass,
          text: colors.textMuted,
          border: colors.borderSubtle,
        };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const userObj = item.user || item;
    const displayName = userObj.displayName || userObj.name || userObj.email?.split('@')[0] || 'DAO Member';
    const wallet = userObj.walletAddress || '';
    const avatarUrl = userObj.avatarUrl;

    const membership =
      userObj.memberships?.find(
        (m: any) => (m.organization?._id || m.organization?.toString() || m.organization) === orgId
      ) ||
      item.membership ||
      {};

    const roleLevel = membership.roleLevel || item.roleLevel || userObj.roleLevel || 3;
    const roleLabel = membership.roleLabel || item.roleLabel;
    const hasSBT = Boolean(membership.hasSBT || item.hasSBT || userObj.hasSBT);
    const badge = getRoleBadge(roleLevel, roleLabel);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => wallet && copyAddress(wallet)}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
        className="flex-row items-center p-4 rounded-2xl border mb-3 shadow-sm"
      >
        {/* Avatar */}
        <View 
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border overflow-hidden"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ color: colors.primary }} className="font-extrabold text-base">
              {displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Info */}
        <View className="flex-1 mr-2">
          <View className="flex-row items-center gap-1.5 mb-0.5">
            <Text style={{ color: colors.textPrimary }} className="font-bold text-base" numberOfLines={1}>
              {displayName}
            </Text>
            {hasSBT && (
              <View 
                style={{ backgroundColor: colors.successBg, borderColor: colors.successBorder }}
                className="px-1.5 py-0.5 rounded-full border"
              >
                <Text style={{ color: colors.success }} className="text-[8px] font-extrabold">SBT</Text>
              </View>
            )}
          </View>

          {wallet ? (
            <Text style={{ color: colors.textMuted }} className="text-xs font-mono" numberOfLines={1}>
              {wallet.slice(0, 8)}...{wallet.slice(-6)}
            </Text>
          ) : userObj.email ? (
            <Text style={{ color: colors.textMuted }} className="text-xs" numberOfLines={1}>
              {userObj.email}
            </Text>
          ) : (
            <Text style={{ color: colors.textMuted }} className="text-xs">No address linked</Text>
          )}
        </View>

        {/* Role Badge */}
        <View 
          style={{ backgroundColor: badge.bg, borderColor: badge.border }}
          className="px-3 py-1 rounded-full border"
        >
          <Text style={{ color: badge.text }} className="font-bold text-[11px] uppercase">
            {badge.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {loading ? (
        <View className="p-4 pt-6">
          <SkeletonTransactionList count={6} />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item, index) => item._id || item.user?._id || index.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <Ionicons name="people-outline" size={50} color={colors.textMuted} className="mb-4" />
              <Text style={{ color: colors.textSecondary }} className="font-medium text-center">
                No members found in this organization.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
