/**
 * NotificationDetailScreen.tsx
 *
 * Dedicated Full Screen view for inspecting complete notification payloads.
 * Features categorized badge headers, full timestamps, rich message containers,
 * clipboard copy, and smart deep linking to DAO proposals, transactions, and approvals.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import ScaleButton from '../components/ScaleButton';

function formatFullDate(dateString?: string) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();

  const notif = route.params?.notification || route.params?.notif || (route.params?.title ? route.params : null);
  if (!notif) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>
          No notification details available.
        </Text>
      </View>
    );
  }

  const title = notif.title || 'Notification';
  const message = notif.message || '';
  const dateFormatted = formatFullDate(notif.createdAt || notif.timestamp);
  const orgName = notif.orgName;

  // Category Tag Resolution
  const lowerTitle = title.toLowerCase();
  const lowerMsg = message.toLowerCase();

  let categoryName = 'SYSTEM ANNOUNCEMENT';
  let categoryIcon: keyof typeof Ionicons.glyphMap = 'information-circle';
  let categoryColor = '#38BDF8';
  let categoryBg = 'rgba(56, 189, 248, 0.15)';
  let actionType: 'dao' | 'approvals' | 'history' | 'members' | 'default' = 'default';
  let actionLabel = 'Back to Notifications';

  if (lowerTitle.includes('welcome') || lowerTitle.includes('member') || lowerMsg.includes('added you') || notif.type === 'member_added') {
    categoryName = 'DAO MEMBERSHIP';
    categoryIcon = 'people';
    categoryColor = '#EC4899';
    categoryBg = 'rgba(236, 72, 153, 0.15)';
    actionType = 'members';
    actionLabel = 'View DAO Members';
  } else if (lowerTitle.includes('dao') || lowerTitle.includes('proposal') || lowerMsg.includes('proposal') || notif.type === 'dao_proposal') {
    categoryName = 'DAO GOVERNANCE';
    categoryIcon = 'planet';
    categoryColor = '#A855F7';
    categoryBg = 'rgba(168, 85, 247, 0.15)';
    actionType = 'dao';
    actionLabel = 'Go to DAO Proposals';
  } else if (lowerTitle.includes('approval') || lowerMsg.includes('approval') || lowerTitle.includes('pending') || notif.type === 'approval_request') {
    categoryName = 'TREASURY APPROVAL';
    categoryIcon = 'shield-checkmark';
    categoryColor = '#F59E0B';
    categoryBg = 'rgba(245, 158, 11, 0.15)';
    actionType = 'approvals';
    actionLabel = 'Open Approvals Queue';
  } else if (lowerTitle.includes('transaction') || lowerMsg.includes('transaction') || lowerMsg.includes('₱') || notif.type === 'blockchain') {
    categoryName = 'TRANSACTION & LEDGER';
    categoryIcon = 'swap-horizontal';
    categoryColor = '#10B981';
    categoryBg = 'rgba(16, 185, 129, 0.15)';
    actionType = 'history';
    actionLabel = 'View Transaction History';
  }

  const handleCopyMessage = async () => {
    await Clipboard.setStringAsync(message);
    await triggerSuccessHaptic();
    showToast('Notification message copied to clipboard!', 'info');
  };

  const handleAction = () => {
    triggerLightHaptic();
    if (actionType === 'dao') {
      navigation.navigate('MainTabs', { screen: 'DAO' });
    } else if (actionType === 'approvals') {
      navigation.navigate('MainTabs', { screen: 'Inbox' });
    } else if (actionType === 'history') {
      navigation.navigate('History');
    } else if (actionType === 'members') {
      navigation.navigate('Members');
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Category & Organization Header Badges */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {orgName && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primaryMuted,
                borderColor: colors.primary + '30',
                borderWidth: 1,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                gap: 5,
              }}
            >
              <Ionicons name="business" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
                {orgName}
              </Text>
            </View>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: categoryBg,
              borderColor: categoryColor + '40',
              borderWidth: 1,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              gap: 6,
            }}
          >
            <Ionicons name={categoryIcon} size={15} color={categoryColor} />
            <Text style={{ color: categoryColor, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
              {categoryName}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 22,
            fontWeight: '800',
            lineHeight: 28,
            marginBottom: 10,
          }}
        >
          {title}
        </Text>

        {/* Timestamp */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 6 }}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
            {dateFormatted}
          </Text>
        </View>

        {/* Full Message Container */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 20,
            marginBottom: 24,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Message Details
            </Text>
            <TouchableOpacity
              onPress={handleCopyMessage}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.cardGlass,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 5,
                gap: 4,
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="copy-outline" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Copy</Text>
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 15,
              lineHeight: 24,
              fontWeight: '500',
            }}
          >
            {message}
          </Text>
        </View>

        {/* Action Button */}
        <ScaleButton
          onPress={handleAction}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
            marginBottom: 12,
          }}
        >
          <Ionicons
            name={actionType ? 'arrow-forward' : 'checkmark-circle'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
            {actionLabel}
          </Text>
        </ScaleButton>

        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          style={{
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
            Dismiss
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
