import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';
import { getCachedNotifications, setCachedNotifications } from '../lib/cache';

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
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (activeOrgId) {
      // Instant cache snapshot
      getCachedNotifications(activeOrgId).then((cached) => {
        if (cached && cached.length > 0) {
          setNotifications(cached);
        }
      });
      fetchNotifications(activeOrgId);
    }
  }, [activeOrgId]);

  // Live WebSocket Subscription: Auto-update notifications when new notifications arrive
  useEffect(() => {
    if (!activeOrgId) return;

    const unsub = on('new_notification', (data: any) => {
      if (!data?.orgId || data.orgId === activeOrgId) {
        fetchNotifications(activeOrgId);
        triggerLightHaptic();
      }
    });

    return () => unsub();
  }, [activeOrgId, on]);

  const fetchNotifications = async (orgId: string) => {
    if (notifications.length === 0) setLoading(true);
    try {
      const res = await api.get(`/notifications?orgId=${orgId}`);
      const list = res.data.notifications || [];
      setNotifications(list);
      setCachedNotifications(orgId, list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const onRefresh = () => {
    setRefreshing(true);
    if (activeOrgId) {
      fetchNotifications(activeOrgId).finally(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  };

  const markAsRead = async (notifId: string, isRead: boolean) => {
    if (isRead) return;
    try {
      await api.post(`/notifications/${notifId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notifId ? { ...n, isRead: true } : n)
      );
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!activeOrgId) return;
    try {
      await api.post(`/notifications/read-all`, { orgId: activeOrgId });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      showToast('All notifications marked as read', 'info');
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      showToast('Failed to mark all as read', 'error');
    }
  };

  const renderNotificationItem = ({ item: notif }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => markAsRead(notif.id, notif.isRead)}
      style={{
        backgroundColor: notif.isRead ? colors.surface : colors.card,
        borderColor: notif.isRead ? colors.borderSubtle : colors.primary + '60',
      }}
      className="mb-3 p-4 rounded-2xl border shadow-sm"
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Notification: ${notif.title}. ${notif.message}`}
    >
      <View className="flex-row justify-between items-start mb-1">
        <Text 
          style={{ color: notif.isRead ? colors.textSecondary : colors.textPrimary }}
          className="font-bold flex-1 mr-3"
        >
          {notif.title}
        </Text>
        {!notif.isRead && (
          <View style={{ backgroundColor: colors.primary }} className="w-2 h-2 rounded-full mt-1" />
        )}
      </View>
      <Text 
        style={{ color: notif.isRead ? colors.textMuted : colors.textSecondary }}
        className="text-sm mb-2 leading-5"
      >
        {notif.message}
      </Text>
      <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase font-bold">
        {timeAgo(notif.timestamp)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {notifications.some(n => !n.isRead) && (
        <View className="px-4 pt-4 items-end">
          <TouchableOpacity 
            onPress={markAllAsRead} 
            style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
            className="px-3 py-1.5 rounded-full border"
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
          >
            <Text style={{ color: colors.primary }} className="font-bold text-[10px] uppercase">Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id || item._id}
        renderItem={renderNotificationItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={loading ? (
          <View className="py-10 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View className="py-12 items-center justify-center">
            <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary }} className="mt-4 text-sm font-medium">No notifications yet</Text>
          </View>
        )}
      />
    </View>
  );
}

