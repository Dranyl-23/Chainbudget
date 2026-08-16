import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';

export default function VerificationReportScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  
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
      <View className="flex-1 bg-[#09090b] items-center justify-center">
        <ActivityIndicator color="#34d399" size="large" />
        <Text className="text-white/50 mt-4">Querying blockchain...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-[#09090b] pt-12 p-6">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center mb-6 bg-white/5 rounded-full">
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View className="items-center mt-10">
          <View className="w-20 h-20 bg-rose-500/20 rounded-full items-center justify-center mb-6 border border-rose-500/40">
            <Ionicons name="close-circle" size={40} color="#f43f5e" />
          </View>
          <Text className="text-2xl font-bold text-white mb-2">Verification Failed</Text>
          <Text className="text-white/60 text-center px-4 leading-relaxed">{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#09090b]">
      <View style={{ paddingTop: insets.top }} className="flex-row items-center p-4 border-b border-white/5">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center -ml-2">
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">Audit Report</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Status Badge */}
        <View className="items-center py-6">
          <View className={`w-24 h-24 rounded-full items-center justify-center mb-4 border ${report.isVerified ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <Ionicons name={report.isVerified ? 'shield-checkmark' : 'warning'} size={48} color={report.isVerified ? '#34d399' : '#f59e0b'} />
          </View>
          <Text className="text-2xl font-black text-white mb-2">
            {report.isVerified ? 'Verified Authentic' : 'Pending Verification'}
          </Text>
          <Text className="text-white/60 text-center px-4">
            {report.isVerified 
              ? 'This transaction exists on the Polygon blockchain and matches our internal ledger.' 
              : 'This transaction is recognized but has not yet been cryptographically verified on-chain.'}
          </Text>
        </View>

        {/* Amount & Organization */}
        <View className="bg-[#121215] rounded-2xl border border-white/5 p-5 mb-4">
          <Text className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">Total Amount</Text>
          <Text className={`text-4xl font-black mb-4 ${report.type === 'expense' ? 'text-rose-400' : 'text-emerald-400'}`}>
            ₱{report.amount?.toLocaleString()}
          </Text>

          <View className="h-px bg-white/5 w-full mb-4" />
          
          <Text className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">Organization</Text>
          <Text className="text-white font-bold text-lg">{report.organizationName}</Text>
          
          <View className="h-px bg-white/5 w-full my-4" />
          
          <Text className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">Description</Text>
          <Text className="text-white/80">{report.description}</Text>
          <View className="flex-row items-center mt-3 bg-white/5 self-start px-2 py-1 rounded">
            <Text className="text-white/50 text-xs font-bold">{report.category}</Text>
          </View>
        </View>

        {/* Blockchain Details */}
        <View className="bg-[#121215] rounded-2xl border border-white/5 p-5 mb-4">
          <Text className="text-white font-bold mb-4 text-lg">Blockchain Data</Text>
          
          <View className="mb-4">
            <Text className="text-white/50 text-xs mb-1">Transaction Hash</Text>
            <Text className="text-emerald-400 font-mono text-xs">{report.transactionHash || 'N/A'}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-white/50 text-xs mb-1">Smart Contract Address</Text>
            <Text className="text-purple-300 font-mono text-xs">{report.contractAddress || 'N/A'}</Text>
          </View>

          <View className="mb-4">
            <Text className="text-white/50 text-xs mb-1">Timestamp</Text>
            <Text className="text-white font-mono text-xs">
              {formatDate(report.timestamp)}
            </Text>
          </View>

          <TouchableOpacity onPress={openPolygonScan} className="flex-row items-center bg-white/5 p-3 rounded-xl justify-center mt-2 border border-white/10">
            <Ionicons name="open-outline" size={16} color="#34d399" style={{ marginRight: 8 }} />
            <Text className="text-white font-bold">View on PolygonScan</Text>
          </TouchableOpacity>
        </View>

        {/* Receipt & Signatures */}
        {(report.receiptUrl || report.signatures?.length > 0) && (
          <View className="bg-[#121215] rounded-2xl border border-white/5 p-5 mb-8">
            <Text className="text-white font-bold mb-4 text-lg">Audit Trail</Text>
            
            {report.receiptUrl && (
              <TouchableOpacity onPress={openIpfsReceipt} className="flex-row items-center justify-between bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 mb-4">
                <View className="flex-row items-center">
                  <Ionicons name="document-text" size={24} color="#60a5fa" style={{ marginRight: 12 }} />
                  <View>
                    <Text className="text-blue-100 font-bold">View Original Receipt</Text>
                    <Text className="text-blue-300/50 text-xs font-mono mt-0.5">Stored on IPFS</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#60a5fa" />
              </TouchableOpacity>
            )}

            {report.signatures?.length > 0 && (
              <View>
                <Text className="text-white/50 text-xs uppercase font-bold mb-3">Digital Signatures ({report.signatures.length})</Text>
                {report.signatures.map((sig: any, idx: number) => (
                  <View key={idx} className="bg-white/5 p-3 rounded-lg mb-2">
                    <Text className="text-white font-bold text-sm mb-1">{sig.name}</Text>
                    <Text className="text-white/40 text-[10px] font-mono mb-2">{sig.wallet}</Text>
                    <View className="flex-row items-center bg-emerald-500/20 self-start px-2 py-1 rounded">
                      <Ionicons name="checkmark-done" size={12} color="#10b981" style={{ marginRight: 4 }} />
                      <Text className="text-emerald-400 text-[10px] font-mono" numberOfLines={1}>Signed</Text>
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
