import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useRoute } from '@react-navigation/native';

export default function TransactionDetailScreen() {
  const route = useRoute<any>();
  const { txId } = route.params || {};

  const [tx, setTx] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (txId) {
      fetchDetails();
    }
  }, [txId]);

  const fetchDetails = async () => {
    try {
      const [txRes, approvalsRes] = await Promise.all([
        api.get(`/transactions/${txId}`),
        api.get(`/approvals/${txId}`).catch(() => ({ data: [] }))
      ]);
      setTx(txRes.data);
      setApprovals(approvalsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied!", "Address copied to clipboard.");
  };

  const openExplorer = (hash: string) => {
    // Assuming Polygon Amoy testnet
    Linking.openURL(`https://amoy.polygonscan.com/tx/${hash}`);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#09090b] items-center justify-center">
        <ActivityIndicator color="#e879f9" />
      </View>
    );
  }

  if (!tx) {
    return (
      <View className="flex-1 bg-[#09090b] items-center justify-center">
        <Text className="text-white text-lg">Transaction not found.</Text>
      </View>
    );
  }

  const isExpense = tx.type === 'expense';

  return (
    <ScrollView className="flex-1 bg-[#09090b]">
      {/* Top Banner */}
      <LinearGradient
        colors={isExpense ? ['#7f1d1d', '#09090b'] : ['#064e3b', '#09090b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ padding: 24, paddingTop: 40, paddingBottom: 60, alignItems: 'center' }}
      >
        <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 border ${isExpense ? 'bg-red-500/20 border-red-500/50' : 'bg-emerald-500/20 border-emerald-500/50'}`}>
          <Ionicons name={isExpense ? 'arrow-up' : 'arrow-down'} size={32} color={isExpense ? '#f87171' : '#34d399'} />
        </View>
        <Text className="text-white/60 font-medium uppercase tracking-widest text-xs mb-1">
          {isExpense ? 'Sent / Requested' : 'Received'}
        </Text>
        <Text className="text-white font-extrabold text-4xl mb-2">
          {isExpense ? '-' : '+'}₱{tx.amount}
        </Text>
        <View className="bg-black/40 px-3 py-1 rounded-full border border-white/10">
          <Text className="text-white/80 font-bold text-xs uppercase">{tx.status}</Text>
        </View>
      </LinearGradient>

      {/* Details Card (overlapping banner) */}
      <View className="px-4 -mt-10 mb-8">
        <View className="bg-[#12121a] rounded-2xl p-5 border border-white/5 shadow-xl">
          
          <Text className="text-white font-bold text-xl mb-4">{tx.description}</Text>

          {tx.category && (
            <View className="flex-row justify-between py-3 border-b border-white/5">
              <Text className="text-white/50">Category</Text>
              <Text className="text-white font-medium">{tx.category}</Text>
            </View>
          )}

          <View className="flex-row justify-between py-3 border-b border-white/5">
            <Text className="text-white/50">Date</Text>
            <Text className="text-white font-medium">{new Date(tx.createdAt).toLocaleString()}</Text>
          </View>

          <View className="flex-row justify-between py-3 border-b border-white/5">
            <Text className="text-white/50">Initiated By</Text>
            <Text className="text-white font-medium">{tx.submittedBy?.displayName || 'Unknown'}</Text>
          </View>

          {tx.blockchainTxHash && (
            <View className="py-3 border-b border-white/5">
              <Text className="text-white/50 mb-1">Blockchain Receipt (Tx Hash)</Text>
              <TouchableOpacity 
                onPress={() => openExplorer(tx.blockchainTxHash)}
                className="flex-row items-center justify-between bg-black/30 p-3 rounded-lg border border-fuchsia-500/20"
              >
                <Text className="text-fuchsia-400 font-mono text-xs flex-1 mr-2" numberOfLines={1}>
                  {tx.blockchainTxHash}
                </Text>
                <Ionicons name="open-outline" size={16} color="#e879f9" />
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>

      {/* Approvals Section */}
      {approvals.length > 0 && (
        <View className="px-4 mb-10">
          <Text className="text-white font-bold text-lg mb-4">Governance Approvals</Text>
          {approvals.map((app: any, idx: number) => (
            <View key={idx} className="flex-row items-center bg-white/5 p-4 rounded-xl border border-white/5 mb-2">
              <Ionicons 
                name={app.action === 'approved' ? 'checkmark-circle' : 'close-circle'} 
                size={24} 
                color={app.action === 'approved' ? '#34d399' : '#f87171'} 
                style={{ marginRight: 12 }} 
              />
              <View className="flex-1">
                <Text className="text-white font-bold">{app.approver?.displayName || 'Admin'}</Text>
                <Text className="text-white/50 text-xs font-mono">{app.approver?.walletAddress?.slice(0,10)}...</Text>
              </View>
              <Text className="text-white/40 text-xs">{new Date(app.createdAt).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}
