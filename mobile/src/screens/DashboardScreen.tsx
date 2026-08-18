import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, FlatList, ActivityIndicator, Image, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  
  const [budgets, setBudgets] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [personalBalance, setPersonalBalance] = useState<string>('0.0');
  
  const [viewMode, setViewMode] = useState<'treasury' | 'personal'>('treasury');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch content whenever activeOrgId changes
  useEffect(() => {
    if (activeOrgId) {
      fetchOrgContent(activeOrgId);
    }
  }, [activeOrgId]);

  const fetchInitialData = async () => {
    try {
      api.get('/users/me/balance').then(res => setPersonalBalance(res.data.balance || '0.0')).catch(() => {});

      const orgRes = await api.get('/organizations');
      setOrganizations(orgRes.data);

      if (orgRes.data.length > 0 && !activeOrgId) {
        setActiveOrgId(orgRes.data[0]._id);
      }
    } catch (err: any) {
      console.warn("Failed to fetch initial dashboard data:", err?.message || err);
    }
  };

  const fetchOrgContent = async (orgId: string) => {
    setLoadingContent(true);
    try {
      const budgetRes = await api.get(`/budget?orgId=${orgId}`);
      setBudgets(budgetRes.data);

      const txRes = await api.get(`/transactions?orgId=${orgId}&limit=5`);
      const txData = txRes.data.data ? txRes.data.data : (Array.isArray(txRes.data) ? txRes.data : []);
      setRecentTransactions(txData.slice(0, 5));

      api.get(`/notifications?orgId=${orgId}`).then(res => {
        if (res.data && res.data.notifications) {
          const unread = res.data.notifications.filter((n: any) => !n.isRead).length;
          setUnreadNotifCount(unread);
        }
      }).catch(() => {});
    } catch (err: any) {
      console.warn("Failed to fetch org content:", err?.message || err);
    } finally {
      setLoadingContent(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchInitialData().then(() => {
      if (activeOrgId) fetchOrgContent(activeOrgId);
      setRefreshing(false);
    });
  }, [activeOrgId]);

  const activeOrg = organizations.find(o => o._id === activeOrgId);

  return (
    <View className="flex-1 bg-[#09090b]">
      {/* Header & Org Switcher (Fixed at top) */}
      <View 
        style={{ paddingTop: (insets.top || 0) + 16 }}
        className="pb-2 px-4 bg-[#09090b] z-10"
      >
        <View className="flex-row justify-between items-start mb-4">
          <View>
            <Text className="text-white/60 text-sm mb-1">Welcome back,</Text>
            <Text className="text-2xl font-bold text-white">{user?.displayName}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity className="relative" onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={24} color="white" />
              {unreadNotifCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-fuchsia-500 rounded-full w-4 h-4 items-center justify-center border border-[#09090b]">
                  <Text className="text-[9px] text-white font-bold">{unreadNotifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} className="w-10 h-10 rounded-full bg-indigo-900 border border-fuchsia-500 items-center justify-center overflow-hidden">
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text className="text-white font-bold text-sm">
                  {user?.displayName ? user.displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {organizations.length > 0 ? (
          <TouchableOpacity 
            onPress={() => setShowOrgDropdown(true)}
            className="flex-row items-center bg-white/5 border border-white/10 rounded-full px-3 py-1.5 self-start"
          >
            <View className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 mr-2" />
            <Text className="text-white font-medium mr-2">{activeOrg?.name || 'Select Org'}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        ) : (
          <View className="px-4 py-2 rounded-full bg-white/5 border border-white/10 self-start">
            <Text className="text-white/40 font-medium text-xs">No Organization</Text>
          </View>
        )}
      </View>

      <ScrollView 
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e879f9" />}
      >
        {activeOrg ? (
          <>
            {/* Main Balance Card */}
            {viewMode === 'treasury' ? (
              <LinearGradient
                colors={['#2e1065', '#170f36']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 24, padding: 24, marginBottom: 24 }}
              >
                <Image 
                  source={require('../../assets/Dashboard-Wallet.png')}
                  style={{ position: 'absolute', right: 5, top: 50, width: 170, height: 170, opacity: 1 }}
                  resizeMode="contain"
                />
                
                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row bg-black/40 p-1 rounded-xl">
                    <TouchableOpacity onPress={() => setViewMode('treasury')} className="px-4 py-1.5 rounded-lg bg-fuchsia-600">
                      <Text className="text-xs font-bold text-white">Treasury</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setViewMode('personal')} className="px-4 py-1.5 rounded-lg">
                      <Text className="text-xs font-bold text-white/50">Personal</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="bg-white/10 w-8 h-8 rounded-lg items-center justify-center border border-white/10">
                    <Ionicons name="business" size={16} color="#e879f9" />
                  </View>
                </View>

                <Text className="text-white/60 text-[10px] mb-1 font-medium uppercase tracking-widest relative">
                  {activeOrg.name} Balance (PHP)
                </Text>
                
                <Text className="text-[42px] font-extrabold text-white mb-6 relative">
                  ₱{activeOrg.subsidyAmount?.toLocaleString() || "0"}
                </Text>

                <View className="flex-row items-center bg-blue-900/40 self-start px-3 py-1.5 rounded-full border border-blue-500/30 relative">
                  <Ionicons name="shield-checkmark" size={14} color="#60a5fa" style={{ marginRight: 6 }} />
                  <Text className="text-blue-200 text-[10px] font-bold">Secured & Non-custodial</Text>
                </View>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={['#1a0b2e', '#0f0f1c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 24, padding: 24, marginBottom: 24 }}
              >
                <Image 
                  source={require('../../assets/Matic-logo.png')}
                  style={{ position: 'absolute', right: -5, top: 55, width: 210, height: 210, opacity: 1 }}
                  resizeMode="contain"
                />
                
                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row bg-black/40 p-1 rounded-xl relative z-20">
                    <TouchableOpacity onPress={() => setViewMode('treasury')} className="px-4 py-1.5 rounded-lg">
                      <Text className="text-xs font-bold text-white/50">Treasury</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setViewMode('personal')} className="px-4 py-1.5 rounded-lg bg-[#8b5cf6]">
                      <Text className="text-xs font-bold text-white">Personal</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="bg-white/10 w-8 h-8 rounded-lg items-center justify-center border border-white/10 relative z-20">
                    <Ionicons name="wallet" size={16} color="#fff" />
                  </View>
                </View>

                <Text className="text-white/60 text-[10px] mb-1 font-medium uppercase tracking-widest relative">
                  YOUR BALANCE (MATIC)
                </Text>
                
                <Text className="text-[42px] font-extrabold text-white leading-none relative">
                  {personalBalance || "0.0"}
                </Text>
                <Text className="text-[32px] font-extrabold text-[#8b5cf6] mb-4 relative">
                  MATIC
                </Text>

                <View className="flex-row items-center bg-white/5 self-start px-3 py-1.5 rounded-full mb-6 relative">
                  <Ionicons name="trending-up" size={14} color="#8b5cf6" style={{ marginRight: 6 }} />
                  <Text className="text-white text-[10px] font-bold">₱0.00 PHP</Text>
                </View>

                {/* Bottom Panels */}
                <View className="flex-row justify-between border-t border-white/10 pt-4 mt-2 relative">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className="bg-white/10 w-9 h-9 rounded-xl items-center justify-center mr-2.5">
                      <Ionicons name="cube-outline" size={18} color="#c084fc" />
                    </View>
                    <View className="flex-shrink">
                      <Text className="text-white/50 text-[9px] uppercase tracking-widest mb-0.5">NETWORK</Text>
                      <Text className="text-fuchsia-400 text-[11px] font-bold" numberOfLines={1} adjustsFontSizeToFit>Polygon Mainnet</Text>
                    </View>
                  </View>
                  
                  <View className="flex-row items-center flex-1 border-l border-white/10 pl-3">
                    <View className="bg-white/10 w-9 h-9 rounded-xl items-center justify-center mr-2.5">
                      <Ionicons name="copy-outline" size={16} color="#fff" />
                    </View>
                    <View className="flex-shrink">
                      <Text className="text-white/50 text-[9px] uppercase tracking-widest mb-0.5">ADDRESS</Text>
                      <Text className="text-purple-300 text-[11px] font-mono" numberOfLines={1} adjustsFontSizeToFit>
                        {user?.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : '0x00...000'}
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            )}

            {/* Quick Actions Grid */}
            <View className="flex-row justify-between mb-8">
              {[
                { icon: 'add', label: 'Request', color: '#e879f9', route: 'Scanner' },
                { icon: 'people-outline', label: 'Members', color: '#34d399', route: 'Members' },
                { icon: 'send-outline', label: 'Send', color: '#3b82f6', route: 'Transfer' },
                { icon: 'time-outline', label: 'History', color: '#f59e0b', route: 'History' },
              ].map((action, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  className="items-center bg-[#15151e] rounded-[20px] border border-white/5" 
                  style={{ width: '23%', paddingVertical: 18 }}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (action.route === 'Scanner') {
                      navigation.navigate('MainTabs', { screen: 'Scanner' });
                    } else {
                      navigation.navigate(action.route, { orgId: activeOrgId });
                    }
                  }}
                >
                  <Ionicons name={action.icon as any} size={28} color={action.color} style={{ marginBottom: 10 }} />
                  <Text className="text-white/80 text-[11px] font-medium">{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Budgets Section */}
            <View className="mb-8">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-white font-bold text-lg">Budget Progress</Text>
                <TouchableOpacity 
                  className="flex-row items-center"
                  onPress={() => Alert.alert("Coming Soon", "Full budget analytics view is coming in a future update!")}
                >
                  <Text className="text-fuchsia-400 text-[11px] font-bold mr-1">View All</Text>
                  <Ionicons name="chevron-forward" size={12} color="#e879f9" />
                </TouchableOpacity>
              </View>

              {loadingContent ? (
                <ActivityIndicator color="#e879f9" />
              ) : budgets.length > 0 ? (
                budgets.map((budget: any, index: number) => {
                  const percent = budget.allocated > 0 ? Math.min((budget.spent / budget.allocated) * 100, 100) : 0;
                  const icons = [
                    { name: 'shield-checkmark-outline', color: '#e879f9', bg: 'rgba(232, 121, 249, 0.1)' },
                    { name: 'calendar-outline', color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)' },
                    { name: 'megaphone-outline', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
                    { name: 'cube-outline', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
                  ];
                  const visual = icons[index % icons.length];

                  return (
                    <TouchableOpacity key={budget._id} activeOpacity={0.7} className="bg-[#15151e] p-4 rounded-[20px] border border-white/5 mb-3 flex-row items-center">
                      <View 
                        style={{ backgroundColor: visual.bg, width: 44, height: 44, borderRadius: 14 }} 
                        className="items-center justify-center mr-4"
                      >
                        <Ionicons name={visual.name as any} size={22} color={visual.color} />
                      </View>
                      
                      <View className="flex-1 mr-2">
                        <View className="flex-row justify-between mb-2">
                          <Text className="text-white font-bold text-sm">{budget.name}</Text>
                          <Text className="text-white/60 text-[10px] font-mono">₱{budget.spent} / ₱{budget.allocated}</Text>
                        </View>
                        <View className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden mb-1.5">
                          <View 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${percent}%`, 
                              backgroundColor: visual.color
                            }} 
                          />
                        </View>
                        <Text style={{ color: visual.color, fontSize: 10, fontWeight: '700' }}>
                          {percent.toFixed(0)}%
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View className="bg-[#15151e] p-4 rounded-[20px] border border-white/5 items-center">
                  <Text className="text-white/40 text-sm">No budget categories defined.</Text>
                </View>
              )}
            </View>

            {/* Recent Activity */}
            <View className="mb-2 mt-6">
              <View className="flex-row justify-between items-end mb-4">
                <Text className="text-xl font-bold text-white tracking-tight">Recent Activity</Text>
                <TouchableOpacity 
                  className="flex-row items-center"
                  onPress={() => navigation.navigate('History', { orgId: activeOrgId })}
                >
                  <Text className="text-fuchsia-400 text-xs font-bold mr-1">View All</Text>
                  <Ionicons name="chevron-forward" size={12} color="#e879f9" />
                </TouchableOpacity>
              </View>

              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx: any) => (
                  <TouchableOpacity key={tx._id} className="bg-[#15151e] p-4 rounded-[20px] border border-white/5 mb-3 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View className="w-11 h-11 rounded-2xl bg-black/40 items-center justify-center mr-3 border border-white/5">
                        <Ionicons 
                          name={tx.type === 'expense' ? 'arrow-up-outline' : 'arrow-down-outline'} 
                          size={18} 
                          color={tx.type === 'expense' ? '#f43f5e' : '#10b981'} 
                        />
                      </View>
                      <View className="flex-1 pr-2">
                        <Text className="text-white font-bold text-sm mb-0.5" numberOfLines={1}>{tx.description}</Text>
                        <Text className="text-white/40 text-[10px]">{new Date(tx.createdAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <Text className={`font-bold text-sm ${tx.type === 'expense' ? 'text-white' : 'text-emerald-400'}`}>
                      {tx.type === 'expense' ? '-' : '+'}₱{tx.amount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View className="bg-[#15151e] p-4 rounded-[20px] border border-white/5 items-center">
                  <Text className="text-white/40 text-sm">No recent activity.</Text>
                </View>
              )}
            </View>
            
          </>
        ) : (
          <View className="bg-white/5 p-6 rounded-3xl border border-white/10 items-center justify-center mt-10">
            <Ionicons name="business" size={40} color="#666" className="mb-4" />
            <Text className="text-white text-center font-bold text-lg">No Organization Found</Text>
            <Text className="text-white/50 text-center text-sm mt-2">Ask your founder to invite you via email, or create one on the desktop portal.</Text>
          </View>
        )}
        
        <View className="h-10" />
      </ScrollView>

      {/* Organization Switcher Dropdown Modal */}
      <Modal visible={showOrgDropdown} transparent animationType="fade">
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setShowOrgDropdown(false)}
          className="flex-1 bg-black/60"
        >
          {/* Position the dropdown box near the top left, right under the header */}
          <View 
            style={{ marginTop: (insets.top || 0) + 90, marginLeft: 16 }}
            className="w-56 bg-[#1a1a24] rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
          >
            {organizations.map((org, index) => {
              const isActive = org._id === activeOrgId;
              return (
                <TouchableOpacity
                  key={org._id}
                  onPress={() => {
                    setActiveOrgId(org._id);
                    setShowOrgDropdown(false);
                  }}
                  className={`px-4 py-4 flex-row items-center justify-between ${index !== organizations.length - 1 ? 'border-b border-white/5' : ''}`}
                  style={{ backgroundColor: isActive ? 'rgba(232, 121, 249, 0.1)' : 'transparent' }}
                >
                  <View className="flex-row items-center">
                    <View className={`w-2.5 h-2.5 rounded-full mr-3 ${isActive ? 'bg-fuchsia-500' : 'bg-white/20'}`} />
                    <Text className={`font-bold ${isActive ? 'text-fuchsia-400' : 'text-white'}`}>
                      {org.name}
                    </Text>
                  </View>
                  {isActive && <Ionicons name="checkmark" size={16} color="#e879f9" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
