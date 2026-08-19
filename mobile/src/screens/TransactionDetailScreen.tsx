import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  authenticateWithBiometrics,
  triggerSuccessHaptic,
  triggerErrorHaptic,
  triggerLightHaptic,
} from '../lib/biometrics';
import { signEscrowRelease } from '../lib/wallet';

const DEFAULT_CHAIN_ID = 80002; // Polygon Amoy testnet

export default function TransactionDetailScreen() {
  const route = useRoute<any>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { txId } = route.params || {};

  const [tx, setTx] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    if (txId) {
      fetchDetails();
    }
  }, [txId]);

  const fetchDetails = async () => {
    try {
      const [txRes, approvalsRes] = await Promise.all([
        api.get(`/transactions/${txId}`),
        api.get(`/approvals/${txId}`).catch(() => ({ data: [] })),
      ]);
      setTx(txRes.data);
      setApprovals(approvalsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    await triggerSuccessHaptic();
    Alert.alert('Copied!', 'Address copied to clipboard.');
  };

  const openExplorer = (hash: string) => {
    Linking.openURL(`https://amoy.polygonscan.com/tx/${hash}`);
  };

  // Determine user roles in relation to this transaction
  const userWallet = user?.walletAddress?.toLowerCase();
  const supplierWallet = (tx?.supplier?.walletAddress || tx?.supplier || tx?.to)?.toLowerCase();
  const isSupplier = Boolean(userWallet && supplierWallet && userWallet === supplierWallet);

  const orgMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === (tx?.organization?._id || tx?.organization)
  );
  const isOrgAdmin = Boolean(orgMembership && (orgMembership.roleLevel <= 2 || orgMembership.role === 'admin'));

  const handleEscrowRelease = async () => {
    if (!tx) return;

    await triggerLightHaptic();

    // 1. Biometric verification prompt
    const authPrompt = isSupplier
      ? `Authorize gasless escrow release of ₱${tx.amount}`
      : `Approve escrow release as Organization Payer`;

    const authResult = await authenticateWithBiometrics(authPrompt);
    if (!authResult.success) return;

    setReleasing(true);
    try {
      let payload: any = {};

      if (isSupplier) {
        // Supplier signs the EIP-191 digest on-device using SecureStore key
        const contractAddress =
          tx.organization?.contractAddress ||
          tx.organization?.vaultAddress;
        if (!contractAddress) {
          throw new Error('No smart contract configured for this organization. Cannot sign escrow release.');
        }
        const chainId = tx.organization?.chainId || DEFAULT_CHAIN_ID;
        const nonce = tx.escrowNonce || 0;

        const signature = await signEscrowRelease(
          contractAddress,
          chainId,
          tx.onChainId || tx.nonce || 0,
          tx.amountWei || '0',
          user?.walletAddress || ''
        );

        payload = {
          role: 'supplier',
          signature,
          nonce,
        };
      } else {
        payload = {
          role: 'payer',
        };
      }

      const res = await api.post(`/transactions/${tx._id}/release-escrow`, payload);
      await triggerSuccessHaptic();

      Alert.alert(
        'Escrow Release Successful!',
        res.data?.txHash
          ? `On-chain Transaction Hash:\n${res.data.txHash.slice(0, 16)}...`
          : 'Escrow status updated on-chain.'
      );

      fetchDetails();
    } catch (err: any) {
      await triggerErrorHaptic();
      console.error('Escrow release failed:', err);
      Alert.alert(
        'Release Failed',
        err.response?.data?.error || err.message || 'Could not release escrow funds.'
      );
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {
    return (
      <View style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <Text style={{ color: colors.textPrimary }} className="text-lg">Transaction not found.</Text>
      </View>
    );
  }

  const isExpense = tx.type === 'expense';
  const isEscrowTx = Boolean(tx.isEscrow || tx.escrowStatus);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Top Banner */}
      <LinearGradient
        colors={
          isExpense 
            ? (isDark ? ['#7f1d1d', '#09090b'] : ['#fee2e2', '#f8fafc']) 
            : (isDark ? ['#064e3b', '#09090b'] : ['#dcfce7', '#f8fafc'])
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ padding: 24, paddingTop: 40, paddingBottom: 60, alignItems: 'center' }}
      >
        <View
          style={{
            backgroundColor: isExpense ? colors.errorBg : colors.successBg,
            borderColor: isExpense ? colors.errorBorder : colors.successBorder,
          }}
          className="w-16 h-16 rounded-full items-center justify-center mb-4 border"
        >
          <Ionicons
            name={isExpense ? 'arrow-up' : 'arrow-down'}
            size={32}
            color={isExpense ? colors.error : colors.success}
          />
        </View>
        <Text style={{ color: colors.textMuted }} className="font-medium uppercase tracking-widest text-xs mb-1">
          {isExpense ? 'Sent / Requested' : 'Received'}
        </Text>
        <Text style={{ color: colors.textPrimary }} className="font-extrabold text-4xl mb-2">
          {isExpense ? '-' : '+'}₱{tx.amount?.toLocaleString()}
        </Text>
        <View className="flex-row gap-2">
          <View 
            style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
            className="px-3 py-1 rounded-full border"
          >
            <Text style={{ color: colors.textPrimary }} className="font-bold text-xs uppercase">{tx.status}</Text>
          </View>
          {isEscrowTx && (
            <View 
              style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
              className="px-3 py-1 rounded-full border"
            >
              <Text style={{ color: colors.primary }} className="font-bold text-xs uppercase">
                Escrow: {tx.escrowStatus || 'Locked'}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Details Card (overlapping banner) */}
      <View className="px-4 -mt-10 mb-6">
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="rounded-3xl p-5 border shadow-xl"
        >
          <Text style={{ color: colors.textPrimary }} className="font-bold text-xl mb-4">{tx.description}</Text>

          {tx.category && (
            <View 
              style={{ borderBottomColor: colors.borderSubtle }}
              className="flex-row justify-between py-3 border-b"
            >
              <Text style={{ color: colors.textSecondary }}>Category</Text>
              <Text style={{ color: colors.textPrimary }} className="font-semibold">{tx.category}</Text>
            </View>
          )}

          <View 
            style={{ borderBottomColor: colors.borderSubtle }}
            className="flex-row justify-between py-3 border-b"
          >
            <Text style={{ color: colors.textSecondary }}>Date</Text>
            <Text style={{ color: colors.textPrimary }} className="font-semibold">
              {new Date(tx.createdAt).toLocaleString()}
            </Text>
          </View>

          <View 
            style={{ borderBottomColor: colors.borderSubtle }}
            className="flex-row justify-between py-3 border-b"
          >
            <Text style={{ color: colors.textSecondary }}>Initiated By</Text>
            <Text style={{ color: colors.textPrimary }} className="font-semibold">
              {tx.submittedBy?.displayName || 'Unknown'}
            </Text>
          </View>

          {tx.blockchainTxHash && (
            <View className="py-3">
              <Text style={{ color: colors.textSecondary }} className="mb-1">Blockchain Receipt (Tx Hash)</Text>
              <TouchableOpacity
                onPress={() => openExplorer(tx.blockchainTxHash)}
                style={{ backgroundColor: colors.cardGlass, borderColor: colors.primary + '40' }}
                className="flex-row items-center justify-between p-3 rounded-xl border"
              >
                <Text style={{ color: colors.primary }} className="font-mono text-xs flex-1 mr-2" numberOfLines={1}>
                  {tx.blockchainTxHash}
                </Text>
                <Ionicons name="open-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Escrow Two-Party Status & Gasless Sign Release Section */}
      {isEscrowTx && (
        <View className="px-4 mb-6">
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.primary + '40' }}
            className="rounded-3xl p-5 border shadow-xl"
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={{ color: colors.textPrimary }} className="font-bold text-base">Two-Party Escrow</Text>
              </View>
              <Text
                style={{
                  backgroundColor: tx.escrowStatus === 'released' ? colors.successBg : colors.warningBg,
                  color: tx.escrowStatus === 'released' ? colors.success : colors.warning,
                }}
                className="text-xs font-bold px-2.5 py-1 rounded-full uppercase"
              >
                {tx.escrowStatus === 'released' ? 'RELEASED' : 'LOCKED'}
              </Text>
            </View>

            {/* Step Checkpoints */}
            <View className="space-y-2 mb-4">
              <View 
                style={{ backgroundColor: colors.cardGlass, borderColor: colors.borderSubtle }}
                className="flex-row items-center justify-between p-3 rounded-xl border mb-2"
              >
                <Text style={{ color: colors.textSecondary }} className="text-xs">🏢 Payer (Organization Admin)</Text>
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name={tx.payerApproved ? 'checkmark-circle' : 'time-outline'}
                    size={16}
                    color={tx.payerApproved ? colors.success : colors.textMuted}
                  />
                  <Text style={{ color: tx.payerApproved ? colors.success : colors.textMuted }} className="font-bold text-xs">
                    {tx.payerApproved ? 'Approved' : 'Pending'}
                  </Text>
                </View>
              </View>

              <View 
                style={{ backgroundColor: colors.cardGlass, borderColor: colors.borderSubtle }}
                className="flex-row items-center justify-between p-3 rounded-xl border"
              >
                <Text style={{ color: colors.textSecondary }} className="text-xs">👤 Payee (Supplier Signature)</Text>
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name={tx.payeeApproved ? 'checkmark-circle' : 'time-outline'}
                    size={16}
                    color={tx.payeeApproved ? colors.success : colors.textMuted}
                  />
                  <Text style={{ color: tx.payeeApproved ? colors.success : colors.textMuted }} className="font-bold text-xs">
                    {tx.payeeApproved ? 'Approved' : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Escrow Release Button */}
            {tx.escrowStatus !== 'released' && (
              <>
                {isSupplier && !tx.payeeApproved && (
                  <TouchableOpacity
                    onPress={handleEscrowRelease}
                    disabled={releasing}
                    style={{ backgroundColor: colors.success }}
                    className="py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-lg mt-2"
                  >
                    {releasing ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="finger-print" size={18} color="#ffffff" />
                        <Text className="text-white font-bold text-sm">
                          Sign & Release Escrow (Gasless)
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {isOrgAdmin && !tx.payerApproved && (
                  <TouchableOpacity
                    onPress={handleEscrowRelease}
                    disabled={releasing}
                    style={{ backgroundColor: colors.primary }}
                    className="py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-lg mt-2"
                  >
                    {releasing ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={18} color="#ffffff" />
                        <Text className="text-white font-bold text-sm">
                          Approve Release as Payer
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {/* Approvals Section */}
      {approvals.length > 0 && (
        <View className="px-4 mb-10">
          <Text style={{ color: colors.textPrimary }} className="font-bold text-lg mb-4">Governance Approvals</Text>
          {approvals.map((app: any, idx: number) => (
            <View
              key={idx}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="flex-row items-center p-4 rounded-2xl border mb-2 shadow-sm"
            >
              <Ionicons
                name={app.action === 'approved' ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={app.action === 'approved' ? colors.success : colors.error}
                style={{ marginRight: 12 }}
              />
              <View className="flex-1 mr-2">
                <Text style={{ color: colors.textPrimary }} className="font-bold">{app.approver?.displayName || 'Admin'}</Text>
                <Text style={{ color: colors.textMuted }} className="text-xs font-mono">
                  {app.approver?.walletAddress?.slice(0, 10)}...
                </Text>
              </View>
              <Text style={{ color: colors.textMuted }} className="text-xs">
                {new Date(app.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
