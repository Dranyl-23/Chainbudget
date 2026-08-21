import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { SkeletonTransactionList } from '../components/SkeletonLoader';
import { triggerSuccessHaptic, triggerErrorHaptic } from '../lib/biometrics';
import { getCachedMembers, setCachedMembers } from '../lib/cache';

const ROLE_OPTIONS = [
  { level: 1, label: 'Executive Approver', desc: 'Full admin access' },
  { level: 2, label: 'Finance Officer', desc: 'Approve transactions' },
  { level: 3, label: 'Member', desc: 'Submit requests' },
  { level: 4, label: 'Viewer', desc: 'Read-only access' },
];

export default function MembersScreen() {
  const route = useRoute<any>();
  const { user } = useAuth();
  const { activeOrgId } = useOrg();
  const { showToast } = useToast();
  const { colors, isDark } = useTheme();
  const orgId = route.params?.orgId || activeOrgId;

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Invite modal state
  const [inviteVisible, setInviteVisible] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [selectedRole, setSelectedRole] = useState(3);
  const [roleLabel, setRoleLabel] = useState('');
  const [inviting, setInviting] = useState(false);

  const lookupTimer = useRef<any>(null);

  // Android BackHandler for modal
  useEffect(() => {
    const onBackPress = () => {
      if (inviteVisible) {
        setInviteVisible(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [inviteVisible]);

  // Get current user's role in this org
  const myMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === orgId
  );
  const myRole = myMembership?.roleLevel || 4;
  const canManage = myRole <= 1 || (user as any)?.isSuperAdmin;

  useEffect(() => {
    if (orgId) {
      // Instant cache snapshot
      getCachedMembers(orgId).then((cached) => {
        if (cached && cached.length > 0) {
          setMembers(cached);
          setLoading(false);
        }
      });
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
      setCachedMembers(orgId, data);
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
    showToast('Member wallet address copied', 'info');
  };

  const handleIdentifierChange = (val: string) => {
    setIdentifier(val);
    setFoundUser(null);
    clearTimeout(lookupTimer.current);
    if (val.length < 3) return;
    lookupTimer.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        let res;
        if (val.includes('@')) {
          res = await api.get(`/users/by-email/${encodeURIComponent(val)}`);
        } else if (val.startsWith('0x') && val.length >= 10) {
          res = await api.get(`/users/by-wallet/${val}`);
        } else return;
        setFoundUser(res.data?.user || res.data || null);
      } catch {
        setFoundUser(null);
      } finally {
        setLookingUp(false);
      }
    }, 600);
  };

  const handleInvite = async () => {
    if (!identifier.trim()) {
      showToast('Enter an email or wallet address.', 'warning');
      return;
    }
    setInviting(true);
    try {
      await api.post(`/users/${orgId}/invite`, {
        identifier: identifier.trim(),
        roleLevel: selectedRole,
        roleLabel: roleLabel.trim() || undefined,
      });
      showToast('Member invited successfully!', 'success');
      setInviteVisible(false);
      setIdentifier(''); setFoundUser(null); setSelectedRole(3); setRoleLabel('');
      fetchMembers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to invite member.', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = (item: any) => {
    const userObj = item.user || item;
    const memberId = userObj._id || item._id;
    const name = userObj.displayName || userObj.email || 'this member';

    if (memberId === (user as any)?._id || memberId === (user as any)?.id) {
      showToast('You cannot remove yourself from the organization.', 'warning');
      return;
    }

    Alert.alert('Remove Member', `Remove ${name} from the organization?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/users/${orgId}/members/${memberId}`);
            showToast(`${name} removed from organization`, 'info');
            fetchMembers();
          } catch (err: any) {
            showToast(err.response?.data?.error || 'Failed to remove member.', 'error');
          }
        },
      },
    ]);
  };

  const getRoleBadge = (roleLevel: number, customLabel?: string) => {
    if (customLabel) return { label: customLabel, bg: colors.primaryMuted, text: colors.primary, border: colors.primary + '40' };
    switch (roleLevel) {
      case 1: return { label: 'Founder (L1)', bg: colors.primaryMuted, text: colors.primary, border: colors.primary + '40' };
      case 2: return { label: 'Manager (L2)', bg: colors.infoBg, text: colors.accentBlue, border: colors.infoBorder };
      case 3: return { label: 'Core (L3)', bg: colors.successBg, text: colors.success, border: colors.successBorder };
      default: return { label: 'Member', bg: colors.cardGlass, text: colors.textMuted, border: colors.borderSubtle };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const userObj = item.user || item;
    const displayName = userObj.displayName || userObj.name || userObj.email?.split('@')[0] || 'DAO Member';
    const wallet = userObj.walletAddress || '';
    const avatarUrl = userObj.avatarUrl;
    const membership = userObj.memberships?.find(
      (m: any) => (m.organization?._id || m.organization?.toString() || m.organization) === orgId
    ) || item.membership || {};
    const roleLevel = membership.roleLevel || item.roleLevel || userObj.roleLevel || 3;
    const rl = membership.roleLabel || item.roleLabel;
    const hasSBT = Boolean(membership.hasSBT || item.hasSBT || userObj.hasSBT);
    const badge = getRoleBadge(roleLevel, rl);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => wallet && copyAddress(wallet)}
        onLongPress={() => canManage && handleRemove(item)}
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="flex-row items-center p-4 rounded-2xl border mb-3 shadow-sm"
      >
        <View style={{
          backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
          borderColor: colors.border,
        }} className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border overflow-hidden">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ color: colors.primary }} className="font-extrabold text-base">
              {displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View className="flex-1 mr-2">
          <View className="flex-row items-center gap-1.5 mb-0.5">
            <Text style={{ color: colors.textPrimary }} className="font-bold text-base" numberOfLines={1}>
              {displayName}
            </Text>
            {hasSBT && (
              <View style={{ backgroundColor: colors.successBg, borderColor: colors.successBorder }}
                className="px-1.5 py-0.5 rounded-full border">
                <Text style={{ color: colors.success }} className="text-[8px] font-extrabold">SBT</Text>
              </View>
            )}
          </View>
          {wallet ? (
            <Text style={{ color: colors.textMuted }} className="text-xs font-mono" numberOfLines={1}>
              {wallet.slice(0, 8)}...{wallet.slice(-6)}
            </Text>
          ) : userObj.email ? (
            <Text style={{ color: colors.textMuted }} className="text-xs" numberOfLines={1}>{userObj.email}</Text>
          ) : (
            <Text style={{ color: colors.textMuted }} className="text-xs">No address linked</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ backgroundColor: badge.bg, borderColor: badge.border }} className="px-3 py-1 rounded-full border">
            <Text style={{ color: badge.text }} className="font-bold text-[11px] uppercase">{badge.label}</Text>
          </View>
          {canManage && (
            <TouchableOpacity onPress={() => handleRemove(item)}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          )}
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
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListHeaderComponent={canManage ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>
              Long-press or tap 🗑 to remove a member.
            </Text>
          ) : null}
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <Ionicons name="people-outline" size={50} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary }} className="font-medium text-center mt-4">
                No members found in this organization.
              </Text>
            </View>
          }
        />
      )}

      {/* Invite FAB */}
      {canManage && (
        <TouchableOpacity
          onPress={() => setInviteVisible(true)}
          style={{
            position: 'absolute', bottom: 24, right: 24,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.primary,
            justifyContent: 'center', alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
          }}
        >
          <Ionicons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Invite Modal */}
      <Modal visible={inviteVisible} animationType="slide" transparent onRequestClose={() => setInviteVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>Invite Member</Text>
              <TouchableOpacity onPress={() => setInviteVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Email or Wallet Address</Text>
            <View style={{ position: 'relative', marginBottom: 8 }}>
              <TextInput
                style={{
                  backgroundColor: colors.background, color: colors.textPrimary,
                  borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, paddingRight: 40,
                }}
                placeholder="user@email.com or 0x..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                value={identifier}
                onChangeText={handleIdentifierChange}
              />
              {lookingUp && <ActivityIndicator size="small" color={colors.primary} style={{ position: 'absolute', right: 12, top: 14 }} />}
            </View>
            {foundUser && (
              <View style={{
                backgroundColor: colors.successBg, borderColor: colors.successBorder, borderWidth: 1,
                borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center',
              }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.success, fontWeight: '600', fontSize: 13 }}>
                  {foundUser.displayName || foundUser.email}
                </Text>
              </View>
            )}

            <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8 }}>Access Level</Text>
            <View style={{ gap: 6, marginBottom: 16 }}>
              {ROLE_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.level}
                  onPress={() => setSelectedRole(r.level)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1,
                    backgroundColor: selectedRole === r.level ? colors.primaryMuted : colors.background,
                    borderColor: selectedRole === r.level ? colors.primary : colors.border,
                  }}
                >
                  <Ionicons
                    name={selectedRole === r.level ? 'radio-button-on' : 'radio-button-off'}
                    size={18} color={selectedRole === r.level ? colors.primary : colors.textMuted}
                    style={{ marginRight: 10 }}
                  />
                  <View>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                      Level {r.level} — {r.label}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{r.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Position Title (optional)</Text>
            <TextInput
              style={{
                backgroundColor: colors.background, color: colors.textPrimary,
                borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 20,
              }}
              placeholder="e.g. Treasurer, Auditor"
              placeholderTextColor={colors.textMuted}
              value={roleLabel}
              onChangeText={setRoleLabel}
            />

            <TouchableOpacity
              onPress={handleInvite}
              disabled={inviting}
              style={{ backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: 'center' }}
            >
              {inviting
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Invite Member</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
