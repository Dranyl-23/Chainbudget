import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

export default function VerificationReportScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  
  const hash = route.params?.hash;
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hash) {
      verifyTransaction(hash);
    } else {
      setError('No transaction hash provided.');
      setLoading(false);
    }
  }, [hash]);

  const verifyTransaction = async (txHash: string) => {
    try {
      const res = await api.get(`/public/verify/${txHash}`);
      setReport(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Verification failed. This transaction may not exist or is private.');
    } finally {
      setLoading(false);
    }
  };

  const openPolygonScan = () => {
    if (report?.transactionHash) {
      Linking.openURL(`https://polygonscan.com/tx/${report.transactionHash}`);
    }
  };

  const openIpfsReceipt = () => {
    if (report?.receiptUrl) {
      Linking.openURL(report.receiptUrl);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <View style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.success} size="large" />
        <Text style={{ color: colors.textSecondary }} className="mt-4">Querying blockchain...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ backgroundColor: colors.background }} className="flex-1 pt-12 p-6">
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={{ backgroundColor: colors.cardGlass }}
          className="w-10 h-10 items-center justify-center mb-6 rounded-full"
        >
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View className="items-center mt-10">
          <View 
            style={{ backgroundColor: colors.errorBg, borderColor: colors.errorBorder }}
            className="w-20 h-20 rounded-full items-center justify-center mb-6 border"
          >
            <Ionicons name="close-circle" size={40} color={colors.error} />
          </View>
          <Text style={{ color: colors.textPrimary }} className="text-2xl font-bold mb-2">Verification Failed</Text>
          <Text style={{ color: colors.textSecondary }} className="text-center px-4 leading-relaxed">{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <View 
        style={{ 
          paddingTop: (insets.top || 0) + 8,
          borderBottomColor: colors.borderSubtle,
        }} 
        className="flex-row items-center p-4 border-b"
      >
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center -ml-2">
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary }} className="font-bold text-lg">Audit Report</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Status Badge */}
        <View className="items-center py-6">
          <View 
            style={{
              backgroundColor: report.isVerified ? colors.successBg : colors.warningBg,
              borderColor: report.isVerified ? colors.successBorder : colors.warningBorder,
            }}
            className="w-24 h-24 rounded-full items-center justify-center mb-4 border"
          >
            <Ionicons 
              name={report.isVerified ? 'shield-checkmark' : 'warning'} 
              size={48} 
              color={report.isVerified ? colors.success : colors.warning} 
            />
          </View>
          <Text style={{ color: colors.textPrimary }} className="text-2xl font-black mb-2">
            {report.isVerified ? 'Verified Authentic' : 'Pending Verification'}
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-center px-4">
            {report.isVerified 
              ? 'This transaction exists on the Polygon blockchain and matches our internal ledger.' 
              : 'This transaction is recognized but has not yet been cryptographically verified on-chain.'}
          </Text>
        </View>

        {/* Amount & Organization */}
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="rounded-3xl border p-5 mb-4 shadow-sm"
        >
          <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase font-bold tracking-widest mb-1">Total Amount</Text>
          <Text 
            style={{ color: report.type === 'expense' ? colors.error : colors.success }}
            className="text-4xl font-black mb-4"
          >
            ₱{report.amount?.toLocaleString()}
          </Text>

          <View style={{ backgroundColor: colors.borderSubtle }} className="h-px w-full mb-4" />
          
          <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase font-bold tracking-widest mb-1">Organization</Text>
          <Text style={{ color: colors.textPrimary }} className="font-bold text-lg">{report.organizationName}</Text>
          
          <View style={{ backgroundColor: colors.borderSubtle }} className="h-px w-full my-4" />
          
          <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase font-bold tracking-widest mb-1">Description</Text>
          <Text style={{ color: colors.textSecondary }}>{report.description}</Text>
          <View 
            style={{ backgroundColor: colors.cardGlass }}
            className="flex-row items-center mt-3 self-start px-2.5 py-1 rounded-lg"
          >
            <Text style={{ color: colors.textMuted }} className="text-xs font-bold">{report.category}</Text>
          </View>
        </View>

        {/* Blockchain Details */}
        <View 
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="rounded-3xl border p-5 mb-4 shadow-sm"
        >
          <Text style={{ color: colors.textPrimary }} className="font-bold mb-4 text-lg">Blockchain Data</Text>
          
          <View className="mb-4">
            <Text style={{ color: colors.textMuted }} className="text-xs mb-1">Transaction Hash</Text>
            <Text style={{ color: colors.success }} className="font-mono text-xs">{report.transactionHash || 'N/A'}</Text>
          </View>

          <View className="mb-4">
            <Text style={{ color: colors.textMuted }} className="text-xs mb-1">Smart Contract Address</Text>
            <Text style={{ color: colors.accentPurple }} className="font-mono text-xs">{report.contractAddress || 'N/A'}</Text>
          </View>

          <View className="mb-4">
            <Text style={{ color: colors.textMuted }} className="text-xs mb-1">Timestamp</Text>
            <Text style={{ color: colors.textPrimary }} className="font-mono text-xs">
              {formatDate(report.timestamp)}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={openPolygonScan} 
            style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
            className="flex-row items-center p-3 rounded-2xl justify-center mt-2 border"
          >
            <Ionicons name="open-outline" size={16} color={colors.success} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.textPrimary }} className="font-bold">View on PolygonScan</Text>
          </TouchableOpacity>
        </View>

        {/* Receipt & Signatures */}
        {(report.receiptUrl || report.signatures?.length > 0) && (
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-3xl border p-5 mb-8 shadow-sm"
          >
            <Text style={{ color: colors.textPrimary }} className="font-bold mb-4 text-lg">Audit Trail</Text>
            
            {report.receiptUrl && (
              <TouchableOpacity 
                onPress={openIpfsReceipt} 
                style={{ backgroundColor: colors.infoBg, borderColor: colors.infoBorder }}
                className="flex-row items-center justify-between p-4 rounded-2xl border mb-4"
              >
                <View className="flex-row items-center">
                  <Ionicons name="document-text" size={24} color={colors.accentBlue} style={{ marginRight: 12 }} />
                  <View>
                    <Text style={{ color: colors.accentBlue }} className="font-bold">View Original Receipt</Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs font-mono mt-0.5">Stored on IPFS</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.accentBlue} />
              </TouchableOpacity>
            )}

            {report.signatures?.length > 0 && (
              <View>
                <Text style={{ color: colors.textMuted }} className="text-xs uppercase font-bold mb-3">Digital Signatures ({report.signatures.length})</Text>
                {report.signatures.map((sig: any, idx: number) => (
                  <View 
                    key={idx} 
                    style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary }}
                    className="p-3.5 rounded-xl mb-2"
                  >
                    <Text style={{ color: colors.textPrimary }} className="font-bold text-sm mb-1">{sig.name}</Text>
                    <Text style={{ color: colors.textMuted }} className="text-[10px] font-mono mb-2">{sig.wallet}</Text>
                    <View 
                      style={{ backgroundColor: colors.successBg, borderColor: colors.successBorder }}
                      className="flex-row items-center self-start px-2 py-1 rounded-lg border"
                    >
                      <Ionicons name="checkmark-done" size={12} color={colors.success} style={{ marginRight: 4 }} />
                      <Text style={{ color: colors.success }} className="text-[10px] font-mono" numberOfLines={1}>Signed</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
