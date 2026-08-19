import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { SkeletonTransactionList } from '../components/SkeletonLoader';

export default function HistoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
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
      <View 
        style={{ backgroundColor: colors.background }}
        className="flex-1 items-center justify-center p-6"
      >
        <Ionicons name="alert-circle" size={50} color={colors.textMuted} className="mb-4" />
        <Text style={{ color: colors.textPrimary }} className="text-lg font-bold">No Organization Selected</Text>
        <Text style={{ color: colors.textSecondary }} className="text-center mt-2">
          Please select an organization from the dashboard first.
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      className="flex-row items-center p-4 rounded-2xl border mb-3 shadow-sm"
      onPress={() => navigation.navigate('TransactionDetail', { txId: item._id })}
    >
      <View 
        style={{
          backgroundColor: item.type === 'expense' ? colors.errorBg : colors.successBg,
          borderColor: item.type === 'expense' ? colors.errorBorder : colors.successBorder,
        }}
        className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border"
      >
        <Ionicons 
          name={item.type === 'expense' ? 'arrow-up' : 'arrow-down'} 
          size={20} 
          color={item.type === 'expense' ? colors.error : colors.success} 
        />
      </View>
      <View className="flex-1 mr-2">
        <Text style={{ color: colors.textPrimary }} className="font-bold text-base mb-1" numberOfLines={1}>
          {item.description || 'Transaction'}
        </Text>
        <Text style={{ color: colors.textMuted }} className="text-xs">
          {new Date(item.createdAt).toLocaleDateString()} • {item.status?.toUpperCase()}
        </Text>
      </View>
      <Text 
        style={{ color: item.type === 'expense' ? colors.textPrimary : colors.success }}
        className="font-bold text-lg"
      >
        {item.type === 'expense' ? '-' : '+'}₱{item.amount?.toLocaleString() || '0'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {loading ? (
        <View className="p-4 pt-6">
          <SkeletonTransactionList count={6} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <Ionicons name="receipt-outline" size={50} color={colors.textMuted} className="mb-4" />
              <Text style={{ color: colors.textSecondary }} className="font-medium text-center">
                No transactions found in this organization.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
