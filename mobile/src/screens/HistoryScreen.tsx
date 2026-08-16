import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function HistoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orgId } = route.params || {};

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [orgId]);

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/transactions?orgId=${orgId}&limit=50`);
      const data = res.data.data || res.data;
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory().then(() => setRefreshing(false));
  };

  if (!orgId) {
    return (
      <View className="flex-1 bg-[#09090b] items-center justify-center p-6">
        <Ionicons name="alert-circle" size={50} color="#666" className="mb-4" />
        <Text className="text-white text-lg font-bold">No Organization Selected</Text>
        <Text className="text-white/50 text-center mt-2">Please select an organization from the dashboard first.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      className="flex-row items-center bg-white/5 p-4 rounded-xl border border-white/5 mb-3"
      onPress={() => navigation.navigate('TransactionDetail', { txId: item._id })}
    >
      <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 border ${item.type === 'expense' ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
        <Ionicons name={item.type === 'expense' ? 'arrow-up' : 'arrow-down'} size={20} color={item.type === 'expense' ? '#f87171' : '#34d399'} />
      </View>
      <View className="flex-1">
        <Text className="text-white font-bold text-base mb-1" numberOfLines={1}>{item.description || 'Transaction'}</Text>
        <Text className="text-white/50 text-xs">{new Date(item.createdAt).toLocaleDateString()} • {item.status.toUpperCase()}</Text>
      </View>
      <Text className={`font-bold text-lg ${item.type === 'expense' ? 'text-white' : 'text-emerald-400'}`}>
        {item.type === 'expense' ? '-' : '+'}₱{item.amount}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#09090b]">
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#e879f9" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e879f9" />}
          ListEmptyComponent={
            <View className="items-center justify-center py-10">
              <Ionicons name="receipt-outline" size={50} color="#333" className="mb-4" />
              <Text className="text-white/50 font-medium text-center">No transactions found in this organization.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
