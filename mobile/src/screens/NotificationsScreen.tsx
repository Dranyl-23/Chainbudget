import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';

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
  const { on } = useSocket();
  const { colors } = useTheme();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (activeOrgId) {
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

  const fetchOrgs = async () => {
    try {
      const orgRes = await api.get('/organizations');
      setOrganizations(orgRes.data || []);
      if (orgRes.data?.length > 0 && !activeOrgId) {
        setActiveOrgId(orgRes.data[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async (orgId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications?orgId=${orgId}`);
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrgs().then(() => {
      if (activeOrgId) fetchNotifications(activeOrgId);
      setRefreshing(false);
    });
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
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {notifications.some(n => !n.isRead) && (
        <View className="px-4 pt-4 items-end">
          <TouchableOpacity 
            onPress={markAllAsRead} 
            style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
            className="px-3 py-1.5 rounded-full border"
          >
            <Text style={{ color: colors.primary }} className="font-bold text-[10px] uppercase">Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <ScrollView 
        className="flex-1 p-4"
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
          <View className="py-10 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View className="py-12 items-center justify-center">
            <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary }} className="mt-4 text-sm font-medium">No notifications yet</Text>
          </View>
        ) : (
          notifications.map(notif => (
            <TouchableOpacity 
              key={notif.id} 
              onPress={() => markAsRead(notif.id, notif.isRead)}
              style={{
                backgroundColor: notif.isRead ? colors.surface : colors.card,
                borderColor: notif.isRead ? colors.borderSubtle : colors.primary + '60',
              }}
              className="mb-3 p-4 rounded-2xl border shadow-sm"
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
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}
