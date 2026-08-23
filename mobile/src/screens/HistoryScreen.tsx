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
      const list =
        res.data.transactions ||
        res.data.data ||
        (Array.isArray(res.data) ? res.data : []);
      setTransactions(list);
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
    const isApproved = item.status === 'approved' || item.status === 'completed';
    const isRejected = item.status === 'rejected';

    const getStatusLabel = () => {
      if (item.status === 'pending_approval') return 'Pending';
      if (item.status === 'requested') return 'Requested';
      if (item.status === 'approved') return 'Approved';
      if (item.status === 'completed') return 'Completed';
      if (item.status === 'rejected') return 'Rejected';
      return (item.status || 'Pending').replace(/_/g, ' ');
    };

    const statusColor = isPending ? '#F59E0B' : isApproved ? '#10B981' : isRejected ? '#EF4444' : '#6B7280';
    const statusBg = isPending ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7')
      : isApproved ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7')
      : isRejected ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2')
      : (isDark ? 'rgba(107, 114, 128, 0.15)' : '#F3F4F6');

    return (
      <TouchableOpacity 
        style={{
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
        }}
        className="flex-row items-center p-4 rounded-2xl border mb-3 shadow-sm"
        onPress={() => navigation.navigate('TransactionDetail', { txId: item._id })}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View 
          style={{
            backgroundColor: isExpense
              ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2')
              : (isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7'),
            borderColor: isExpense ? '#EF444430' : '#10B98130',
          }}
          className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5 border"
        >
          <Ionicons 
            name={isExpense ? 'arrow-up' : 'arrow-down'} 
            size={22} 
            color={isExpense ? '#EF4444' : '#10B981'} 
          />
        </View>

        {/* Middle Info (Description, Date, Category) */}
        <View className="flex-1 mr-3">
          <Text style={{ color: colors.textPrimary }} className="font-bold text-[15px] mb-1" numberOfLines={1}>
            {item.description || 'Transaction'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            {item.category ? (
              <>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginHorizontal: 4 }}>•</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
                  {item.category}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Right Info (Amount + Clean Status Badge) */}
        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text 
            style={{
              color: isExpense ? colors.textPrimary : '#10B981',
              fontSize: 16,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {isExpense ? '-' : '+'}₱{Number(item.amount || 0).toLocaleString()}
          </Text>
          
          {/* Status Badge */}
          <View
            style={{
              backgroundColor: statusBg,
              borderColor: statusColor + '40',
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 2,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                color: statusColor,
                fontWeight: '700',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                includeFontPadding: false,
              }}
            >
              {getStatusLabel()}
            </Text>
          </View>
        </View>
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
          showsVerticalScrollIndicator={false}
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

