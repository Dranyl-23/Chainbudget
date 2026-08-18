import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

function timeAgo(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
  } catch (e) {
    return dateString;
  }
}

export default function PublicLedgerScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'directory'>('feed');

  const fetchData = async () => {
    try {
      const [orgsRes, feedRes] = await Promise.all([
        api.get('/public/organizations'),
        api.get('/public/feed')
      ]);
      setOrganizations(orgsRes.data || []);
      setFeed(feedRes.data || []);
    } catch (err: any) {
      console.warn('[PublicLedger] Failed to fetch data:', err?.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <View className="flex-1 bg-[#09090b]">
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-[#121215] border-b border-white/10 px-4 pb-4">
        <View className="flex-row items-center justify-between h-12">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center -ml-2">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg">Public Ledger</Text>
          <View className="w-10" />
        </View>

        {/* Tabs */}
        <View className="flex-row bg-black/40 p-1 rounded-xl mt-4">
          <TouchableOpacity 
            onPress={() => setActiveTab('feed')} 
            className={`flex-1 items-center py-2 rounded-lg ${activeTab === 'feed' ? 'bg-fuchsia-600' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'feed' ? 'text-white' : 'text-white/50'}`}>Live Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('directory')} 
            className={`flex-1 items-center py-2 rounded-lg ${activeTab === 'directory' ? 'bg-fuchsia-600' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'directory' ? 'text-white' : 'text-white/50'}`}>Directory</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e879f9" />}
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator color="#e879f9" size="large" />
          </View>
        ) : activeTab === 'feed' ? (
          <View className="p-4">
            {feed.length === 0 ? (
              <Text className="text-white/50 text-center py-10">No public transactions yet.</Text>
            ) : (
              feed.map((tx: any, idx) => (
                <View key={idx} className="bg-[#1e1e24] p-4 rounded-2xl border border-white/5 mb-3">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-row items-center flex-1">
                      <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${tx.type === 'expense' ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`}>
                        <Ionicons name={tx.type === 'expense' ? 'arrow-up' : 'arrow-down'} size={16} color={tx.type === 'expense' ? '#f43f5e' : '#10b981'} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-bold" numberOfLines={1}>{tx.organization?.name || 'Unknown Org'}</Text>
                        <Text className="text-white/50 text-xs">{timeAgo(tx.createdAt)}</Text>
                      </View>
                    </View>
                    <Text className={`font-bold text-lg ${tx.type === 'expense' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {tx.type === 'expense' ? '-' : '+'}₱{tx.amount.toLocaleString()}
                    </Text>
                  </View>
                  <Text className="text-white/80 text-sm">{tx.description}</Text>
                  <View className="flex-row items-center mt-3 bg-indigo-500/10 self-start px-2 py-1 rounded-md border border-indigo-500/20">
                    <Ionicons name="checkmark-circle" size={12} color="#818cf8" style={{ marginRight: 4 }} />
                    <Text className="text-indigo-300 text-[10px] font-mono">On-Chain: {tx.blockchainTxHash.substring(0,8)}...</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="p-4 flex-row flex-wrap justify-between">
            {organizations.length === 0 ? (
              <Text className="text-white/50 w-full text-center py-10">No public organizations found.</Text>
            ) : (
              organizations.map((org: any, idx) => (
                <View key={idx} className="w-[48%] bg-[#1e1e24] rounded-2xl border border-white/5 p-4 mb-4 items-center">
                  <View className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30 items-center justify-center mb-3">
                    <Text className="text-fuchsia-400 font-extrabold text-2xl">{org.name.charAt(0)}</Text>
                  </View>
                  <Text className="text-white font-bold text-center mb-1" numberOfLines={1}>{org.name}</Text>
                  <Text className="text-white/50 text-xs text-center mb-3 capitalize">{org.type}</Text>
                  
                  {/* Transparency Score */}
                  <View className="w-full bg-black/40 rounded-lg p-2 items-center border border-white/5">
                    <Text className="text-[10px] text-white/50 uppercase font-bold mb-1">Transparency</Text>
                    <View className="flex-row items-center">
                      <Ionicons name="shield-checkmark" size={12} color={org.transparencyScore >= 80 ? '#34d399' : '#f59e0b'} style={{ marginRight: 4 }} />
                      <Text className={`font-black ${org.transparencyScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {org.transparencyScore}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
