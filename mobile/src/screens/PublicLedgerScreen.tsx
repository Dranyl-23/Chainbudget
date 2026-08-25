/**
 * PublicLedgerScreen.tsx
 *
 * Public Transparency Explorer & Directory for ChainBudget.
 * Features searchable live transaction ledger, directory navigation to dedicated
 * full-page organization ledgers, on-chain Polygon verification links, and transparency metrics.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { triggerLightHaptic } from '../lib/biometrics';

const BACKEND_BASE = 'https://chainbudget-api.fly.dev';

function formatMobileAvatarUrl(uri?: string) {
  if (!uri || typeof uri !== 'string') return undefined;
  if (uri.startsWith('data:image/') || uri.startsWith('blob:')) {
    return uri;
  }
  if (uri.startsWith('/uploads')) {
    return `${BACKEND_BASE}${uri}`;
  }
  if (uri.includes('localhost:5001') || uri.includes('127.0.0.1:5001')) {
    return uri.replace(/http:\/\/(localhost|127\.0\.0\.1):5001/, BACKEND_BASE);
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }
  return undefined;
}

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

const ORG_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  student_org: { label: 'Student Org', icon: 'school-outline', color: '#C084FC' },
  barangay: { label: 'Barangay LGU', icon: 'business-outline', color: '#38BDF8' },
  homeowners_association: { label: 'Homeowners (HOA)', icon: 'key-outline', color: '#F59E0B' },
  ngo: { label: 'Non-Profit / NGO', icon: 'heart-outline', color: '#F43F5E' },
  cooperative: { label: 'Cooperative', icon: 'people-outline', color: '#10B981' },
  church: { label: 'Church / Religious', icon: 'home-outline', color: '#818CF8' },
  sports_club: { label: 'Sports Club', icon: 'trophy-outline', color: '#FBBF24' },
  startup: { label: 'Startup / Company', icon: 'rocket-outline', color: '#60A5FA' },
  family: { label: 'Family / Estate', icon: 'people-circle-outline', color: '#2DD4BF' },
  fundraising: { label: 'Charity Drive', icon: 'gift-outline', color: '#A3E635' },
};

const MOBILE_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'globe-outline' },
  { id: 'cooperative', label: 'Cooperatives', icon: 'people-outline' },
  { id: 'barangay', label: 'Barangays', icon: 'business-outline' },
  { id: 'student_org', label: 'Student Orgs', icon: 'school-outline' },
  { id: 'homeowners_association', label: 'HOA', icon: 'key-outline' },
  { id: 'ngo', label: 'NGO / Non-Profit', icon: 'heart-outline' },
  { id: 'church', label: 'Church', icon: 'home-outline' },
  { id: 'sports_club', label: 'Sports', icon: 'trophy-outline' },
  { id: 'startup', label: 'Startups', icon: 'rocket-outline' },
  { id: 'family', label: 'Family', icon: 'people-circle-outline' },
  { id: 'fundraising', label: 'Charity', icon: 'gift-outline' },
];

function getOrgTypeInfo(type?: string) {
  if (!type) return { label: 'DAO Workspace', icon: 'cube-outline', color: '#C084FC' };
  return ORG_TYPE_MAP[type.toLowerCase()] || {
    label: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: 'business-outline',
    color: '#C084FC',
  };
}

export default function PublicLedgerScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'directory'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [orgsRes, feedRes] = await Promise.all([
        api.get('/public/organizations'),
        api.get('/public/feed'),
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

  const handleOpenOrgDetail = (org: any) => {
    triggerLightHaptic();
    navigation.navigate('PublicOrgDetail', { org, orgId: org._id });
  };

  const handleOpenPolygonscan = (hashOrAddress: string, isTx = false) => {
    triggerLightHaptic();
    const url = isTx
      ? `https://amoy.polygonscan.com/tx/${hashOrAddress}`
      : `https://amoy.polygonscan.com/address/${hashOrAddress}`;
    Linking.openURL(url).catch(() => {
      showToast('Could not open PolygonScan explorer.', 'error');
    });
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: organizations.length };
    organizations.forEach((o) => {
      const typeKey = (o.type || '').toLowerCase();
      counts[typeKey] = (counts[typeKey] || 0) + 1;
    });
    return counts;
  }, [organizations]);

  // Filtered Feed
  const filteredFeed = useMemo(() => {
    return feed.filter((tx) => {
      const matchesOrg = selectedOrgFilter
        ? tx.organization?._id === selectedOrgFilter || tx.organization === selectedOrgFilter
        : true;
      if (!matchesOrg) return false;

      const orgType = (tx.organization?.type || '').toLowerCase();
      const matchesCategory =
        selectedCategory === 'all' || orgType === selectedCategory.toLowerCase();
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const orgName = (tx.organization?.name || '').toLowerCase();
      const amountStr = String(tx.amount || '');
      return desc.includes(q) || orgName.includes(q) || amountStr.includes(q);
    });
  }, [feed, searchQuery, selectedOrgFilter, selectedCategory]);

  // Filtered Directory
  const filteredOrgs = useMemo(() => {
    return organizations.filter((org) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (org.name || '').toLowerCase().includes(q) ||
        (org.type || '').toLowerCase().includes(q) ||
        (org.description || '').toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === 'all' ||
        (org.type || '').toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [organizations, searchQuery, selectedCategory]);

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      {/* Top Header */}
      <View
        style={{
          paddingTop: (insets.top || 0) + 8,
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderSubtle,
        }}
        className="border-b px-4 pb-3 shadow-sm"
      >
        <View className="flex-row items-center justify-between h-12">
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.goBack();
            }}
            className="w-10 h-10 items-center justify-center -ml-2 rounded-full"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary }} className="font-extrabold text-lg">
            Public Ledger
          </Text>
          <View className="w-10" />
        </View>

        {/* Tab Switcher */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            borderRadius: 16,
            padding: 4,
            marginTop: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setActiveTab('feed');
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: activeTab === 'feed' ? colors.primary : 'transparent',
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="pulse"
              size={15}
              color={activeTab === 'feed' ? '#ffffff' : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                color: activeTab === 'feed' ? '#ffffff' : colors.textMuted,
                fontWeight: '700',
                fontSize: 13,
                textAlign: 'center',
                includeFontPadding: false,
              }}
            >
              Live Feed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setActiveTab('directory');
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: activeTab === 'directory' ? colors.primary : 'transparent',
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="grid"
              size={14}
              color={activeTab === 'directory' ? '#ffffff' : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                color: activeTab === 'directory' ? '#ffffff' : colors.textMuted,
                fontWeight: '700',
                fontSize: 13,
                textAlign: 'center',
                includeFontPadding: false,
              }}
            >
              Directory ({organizations.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input Bar */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : colors.backgroundSecondary,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="flex-row items-center px-3.5 py-2.5 rounded-xl mt-3"
        >
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder={
              activeTab === 'feed'
                ? 'Search public transactions...'
                : 'Search organizations, DAOs, or types...'
            }
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

        {/* Category Horizontal Filter Pills */}
        <View style={{ marginTop: 10 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 2, gap: 8 }}
          >
            {MOBILE_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              const isSelected = selectedCategory === cat.id;

              if (cat.id !== 'all' && count === 0) return null;

              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    triggerLightHaptic();
                    setSelectedCategory(cat.id);
                  }}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 14,
                    backgroundColor: isSelected
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : colors.backgroundSecondary,
                    borderColor: isSelected ? colors.primary : colors.borderSubtle,
                    borderWidth: 1,
                  }}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={13}
                    color={isSelected ? '#ffffff' : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={{
                      color: isSelected ? '#ffffff' : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: isSelected ? '700' : '600',
                      includeFontPadding: false,
                    }}
                  >
                    {cat.label}
                  </Text>
                  <View
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(0, 0, 0, 0.25)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.06)',
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                      borderRadius: 8,
                      marginLeft: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? '#ffffff' : colors.textMuted,
                        fontSize: 10,
                        fontWeight: '700',
                        includeFontPadding: false,
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Active Filter Pill */}
        {selectedOrgFilter && (
          <View className="flex-row items-center justify-between mt-2.5 px-1">
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
              Filtered by:{' '}
              {organizations.find((o) => o._id === selectedOrgFilter)?.name || 'Selected DAO'}
            </Text>
            <TouchableOpacity onPress={() => setSelectedOrgFilter(null)}>
              <Text style={{ color: colors.error, fontSize: 11, fontWeight: '700' }}>Clear Filter</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Content */}
      <ScrollView
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
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 12 }}>
              Loading public blockchain ledger...
            </Text>
          </View>
        ) : activeTab === 'feed' ? (
          /* ── LIVE FEED ────────────────────────────────────────── */
          <View className="p-4">
            {filteredFeed.length === 0 ? (
              <View className="py-16 items-center justify-center">
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary }} className="font-bold text-sm mt-3">
                  No public transactions found
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1 text-center">
                  Transactions with Public Transparency will appear here in real time.
                </Text>
              </View>
            ) : (
              filteredFeed.map((tx: any, idx) => {
                const orgInfo = getOrgTypeInfo(tx.organization?.type);
                const isExpense = tx.type === 'expense';

                return (
                  <TouchableOpacity
                    key={tx._id || idx}
                    onPress={() => {
                      triggerLightHaptic();
                      if (tx.blockchainTxHash) {
                        handleOpenPolygonscan(tx.blockchainTxHash, true);
                      } else if (tx._id) {
                        navigation.navigate('TransactionDetail', { txId: tx._id });
                      }
                    }}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    }}
                    className="p-4 rounded-2xl mb-3 shadow-sm"
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-row items-center flex-1 mr-2">
                        <View
                          style={{
                            backgroundColor: isExpense ? colors.errorBg : colors.successBg,
                            borderColor: isExpense ? colors.errorBorder : colors.successBorder,
                            borderWidth: 1,
                          }}
                          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                        >
                          <Ionicons
                            name={isExpense ? 'arrow-up' : 'arrow-down'}
                            size={18}
                            color={isExpense ? colors.error : colors.success}
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            style={{ color: colors.textPrimary }}
                            className="font-bold text-sm"
                            numberOfLines={1}
                          >
                            {tx.organization?.name || 'Public Organization'}
                          </Text>
                          <View className="flex-row items-center gap-1.5 mt-0.5">
                            <Text style={{ color: orgInfo.color, fontSize: 10, fontWeight: '700' }}>
                              {orgInfo.label}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 10 }}>•</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                              {timeAgo(tx.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text
                        style={{ color: isExpense ? colors.textPrimary : colors.success }}
                        className="font-extrabold text-base"
                      >
                        {isExpense ? '-' : '+'}₱{tx.amount?.toLocaleString() || '0'}
                      </Text>
                    </View>

                    <Text
                      style={{ color: colors.textSecondary }}
                      className="text-xs leading-5 mb-2"
                      numberOfLines={2}
                    >
                      {tx.description}
                    </Text>

                    {/* Blockchain Verification Hash Badge */}
                    {tx.blockchainTxHash ? (
                      <View
                        style={{
                          backgroundColor: colors.infoBg,
                          borderColor: colors.infoBorder,
                          borderWidth: 1,
                        }}
                        className="flex-row items-center self-start px-2.5 py-1 rounded-lg"
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={12}
                          color={colors.accentBlue}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={{ color: colors.accentBlue }} className="text-[10px] font-mono font-bold">
                          Polygon Proof: {tx.blockchainTxHash.substring(0, 8)}...
                          {tx.blockchainTxHash.substring(tx.blockchainTxHash.length - 4)}
                        </Text>
                        <Ionicons
                          name="open-outline"
                          size={11}
                          color={colors.accentBlue}
                          style={{ marginLeft: 4 }}
                        />
                      </View>
                    ) : (
                      <View
                        style={{
                          backgroundColor: colors.cardGlass,
                          borderColor: colors.borderSubtle,
                          borderWidth: 1,
                        }}
                        className="flex-row items-center self-start px-2 py-0.5 rounded-md"
                      >
                        <Text style={{ color: colors.textMuted, fontSize: 9, fontWeight: '600' }}>
                          Off-chain internal ledger
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          /* ── DIRECTORY ────────────────────────────────────────── */
          <View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {/* Category Directory Header */}
            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 2 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                Showing <Text style={{ color: colors.primary, fontWeight: '800' }}>{filteredOrgs.length}</Text> organization{filteredOrgs.length === 1 ? '' : 's'}
                {selectedCategory !== 'all' ? ` in ${selectedCategory.replace(/_/g, ' ')}` : ''}
              </Text>
              {selectedCategory !== 'all' && (
                <TouchableOpacity
                  onPress={() => {
                    triggerLightHaptic();
                    setSelectedCategory('all');
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Reset Filter</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredOrgs.length === 0 ? (
              <View className="w-full py-16 items-center justify-center">
                <Ionicons name="business-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary }} className="font-bold text-sm mt-3">
                  No organizations found
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-xs mt-1 text-center">
                  Try selecting another category or clearing your search.
                </Text>
              </View>
            ) : (
              filteredOrgs.map((org: any) => {
                const typeInfo = getOrgTypeInfo(org.type);
                const score = org.transparencyScore ?? (org.contractAddress ? 100 : 50);
                const scoreColor = score >= 80 ? colors.success : colors.warning;

                return (
                  <TouchableOpacity
                    key={org._id}
                    onPress={() => handleOpenOrgDetail(org)}
                    activeOpacity={0.75}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      width: '48%',
                      borderRadius: 20,
                      padding: 14,
                      marginBottom: 14,
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDark ? 0.2 : 0.05,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    {/* Organization Icon / Logo Avatar */}
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 18,
                        backgroundColor: typeInfo.color + '18',
                        borderColor: typeInfo.color + '40',
                        borderWidth: 1.5,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                        overflow: 'hidden',
                      }}
                    >
                      {formatMobileAvatarUrl(org.logoUrl) ? (
                        <Image
                          source={{ uri: formatMobileAvatarUrl(org.logoUrl) }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name={typeInfo.icon} size={24} color={typeInfo.color} />
                      )}
                    </View>

                    {/* Org Name (2 Lines Max with balanced height) */}
                    <View style={{ minHeight: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 4, width: '100%' }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: '800',
                          fontSize: 13,
                          textAlign: 'center',
                          lineHeight: 18,
                        }}
                        numberOfLines={2}
                      >
                        {org.name}
                      </Text>
                    </View>

                    {/* Formatted Category Tag & Private Indicator */}
                    <View className="flex-row items-center gap-1.5 mb-2.5 flex-wrap justify-center">
                      <View
                        style={{
                          backgroundColor: typeInfo.color + '15',
                          borderColor: typeInfo.color + '30',
                          borderWidth: 1,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 12,
                          maxWidth: '100%',
                        }}
                      >
                        <Text
                          style={{ color: typeInfo.color, fontSize: 10, fontWeight: '700' }}
                          numberOfLines={1}
                        >
                          {typeInfo.label}
                        </Text>
                      </View>

                      {org.isPrivate && (
                        <View
                          style={{
                            backgroundColor: 'rgba(192, 132, 252, 0.15)',
                            borderColor: 'rgba(192, 132, 252, 0.35)',
                            borderWidth: 1,
                            paddingHorizontal: 6,
                            paddingVertical: 2.5,
                            borderRadius: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Ionicons name="lock-closed" size={9} color="#C084FC" />
                          <Text style={{ color: '#C084FC', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>
                            Private
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Transparency Score Card */}
                    <View
                      style={{
                        backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : colors.backgroundSecondary,
                        borderColor: colors.borderSubtle,
                        borderWidth: 1,
                        width: '100%',
                        borderRadius: 12,
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontSize: 8.5,
                          fontWeight: '700',
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                          marginBottom: 2,
                        }}
                      >
                        TRANSPARENCY
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="shield-checkmark" size={12} color={scoreColor} />
                        <Text style={{ color: scoreColor, fontWeight: '900', fontSize: 12.5 }}>
                          {score}%
                        </Text>
                      </View>
                    </View>

                    {/* Tap to View Hint */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 2 }}>
                      <Text style={{ color: colors.primary, fontSize: 10.5, fontWeight: '700' }}>
                        View Details
                      </Text>
                      <Ionicons name="chevron-forward" size={11} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
