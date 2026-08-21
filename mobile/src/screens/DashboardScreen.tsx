import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
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
import AnimatedCounter from '../components/AnimatedCounter';
import ScaleButton from '../components/ScaleButton';
import { getCachedDashboard, setCachedDashboard } from '../lib/cache';
import { registerForPushNotifications } from '../lib/notifications';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();
  const { organizations, activeOrgId, setActiveOrgId } = useOrg();
  const { showToast } = useToast();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();

  // Dynamic layout calculations for responsive grid sizing across devices
  const numColumns = screenWidth >= 600 ? 4 : 3;
  const gridGap = 10;
  const totalPadding = 32; // px-4 (16 left + 16 right)
  const itemWidth = Math.floor((screenWidth - totalPadding - (numColumns - 1) * gridGap) / numColumns);


  const [budgets, setBudgets] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [personalBalance, setPersonalBalance] = useState<string>('0.0');

  const [viewMode, setViewMode] = useState<'treasury' | 'personal'>('treasury');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showOrgSheet, setShowOrgSheet] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load cached snapshot instantly on mount (cold-start optimization)
  useEffect(() => {
    async function loadCache() {
      const cached = await getCachedDashboard();
      if (cached) {
        if (cached.personalBalance) setPersonalBalance(cached.personalBalance);
        if (cached.budgets) setBudgets(cached.budgets);
        if (cached.recentTransactions) setRecentTransactions(cached.recentTransactions);
        setLoadingInitial(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      }
    }
    loadCache();
    fetchPersonalBalance();

    // Register push token on first dashboard load (after successful login)
    registerForPushNotifications().catch(() => {
      // Silently ignore — push is optional, not critical
    });
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

  const fetchPersonalBalance = async () => {
    try {
      api
        .get('/users/me/balance')
        .then((res) => {
          const bal = res.data.balance || '0.0';
          setPersonalBalance(bal);
          setCachedDashboard({ personalBalance: bal });
        })
        .catch(() => {});
    } finally {
      setLoadingInitial(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
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
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    triggerLightHaptic();
    fetchPersonalBalance().then(() => {
      if (activeOrgId) fetchOrgContent(activeOrgId);
      setRefreshing(false);
    });
  }, [activeOrgId]);

  const activeOrg = organizations.find((o) => o._id === activeOrgId);

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Top App Bar */}
      <View 
        style={{ 
          paddingTop: (insets.top || 0) + 16,
          backgroundColor: colors.background,
          borderBottomColor: colors.borderSubtle,
        }}
        className="pb-4 px-4 border-b z-10"
      >
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} className="w-10 h-10 rounded-full mr-3 border" style={{ borderColor: colors.primary }} />
            ) : (
              <View 
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="w-10 h-10 rounded-full border items-center justify-center mr-3 shadow-sm"
              >
                <Text style={{ color: colors.primary }} className="font-extrabold text-base">
                  {user?.displayName?.slice(0, 2).toUpperCase() || 'CB'}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ color: colors.textMuted }} className="text-xs font-semibold uppercase tracking-wider">Welcome back,</Text>
              <Text style={{ color: colors.textPrimary }} className="text-base font-bold">{user?.displayName || 'User'}</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity 
              onPress={() => {
                triggerLightHaptic();
                navigation.navigate('Notifications');
              }}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="w-10 h-10 rounded-full border items-center justify-center shadow-sm relative"
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="View notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {unreadNotifCount > 0 && (
                <View 
                  style={{ backgroundColor: colors.error }}
                  className="w-2.5 h-2.5 rounded-full absolute top-2 right-2 border-2 border-slate-900" 
                />
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
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Switch organization. Current organization: ${activeOrg?.name || 'Select Org'}`}
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
          <Animated.View style={{ opacity: fadeAnim }}>
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

                <AnimatedCounter
                  value={Number(activeOrg.subsidyAmount) || 0}
                  prefix="₱"
                  className="text-[42px] font-extrabold text-white mb-6 relative"
                />

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

                <AnimatedCounter
                  value={Number(personalBalance) || 0}
                  prefix=""
                  className="text-[42px] font-extrabold text-white leading-none relative"
                />
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
                        showToast('Wallet address copied to clipboard!', 'info');
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gridGap, marginBottom: 24 }}>
              {[
                { icon: 'scan-outline', label: 'Scan', color: colors.primary, route: 'Scanner' },
                { icon: 'send-outline', label: 'Request', color: colors.accentBlue, route: 'Transfer' },
                { icon: 'qr-code-outline', label: 'Receive', color: colors.accentPurple, route: 'Receive' },
                { icon: 'people-outline', label: 'Members', color: colors.success, route: 'Members' },
                { icon: 'time-outline', label: 'History', color: colors.warning, route: 'History' },
                { icon: 'pie-chart-outline', label: 'Budget', color: '#10B981', route: 'Budget' },
                { icon: 'bar-chart-outline', label: 'Reports', color: '#3B82F6', route: 'Reports' },
                { icon: 'shield-checkmark-outline', label: 'Audit', color: '#8B5CF6', route: 'Audit' },
                { icon: 'business-outline', label: 'Treasury', color: '#F59E0B', route: 'Treasury' },
              ].map((action, idx) => (
                <ScaleButton
                  key={idx}
                  containerStyle={{ width: itemWidth, marginBottom: 2 }}
                  style={{
                    width: '100%',
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 20,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDark ? 0.2 : 0.05,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                  onPress={() => {
                    if (action.route === 'Scanner') {
                      navigation.navigate('MainTabs', { screen: 'Scanner', params: { orgId: activeOrgId } });
                    } else {
                      navigation.navigate(action.route, { orgId: activeOrgId });
                    }
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick action: ${action.label}`}
                >
                  <View
                    style={{
                      backgroundColor: action.color + '15',
                      borderColor: action.color + '30',
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                      borderWidth: 1,
                    }}
                  >
                    <Ionicons name={action.icon as any} size={22} color={action.color} />
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                    {action.label}
                  </Text>
                </ScaleButton>
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
          </Animated.View>
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
