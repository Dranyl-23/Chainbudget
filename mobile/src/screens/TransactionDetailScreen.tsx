import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import {
  authenticateWithBiometrics,
  triggerSuccessHaptic,
  triggerErrorHaptic,
  triggerLightHaptic,
} from '../lib/biometrics';
import { signEscrowRelease } from '../lib/wallet';
import { RefreshControl } from 'react-native';

const DEFAULT_CHAIN_ID = 80002; // Polygon Amoy testnet

export default function TransactionDetailScreen() {
  const route = useRoute<any>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();
  const { txId } = route.params || {};

  const [tx, setTx] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [attachingReceipt, setAttachingReceipt] = useState(false);

  useEffect(() => {
    if (txId) {
      fetchDetails();
    }
  }, [txId]);

  // Real-time WebSocket updates
  useEffect(() => {
    if (!txId) return;

    const unsub = on('transaction_updated', (data: any) => {
      fetchDetails(false);
    });

    return () => unsub();
  }, [txId, on]);

  // Auto-polling for pending/in-progress transactions
  useEffect(() => {
    if (!tx || (tx.status !== 'pending_approval' && tx.status !== 'requested')) return;

    const interval = setInterval(() => {
      fetchDetails(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [tx?.status, txId]);

  const fetchDetails = async (showLoading = true) => {
    if (showLoading) setLoading(true);
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
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    triggerLightHaptic();
    fetchDetails(false);
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showToast('Copied to clipboard!', 'info');
  };

  const openExplorer = (hash: string) => {
    Linking.openURL(`https://amoy.polygonscan.com/tx/${hash}`);
  };

  const promptReceiptPicker = () => {
    Alert.alert('Attach Receipt', 'Choose a source for your invoice/receipt', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Camera', onPress: () => handlePickAndUploadReceipt(true) },
      { text: 'Photo Gallery', onPress: () => handlePickAndUploadReceipt(false) },
    ]);
  };

  const handlePickAndUploadReceipt = async (useCamera: boolean) => {
    await triggerLightHaptic();
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          showToast('Camera access is required to take photo receipts.', 'warning');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7 });
      }

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop() || 'receipt.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      setAttachingReceipt(true);
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type } as any);

      // Upload to IPFS/server
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { documentUrl, documentHash } = uploadRes.data;
      if (!documentUrl) throw new Error('Upload succeeded but no documentUrl returned.');

      // Patch transaction with receipt
      await api.patch(`/transactions/${txId}/receipt`, {
        documentUrl,
        documentHash,
      });

      showToast('Receipt attached successfully!', 'success');
      fetchDetails(false);
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to attach receipt.', 'error');
    } finally {
      setAttachingReceipt(false);
    }
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
    <ScrollView 
      style={{ backgroundColor: colors.background }} 
      className="flex-1"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          tintColor={colors.primary} 
          colors={[colors.primary]} 
        />
      }
    >
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
            <View className="py-3 border-b" style={{ borderBottomColor: colors.borderSubtle }}>
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

          {/* Attached Receipt / Invoice (FP-12) */}
          <View className="pt-3">
            <Text style={{ color: colors.textSecondary }} className="mb-2">Invoice / Receipt Document</Text>
            {tx.documentUrl ? (
              <TouchableOpacity
                onPress={() => {
                  const url = tx.documentUrl.startsWith('http')
                    ? tx.documentUrl
                    : `https://gateway.pinata.cloud/ipfs/${tx.documentUrl}`;
                  Linking.openURL(url);
                }}
                style={{ backgroundColor: colors.cardGlass, borderColor: colors.borderSubtle }}
                className="rounded-2xl p-3 border flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <Ionicons name="document-text" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                  <View className="flex-1">
                    <Text style={{ color: colors.textPrimary }} className="font-semibold text-xs" numberOfLines={1}>
                      View Document / Receipt
                    </Text>
                    {tx.documentHash && (
                      <Text style={{ color: colors.textMuted }} className="font-mono text-[10px]" numberOfLines={1}>
                        SHA-256: {tx.documentHash.slice(0, 16)}...
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={promptReceiptPicker}
                disabled={attachingReceipt}
                style={{
                  backgroundColor: colors.primaryMuted,
                  borderColor: colors.primary + '60',
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {attachingReceipt ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, includeFontPadding: false }}>Attach Receipt</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      backgroundColor: colors.primaryMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="business" size={14} color={colors.primary} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                    Payer (Organization Admin)
                  </Text>
                </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="person" size={14} color={colors.accentCyan} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                    Payee (Supplier Signature)
                  </Text>
                </View>
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
              <View>
                {isSupplier && !tx.payeeApproved && (
                  <TouchableOpacity
                    onPress={handleEscrowRelease}
                    disabled={releasing}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: colors.success,
                      paddingVertical: 14,
                      borderRadius: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginTop: 8,
                      shadowColor: colors.success,
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      elevation: 3,
                    }}
                  >
                    {releasing ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Ionicons name="finger-print" size={18} color="#ffffff" />
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, includeFontPadding: false }}>
                          Sign & Release Escrow (Gasless)
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {isOrgAdmin && !tx.payerApproved && (
                  <TouchableOpacity
                    onPress={handleEscrowRelease}
                    disabled={releasing}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: colors.primary,
                      paddingVertical: 14,
                      borderRadius: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginTop: 8,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      elevation: 3,
                    }}
                  >
                    {releasing ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Ionicons name="checkmark-done" size={18} color="#ffffff" />
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, includeFontPadding: false }}>
                          Approve Release as Payer
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
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
