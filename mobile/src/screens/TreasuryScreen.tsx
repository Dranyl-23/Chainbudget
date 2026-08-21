/**
 * TreasuryScreen.tsx — FP-4
 * Treasury settings: governance rules, live on-chain balance.
 * Level 1 (Executive) only.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { ethers } from 'ethers';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { triggerSuccessHaptic, triggerErrorHaptic } from '../lib/biometrics';

const AMOY_RPC = 'https://rpc-amoy.polygon.technology';

export default function TreasuryScreen() {
  const route = useRoute<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const orgId: string = route.params?.orgId;

  const [org, setOrg] = useState<any>(null);
  const [chainBalance, setChainBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form
  const [threshold, setThreshold] = useState('');
  const [requiredApprovals, setRequiredApprovals] = useState('');

  // Check role
  const myMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === orgId
  );
  const roleLevel = myMembership?.roleLevel || 4;
  const isAuthorized = roleLevel <= 1 || user?.isSuperAdmin;

  useEffect(() => {
    if (orgId) fetchOrg();
  }, [orgId]);

  const fetchOrg = async () => {
    try {
      const res = await api.get(`/organizations/${orgId}`);
      const data = res.data?.organization || res.data;
      setOrg(data);
      setThreshold(String(data.highValueThreshold || ''));
      setRequiredApprovals(String(data.requiredApprovals || ''));
      if (data.treasuryContractAddress || data.contractAddress) {
        fetchChainBalance(data.treasuryContractAddress || data.contractAddress);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChainBalance = async (contractAddr: string) => {
    if (!contractAddr || !contractAddr.startsWith('0x')) return;
    setLoadingBalance(true);
    try {
      const provider = new ethers.JsonRpcProvider(AMOY_RPC);
      const bal = await provider.getBalance(contractAddr);
      setChainBalance(ethers.formatEther(bal));
    } catch {
      setChainBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrg().then(() => setRefreshing(false));
  };

  const handleSave = async () => {
    if (!threshold || !requiredApprovals) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/organizations/${orgId}`, {
        highValueThreshold: Number(threshold),
        requiredApprovals: Number(requiredApprovals),
      });
      await triggerSuccessHaptic();
      Alert.alert('Saved', 'Treasury settings updated successfully.');
      fetchOrg();
    } catch (err: any) {
      await triggerErrorHaptic();
      Alert.alert('Error', err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="lock-closed-outline" size={56} color={colors.textMuted} />
        <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 20, marginTop: 16, textAlign: 'center' }}>
          Access Denied
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center', fontSize: 14 }}>
          Treasury settings are restricted to Executive Approvers (Level 1) only.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const contractAddr = org?.treasuryContractAddress || org?.contractAddress;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* Live Balance Card */}
      <View style={{
        backgroundColor: colors.surface, borderColor: colors.border,
        borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 20,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            Live Treasury Balance
          </Text>
          <TouchableOpacity onPress={() => contractAddr && fetchChainBalance(contractAddr)}>
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loadingBalance ? (
          <ActivityIndicator color={colors.primary} />
        ) : chainBalance !== null ? (
          <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '800' }}>
            {parseFloat(chainBalance).toFixed(4)} POL
          </Text>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            {contractAddr ? 'Unable to fetch balance' : 'No contract linked'}
          </Text>
        )}

        {contractAddr && (
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>
            {contractAddr.slice(0, 10)}...{contractAddr.slice(-8)}
          </Text>
        )}
      </View>

      {/* Governance Settings */}
      <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18, marginBottom: 16 }}>
        Governance Rules
      </Text>

      <View style={{
        backgroundColor: colors.surface, borderColor: colors.border,
        borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 20,
      }}>
        <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>
          High-Value Threshold (PHP)
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
          Transactions above this amount require multi-sig approval.
        </Text>
        <TextInput
          style={{
            backgroundColor: colors.background, color: colors.textPrimary,
            borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 20,
          }}
          placeholder="e.g. 10000"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={threshold}
          onChangeText={setThreshold}
        />

        <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>
          Required Approvals
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
          Number of executive approvers needed (1–10).
        </Text>
        <TextInput
          style={{
            backgroundColor: colors.background, color: colors.textPrimary,
            borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12,
          }}
          placeholder="e.g. 2"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={requiredApprovals}
          onChangeText={(v) => {
            const n = parseInt(v);
            if (!v || (n >= 1 && n <= 10)) setRequiredApprovals(v);
          }}
        />
      </View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={{
          backgroundColor: colors.primary, padding: 16,
          borderRadius: 16, alignItems: 'center',
        }}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Save Changes</Text>
            </View>
          )
        }
      </TouchableOpacity>
    </ScrollView>
  );
}
