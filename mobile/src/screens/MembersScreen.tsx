import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useRoute } from '@react-navigation/native';

export default function MembersScreen() {
  const route = useRoute<any>();
  const { orgId } = route.params || {};

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchMembers();
    } else {
      setLoading(false);
    }
  }, [orgId]);

  const fetchMembers = async () => {
    try {
      const res = await api.get(`/users/${orgId}/members`);
      setMembers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers().then(() => setRefreshing(false));
  };

  const getRoleBadge = (roleLevel: number) => {
    switch (roleLevel) {
      case 1:
        return { label: 'Founder', color: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', border: 'border-fuchsia-500/40' };
      case 2:
        return { label: 'Manager', color: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' };
      case 3:
        return { label: 'Core', color: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' };
      default:
        return { label: 'Member', color: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40' };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const badge = getRoleBadge(item.roleLevel);
    
    return (
      <View className="flex-row items-center bg-white/5 p-4 rounded-xl border border-white/5 mb-3">
        {/* Avatar Placeholder */}
        <View className="w-12 h-12 rounded-full bg-black/50 items-center justify-center mr-4 border border-white/10">
          <Ionicons name="person" size={20} color="#fff" />
        </View>
        
        <View className="flex-1">
          <Text className="text-white font-bold text-base mb-1">{item.user?.displayName || 'Unknown User'}</Text>
          <Text className="text-white/50 text-xs font-mono">{item.user?.walletAddress?.slice(0, 12)}...{item.user?.walletAddress?.slice(-4)}</Text>
        </View>

        {/* Role Badge */}
        <View className={`px-3 py-1 rounded-full border ${badge.color} ${badge.border}`}>
          <Text className={`font-bold text-xs uppercase ${badge.text}`}>
            {badge.label}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#09090b]">
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#e879f9" />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item, index) => item.user?._id || index.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e879f9" />}
          ListEmptyComponent={
            <View className="items-center justify-center py-10">
              <Ionicons name="people-outline" size={50} color="#333" className="mb-4" />
              <Text className="text-white/50 font-medium text-center">No members found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
