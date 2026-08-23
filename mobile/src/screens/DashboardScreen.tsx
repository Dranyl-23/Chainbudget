import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  ImageBackground,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

  const activeOrgIdRef = useRef<string | null>(activeOrgId);
  useEffect(() => { activeOrgIdRef.current = activeOrgId; }, [activeOrgId]);

  const fetchPersonalBalance = async () => {
    try {
      const res = await api.get('/users/me/balance');
      const bal = res.data.balance || '0.0';
      setPersonalBalance(bal);
      setCachedDashboard({ personalBalance: bal });
    } catch {
      // Balance is non-critical; fail silently
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
      const txData =
        txRes.data.transactions ||
        txRes.data.data ||
        (Array.isArray(txRes.data) ? txRes.data : []);
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
    const currentOrgId = activeOrgIdRef.current;
    Promise.all([
      fetchPersonalBalance(),
      currentOrgId ? fetchOrgContent(currentOrgId) : Promise.resolve(),
    ]).finally(() => {
      setRefreshing(false);
    });
  }, []);

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
              <View
                style={{
                  borderRadius: 26,
                  overflow: 'hidden',
                  marginBottom: 24,
                  backgroundColor: '#2A0845',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(147, 51, 234, 0.25)',
                  shadowColor: '#8B5CF6',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isDark ? 0.45 : 0.18,
                  shadowRadius: 16,
                  elevation: 6,
                }}
              >
                <ImageBackground
                  source={require('../../assets/treasury-card-clean.png')}
                  resizeMode="cover"
                  style={{
                    padding: 22,
                    minHeight: 215,
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Top Bar: Segmented Pill Toggle + Org Icon Button */}
                  <View className="flex-row justify-between items-center mb-3">
                    <View
                      style={{
                        backgroundColor: 'rgba(15, 6, 32, 0.75)',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        borderWidth: 1,
                        borderRadius: 24,
                        padding: 3,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setViewMode('treasury')}
                        style={{
                          backgroundColor: '#9333EA',
                          borderRadius: 20,
                          paddingHorizontal: 16,
                          paddingVertical: 7,
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>Treasury</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setViewMode('personal')}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 20,
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12.5, fontWeight: '600' }}>Personal</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => setShowOrgSheet(true)}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.12)',
                        borderColor: 'rgba(255, 255, 255, 0.18)',
                        borderWidth: 1,
                        borderRadius: 14,
                        width: 42,
                        height: 42,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="business" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {/* Middle: Organization Balance Display */}
                  <View style={{ marginVertical: 4 }}>
                    <View style={{ maxWidth: '58%' }}>
                      <Text
                        style={{
                          color: 'rgba(216, 180, 254, 0.95)',
                          fontSize: 11,
                          fontWeight: '800',
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                          lineHeight: 15,
                          marginBottom: 2,
                        }}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {activeOrg.name}
                      </Text>
                      <Text
                        style={{
                          color: 'rgba(255, 255, 255, 0.65)',
                          fontSize: 9.5,
                          fontWeight: '700',
                          letterSpacing: 1.2,
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        Treasury Balance (PHP)
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text
                        style={{
                          fontSize: 32,
                          fontWeight: '800',
                          color: '#FFFFFF',
                          marginTop: 6,
                          marginRight: 4,
                        }}
                      >
                        ₱
                      </Text>
                      <AnimatedCounter
                        value={Number(activeOrg.subsidyAmount) || 0}
                        prefix=""
                        style={{
                          fontSize: 52,
                          fontWeight: '900',
                          color: '#FFFFFF',
                          letterSpacing: -1.5,
                          fontVariant: ['tabular-nums'],
                        }}
                      />
                    </View>
                  </View>

                  {/* Bottom: Secured Vault Pill Badge */}
                  <View
                    style={{
                      backgroundColor: 'rgba(15, 6, 32, 0.75)',
                      borderColor: 'rgba(168, 85, 247, 0.3)',
                      borderWidth: 1,
                      borderRadius: 22,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      marginTop: 8,
                    }}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={15}
                      color="#10B981"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Secured Vault</Text>
                  </View>
                </ImageBackground>
              </View>
            ) : (
              <View
                style={{
                  borderRadius: 26,
                  overflow: 'hidden',
                  marginBottom: 24,
                  backgroundColor: '#1E1B4B',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(147, 51, 234, 0.25)',
                  shadowColor: '#8B5CF6',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isDark ? 0.45 : 0.18,
                  shadowRadius: 16,
                  elevation: 6,
                }}
              >
                <ImageBackground
                  source={require('../../assets/personal-card-clean.png')}
                  resizeMode="cover"
                  style={{
                    padding: 20,
                    minHeight: 225,
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Top Bar: Segmented Pill Toggle + Wallet Icon Button */}
                  <View className="flex-row justify-between items-center mb-3">
                    <View
                      style={{
                        backgroundColor: 'rgba(15, 6, 32, 0.75)',
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        borderWidth: 1,
                        borderRadius: 24,
                        padding: 3,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setViewMode('treasury')}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 20,
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12.5, fontWeight: '600' }}>Treasury</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setViewMode('personal')}
                        style={{
                          backgroundColor: '#9333EA',
                          borderRadius: 20,
                          paddingHorizontal: 16,
                          paddingVertical: 7,
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>Personal</Text>
                      </TouchableOpacity>
                    </View>

                    <View
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.12)',
                        borderColor: 'rgba(255, 255, 255, 0.18)',
                        borderWidth: 1,
                        borderRadius: 14,
                        width: 42,
                        height: 42,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="wallet" size={18} color="#FFFFFF" />
                    </View>
                  </View>

                  {/* Middle: MATIC Balance Display */}
                  <View style={{ marginVertical: 2 }}>
                    <Text
                      style={{
                        color: 'rgba(216, 180, 254, 0.9)',
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        marginBottom: 2,
                      }}
                    >
                      YOUR BALANCE (MATIC)
                    </Text>

                    <AnimatedCounter
                      value={Number(personalBalance) || 0}
                      prefix=""
                      style={{
                        fontSize: 52,
                        fontWeight: '900',
                        color: '#FFFFFF',
                        letterSpacing: -1.5,
                        fontVariant: ['tabular-nums'],
                      }}
                    />
                    <Text
                      style={{
                        color: '#C084FC',
                        fontSize: 26,
                        fontWeight: '900',
                        letterSpacing: 0.5,
                        marginTop: 2,
                      }}
                    >
                      MATIC
                    </Text>
                  </View>

                  {/* Bottom Panels (Network & Copy Address) */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 10,
                      gap: 8,
                    }}
                  >
                    {/* Left: Network pill */}
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: 'rgba(15, 6, 32, 0.75)',
                        borderColor: 'rgba(168, 85, 247, 0.25)',
                        borderWidth: 1,
                        borderRadius: 16,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: 'rgba(147, 51, 234, 0.25)',
                          borderRadius: 10,
                          width: 32,
                          height: 32,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                        }}
                      >
                        <Ionicons name="cube-outline" size={17} color="#C084FC" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 8.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                          NETWORK
                        </Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' }} numberOfLines={1}>
                          Polygon Amoy
                        </Text>
                      </View>
                    </View>

                    {/* Right: Address pill with copy */}
                    <TouchableOpacity
                      style={{
                        flex: 1.3,
                        backgroundColor: 'rgba(15, 6, 32, 0.75)',
                        borderColor: 'rgba(168, 85, 247, 0.25)',
                        borderWidth: 1,
                        borderRadius: 16,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                      activeOpacity={0.7}
                      onPress={async () => {
                        if (user?.walletAddress) {
                          await Clipboard.setStringAsync(user.walletAddress);
                          showToast('Wallet address copied to clipboard!', 'info');
                        }
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: 'rgba(147, 51, 234, 0.25)',
                          borderRadius: 10,
                          width: 32,
                          height: 32,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                        }}
                      >
                        <Ionicons name="document-text-outline" size={17} color="#C084FC" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 8.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                          ADDRESS
                        </Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '700', fontFamily: 'monospace' }} numberOfLines={1}>
                          {user?.walletAddress
                            ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                            : '0x00...000'}
                        </Text>
                      </View>
                      <Ionicons name="copy-outline" size={15} color="rgba(255, 255, 255, 0.6)" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                </ImageBackground>
              </View>
            )}

            {/* ── PRIMARY ACTION BAR (4 CORE ACTIONS) ── */}
            <View
              style={{
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                borderWidth: 1,
                borderRadius: 24,
                paddingVertical: 14,
                paddingHorizontal: 8,
                marginBottom: 20,
                flexDirection: 'row',
                justifyContent: 'space-around',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.25 : 0.05,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              {[
                {
                  id: 'request',
                  label: 'Request',
                  icon: 'paper-plane',
                  color: '#0284C7',
                  bgColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#E0F2FE',
                  onPress: () => navigation.navigate('Transfer', { orgId: activeOrgId }),
                },
                {
                  id: 'receive',
                  label: 'Receive',
                  icon: 'qr-code',
                  color: '#7C3AED',
                  bgColor: isDark ? 'rgba(124, 58, 237, 0.15)' : '#EDE9FE',
                  onPress: () => navigation.navigate('Receive', { orgId: activeOrgId }),
                },
                {
                  id: 'scan',
                  label: 'Scan QR',
                  icon: 'scan',
                  color: '#9333EA',
                  bgColor: isDark ? 'rgba(147, 51, 234, 0.15)' : '#F5EEFC',
                  onPress: () => navigation.navigate('MainTabs', { screen: 'Scanner', params: { orgId: activeOrgId } }),
                },
                {
                  id: 'history',
                  label: 'History',
                  icon: 'time',
                  color: '#F59E0B',
                  bgColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                  onPress: () => navigation.navigate('History', { orgId: activeOrgId }),
                },
              ].map((action) => (
                <TouchableOpacity
                  key={action.id}
                  onPress={() => {
                    triggerLightHaptic();
                    action.onPress();
                  }}
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', minWidth: 68 }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 20,
                      backgroundColor: action.bgColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: action.color + '30',
                    }}
                  >
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 12,
                      fontWeight: '700',
                      textAlign: 'center',
                      includeFontPadding: false,
                    }}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── DAO & MANAGEMENT TOOLS (2x2 FEATURE HUB) ── */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11.5,
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: 1.2,
                  }}
                >
                  DAO & Management Tools
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {[
                  {
                    id: 'budget',
                    title: 'Budget Tracker',
                    subtitle: 'Limits & allocations',
                    icon: 'pie-chart-outline',
                    color: '#0D9488',
                    bgColor: isDark ? 'rgba(13, 148, 136, 0.15)' : '#CCFBF1',
                    route: 'Budget',
                  },
                  {
                    id: 'members',
                    title: 'DAO Members',
                    subtitle: 'Soulbound IDs & roles',
                    icon: 'people-outline',
                    color: '#10B981',
                    bgColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
                    route: 'Members',
                  },
                  {
                    id: 'treasury',
                    title: 'Treasury Vault',
                    subtitle: 'Subsidies & balances',
                    icon: 'business-outline',
                    color: '#EA580C',
                    bgColor: isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFEDD5',
                    route: 'Treasury',
                  },
                  {
                    id: 'audit',
                    title: 'Audit & Reports',
                    subtitle: 'On-chain proof & logs',
                    icon: 'shield-checkmark-outline',
                    color: '#2563EB',
                    bgColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#DBEAFE',
                    route: 'Audit',
                  },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      triggerLightHaptic();
                      navigation.navigate(item.route, { orgId: activeOrgId });
                    }}
                    activeOpacity={0.75}
                    style={{
                      width: '48.4%',
                      backgroundColor: isDark ? colors.surface : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      borderWidth: 1,
                      borderRadius: 20,
                      padding: 16,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: isDark ? 0.2 : 0.04,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor: item.bgColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: item.color + '30',
                      }}
                    >
                      <Ionicons name={item.icon as any} size={22} color={item.color} />
                    </View>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                        fontWeight: '700',
                        marginBottom: 3,
                        includeFontPadding: false,
                      }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 11,
                        includeFontPadding: false,
                      }}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
                  const spent = b.spent ?? b.spentAmount ?? 0;
                  const total = b.allocated ?? b.allocatedAmount ?? b.amount ?? 0;
                  const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
                  const isHigh = pct >= 85;

                  return (
                    <View
                      key={b._id || b.name || b.category}
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      className="p-4 rounded-[20px] border mb-3 shadow-sm"
                    >
                      <View className="flex-row justify-between items-center mb-2">
                        <Text style={{ color: colors.textPrimary }} className="font-bold text-sm">{b.name || b.category}</Text>
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
