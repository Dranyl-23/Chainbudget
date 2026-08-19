import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

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
  const { colors, isDark } = useTheme();
  
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
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Header */}
      <View 
        style={{ 
          paddingTop: (insets.top || 0) + 8,
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderSubtle,
        }} 
        className="border-b px-4 pb-4 shadow-sm"
      >
        <View className="flex-row items-center justify-between h-12">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center -ml-2">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary }} className="font-bold text-lg">Public Ledger</Text>
          <View className="w-10" />
        </View>

        {/* Tabs */}
        <View 
          style={{ 
            backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
          }}
          className="flex-row p-1 rounded-2xl mt-4"
        >
          <TouchableOpacity 
            onPress={() => setActiveTab('feed')} 
            style={{
              backgroundColor: activeTab === 'feed' ? colors.primary : 'transparent',
            }}
            className="flex-1 items-center py-2.5 rounded-xl"
          >
            <Text 
              style={{ color: activeTab === 'feed' ? '#ffffff' : colors.textMuted }}
              className="font-bold text-sm"
            >
              Live Feed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('directory')} 
            style={{
              backgroundColor: activeTab === 'directory' ? colors.primary : 'transparent',
            }}
            className="flex-1 items-center py-2.5 rounded-xl"
          >
            <Text 
              style={{ color: activeTab === 'directory' ? '#ffffff' : colors.textMuted }}
              className="font-bold text-sm"
            >
              Directory
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : activeTab === 'feed' ? (
          <View className="p-4">
            {feed.length === 0 ? (
              <Text style={{ color: colors.textSecondary }} className="text-center py-10">No public transactions yet.</Text>
            ) : (
              feed.map((tx: any, idx) => (
                <View 
                  key={idx} 
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="p-4 rounded-2xl border mb-3 shadow-sm"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-row items-center flex-1 mr-2">
                      <View 
                        style={{
                          backgroundColor: tx.type === 'expense' ? colors.errorBg : colors.successBg,
                        }}
                        className="w-8 h-8 rounded-full items-center justify-center mr-3"
                      >
                        <Ionicons 
                          name={tx.type === 'expense' ? 'arrow-up' : 'arrow-down'} 
                          size={16} 
                          color={tx.type === 'expense' ? colors.error : colors.success} 
                        />
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: colors.textPrimary }} className="font-bold" numberOfLines={1}>
                          {tx.organization?.name || 'Unknown Org'}
                        </Text>
                        <Text style={{ color: colors.textMuted }} className="text-xs">{timeAgo(tx.createdAt)}</Text>
                      </View>
                    </View>
                    <Text 
                      style={{ color: tx.type === 'expense' ? colors.error : colors.success }}
                      className="font-bold text-lg"
                    >
                      {tx.type === 'expense' ? '-' : '+'}₱{tx.amount?.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textSecondary }} className="text-sm">{tx.description}</Text>
                  {tx.blockchainTxHash && (
                    <View 
                      style={{ backgroundColor: colors.infoBg, borderColor: colors.infoBorder }}
                      className="flex-row items-center mt-3 self-start px-2 py-1 rounded-md border"
                    >
                      <Ionicons name="checkmark-circle" size={12} color={colors.accentBlue} style={{ marginRight: 4 }} />
                      <Text style={{ color: colors.accentBlue }} className="text-[10px] font-mono">
                        On-Chain: {tx.blockchainTxHash.substring(0, 8)}...
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="p-4 flex-row flex-wrap justify-between">
            {organizations.length === 0 ? (
              <Text style={{ color: colors.textSecondary }} className="w-full text-center py-10">No public organizations found.</Text>
            ) : (
              organizations.map((org: any, idx) => (
                <View 
                  key={idx} 
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="w-[48%] rounded-2xl border p-4 mb-4 items-center shadow-sm"
                >
                  <View 
                    style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
                    className="w-14 h-14 rounded-2xl border items-center justify-center mb-3"
                  >
                    <Text style={{ color: colors.primary }} className="font-extrabold text-2xl">{org.name.charAt(0)}</Text>
                  </View>
                  <Text style={{ color: colors.textPrimary }} className="font-bold text-center mb-1" numberOfLines={1}>{org.name}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-xs text-center mb-3 capitalize">{org.type || 'DAO'}</Text>
                  
                  {/* Transparency Score */}
                  <View 
                    style={{ 
                      backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
                      borderColor: colors.borderSubtle,
                    }}
                    className="w-full rounded-xl p-2 items-center border"
                  >
                    <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase font-bold mb-1">Transparency</Text>
                    <View className="flex-row items-center">
                      <Ionicons 
                        name="shield-checkmark" 
                        size={12} 
                        color={org.transparencyScore >= 80 ? colors.success : colors.warning} 
                        style={{ marginRight: 4 }} 
                      />
                      <Text 
                        style={{ color: org.transparencyScore >= 80 ? colors.success : colors.warning }}
                        className="font-black"
                      >
                        {org.transparencyScore || 100}%
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
