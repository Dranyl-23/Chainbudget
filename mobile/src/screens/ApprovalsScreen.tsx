import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList, Animated, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { ethers } from 'ethers';
import { signApprovalAction } from '../lib/wallet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';
import { SkeletonTransactionList } from '../components/SkeletonLoader';
import ApprovalConfirmModal from '../components/ApprovalConfirmModal';
import SwipeableApprovalCard from '../components/SwipeableApprovalCard';
import ScaleButton from '../components/ScaleButton';
import SuccessCelebrationModal from '../components/SuccessCelebrationModal';
import OrgBottomSheet from '../components/OrgBottomSheet';
import { getCachedApprovals, setCachedApprovals } from '../lib/cache';

export default function ApprovalsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { organizations, activeOrgId, setActiveOrgId } = useOrg();
  const { showToast } = useToast();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const [pendingTx, setPendingTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signingTxId, setSigningTxId] = useState<string | null>(null);

  // Filter & Search State
  const [filterTab, setFilterTab] = useState<'needs_my_sign' | 'awaiting_others' | 'urgent' | 'all'>('needs_my_sign');
  const [searchQuery, setSearchQuery] = useState('');

  // Org Selector Bottom Sheet State
  const [showOrgSheet, setShowOrgSheet] = useState(false);

  // Modal State
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [targetTx, setTargetTx] = useState<any>(null);
  const [targetAction, setTargetAction] = useState<'approved' | 'rejected' | null>(null);

  // Celebration state
  const [celebration, setCelebration] = useState<{ visible: boolean; title: string; subtitle?: string }>({
    visible: false,
    title: '',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;
    if (activeOrgId) {
      // Instant cache snapshot
      getCachedApprovals(activeOrgId).then((cached) => {
        if (isMounted && cached && cached.length > 0) {
          setPendingTx(cached);
          fadeAnim.setValue(1);
        }
      });
      fetchPending(activeOrgId);
    }
    return () => {
      isMounted = false;
    };
  }, [activeOrgId]);

  // Live WebSocket Subscription: Auto-update approvals list on real-time transaction updates
  useEffect(() => {
    if (!activeOrgId) return;

    const unsub = on('transaction_updated', (data: any) => {
      if (!data?.orgId || data.orgId === activeOrgId) {
        fetchPending(activeOrgId);
        triggerLightHaptic();
      }
    });

    return () => unsub();
  }, [activeOrgId, on]);

  const fetchPending = async (orgId: string) => {
    if (pendingTx.length === 0) setLoading(true);
    try {
      const res = await api.get(`/transactions?orgId=${orgId}&status=pending_approval&limit=100`);
      const list =
        res.data.transactions ||
        res.data.data ||
        (Array.isArray(res.data) ? res.data : []);
      setPendingTx(list);
      setCachedApprovals(orgId, list);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error(err);
      showToast('Failed to load approvals. Pull down to refresh.', 'error');
    } finally {
      setLoading(false);
    }
  };


  const onRefresh = () => {
    setRefreshing(true);
    if (activeOrgId) {
      fetchPending(activeOrgId).finally(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  };

  // Check if user is Admin (Level 1 or 2) in the active org
  const activeMembership = user?.memberships?.find((m: any) =>
    (m.organization?._id || m.organization) === activeOrgId
  );
  const roleLevel = activeMembership?.roleLevel || 4;
  const isAdmin = roleLevel <= 2;

  const promptConfirmation = (tx: any, action: 'approved' | 'rejected') => {
    setTargetTx(tx);
    setTargetAction(action);
    setConfirmModalVisible(true);
    triggerLightHaptic();
  };

  const handleExecuteSign = async (comment: string) => {
    if (!targetTx || !targetAction) return;

    const tx = targetTx;
    const action = targetAction;

    try {
      setSigningTxId(tx._id);

      let candidateTo = tx.to || tx.submittedBy?.walletAddress || '';
      if (!candidateTo && typeof tx.submittedBy === 'string' && tx.submittedBy.startsWith('0x')) {
        candidateTo = tx.submittedBy;
      }
      const toAddress = ethers.isAddress(candidateTo) ? ethers.getAddress(candidateTo) : '0x0000000000000000000000000000000000000000';
      const amountWei = (tx.amount || 0).toString();

      const signature = await signApprovalAction(
        tx._id.toString(),
        action,
        amountWei,
        tx.description || '',
        toAddress,
        amountWei
      );

      await api.post(`/approvals/${tx._id}`, {
        action,
        signature,
        organizationId: activeOrgId,
        comment: comment || `${action === 'approved' ? 'Approved' : 'Rejected'} via mobile`,
        to: toAddress,
        amountWei,
      });

      setConfirmModalVisible(false);
      setCelebration({
        visible: true,
        title: action === 'approved' ? 'Approval Signed!' : 'Request Rejected',
        subtitle: `Cryptographic EIP-712 signature anchored for ₱${(tx.amount || 0).toLocaleString()}`,
      });
      if (activeOrgId) fetchPending(activeOrgId);
    } catch (err: any) {
      console.error("Sign / Approve Error:", err);
      showToast(err.response?.data?.error || err.message || "Failed to process approval.", 'error');
    } finally {
      setSigningTxId(null);
    }
  };

  const renderTransactionCard = ({ item: tx }: { item: any }) => {
    const activeOrg = organizations.find((o) => o._id === activeOrgId);
    const requiredApprovals = activeOrg?.requiredApprovals || tx.organization?.requiredApprovals || 2;
    const currentApprovals = tx.approvalCount || tx.approvals?.filter((a: any) => a.action === 'approved').length || 0;
    const pct = Math.min(Math.round((currentApprovals / requiredApprovals) * 100), 100);

    const userId = (user as any)?._id || (user as any)?.id;
    const userVote = tx.approvals?.find(
      (a: any) => (a.approver?._id || a.approver) === userId || a.walletAddress?.toLowerCase() === user?.walletAddress?.toLowerCase()
    );

    return (
      <SwipeableApprovalCard
        onSwipeApprove={() => promptConfirmation(tx, 'approved')}
        onSwipeReject={() => promptConfirmation(tx, 'rejected')}
        disabled={Boolean(userVote) || signingTxId === tx._id}
      >
        <LinearGradient
          colors={isDark ? ['#1a1a24', '#0d0d12'] : ['#ffffff', '#f1f5f9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Top Row: Description & Amount — Tap to view details */}
          <TouchableOpacity
            onPress={() => navigation.navigate('TransactionDetail', { txId: tx._id })}
            activeOpacity={0.7}
            className="flex-row justify-between items-start mb-2"
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Transaction: ${tx.description}, Amount: ${tx.amount} PHP`}
          >
            <View className="flex-1 mr-2">
              <Text style={{ color: colors.textPrimary }} className="font-bold text-lg mb-1">{tx.description}</Text>
              <Text style={{ color: colors.textMuted }} className="text-xs">
                Requested by: {tx.submittedBy?.displayName || 'Unknown'}
              </Text>
            </View>
            <Text style={{ color: colors.primary }} className="font-extrabold text-xl">₱{tx.amount?.toLocaleString()}</Text>
          </TouchableOpacity>

          {/* Badges: Category, Urgency */}
          <View className="flex-row items-center gap-2 mb-3 flex-wrap">
            {tx.category && (
              <View style={{ backgroundColor: colors.cardGlass, borderColor: colors.borderSubtle }} className="px-2.5 py-0.5 rounded-full border">
                <Text style={{ color: colors.textSecondary }} className="text-[10px] font-semibold">{tx.category}</Text>
              </View>
            )}
            {tx.urgency && tx.urgency !== 'low' && (
              <View
                style={{
                  backgroundColor: tx.urgency === 'high' || tx.urgency === 'critical' ? colors.errorBg : colors.warningBg,
                  borderColor: tx.urgency === 'high' || tx.urgency === 'critical' ? colors.errorBorder : colors.warningBorder,
                }}
                className="px-2.5 py-0.5 rounded-full border"
              >
                <Text
                  style={{
                    color: tx.urgency === 'high' || tx.urgency === 'critical' ? colors.error : colors.warning,
                  }}
                  className="text-[10px] font-extrabold uppercase"
                >
                  {tx.urgency}
                </Text>
              </View>
            )}
          </View>

          {/* Approval Threshold Progress Bar */}
          <View style={{ backgroundColor: colors.cardGlass, borderColor: colors.borderSubtle }} className="p-3 rounded-xl border mb-3">
            <View className="flex-row justify-between items-center mb-1.5">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
                <Text style={{ color: colors.textSecondary }} className="text-xs font-semibold">Approval Progress</Text>
              </View>
              <Text style={{ color: colors.primary }} className="text-xs font-bold">
                {currentApprovals} of {requiredApprovals} Signed
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : colors.backgroundSecondary, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? colors.success : colors.primary, borderRadius: 3 }} />
            </View>
          </View>

          {/* Already voted banner or Action Buttons */}
          {userVote ? (
            <View
              style={{
                backgroundColor: userVote.action === 'approved' ? colors.successBg : colors.errorBg,
                borderColor: userVote.action === 'approved' ? colors.successBorder : colors.errorBorder,
              }}
              className="flex-row items-center justify-center p-2.5 rounded-xl border"
            >
              <Ionicons
                name={userVote.action === 'approved' ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={userVote.action === 'approved' ? colors.success : colors.error}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{ color: userVote.action === 'approved' ? colors.success : colors.error }}
                className="font-bold text-xs"
              >
                You already voted ({userVote.action === 'approved' ? 'Approved' : 'Rejected'})
              </Text>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <TouchableOpacity 
                style={{
                  backgroundColor: colors.errorBg,
                  borderColor: colors.errorBorder,
                  flex: 1,
                  borderWidth: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                }}
                activeOpacity={0.7}
                onPress={() => promptConfirmation(tx, 'rejected')}
                disabled={signingTxId === tx._id}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Reject transaction"
              >
                <Ionicons name="close-circle" size={18} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.error }} className="font-bold">Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{
                  backgroundColor: colors.successBg,
                  borderColor: colors.successBorder,
                  flex: 1,
                  borderWidth: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                }}
                activeOpacity={0.7}
                onPress={() => promptConfirmation(tx, 'approved')}
                disabled={signingTxId === tx._id}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Approve transaction"
              >
                {signingTxId === tx._id ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.success }} className="font-bold">Approve</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </SwipeableApprovalCard>
    );
  };

  const currentUserId = user?.id || (user as any)?._id;
  const userWallet = user?.walletAddress?.toLowerCase();

  const isSignedByMe = (tx: any) => {
    return tx.approvals?.some((a: any) => {
      const approverId = a.approver?._id || a.approver?.id || a.approver;
      const approverWallet = a.walletAddress?.toLowerCase();
      return (
        (currentUserId && approverId === currentUserId) ||
        (userWallet && approverWallet === userWallet)
      );
    });
  };

  const isUrgent = (tx: any) => {
    const u = (tx.urgency || '').toLowerCase();
    return u === 'high' || u === 'critical' || u === 'urgent';
  };

  const needsMySignCount = pendingTx.filter((tx) => !isSignedByMe(tx)).length;
  const awaitingOthersCount = pendingTx.filter((tx) => isSignedByMe(tx)).length;
  const urgentCount = pendingTx.filter((tx) => isUrgent(tx)).length;
  const allCount = pendingTx.length;

  const filteredTx = pendingTx.filter((tx) => {
    if (filterTab === 'needs_my_sign' && isSignedByMe(tx)) return false;
    if (filterTab === 'awaiting_others' && !isSignedByMe(tx)) return false;
    if (filterTab === 'urgent' && !isUrgent(tx)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const descMatch = (tx.description || '').toLowerCase().includes(q);
      const requesterMatch = (tx.submittedBy?.displayName || '').toLowerCase().includes(q);
      const catMatch = (tx.category || '').toLowerCase().includes(q);
      const amountMatch = (tx.amount || '').toString().includes(q);
      if (!descMatch && !requesterMatch && !catMatch && !amountMatch) return false;
    }
    return true;
  });

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Header & Org Switcher */}
      <View 
        style={{ 
          paddingTop: (insets.top || 0) + 12,
          backgroundColor: colors.background,
          borderBottomColor: colors.borderSubtle,
        }}
        className="pb-3 px-4 border-b z-10"
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View>
            <Text style={{ color: colors.textPrimary }} className="text-2xl font-bold">
              Inbox & Approvals
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">
              Review and sign multi-sig requests
            </Text>
          </View>
        </View>
        
        {organizations.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setShowOrgSheet(true);
            }}
            activeOpacity={0.75}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Select organization"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: colors.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  borderWidth: 1,
                  borderColor: colors.primary + '25',
                }}
              >
                <Ionicons name="business" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Selected Organization
                </Text>
                <Text
                  style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}
                  numberOfLines={1}
                >
                  {organizations.find((o) => o._id === activeOrgId)?.name || 'Select Organization'}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primaryMuted,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.primary + '25',
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginRight: 4 }}>
                Switch
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {!isAdmin ? (
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.errorBorder }}
          className="p-6 rounded-3xl border items-center justify-center m-4 mt-10 shadow-sm"
        >
          <Ionicons name="lock-closed" size={40} color={colors.error} className="mb-4" />
          <Text style={{ color: colors.error }} className="text-center font-bold text-lg">Access Restricted</Text>
          <Text style={{ color: colors.textSecondary }} className="text-center text-sm mt-2">
            Only DAO Admins and Managers (Role Level 1 & 2) can access the Approvals Inbox.
          </Text>
        </View>
      ) : loading ? (
        <View className="p-4 pt-6">
          <SkeletonTransactionList count={4} />
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={filteredTx}
            keyExtractor={(item) => item._id}
            renderItem={renderTransactionCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              <View className="mb-3">
                {/* Search Bar */}
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                  className="flex-row items-center px-3.5 py-2.5 rounded-2xl border mb-3"
                >
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    placeholder="Search requests, category, amount..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={{ color: colors.textPrimary }}
                    className="flex-1 ml-2.5 text-sm"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Tabs Pills (Horizontal Scroll) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                >
                  {[
                    { key: 'needs_my_sign', label: 'Needs My Sign', icon: 'flash-outline', count: needsMySignCount },
                    { key: 'awaiting_others', label: 'Awaiting Others', icon: 'time-outline', count: awaitingOthersCount },
                    { key: 'urgent', label: 'Urgent', icon: 'alert-circle-outline', count: urgentCount },
                    { key: 'all', label: 'All Pending', icon: 'file-tray-full-outline', count: allCount },
                  ].map((tab) => {
                    const isSelected = filterTab === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        onPress={() => {
                          triggerLightHaptic();
                          setFilterTab(tab.key as any);
                        }}
                        activeOpacity={0.7}
                        style={{
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderWidth: 1,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Ionicons
                          name={tab.icon as any}
                          size={13}
                          color={isSelected ? '#fff' : colors.textSecondary}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={{
                            color: isSelected ? '#fff' : colors.textSecondary,
                            fontWeight: isSelected ? '700' : '600',
                            fontSize: 12,
                          }}
                        >
                          {tab.label}
                        </Text>
                        <View
                          style={{
                            backgroundColor: isSelected
                              ? 'rgba(255,255,255,0.25)'
                              : colors.cardGlass,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                            borderRadius: 999,
                            marginLeft: 5,
                          }}
                        >
                          <Text
                            style={{
                              color: isSelected ? '#fff' : colors.textMuted,
                              fontSize: 10,
                              fontWeight: '800',
                            }}
                          >
                            {tab.count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={
              allCount === 0 ? (
                <View 
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="p-6 rounded-3xl border items-center justify-center mt-6 shadow-sm"
                >
                  <Ionicons name="checkmark-done-circle" size={48} color={colors.success} className="mb-3" />
                  <Text style={{ color: colors.textPrimary }} className="text-center font-bold text-base">Inbox Zero!</Text>
                  <Text style={{ color: colors.textSecondary }} className="text-center text-xs mt-1.5 leading-4">
                    There are no pending budget requests requiring approval in this organization.
                  </Text>
                </View>
              ) : (
                <View 
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="py-10 px-6 rounded-2xl border items-center justify-center mt-2"
                >
                  <Ionicons name="file-tray-outline" size={44} color={colors.textMuted} />
                  <Text style={{ color: colors.textPrimary }} className="mt-3 font-bold text-sm">
                    No requests matching this filter
                  </Text>
                  <Text style={{ color: colors.textSecondary }} className="mt-1 text-xs text-center">
                    {searchQuery ? `No results match "${searchQuery}"` : 'Try selecting "All Pending" to view all requests.'}
                  </Text>
                </View>
              )
            }
          />
        </Animated.View>
      )}

      {/* Confirmation Bottom Sheet */}
      <ApprovalConfirmModal
        visible={confirmModalVisible}
        tx={targetTx}
        action={targetAction}
        onConfirm={handleExecuteSign}
        onClose={() => setConfirmModalVisible(false)}
        isSigning={Boolean(signingTxId)}
      />

      {/* Celebration Overlay Modal */}
      <SuccessCelebrationModal
        visible={celebration.visible}
        title={celebration.title}
        subtitle={celebration.subtitle}
        onDismiss={() => setCelebration({ visible: false, title: '' })}
      />

      {/* Organization Selection Drawer */}
      <OrgBottomSheet
        visible={showOrgSheet}
        onClose={() => setShowOrgSheet(false)}
        organizations={organizations}
        activeOrgId={activeOrgId}
        onSelectOrg={(orgId) => {
          setActiveOrgId(orgId);
          setShowOrgSheet(false);
        }}
      />
    </View>
  );
}


