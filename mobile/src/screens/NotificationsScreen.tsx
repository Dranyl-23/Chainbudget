import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { triggerLightHaptic } from '../lib/biometrics';
import { getCachedNotifications, setCachedNotifications } from '../lib/cache';
import OrgBottomSheet from '../components/OrgBottomSheet';

function timeAgo(dateString: string) {
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
}

export default function NotificationsScreen() {
  const { organizations, activeOrgId, setActiveOrgId } = useOrg();
  const { showToast } = useToast();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showOrgSheet, setShowOrgSheet] = useState(false);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<'all' | string>('all');

  const fetchNotifications = async (orgIdFilter: string) => {
    if (notifications.length === 0) setLoading(true);
    try {
      const res = await api.get(`/notifications?orgId=${orgIdFilter}`);
      const list = res.data.notifications || [];
      setNotifications(list);
      setCachedNotifications(orgIdFilter, list);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Instant cache snapshot
    getCachedNotifications(selectedOrgFilter).then((cached) => {
      if (cached && cached.length > 0) {
        setNotifications(cached);
      }
    });
    fetchNotifications(selectedOrgFilter);
  }, [selectedOrgFilter, activeOrgId]);

  // Live WebSocket Subscription: Auto-update notifications when new notifications arrive
  useEffect(() => {
    const unsub = on('notification', (notif: any) => {
      fetchNotifications(selectedOrgFilter);
      triggerLightHaptic();
    });

    const unsub2 = on('new_notification', (data: any) => {
      fetchNotifications(selectedOrgFilter);
      triggerLightHaptic();
    });

    return () => {
      unsub();
      unsub2();
    };
  }, [selectedOrgFilter, on]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(selectedOrgFilter).finally(() => setRefreshing(false));
  };

  const markAsRead = async (notifId: string, isRead: boolean) => {
    if (isRead) return;
    try {
      await api.post(`/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post(`/notifications/read-all`, { orgId: selectedOrgFilter });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showToast('All notifications marked as read', 'info');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      showToast('Failed to mark all as read', 'error');
    }
  };

  const handleNotificationPress = (notif: any) => {
    triggerLightHaptic();
    markAsRead(notif.id || notif._id, notif.isRead);
    navigation.navigate('NotificationDetail', { notification: notif, notif });
  };

  const activeOrgName =
    selectedOrgFilter === 'all'
      ? 'All My Organizations'
      : organizations.find((o) => o._id === selectedOrgFilter)?.name || 'Selected Org';

  const renderNotificationItem = ({ item: notif }: { item: any }) => (
    <TouchableOpacity
      onPress={() => handleNotificationPress(notif)}
      activeOpacity={0.75}
      style={{
        backgroundColor: notif.isRead ? colors.surface : isDark ? '#181824' : '#f8faff',
        borderColor: notif.isRead ? colors.borderSubtle : colors.primary + '50',
      }}
      className="mb-3 p-4 rounded-2xl border shadow-sm"
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Notification: ${notif.title}. ${notif.message}`}
    >
      {/* Top Tag: Organization Name */}
      {notif.orgName && (
        <View className="flex-row items-center gap-1 mb-1.5">
          <View
            style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '25' }}
            className="px-2 py-0.5 rounded-md border flex-row items-center"
          >
            <Ionicons name="business" size={10} color={colors.primary} style={{ marginRight: 3 }} />
            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
              {notif.orgName}
            </Text>
          </View>
        </View>
      )}

      <View className="flex-row justify-between items-start mb-1">
        <Text
          style={{ color: notif.isRead ? colors.textSecondary : colors.textPrimary }}
          className="font-bold flex-1 mr-3 text-base"
        >
          {notif.title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {!notif.isRead && (
            <View style={{ backgroundColor: colors.primary }} className="w-2 h-2 rounded-full" />
          )}
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </View>
      </View>
      <Text
        style={{ color: notif.isRead ? colors.textMuted : colors.textSecondary }}
        className="text-sm mb-2 leading-5"
        numberOfLines={2}
      >
        {notif.message}
      </Text>
      <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase font-bold">
        {timeAgo(notif.timestamp || notif.createdAt)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* ── Organization Filter Header ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            setShowOrgSheet(true);
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
                borderWidth: 1,
                borderColor: colors.primary + '25',
              }}
            >
              <Ionicons name="filter" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Filter by Organization
              </Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                {activeOrgName}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primaryMuted,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.primary + '25',
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginRight: 4 }}>
              Filter ▾
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Mark All Read Action */}
      {notifications.some((n) => !n.isRead) && (
        <View className="px-4 pt-2 items-end">
          <TouchableOpacity
            onPress={markAllAsRead}
            style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
            className="px-3 py-1.5 rounded-full border"
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
          >
            <Text style={{ color: colors.primary }} className="font-bold text-[10px] uppercase">
              Mark all as read
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id || item._id}
        renderItem={renderNotificationItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View className="py-10 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View className="py-12 items-center justify-center">
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary }} className="mt-4 text-sm font-medium">
                No notifications yet
              </Text>
            </View>
          )
        }
      />

      {/* Organization Selection Drawer */}
      <OrgBottomSheet
        visible={showOrgSheet}
        onClose={() => setShowOrgSheet(false)}
        organizations={organizations}
        activeOrgId={selectedOrgFilter}
        onSelectOrg={(orgId) => {
          setSelectedOrgFilter(orgId);
          setActiveOrgId(orgId);
          setShowOrgSheet(false);
        }}
      />
    </View>
  );
}

