import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { signApprovalAction } from '../lib/wallet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';
import { SkeletonTransactionList } from '../components/SkeletonLoader';

export default function ApprovalsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signingTxId, setSigningTxId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (activeOrgId) {
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

  const fetchOrgs = async () => {
    try {
      const orgRes = await api.get('/organizations');
      setOrganizations(orgRes.data || []);
      if (orgRes.data?.length > 0 && !activeOrgId) {
        setActiveOrgId(orgRes.data[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPending = async (orgId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/transactions?orgId=${orgId}&status=pending_approval`);
      const data = res.data.data || res.data;
      setPendingTx(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrgs().then(() => {
      if (activeOrgId) fetchPending(activeOrgId);
      setRefreshing(false);
    });
  };

  // Check if user is Admin (Level 1 or 2) in the active org
  const activeMembership = user?.memberships?.find((m: any) => 
    (m.organization?._id || m.organization) === activeOrgId
  );
  const roleLevel = activeMembership?.roleLevel || 4;
  const isAdmin = roleLevel <= 2;

  const handleSign = async (tx: any, action: 'approved' | 'rejected') => {
    try {
      await triggerLightHaptic();
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

      await api.post(`/transactions/${tx._id}/approve`, {
        action,
        signature,
        to: toAddress,
        amountWei,
      });

      await triggerSuccessHaptic();
      Alert.alert(
        "Success", 
        `Transaction has been ${action} successfully.`
      );
      if (activeOrgId) fetchPending(activeOrgId);
    } catch (err: any) {
      await triggerErrorHaptic();
      console.error("Sign / Approve Error:", err);
      Alert.alert("Action Failed", err.response?.data?.error || err.message || "Failed to process approval.");
    } finally {
      setSigningTxId(null);
    }
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

      <ScrollView 
        className="flex-1 p-4"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {!isAdmin ? (
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.errorBorder }}
            className="p-6 rounded-3xl border items-center justify-center mt-10 shadow-sm"
          >
            <Ionicons name="lock-closed" size={40} color={colors.error} className="mb-4" />
            <Text style={{ color: colors.error }} className="text-center font-bold text-lg">Access Restricted</Text>
            <Text style={{ color: colors.textSecondary }} className="text-center text-sm mt-2">
              Only DAO Admins and Managers (Role Level 1 & 2) can access the Approvals Inbox.
            </Text>
          </View>
        ) : (
          <>
            {loading ? (
              <View className="py-2">
                <SkeletonTransactionList count={4} />
              </View>
            ) : pendingTx.length > 0 ? (
              pendingTx.map((tx: any) => (
                <TouchableOpacity 
                  key={tx._id}
                  onPress={() => navigation.navigate('TransactionDetail', { txId: tx._id })}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isDark ? ['#1a1a24', '#0d0d12'] : ['#ffffff', '#f1f5f9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text style={{ color: colors.textPrimary }} className="font-bold text-lg mb-1">{tx.description}</Text>
                        <Text style={{ color: colors.textMuted }} className="text-xs">
                          Requested by: {tx.submittedBy?.displayName || 'Unknown'}
                        </Text>
                      </View>
                      <Text style={{ color: colors.primary }} className="font-extrabold text-xl">₱{tx.amount?.toLocaleString()}</Text>
                    </View>

                    {/* Actions */}
                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity 
                        style={{
                          backgroundColor: colors.errorBg,
                          borderColor: colors.errorBorder,
                        }}
                        className="flex-1 border py-3 rounded-xl items-center flex-row justify-center"
                        onPress={() => handleSign(tx, 'rejected')}
                        disabled={signingTxId === tx._id}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.error} style={{ marginRight: 6 }} />
                        <Text style={{ color: colors.error }} className="font-bold">Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{
                          backgroundColor: colors.successBg,
                          borderColor: colors.successBorder,
                        }}
                        className="flex-1 border py-3 rounded-xl items-center flex-row justify-center"
                        onPress={() => handleSign(tx, 'approved')}
                        disabled={signingTxId === tx._id}
                      >
                        {signingTxId === tx._id ? (
                          <ActivityIndicator size="small" color={colors.success} />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 6 }} />
                            <Text style={{ color: colors.success }} className="font-bold">Approve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))
            ) : (
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
            )}
          </>
        )}
        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
