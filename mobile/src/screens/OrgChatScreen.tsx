/**
 * OrgChatScreen.tsx
 *
 * Real-time Organization Group Chat for all members (Levels 1, 2, 3, 4).
 * Features live WebSockets, role-level badges, pinned announcements,
 * and responsive chat bubbles.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Image,
  Alert,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';

interface ChatMessageItem {
  _id: string;
  organization: string;
  sender: {
    _id: string;
    displayName?: string;
    avatarUrl?: string;
    walletAddress?: string;
    email?: string;
  };
  content: string;
  messageType: 'text' | 'image' | 'system';
  roleLevel: number;
  roleLabel: string;
  isPinned: boolean;
  pinnedBy?: {
    _id: string;
    displayName?: string;
  };
  pinnedAt?: string;
  replyTo?: {
    _id: string;
    content: string;
    roleLabel: string;
  };
  createdAt: string;
}

function getRoleBadge(roleLevel: number, roleLabel?: string) {
  const label = roleLabel || (roleLevel === 1 ? 'President' : roleLevel === 2 ? 'Auditor' : roleLevel === 3 ? 'Treasurer' : 'Member');
  
  switch (roleLevel) {
    case 1:
      return { label: `👑 ${label}`, color: '#E879F9', bg: 'rgba(232, 121, 249, 0.15)', border: '#E879F950' };
    case 2:
      return { label: `🛡️ ${label}`, color: '#22D3EE', bg: 'rgba(34, 211, 238, 0.15)', border: '#22D3EE50' };
    case 3:
      return { label: `💼 ${label}`, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10B98150' };
    default:
      return { label: `👤 ${label}`, color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)', border: '#94A3B840' };
  }
}

function formatChatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

export default function OrgChatScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { organizations, activeOrgId } = useOrg();
  const { on, isConnected } = useSocket();
  const { colors, isDark } = useTheme();

  const targetOrgId = route.params?.orgId || activeOrgId;
  const currentOrg = organizations.find((o) => (o._id || o.id) === targetOrgId) || organizations[0];

  const currentMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === targetOrgId
  );
  const userRoleLevel = currentMembership?.roleLevel || 4;

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessageItem | null>(null);
  const [inputText, setInputText] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showPinnedBanner, setShowPinnedBanner] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Keyboard show/hide listeners for smooth chat auto-scrolling
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Fetch initial chat messages and pinned announcements
  const loadChatHistory = useCallback(async () => {
    if (!targetOrgId) return;
    try {
      const [msgRes, pinRes] = await Promise.all([
        api.get(`/chat/${targetOrgId}/messages?limit=50`),
        api.get(`/chat/${targetOrgId}/pinned`),
      ]);

      const history: ChatMessageItem[] = msgRes.data?.messages || [];
      setMessages(history);

      const pinnedList: ChatMessageItem[] = pinRes.data?.pinned || [];
      if (pinnedList.length > 0) {
        setPinnedMessage(pinnedList[0]);
      } else {
        setPinnedMessage(null);
      }
    } catch (err) {
      console.warn('[OrgChat] Failed to load messages:', err);
    } finally {
      setLoadingInitial(false);
    }
  }, [targetOrgId]);

  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Live WebSocket subscriptions for real-time messages
  useEffect(() => {
    const unsubNewMsg = on('new_org_message', (data: { orgId: string; message: ChatMessageItem }) => {
      if (data.orgId === targetOrgId && data.message) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        triggerLightHaptic();
      }
    });

    const unsubPin = on('org_message_pinned', (data: { orgId: string; message: ChatMessageItem }) => {
      if (data.orgId === targetOrgId && data.message) {
        setMessages((prev) =>
          prev.map((m) => (m._id === data.message._id ? data.message : m))
        );
        if (data.message.isPinned) {
          setPinnedMessage(data.message);
          setShowPinnedBanner(true);
        } else {
          setPinnedMessage(null);
        }
      }
    });

    const unsubDelete = on('org_message_deleted', (data: { orgId: string; messageId: string }) => {
      if (data.orgId === targetOrgId) {
        setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
        if (pinnedMessage?._id === data.messageId) {
          setPinnedMessage(null);
        }
      }
    });

    return () => {
      unsubNewMsg();
      unsubPin();
      unsubDelete();
    };
  }, [targetOrgId, pinnedMessage, on]);

  // Send a message
  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setInputText('');
    setIsSending(true);
    await triggerLightHaptic();

    try {
      const res = await api.post(`/chat/${targetOrgId}/messages`, {
        content: trimmed,
        messageType: 'text',
      });

      const sentMsg: ChatMessageItem = res.data?.message;
      if (sentMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === sentMsg._id)) return prev;
          return [...prev, sentMsg];
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send message.');
      setInputText(trimmed); // Restore text on failure
    } finally {
      setIsSending(false);
    }
  };

  // Message actions on long-press
  const handleMessageLongPress = (item: ChatMessageItem) => {
    const currentUserId = user?.id || (user as any)?._id;
    const isMyMessage = item.sender?._id === currentUserId;
    const canPin = userRoleLevel <= 2; // Level 1 (President) or Level 2 (Auditor)
    const canDelete = isMyMessage || userRoleLevel === 1;

    const options: { text: string; onPress: () => void; style?: 'destructive' | 'cancel' }[] = [
      {
        text: 'Copy Text',
        onPress: async () => {
          await Clipboard.setStringAsync(item.content);
          await triggerSuccessHaptic();
        },
      },
    ];

    if (canPin) {
      options.push({
        text: item.isPinned ? 'Unpin Announcement' : 'Pin as Announcement',
        onPress: async () => {
          try {
            await api.post(`/chat/${targetOrgId}/messages/${item._id}/pin`);
            await triggerSuccessHaptic();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to update pin status.');
          }
        },
      });
    }

    if (canDelete) {
      options.push({
        text: 'Delete Message',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/chat/${targetOrgId}/messages/${item._id}`);
            await triggerLightHaptic();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to delete message.');
          }
        },
      });
    }

    options.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });

    Alert.alert('Message Options', item.content.slice(0, 60), options);
  };

  // Render individual message bubble
  const renderMessageItem = ({ item }: { item: ChatMessageItem }) => {
    const currentUserId = user?.id || (user as any)?._id;
    const isMyMessage = item.sender?._id === currentUserId;
    const senderName = item.sender?.displayName || 'Member';
    const badge = getRoleBadge(item.roleLevel, item.roleLabel);

    if (isMyMessage) {
      return (
        <View style={{ alignItems: 'flex-end', marginBottom: 12, paddingHorizontal: 12 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={() => handleMessageLongPress(item)}
            style={{
              backgroundColor: '#9333EA',
              borderRadius: 18,
              borderBottomRightRadius: 4,
              paddingHorizontal: 14,
              paddingVertical: 10,
              maxWidth: '82%',
              shadowColor: '#9333EA',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            {item.isPinned && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Ionicons name="pin" size={12} color="#FDE047" />
                <Text style={{ color: '#FDE047', fontSize: 10, fontWeight: '700' }}>PINNED</Text>
              </View>
            )}
            <Text style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 }}>
              {formatChatTime(item.createdAt)}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const avatarUrl =
      item.sender?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=9333ea&color=fff&size=100`;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, paddingHorizontal: 12, gap: 8 }}>
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: 34, height: 34, borderRadius: 17, marginTop: 2 }}
        />
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12.5 }} numberOfLines={1}>
              {senderName}
            </Text>
            <View
              style={{
                backgroundColor: badge.bg,
                borderColor: badge.border,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 1.5,
              }}
            >
              <Text style={{ color: badge.color, fontSize: 10, fontWeight: '800' }}>{badge.label}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={() => handleMessageLongPress(item)}
            style={{
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
              borderWidth: 1,
              borderRadius: 18,
              borderTopLeftRadius: 4,
              paddingHorizontal: 14,
              paddingVertical: 10,
              maxWidth: '88%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDark ? 0.2 : 0.04,
              shadowRadius: 3,
              elevation: 1,
            }}
          >
            {item.isPinned && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Ionicons name="pin" size={12} color="#EAB308" />
                <Text style={{ color: '#EAB308', fontSize: 10, fontWeight: '700' }}>PINNED ANNOUNCEMENT</Text>
              </View>
            )}
            <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, alignSelf: 'flex-end', marginTop: 4 }}>
              {formatChatTime(item.createdAt)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── CUSTOM ORG CHAT HEADER ── */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginLeft: -4 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={{ position: 'relative' }}>
            <Image
              source={{
                uri:
                  currentOrg?.logo ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(currentOrg?.name || 'Org')}&background=9333ea&color=fff`,
              }}
              style={{ width: 38, height: 38, borderRadius: 19 }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 11,
                height: 11,
                borderRadius: 6,
                backgroundColor: isConnected ? '#10B981' : '#F59E0B',
                borderWidth: 2,
                borderColor: isDark ? colors.surface : '#FFFFFF',
              }}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
              {currentOrg?.name || 'Organization Chat'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
              {isConnected ? 'Real-time Connected • All Roles (L1-L4)' : 'Reconnecting...'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Members', { orgId: targetOrgId })}
          activeOpacity={0.7}
          style={{
            backgroundColor: colors.primaryMuted,
            borderColor: colors.primary + '40',
            borderWidth: 1,
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 5,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Ionicons name="people" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>Members</Text>
        </TouchableOpacity>
      </View>

      {/* ── PINNED ANNOUNCEMENT DRAWER ── */}
      {pinnedMessage && showPinnedBanner && (
        <View
          style={{
            backgroundColor: isDark ? 'rgba(234, 179, 8, 0.12)' : '#FEF9C3',
            borderColor: isDark ? 'rgba(234, 179, 8, 0.35)' : '#FDE047',
            borderBottomWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 9,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
            <Ionicons name="pin" size={16} color="#CA8A04" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: isDark ? '#FDE047' : '#854D0E', fontSize: 11, fontWeight: '800' }}>
                PINNED ANNOUNCEMENT
              </Text>
              <Text
                style={{ color: isDark ? '#FEF08A' : '#713F12', fontSize: 12 }}
                numberOfLines={1}
              >
                {pinnedMessage.content}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowPinnedBanner(false)} style={{ padding: 4 }}>
            <Ionicons name="close" size={16} color={isDark ? '#FDE047' : '#854D0E'} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── CHAT MESSAGES STREAM ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loadingInitial ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 10, fontSize: 12 }}>
              Connecting to organization group chat...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessageItem}
            contentContainerStyle={{ paddingVertical: 16 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
                </View>
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16, marginBottom: 6 }}>
                  Welcome to {currentOrg?.name || 'Org'} Chat!
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                  Start a conversation with fellow members, clarify budget requests, or discuss governance proposals.
                </Text>
              </View>
            }
          />
        )}

        {/* ── MESSAGE COMPOSER BAR ── */}
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom, 10),
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : '#F1F5F9',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
              borderWidth: 1,
              borderRadius: 22,
              paddingHorizontal: 14,
              paddingVertical: Platform.OS === 'ios' ? 8 : 4,
              maxHeight: 100,
              minHeight: 42,
              justifyContent: 'center',
            }}
          >
            <TextInput
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                padding: 0,
              }}
              placeholder={`Message ${currentOrg?.name || 'organization'}...`}
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline={true}
              maxLength={2000}
            />
          </View>

          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.7}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: inputText.trim() ? '#9333EA' : isDark ? '#334155' : '#CBD5E1',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#9333EA',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: inputText.trim() ? 0.3 : 0,
              shadowRadius: 4,
              elevation: inputText.trim() ? 3 : 0,
            }}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
