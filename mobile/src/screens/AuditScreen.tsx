/**
 * AuditScreen.tsx — FP-6
 * Chronological audit trail for the organization.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {};

function getActionStyle(action: string, colors: any) {
  const a = (action || '').toLowerCase();
  if (a.includes('approve')) return { bg: colors.successBg, text: colors.success };
  if (a.includes('reject')) return { bg: colors.errorBg, text: colors.error };
  if (a.includes('create') || a.includes('record')) return { bg: colors.primaryMuted, text: colors.primary };
  if (a.includes('login') || a.includes('auth')) return { bg: colors.infoBg || '#EFF6FF', text: colors.accentBlue || '#3B82F6' };
  if (a.includes('export') || a.includes('key')) return { bg: '#FEF3C7', text: '#D97706' };
  return { bg: colors.cardGlass, text: colors.textMuted };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AuditScreen() {
  const route = useRoute<any>();
  const { colors } = useTheme();
  const orgId: string = route.params?.orgId;

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (orgId) fetchAudit();
  }, [orgId]);

  const fetchAudit = async () => {
    try {
      const res = await api.get(`/audit?orgId=${orgId}&limit=100`);
      const data = Array.isArray(res.data) ? res.data : res.data.logs || [];
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAudit().then(() => setRefreshing(false));
  };

  const openPolygonscan = (hash: string) => {
    Linking.openURL(`https://amoy.polygonscan.com/tx/${hash}`);
  };

  const renderItem = ({ item }: { item: any }) => {
    const actor = item.actor || {};
    const name = actor.displayName || actor.name || 'System';
    const wallet = actor.walletAddress || item.actorWallet || '';
    const actionStyle = getActionStyle(item.action, colors);
    const hasHash = !!(item.blockchainTxHash);

    return (
      <View style={{
        backgroundColor: colors.surface, borderColor: colors.border,
        borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          {/* Action badge */}
          <View style={{
            backgroundColor: actionStyle.bg, paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 12, maxWidth: '65%',
          }}>
            <Text style={{ color: actionStyle.text, fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
              {(item.action || '').toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{timeAgo(item.createdAt)}</Text>
        </View>

        {/* Actor */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 8,
          }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>{name}</Text>
            {wallet ? (
              <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace' }}>
                {wallet.slice(0, 8)}...{wallet.slice(-5)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Details */}
        {item.details && typeof item.details === 'object' && Object.keys(item.details).length > 0 && (
          <View style={{
            backgroundColor: colors.background, borderRadius: 10, padding: 10, marginBottom: 8,
          }}>
            {Object.entries(item.details).slice(0, 3).map(([k, v]) => (
              <Text key={k} style={{ color: colors.textSecondary, fontSize: 11 }}>
                <Text style={{ color: colors.textMuted }}>{k}: </Text>
                {String(v).substring(0, 60)}
              </Text>
            ))}
          </View>
        )}

        {/* Blockchain hash */}
        {hasHash && (
          <TouchableOpacity
            onPress={() => openPolygonscan(item.blockchainTxHash)}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="cube-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>
              {item.blockchainTxHash.slice(0, 10)}...{item.blockchainTxHash.slice(-8)}
            </Text>
            <Ionicons name="open-outline" size={11} color={colors.primary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="shield-checkmark-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>
                No audit events found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
