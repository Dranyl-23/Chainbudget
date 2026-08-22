/**
 * AuditScreen.tsx — FP-6
 * Chronological audit trail for the organization with human-readable formatting.
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

function formatActionLabel(action: string): string {
  if (!action) return 'Activity Logged';
  const clean = action.replace(/[_.]/g, ' ').trim();
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getActionConfig(action: string, colors: any) {
  const a = (action || '').toLowerCase();
  if (a.includes('approve') || a.includes('executed')) {
    return {
      bg: colors.successBg,
      text: colors.success,
      border: colors.successBorder,
      icon: 'checkmark-circle' as const,
    };
  }
  if (a.includes('reject') || a.includes('fail') || a.includes('escalation')) {
    return {
      bg: colors.errorBg,
      text: colors.error,
      border: colors.errorBorder,
      icon: 'close-circle' as const,
    };
  }
  if (a.includes('create') || a.includes('record') || a.includes('invite')) {
    return {
      bg: colors.primaryMuted,
      text: colors.primary,
      border: colors.primary + '50',
      icon: 'add-circle' as const,
    };
  }
  if (a.includes('export') || a.includes('key') || a.includes('phrase')) {
    return {
      bg: 'rgba(245, 158, 11, 0.12)',
      text: '#D97706',
      border: 'rgba(245, 158, 11, 0.3)',
      icon: 'key' as const,
    };
  }
  if (a.includes('escrow')) {
    return {
      bg: 'rgba(59, 130, 246, 0.12)',
      text: '#2563EB',
      border: 'rgba(59, 130, 246, 0.3)',
      icon: 'shield-checkmark' as const,
    };
  }
  return {
    bg: colors.cardGlass,
    text: colors.textSecondary,
    border: colors.borderSubtle,
    icon: 'information-circle' as const,
  };
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

function formatKeyLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_.]/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function renderDetailPill(key: string, value: any, colors: any) {
  const label = formatKeyLabel(key);
  let displayVal = String(value);
  let isCurrency = false;
  let isBool = typeof value === 'boolean';

  if ((key === 'amount' || key.toLowerCase().includes('amount')) && !isNaN(Number(value))) {
    displayVal = `₱${Number(value).toLocaleString()}`;
    isCurrency = true;
  } else if (typeof value === 'boolean') {
    displayVal = value ? 'Yes' : 'No';
  } else if (typeof value === 'string' && value.startsWith('0x') && value.length > 12) {
    displayVal = `${value.slice(0, 6)}...${value.slice(-4)}`;
  } else if (typeof value === 'string') {
    // If the string contains an embedded 0x address (42 chars), abbreviate the address
    displayVal = displayVal.replace(/0x[a-fA-F0-9]{40}/g, (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`);
  }

  const isLong = displayVal.length > 25 || key.toLowerCase() === 'note' || key.toLowerCase() === 'description';

  if (isLong) {
    return (
      <View
        key={key}
        style={{
          backgroundColor: colors.cardGlass,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 7,
          width: '100%',
          marginBottom: 6,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginRight: 4 }}>
          {label}:
        </Text>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 11,
            fontWeight: '600',
            flex: 1,
            flexWrap: 'wrap',
            lineHeight: 16,
          }}
        >
          {displayVal}
        </Text>
      </View>
    );
  }

  return (
    <View
      key={key}
      style={{
        backgroundColor: colors.cardGlass,
        borderColor: colors.borderSubtle,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginRight: 6,
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: '100%',
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginRight: 4 }}>
        {label}:
      </Text>
      <Text
        style={{
          color: isCurrency
            ? colors.primary
            : isBool
            ? (value ? colors.success : colors.textMuted)
            : colors.textPrimary,
          fontSize: 11,
          fontWeight: '700',
          fontFamily: isCurrency || key.includes('Address') ? 'monospace' : undefined,
        }}
      >
        {displayVal}
      </Text>
    </View>
  );
}

export default function AuditScreen() {
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
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

  const parseDetails = (details: any) => {
    if (!details) return null;
    if (typeof details === 'object') return details;
    if (typeof details === 'string') {
      try {
        const parsed = JSON.parse(details);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      } catch {
        return { note: details };
      }
    }
    return null;
  };

  const renderItem = ({ item }: { item: any }) => {
    const actor = item.actor || {};
    const isSystem = !actor.displayName && !actor.name && (!actor.walletAddress || actor.walletAddress === '');
    const name = isSystem ? 'Automated Security System' : (actor.displayName || actor.name || 'Member');
    const wallet = actor.walletAddress || item.actorWallet || '';
    const actionConfig = getActionConfig(item.action, colors);
    const hasHash = Boolean(item.blockchainTxHash);
    const detailsObj = parseDetails(item.details);

    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 22,
          padding: 16,
          marginBottom: 12,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        {/* Header: Action Title & Time Ago */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View
            style={{
              backgroundColor: actionConfig.bg,
              borderColor: actionConfig.border,
              borderWidth: 1,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              maxWidth: '72%',
              gap: 5,
            }}
          >
            <Ionicons name={actionConfig.icon} size={13} color={actionConfig.text} />
            <Text
              style={{ color: actionConfig.text, fontSize: 11, fontWeight: '800' }}
              numberOfLines={1}
            >
              {formatActionLabel(item.action)}
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '500' }}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>

        {/* Actor Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: detailsObj ? 12 : 4 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isSystem ? 'rgba(245, 158, 11, 0.15)' : colors.primaryMuted,
              borderColor: isSystem ? 'rgba(245, 158, 11, 0.3)' : colors.primary + '40',
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            {isSystem ? (
              <Ionicons name="shield" size={15} color="#D97706" />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>
                {name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
              {name}
            </Text>
            {wallet ? (
              <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginTop: 1 }}>
                {wallet.slice(0, 8)}...{wallet.slice(-6)}
              </Text>
            ) : isSystem ? (
              <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 1 }}>
                Platform Security Guard
              </Text>
            ) : null}
          </View>
        </View>

        {/* Formatted Details Pills */}
        {detailsObj && Object.keys(detailsObj).length > 0 && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : colors.backgroundSecondary,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 14,
              padding: 10,
              paddingBottom: 4,
              flexDirection: 'row',
              flexWrap: 'wrap',
              width: '100%',
              overflow: 'hidden',
              marginBottom: hasHash ? 10 : 0,
            }}
          >
            {Object.entries(detailsObj).map(([k, v]) => renderDetailPill(k, v, colors))}
          </View>
        )}

        {/* Blockchain Hash Link */}
        {hasHash && (
          <TouchableOpacity
            onPress={() => openPolygonscan(item.blockchainTxHash)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primaryMuted,
              borderColor: colors.primary + '40',
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 6,
              marginTop: 4,
              alignSelf: 'flex-start',
            }}
          >
            <Ionicons name="cube" size={13} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', fontFamily: 'monospace' }}>
              {item.blockchainTxHash.slice(0, 8)}...{item.blockchainTxHash.slice(-6)}
            </Text>
            <Ionicons name="open-outline" size={12} color={colors.primary} style={{ marginLeft: 6 }} />
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
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 12 }}>
            Loading audit ledger...
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="shield-checkmark-outline" size={56} color={colors.textMuted} />
              <Text style={{ color: colors.textPrimary, marginTop: 16, fontWeight: '700', fontSize: 16 }}>
                Audit Ledger Clear
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 6, fontSize: 12, textAlign: 'center' }}>
                No events recorded for this organization yet.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
