import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { signApprovalAction } from '../lib/wallet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ApprovalsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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

  const fetchOrgs = async () => {
    try {
      const orgRes = await api.get('/organizations');
      setOrganizations(orgRes.data);
      if (orgRes.data.length > 0 && !activeOrgId) {
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
      setPendingTx(data);
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
      setSigningTxId(tx._id);

      // Sign using the private key stored locally in hardware-backed SecureStore.
      // This triggers biometric authentication (FaceID / Fingerprint / PIN).
      // The private key NEVER leaves the device — only the signature is sent.
      const signature = await signApprovalAction(
        tx._id.toString(),
        action,
        tx.amount.toString(),
        tx.description
      );

      await api.post(`/approvals/${tx._id}`, {
        action,
        signature,
        organizationId: activeOrgId,
        comment: `Transaction ${action} by mobile.`
      });

      Alert.alert("Success", `Transaction ${action} successfully!`);
      if (activeOrgId) fetchPending(activeOrgId);

    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        Alert.alert("Security Required", "Please unlock your vault first to sign transactions.");
      } else {
        Alert.alert("Error", err.response?.data?.error || err.message);
      }
    } finally {
      setSigningTxId(null);
    }
  };

  return (
    <View className="flex-1 bg-[#09090b]">
      {/* Header & Org Switcher */}
      <View 
        style={{ paddingTop: (insets.top || 0) + 16 }}
        className="pb-2 px-4 bg-[#09090b] border-b border-white/5 z-10"
      >
        <Text className="text-2xl font-bold text-white mb-4">Inbox & Approvals</Text>
        
        {organizations.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {organizations.map(org => {
              const isActive = org._id === activeOrgId;
              return (
                <TouchableOpacity
                  key={org._id}
                  onPress={() => setActiveOrgId(org._id)}
                  className={`mr-3 px-4 py-2 rounded-full border flex-row items-center ${isActive ? 'bg-fuchsia-500/20 border-fuchsia-500/50' : 'bg-white/5 border-white/10'}`}
                >
                  {isActive && <Ionicons name="radio-button-on" size={14} color="#e879f9" style={{ marginRight: 6 }} />}
                  <Text className={isActive ? 'text-fuchsia-300 font-bold' : 'text-white/60 font-medium'}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e879f9" />}
      >
        {!isAdmin ? (
          <View className="bg-white/5 p-6 rounded-3xl border border-red-500/20 items-center justify-center mt-10">
            <Ionicons name="lock-closed" size={40} color="#ef4444" className="mb-4" />
            <Text className="text-red-400 text-center font-bold text-lg">Access Restricted</Text>
            <Text className="text-white/50 text-center text-sm mt-2">Only DAO Admins and Managers (Role Level 1 & 2) can access the Approvals Inbox.</Text>
          </View>
        ) : (
          <>
            {loading ? (
              <ActivityIndicator color="#e879f9" style={{ marginTop: 20 }} />
            ) : pendingTx.length > 0 ? (
              pendingTx.map((tx: any) => (
                <TouchableOpacity 
                  key={tx._id}
                  onPress={() => navigation.navigate('TransactionDetail', { txId: tx._id })}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#1a1a24', '#0d0d12']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1">
                        <Text className="text-white font-bold text-lg mb-1">{tx.description}</Text>
                        <Text className="text-white/50 text-xs">Requested by: {tx.submittedBy?.displayName || 'Unknown'}</Text>
                      </View>
                      <Text className="text-fuchsia-400 font-extrabold text-xl">₱{tx.amount}</Text>
                    </View>

                    {/* Actions */}
                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity 
                        className="flex-1 bg-red-500/20 border border-red-500/40 py-3 rounded-xl items-center flex-row justify-center"
                        onPress={() => handleSign(tx, 'rejected')}
                        disabled={signingTxId === tx._id}
                      >
                        <Ionicons name="close-circle" size={18} color="#f87171" style={{ marginRight: 6 }} />
                        <Text className="text-red-400 font-bold">Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        className="flex-1 bg-emerald-500/20 border border-emerald-500/40 py-3 rounded-xl items-center flex-row justify-center"
                        onPress={() => handleSign(tx, 'approved')}
                        disabled={signingTxId === tx._id}
                      >
                        {signingTxId === tx._id ? (
                          <ActivityIndicator size="small" color="#34d399" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={18} color="#34d399" style={{ marginRight: 6 }} />
                            <Text className="text-emerald-400 font-bold">Approve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))
            ) : (
              <View className="bg-white/5 p-6 rounded-3xl border border-white/10 items-center justify-center mt-10">
                <Ionicons name="checkmark-done-circle" size={50} color="#34d399" className="mb-4" />
                <Text className="text-white text-center font-bold text-lg">Inbox Zero!</Text>
                <Text className="text-white/50 text-center text-sm mt-2">There are no pending budget requests requiring your approval in this organization.</Text>
              </View>
            )}
          </>
        )}
        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
