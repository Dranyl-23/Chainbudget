import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
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

  const fetchOrgs = async () => {
    try {
      const orgRes = await api.get('/organizations');
      setOrganizations(orgRes.data);
      if (orgRes.data.length > 0 && !activeOrgId) {
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
    <View className="flex-1 bg-[#09090b]">
      {notifications.some(n => !n.isRead) && (
        <View className="px-4 pt-4 items-end">
          <TouchableOpacity onPress={markAllAsRead} className="bg-fuchsia-500/20 px-3 py-1.5 rounded-full border border-fuchsia-500/30">
            <Text className="text-fuchsia-400 font-bold text-[10px] uppercase">Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <ScrollView 
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e879f9" />}
      >
        {loading ? (
          <View className="py-10 items-center justify-center">
            <ActivityIndicator color="#e879f9" />
          </View>
        ) : notifications.length === 0 ? (
          <View className="py-10 items-center justify-center">
            <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text className="text-white/40 mt-4 text-sm">No notifications yet</Text>
          </View>
        ) : (
          notifications.map(notif => (
            <TouchableOpacity 
              key={notif.id} 
              onPress={() => markAsRead(notif.id, notif.isRead)}
              className={`mb-3 p-4 rounded-xl border ${notif.isRead ? 'bg-white/5 border-white/5' : 'bg-[#15151e] border-fuchsia-500/30'}`}
            >
              <View className="flex-row justify-between items-start mb-1">
                <Text className={`font-bold flex-1 mr-3 ${notif.isRead ? 'text-white/60' : 'text-white'}`}>
                  {notif.title}
                </Text>
                {!notif.isRead && (
                  <View className="w-2 h-2 rounded-full bg-fuchsia-500 mt-1" />
                )}
              </View>
              <Text className={`text-sm mb-2 leading-5 ${notif.isRead ? 'text-white/40' : 'text-white/80'}`}>
                {notif.message}
              </Text>
              <Text className="text-[10px] text-white/30 uppercase font-bold">
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
