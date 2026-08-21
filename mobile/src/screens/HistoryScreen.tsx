import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useOrg } from '../context/OrgContext';
import { useTheme } from '../context/ThemeContext';
import { SkeletonTransactionList } from '../components/SkeletonLoader';
import { triggerLightHaptic } from '../lib/biometrics';

type FilterType = 'all' | 'expense' | 'income' | 'pending' | 'approved' | 'escrow';

const FILTERS: { key: FilterType; label: string; icon?: any }[] = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses', icon: 'arrow-up' },
  { key: 'income', label: 'Incomes', icon: 'arrow-down' },
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'approved', label: 'Approved', icon: 'checkmark-circle-outline' },
  { key: 'escrow', label: 'Escrow', icon: 'shield-checkmark-outline' },
];

export default function HistoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { activeOrgId } = useOrg();
  const orgId = route.params?.orgId || activeOrgId;

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (orgId) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [orgId]);

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/transactions?orgId=${orgId}&limit=100`);
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

  // Live client-side search & filtering
  const filteredTransactions = useMemo(() => {
    let list = transactions;

    // Filter by type / status
    if (activeFilter === 'expense') {
      list = list.filter((t) => t.type === 'expense');
    } else if (activeFilter === 'income') {
      list = list.filter((t) => t.type === 'income');
    } else if (activeFilter === 'pending') {
      list = list.filter((t) => t.status === 'pending_approval' || t.status === 'requested');
    } else if (activeFilter === 'approved') {
      list = list.filter((t) => t.status === 'approved');
    } else if (activeFilter === 'escrow') {
      list = list.filter((t) => t.isEscrow || t.escrowStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.amount?.toString().includes(q) ||
          t.status?.toLowerCase().includes(q) ||
          t.blockchainTxHash?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [transactions, activeFilter, searchQuery]);

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

  const renderItem = ({ item }: { item: any }) => {
    const isExpense = item.type === 'expense';
    const isPending = item.status === 'pending_approval' || item.status === 'requested';
    const isApproved = item.status === 'approved';

    return (
      <TouchableOpacity 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="flex-row items-center p-4 rounded-2xl border mb-3 shadow-sm"
        onPress={() => navigation.navigate('TransactionDetail', { txId: item._id })}
      >
        <View 
          style={{
            backgroundColor: isExpense ? colors.errorBg : colors.successBg,
            borderColor: isExpense ? colors.errorBorder : colors.successBorder,
          }}
          className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border"
        >
          <Ionicons 
            name={isExpense ? 'arrow-up' : 'arrow-down'} 
            size={20} 
            color={isExpense ? colors.error : colors.success} 
          />
        </View>
        <View className="flex-1 mr-2">
          <Text style={{ color: colors.textPrimary }} className="font-bold text-base mb-1" numberOfLines={1}>
            {item.description || 'Transaction'}
          </Text>
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text style={{ color: colors.textMuted }} className="text-xs">
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            {item.category && (
              <>
                <Text style={{ color: colors.textMuted }} className="text-xs">•</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs font-semibold">{item.category}</Text>
              </>
            )}
            <Text style={{ color: colors.textMuted }} className="text-xs">•</Text>
            <Text
              style={{
                color: isPending ? colors.warning : isApproved ? colors.success : colors.error,
                fontWeight: '700',
                fontSize: 11,
                textTransform: 'uppercase',
              }}
            >
              {item.status}
            </Text>
          </View>
        </View>
        <Text 
          style={{ color: isExpense ? colors.textPrimary : colors.success }}
          className="font-bold text-lg"
        >
          {isExpense ? '-' : '+'}₱{item.amount?.toLocaleString() || '0'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Search and Filters Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        {/* Search Bar */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="flex-row items-center px-3 py-2.5 rounded-2xl border mb-3"
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search description, category, amount..."
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: colors.textPrimary, flex: 1, fontSize: 13 }}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-2">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => {
                  triggerLightHaptic();
                  setActiveFilter(f.key);
                }}
                style={{
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                  borderWidth: 1,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  marginRight: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {f.icon && (
                  <Ionicons
                    name={f.icon}
                    size={14}
                    color={isActive ? '#fff' : colors.textMuted}
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text
                  style={{
                    color: isActive ? '#fff' : colors.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                    fontSize: 12,
                  }}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="p-4 pt-4">
          <SkeletonTransactionList count={6} />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Ionicons name="receipt-outline" size={50} color={colors.textMuted} className="mb-4" />
              <Text style={{ color: colors.textSecondary }} className="font-semibold text-center text-base">
                {searchQuery || activeFilter !== 'all' ? 'No matching transactions' : 'No transactions found'}
              </Text>
              <Text style={{ color: colors.textMuted }} className="text-center text-xs mt-1">
                {searchQuery || activeFilter !== 'all' ? 'Try adjusting your search or filters' : 'Transactions for this organization will appear here'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

