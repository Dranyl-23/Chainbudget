import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { signApprovalAction } from '../lib/wallet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';
import { SkeletonTransactionList } from '../components/SkeletonLoader';
import ApprovalConfirmModal from '../components/ApprovalConfirmModal';
import SwipeableApprovalCard from '../components/SwipeableApprovalCard';
import ScaleButton from '../components/ScaleButton';
import SuccessCelebrationModal from '../components/SuccessCelebrationModal';
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
    if (activeOrgId) {
      // Instant cache snapshot
      getCachedApprovals(activeOrgId).then((cached) => {
        if (cached && cached.length > 0) {
          setPendingTx(cached);
          fadeAnim.setValue(1);
        }
      });
      fetchPending(activeOrgId);
    }
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
      const res = await api.get(`/transactions?orgId=${orgId}&status=pending_approval`);
      const data = res.data.data || res.data;
      const list = Array.isArray(data) ? data : [];
      setPendingTx(list);
      setCachedApprovals(orgId, list);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error(err);
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

      const toAddress = tx.to || tx.submittedBy?.walletAddress || tx.submittedBy || '';
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
        <TouchableOpacity 
          onPress={() => navigation.navigate('TransactionDetail', { txId: tx._id })}
          activeOpacity={0.85}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Transaction: ${tx.description}, Amount: ${tx.amount} PHP. Swipe right to approve, swipe left to reject.`}
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
            {/* Top Row: Description & Amount */}
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1 mr-2">
                <Text style={{ color: colors.textPrimary }} className="font-bold text-lg mb-1">{tx.description}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  Requested by: {tx.submittedBy?.displayName || 'Unknown'}
                </Text>
              </View>
              <Text style={{ color: colors.primary }} className="font-extrabold text-xl">₱{tx.amount?.toLocaleString()}</Text>
            </View>

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
                  You already voted ({userVote.action})
                </Text>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <ScaleButton 
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
                  onPress={() => promptConfirmation(tx, 'rejected')}
                  disabled={signingTxId === tx._id}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Reject transaction"
                >
                  <Ionicons name="close-circle" size={18} color={colors.error} style={{ marginRight: 6 }} />
                  <Text style={{ color: colors.error }} className="font-bold">Reject</Text>
                </ScaleButton>

                <ScaleButton 
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
                  onPress={() => promptConfirmation(tx, 'approved')}
                  disabled={signingTxId === tx._id}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Approve transaction"
                >
                  {signingTxId === tx._id ? (
                    <ActivityIndicator size="small" color={colors.success} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 6 }} />
                      <Text style={{ color: colors.success }} className="font-bold">Approve</Text>
                    </>
                  )}
                </ScaleButton>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </SwipeableApprovalCard>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Header & Org Switcher */}
      <View 
        style={{ 
          paddingTop: (insets.top || 0) + 16,
          backgroundColor: colors.background,
          borderBottomColor: colors.borderSubtle,
        }}
        className="pb-2 px-4 border-b z-10"
      >
        <Text style={{ color: colors.textPrimary }} className="text-2xl font-bold mb-4">Inbox & Approvals</Text>
        
        {organizations.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {organizations.map(org => {
              const isActive = org._id === activeOrgId;
              return (
                <TouchableOpacity
                  key={org._id}
                  onPress={() => {
                    triggerLightHaptic();
                    setActiveOrgId(org._id);
                  }}
                  style={{
                    backgroundColor: isActive ? colors.primaryMuted : colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  }}
                  className="mr-3 px-4 py-2 rounded-full border flex-row items-center shadow-sm"
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to organization ${org.name}`}
                >
                  {isActive && <Ionicons name="radio-button-on" size={14} color={colors.primary} style={{ marginRight: 6 }} />}
                  <Text style={{ color: isActive ? colors.primary : colors.textSecondary }} className="font-semibold text-xs">
                    {org.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
            data={pendingTx}
            keyExtractor={(item) => item._id}
            renderItem={renderTransactionCard}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              <View 
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="p-6 rounded-3xl border items-center justify-center mt-10 shadow-sm"
              >
                <Ionicons name="checkmark-done-circle" size={50} color={colors.success} className="mb-4" />
                <Text style={{ color: colors.textPrimary }} className="text-center font-bold text-lg">Inbox Zero!</Text>
                <Text style={{ color: colors.textSecondary }} className="text-center text-sm mt-2">
                  There are no pending budget requests requiring your approval in this organization.
                </Text>
              </View>
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
    </View>
  );
}


