import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SkeletonBalanceCard,
  SkeletonBudgetList,
  SkeletonTransactionList,
} from '../components/SkeletonLoader';
import BudgetChart from '../components/BudgetChart';
import OrgBottomSheet from '../components/OrgBottomSheet';
import { getCachedDashboard, setCachedDashboard } from '../lib/cache';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  const [budgets, setBudgets] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [personalBalance, setPersonalBalance] = useState<string>('0.0');

  const [viewMode, setViewMode] = useState<'treasury' | 'personal'>('treasury');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showOrgSheet, setShowOrgSheet] = useState(false);

  // Load cached snapshot instantly on mount (cold-start optimization)
  useEffect(() => {
    async function loadCache() {
      const cached = await getCachedDashboard();
      if (cached) {
        if (cached.organizations) setOrganizations(cached.organizations);
        if (cached.activeOrgId) setActiveOrgId(cached.activeOrgId);
        if (cached.personalBalance) setPersonalBalance(cached.personalBalance);
        if (cached.budgets) setBudgets(cached.budgets);
        if (cached.recentTransactions) setRecentTransactions(cached.recentTransactions);
        setLoadingInitial(false);
      }
    }
    loadCache();
    fetchInitialData();
  }, []);

  // Fetch content whenever activeOrgId changes
  useEffect(() => {
    if (activeOrgId) {
      fetchOrgContent(activeOrgId);
    }
  }, [activeOrgId]);

  // Live WebSocket Subscription: Auto-update on new transactions, approvals, or notifications
  useEffect(() => {
    if (!activeOrgId) return;

    const unsubTx = on('transaction_updated', (data: any) => {
      if (!data?.orgId || data.orgId === activeOrgId) {
        fetchOrgContent(activeOrgId);
        triggerLightHaptic();
      }
    });

    const unsubNotif = on('new_notification', (data: any) => {
      if (!data?.orgId || data.orgId === activeOrgId) {
        setUnreadNotifCount((prev) => prev + 1);
        triggerLightHaptic();
      }
    });

    return () => {
      unsubTx();
      unsubNotif();
    };
  }, [activeOrgId, on]);

  const fetchInitialData = async () => {
    // 1. Immediately seed from user.memberships from session
    if (user?.memberships && user.memberships.length > 0) {
      const initialOrgs = user.memberships
        .filter((m: any) => m.isActive)
        .map((m: any) => ({
          _id: m.organization?._id || m.organization,
          name: m.organization?.name || m.organizationName || 'Organization',
          subsidyAmount: m.organization?.subsidyAmount || 0,
          ...m.organization,
        }));
      if (initialOrgs.length > 0) {
        setOrganizations(initialOrgs);
        if (!activeOrgId) {
          setActiveOrgId(initialOrgs[0]._id);
        }
      }
    }

    try {
      api
        .get('/users/me/balance')
        .then((res) => {
          const bal = res.data.balance || '0.0';
          setPersonalBalance(bal);
          setCachedDashboard({ personalBalance: bal });
        })
        .catch(() => {});

      const orgRes = await api.get('/organizations');
      let orgs = orgRes.data || [];

      // If orgs is empty from /organizations, fall back to user.memberships
      if (orgs.length === 0 && user?.memberships && user.memberships.length > 0) {
        orgs = user.memberships
          .filter((m: any) => m.isActive)
          .map((m: any) => ({
            _id: m.organization?._id || m.organization,
            name: m.organization?.name || m.organizationName || 'Organization',
            subsidyAmount: m.organization?.subsidyAmount || 0,
            ...m.organization,
          }));
      }

      if (orgs.length > 0) {
        setOrganizations(orgs);
        let targetOrgId = activeOrgId;
        if (!targetOrgId || !orgs.some((o: any) => o._id === targetOrgId)) {
          targetOrgId = orgs[0]._id;
          setActiveOrgId(targetOrgId);
        }
        setCachedDashboard({ organizations: orgs, activeOrgId: targetOrgId || undefined });
      }
    } catch (err: any) {
      console.warn('Failed to fetch initial dashboard data:', err?.message || err);
    } finally {
      setLoadingInitial(false);
    }
  };

  const fetchOrgContent = async (orgId: string) => {
    setLoadingContent(true);
    try {
      const budgetRes = await api.get(`/budget?orgId=${orgId}`);
      const budgetData = budgetRes.data || [];
      setBudgets(budgetData);

      const txRes = await api.get(`/transactions?orgId=${orgId}&limit=5`);
      const txData = txRes.data.data
        ? txRes.data.data
        : Array.isArray(txRes.data)
        ? txRes.data
        : [];
      setRecentTransactions(txData);

      setCachedDashboard({
        budgets: budgetData,
        recentTransactions: txData,
      });

      api
        .get(`/notifications?orgId=${orgId}`)
        .then((res) => {
          if (res.data && res.data.notifications) {
            const unread = res.data.notifications.filter((n: any) => !n.isRead).length;
            setUnreadNotifCount(unread);
          }
        })
        .catch(() => {});
    } catch (err: any) {
      console.warn('Failed to fetch org content:', err?.message || err);
    } finally {
      setLoadingContent(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    triggerLightHaptic();
    fetchInitialData().then(() => {
      if (activeOrgId) fetchOrgContent(activeOrgId);
      setRefreshing(false);
    });
  }, [activeOrgId]);

  const activeOrg = organizations.find((o) => o._id === activeOrgId);

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Header & Org Switcher (Fixed at top) */}
      <View
        style={{
          paddingTop: (insets.top || 0) + 16,
          backgroundColor: colors.background,
        }}
        className="pb-2 px-4 z-10"
      >
        <View className="flex-row justify-between items-start mb-4">
          <View>
            <Text style={{ color: colors.textSecondary }} className="text-sm mb-1">Welcome back,</Text>
            <Text style={{ color: colors.textPrimary }} className="text-2xl font-bold">{user?.displayName}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              className="relative"
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
              {unreadNotifCount > 0 && (
                <View 
                  style={{ backgroundColor: colors.primary, borderColor: colors.background }}
                  className="absolute -top-1 -right-1 rounded-full w-4 h-4 items-center justify-center border"
                >
                  <Text className="text-[9px] text-white font-bold">{unreadNotifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary }}
              className="w-10 h-10 rounded-full border items-center justify-center overflow-hidden"
            >
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ color: colors.primary }} className="font-bold text-sm">
                  {user?.displayName
                    ? user.displayName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()
                    : 'U'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {organizations.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setShowOrgSheet(true);
            }}
            style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
            className="flex-row items-center border rounded-full px-3 py-1.5 self-start shadow-sm"
          >
            <View style={{ backgroundColor: colors.primary }} className="w-2.5 h-2.5 rounded-full mr-2" />
            <Text style={{ color: colors.textPrimary }} className="font-medium mr-2">{activeOrg?.name || 'Select Org'}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <View 
            style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
            className="px-4 py-2 rounded-full border self-start"
          >
            <Text style={{ color: colors.textMuted }} className="font-medium text-xs">No Organization</Text>
          </View>
        )}
      </View>

      {/* Main Content Area */}
      <ScrollView
        className="flex-1 px-4 mt-2"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loadingInitial && organizations.length === 0 ? (
          <View className="py-6">
            <SkeletonBalanceCard />
            <SkeletonBudgetList />
            <SkeletonTransactionList count={4} />
          </View>
        ) : activeOrg ? (
          <>
            {/* Balance Card Container */}
            {viewMode === 'treasury' ? (
              <LinearGradient
                colors={isDark ? ['#4a154b', '#1a092b', '#09090b'] : ['#86198f', '#a21caf', '#701a75']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 24, padding: 24, marginBottom: 24 }}
              >
                <Image
                  source={require('../../assets/Dashboard-Wallet.png')}
                  style={{
                    position: 'absolute',
                    right: 5,
                    top: 50,
                    width: 170,
                    height: 170,
                    opacity: 0.95,
                  }}
                  resizeMode="contain"
                />

                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row bg-black/40 p-1 rounded-xl">
                    <TouchableOpacity
                      onPress={() => setViewMode('treasury')}
                      className="px-4 py-1.5 rounded-lg bg-fuchsia-600"
                    >
                      <Text className="text-xs font-bold text-white">Treasury</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setViewMode('personal')}
                      className="px-4 py-1.5 rounded-lg"
                    >
                      <Text className="text-xs font-bold text-white/50">Personal</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="bg-white/10 w-8 h-8 rounded-lg items-center justify-center border border-white/10">
                    <Ionicons name="business" size={16} color="#e879f9" />
                  </View>
                </View>

                <Text className="text-white/70 text-[10px] mb-1 font-medium uppercase tracking-widest relative">
                  {activeOrg.name} Balance (PHP)
                </Text>

                <Text className="text-[42px] font-extrabold text-white mb-6 relative">
                  ₱{activeOrg.subsidyAmount?.toLocaleString() || '0'}
                </Text>

                <View className="flex-row items-center bg-black/30 self-start px-3 py-1.5 rounded-full border border-white/20 relative">
                  <Ionicons
                    name="shield-checkmark"
                    size={14}
                    color="#4ade80"
                    style={{ marginRight: 6 }}
                  />
                  <Text className="text-green-200 text-[10px] font-bold">Secured Vault</Text>
                </View>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={isDark ? ['#1a0b2e', '#0f0f1c'] : ['#4338ca', '#3730a3', '#1e1b4b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 24, padding: 24, marginBottom: 24 }}
              >
                <Image
                  source={require('../../assets/Matic-logo.png')}
                  style={{
                    position: 'absolute',
                    right: 5,
                    top: 45,
                    width: 205,
                    height: 205,
                    opacity: 0.95,
                  }}
                  resizeMode="contain"
                />

                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row bg-black/40 p-1 rounded-xl relative z-20">
                    <TouchableOpacity
                      onPress={() => setViewMode('treasury')}
                      className="px-4 py-1.5 rounded-lg"
                    >
                      <Text className="text-xs font-bold text-white/50">Treasury</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setViewMode('personal')}
                      className="px-4 py-1.5 rounded-lg bg-[#8b5cf6]"
                    >
                      <Text className="text-xs font-bold text-white">Personal</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="bg-white/10 w-8 h-8 rounded-lg items-center justify-center border border-white/10 relative z-20">
                    <Ionicons name="wallet" size={16} color="#fff" />
                  </View>
                </View>

                <Text className="text-white/70 text-[10px] mb-1 font-medium uppercase tracking-widest relative">
                  YOUR BALANCE (MATIC)
                </Text>

                <Text className="text-[42px] font-extrabold text-white leading-none relative">
                  {personalBalance || '0.0'}
                </Text>
                <Text className="text-[32px] font-extrabold text-[#c084fc] mb-4 relative">
                  MATIC
                </Text>

                {/* Bottom Panels */}
                <View className="flex-row justify-between border-t border-white/15 pt-4 mt-2 relative">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className="bg-white/10 w-9 h-9 rounded-xl items-center justify-center mr-2.5">
                      <Ionicons name="cube-outline" size={18} color="#c084fc" />
                    </View>
                    <View className="flex-shrink">
                      <Text className="text-white/60 text-[9px] uppercase tracking-widest mb-0.5">
                        NETWORK
                      </Text>
                      <Text
                        className="text-fuchsia-300 text-[11px] font-bold"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        Polygon Amoy
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    className="flex-row items-center flex-1 border-l border-white/15 pl-3"
                    activeOpacity={0.7}
                    onPress={async () => {
                      if (user?.walletAddress) {
                        await Clipboard.setStringAsync(user.walletAddress);
                        await triggerSuccessHaptic();
                        Alert.alert(
                          'Copied!',
                          'Your wallet address has been copied to clipboard.'
                        );
                      }
                    }}
                  >
                    <View className="bg-white/10 w-9 h-9 rounded-xl items-center justify-center mr-2.5">
                      <Ionicons name="copy-outline" size={16} color="#fff" />
                    </View>
                    <View className="flex-shrink">
                      <Text className="text-white/60 text-[9px] uppercase tracking-widest mb-0.5">
                        ADDRESS
                      </Text>
                      <Text
                        className="text-purple-200 text-[11px] font-mono"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {user?.walletAddress
                          ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                          : '0x00...000'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            )}

            {/* Quick Actions Grid */}
            <View className="flex-row justify-between mb-8">
              {[
                { icon: 'add', label: 'Request', color: colors.primary, route: 'Scanner' },
                { icon: 'send-outline', label: 'Send', color: colors.accentBlue, route: 'Transfer' },
                { icon: 'qr-code-outline', label: 'Receive', color: colors.accentPurple, route: 'Receive' },
                { icon: 'people-outline', label: 'Members', color: colors.success, route: 'Members' },
                { icon: 'time-outline', label: 'History', color: colors.warning, route: 'History' },
              ].map((action, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                  className="items-center rounded-[18px] border flex-1 mx-1 py-3.5 shadow-sm"
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerLightHaptic();
                    if (action.route === 'Scanner') {
                      navigation.navigate('MainTabs', { screen: 'Scanner' });
                    } else {
                      navigation.navigate(action.route, {
                        orgId: activeOrgId,
                        initialOrgId: activeOrgId,
                      });
                    }
                  }}
                >
                  <Ionicons
                    name={action.icon as any}
                    size={22}
                    color={action.color}
                    style={{ marginBottom: 6 }}
                  />
                  <Text style={{ color: colors.textPrimary }} className="text-[10px] font-semibold" numberOfLines={1}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Visual Budget Utilization Chart */}
            {budgets.length > 0 && <BudgetChart budgets={budgets} currency="₱" />}

            {/* Budgets Progress Section */}
            <View className="mb-8">
              <View className="flex-row justify-between items-center mb-4">
                <Text style={{ color: colors.textPrimary }} className="font-bold text-lg">Category Budgets</Text>
              </View>

              {loadingContent && budgets.length === 0 ? (
                <SkeletonBudgetList />
              ) : budgets.length > 0 ? (
                budgets.map((b: any) => {
                  const spent = b.spentAmount || b.spent || 0;
                  const total = b.allocatedAmount || b.amount || 0;
                  const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
                  const isHigh = pct >= 85;

                  return (
                    <View
                      key={b._id || b.category}
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      className="p-4 rounded-[20px] border mb-3 shadow-sm"
                    >
                      <View className="flex-row justify-between items-center mb-2">
                        <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">{b.category}</Text>
                        <Text style={{ color: colors.textSecondary }} className="text-xs font-semibold">
                          ₱{spent.toLocaleString()} / ₱{total.toLocaleString()}
                        </Text>
                      </View>

                      {/* Progress Bar */}
                      <View 
                        style={{ backgroundColor: colors.cardGlass }}
                        className="h-2 rounded-full overflow-hidden mb-2"
                      >
                        <View
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isHigh ? colors.error : colors.primary,
                            height: '100%',
                            borderRadius: 4,
                          }}
                        />
                      </View>

                      <View className="flex-row justify-between items-center">
                        <Text style={{ color: colors.textMuted }} className="text-[10px]">{pct}% utilized</Text>
                        {isHigh && (
                          <Text style={{ color: colors.error }} className="text-[10px] font-bold">
                            Approaching Limit
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View 
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="p-4 rounded-[20px] border items-center"
                >
                  <Text style={{ color: colors.textMuted }} className="text-sm">No budget categories defined.</Text>
                </View>
              )}
            </View>

            {/* Recent Activity */}
            <View className="mb-2 mt-2">
              <View className="flex-row justify-between items-end mb-4">
                <Text style={{ color: colors.textPrimary }} className="text-xl font-bold tracking-tight">Recent Activity</Text>
                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() => navigation.navigate('History', { orgId: activeOrgId })}
                >
                  <Text style={{ color: colors.primary }} className="text-xs font-bold mr-1">View All</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {loadingContent && recentTransactions.length === 0 ? (
                <SkeletonTransactionList count={3} />
              ) : recentTransactions.length > 0 ? (
                recentTransactions.map((tx: any) => (
                  <TouchableOpacity
                    key={tx._id}
                    onPress={() => navigation.navigate('TransactionDetail', { txId: tx._id })}
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    className="p-4 rounded-[20px] border mb-3 flex-row items-center justify-between shadow-sm"
                  >
                    <View className="flex-row items-center flex-1">
                      <View 
                        style={{
                          backgroundColor: tx.type === 'expense' ? colors.errorBg : colors.successBg,
                          borderColor: tx.type === 'expense' ? colors.errorBorder : colors.successBorder,
                        }}
                        className="w-11 h-11 rounded-2xl items-center justify-center mr-3 border"
                      >
                        <Ionicons
                          name={tx.type === 'expense' ? 'arrow-up-outline' : 'arrow-down-outline'}
                          size={18}
                          color={tx.type === 'expense' ? colors.error : colors.success}
                        />
                      </View>
                      <View className="flex-1 pr-2">
                        <Text style={{ color: colors.textPrimary }} className="font-bold text-sm mb-0.5" numberOfLines={1}>
                          {tx.description}
                        </Text>
                        <Text style={{ color: colors.textMuted }} className="text-[10px]">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{ color: tx.type === 'expense' ? colors.textPrimary : colors.success }}
                      className="font-bold text-sm"
                    >
                      {tx.type === 'expense' ? '-' : '+'}₱{tx.amount?.toLocaleString() || '0'}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View 
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="p-4 rounded-[20px] border items-center"
                >
                  <Text style={{ color: colors.textMuted }} className="text-sm">No recent activity.</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="p-6 rounded-3xl border items-center justify-center mt-10 shadow-sm"
          >
            <Ionicons name="business" size={40} color={colors.textMuted} className="mb-4" />
            <Text style={{ color: colors.textPrimary }} className="text-center font-bold text-lg">No Organization Found</Text>
            <Text style={{ color: colors.textSecondary }} className="text-center text-sm mt-2">
              Ask your founder to invite you via email, or create one on the desktop portal.
            </Text>
          </View>
        )}

        <View className="h-10" />
      </ScrollView>

      {/* Organization Switcher Bottom Sheet */}
      <OrgBottomSheet
        visible={showOrgSheet}
        onClose={() => setShowOrgSheet(false)}
        organizations={organizations}
        activeOrgId={activeOrgId}
        onSelectOrg={(orgId) => setActiveOrgId(orgId)}
      />
    </View>
  );
}
