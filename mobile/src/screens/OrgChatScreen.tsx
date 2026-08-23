/**
 * OrgChatScreen.tsx
 *
 * Real-time Organization Group Chat for all members (Levels 1, 2, 3, 4).
 * Messenger-style layout with side avatars, seen receipts, emoji reactions,
 * role-level badges, and keyboard-aware responsive view.
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
  Modal,
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

const REACTION_EMOJIS = ['👍', '❤️', '🥰', '😆', '👎', '😡'];

interface UserRef {
  _id: string;
  displayName?: string;
  avatarUrl?: string;
}

interface ReactionGroup {
  emoji: string;
  users: UserRef[];
}

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
  reactions?: ReactionGroup[];
  seenBy?: UserRef[];
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

function ChatMobileAvatar({
  uri,
  name,
  size = 28,
}: {
  uri?: string;
  name?: string;
  size?: number;
}) {
  const [error, setError] = useState(false);
  const initial = (name || 'M').trim().charAt(0).toUpperCase();

  if (!uri || error) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#9333EA',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.42 }}>{initial}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setError(true)}
    />
  );
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
  const currentUserId = user?.id || (user as any)?._id;

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
  const [selectedMessageForAction, setSelectedMessageForAction] = useState<ChatMessageItem | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Keyboard show listeners for smooth chat auto-scrolling
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      showSub.remove();
    };
  }, []);

  // Mark all unread messages in current org as seen
  const markMessagesAsSeen = useCallback(async () => {
    if (!targetOrgId) return;
    try {
      await api.post(`/chat/${targetOrgId}/seen`, {});
    } catch {
      // non-blocking
    }
  }, [targetOrgId]);

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
      void markMessagesAsSeen();
    } catch (err) {
      console.warn('[OrgChat] Failed to load messages:', err);
    } finally {
      setLoadingInitial(false);
    }
  }, [targetOrgId, markMessagesAsSeen]);

  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Live WebSocket subscriptions for real-time messages, reactions, and seen receipts
  useEffect(() => {
    const unsubNewMsg = on('new_org_message', (data: { orgId: string; message: ChatMessageItem }) => {
      if (data.orgId === targetOrgId && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        triggerLightHaptic();
        void markMessagesAsSeen();
      }
    });

    const unsubReaction = on('org_message_reacted', (data: { orgId: string; messageId: string; reactions: ReactionGroup[] }) => {
      if (data.orgId === targetOrgId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === data.messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    });

    const unsubSeen = on('org_messages_seen', (data: { orgId: string; userId: string; user: UserRef }) => {
      if (data.orgId === targetOrgId && data.userId !== currentUserId) {
        setMessages((prev) =>
          prev.map((m) => {
            const alreadySeen = m.seenBy?.some((u) => u._id === data.userId);
            if (alreadySeen) return m;
            return { ...m, seenBy: [...(m.seenBy || []), data.user] };
          })
        );
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
      unsubReaction();
      unsubSeen();
      unsubPin();
      unsubDelete();
    };
  }, [targetOrgId, pinnedMessage, currentUserId, on, markMessagesAsSeen]);

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
      setInputText(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  // Toggle emoji reaction on message
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setSelectedMessageForAction(null);
    await triggerLightHaptic();
    try {
      const res = await api.post(`/chat/${targetOrgId}/messages/${messageId}/react`, { emoji });
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions: res.data?.reactions } : m))
      );
    } catch (err: any) {
      console.warn('[chat:react error]', err?.response?.data || err.message);
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update reaction.');
    }
  };

  // Render individual message bubble (Messenger style)
  const renderMessageItem = ({ item, index }: { item: ChatMessageItem; index: number }) => {
    const isMyMessage = item.sender?._id === currentUserId;
    const senderName = item.sender?.displayName || 'Member';
    const badge = getRoleBadge(item.roleLevel, item.roleLabel);

    const isLastInSequence =
      index === messages.length - 1 ||
      messages[index + 1]?.sender?._id !== item.sender?._id;

    const avatarUrl =
      item.sender?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=9333ea&color=fff&size=100`;

    const otherSeenUsers = (item.seenBy || []).filter(
      (u) => u._id !== currentUserId && u._id !== item.sender?._id
    );

    if (isMyMessage) {
      return (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', marginBottom: 10, paddingHorizontal: 14, gap: 8 }}>
          <View style={{ alignItems: 'flex-end', maxWidth: '82%' }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onLongPress={() => setSelectedMessageForAction(item)}
              style={{
                backgroundColor: '#9333EA',
                borderRadius: 18,
                borderBottomRightRadius: 4,
                paddingHorizontal: 14,
                paddingVertical: 10,
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>
                  {formatChatTime(item.createdAt)}
                </Text>
                <Ionicons
                  name={otherSeenUsers.length > 0 ? "checkmark-done" : "checkmark"}
                  size={13}
                  color={otherSeenUsers.length > 0 ? "#67E8F9" : "rgba(255,255,255,0.7)"}
                />
              </View>
            </TouchableOpacity>

            {/* ── REACTIONS PILLS UNDER BUBBLE ── */}
            {item.reactions && item.reactions.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {item.reactions.map((r) => {
                  const hasReacted = r.users?.some((u) => u._id === currentUserId);
                  return (
                    <TouchableOpacity
                      key={r.emoji}
                      onPress={() => handleToggleReaction(item._id, r.emoji)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: hasReacted ? 'rgba(147, 51, 234, 0.25)' : isDark ? '#1E293B' : '#F1F5F9',
                        borderColor: hasReacted ? '#A855F7' : isDark ? '#334155' : '#CBD5E1',
                        borderWidth: 1,
                        borderRadius: 12,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        gap: 3,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>{r.users.length}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── SEEN BY AVATARS (Messenger Style: Bottom of sent message) ── */}
            {otherSeenUsers.length > 0 && isLastInSequence && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingRight: 2 }}>
                <Text style={{ fontSize: 9.5, color: colors.textMuted, fontWeight: '500' }}>Seen by</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {otherSeenUsers.slice(0, 4).map((u, i) => (
                    <View key={u._id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                      <ChatMobileAvatar
                        uri={u.avatarUrl}
                        name={u.displayName || 'M'}
                        size={14}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* ── SENDER AVATAR (Right side of own message, 28px) ── */}
          <View style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 2 }}>
            {isLastInSequence ? (
              <ChatMobileAvatar
                uri={item.sender?.avatarUrl}
                name={senderName}
                size={28}
              />
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, paddingHorizontal: 14, gap: 8 }}>
        {/* ── SENDER AVATAR (Messenger Style: Beside message bubble, 28px) ── */}
        <View style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 2 }}>
          {isLastInSequence ? (
            <ChatMobileAvatar
              uri={item.sender?.avatarUrl}
              name={senderName}
              size={28}
            />
          ) : null}
        </View>

        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
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
              <Text style={{ color: badge.color, fontSize: 9.5, fontWeight: '800' }}>{badge.label}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={() => setSelectedMessageForAction(item)}
            style={{
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
              borderWidth: 1,
              borderRadius: 18,
              borderBottomLeftRadius: 4,
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

          {/* ── REACTIONS PILLS UNDER BUBBLE ── */}
          {item.reactions && item.reactions.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {item.reactions.map((r) => {
                const hasReacted = r.users?.some((u) => u._id === currentUserId);
                return (
                  <TouchableOpacity
                    key={r.emoji}
                    onPress={() => handleToggleReaction(item._id, r.emoji)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: hasReacted ? 'rgba(147, 51, 234, 0.25)' : isDark ? '#1E293B' : '#F1F5F9',
                      borderColor: hasReacted ? '#A855F7' : isDark ? '#334155' : '#CBD5E1',
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      gap: 3,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>{r.users.length}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom + 8, 20),
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
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

      {/* ── MESSENGER-STYLE QUICK REACTION & ACTION MODAL ── */}
      {selectedMessageForAction && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={true}
          onRequestClose={() => setSelectedMessageForAction(null)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.6)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
            }}
            activeOpacity={1}
            onPress={() => setSelectedMessageForAction(null)}
          >
            <View
              style={{
                width: '100%',
                maxWidth: 320,
                backgroundColor: isDark ? '#1E1B2E' : '#FFFFFF',
                borderRadius: 24,
                padding: 18,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {/* Emoji Reaction Bar */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F8FAFC',
                  borderRadius: 20,
                  marginBottom: 16,
                }}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleToggleReaction(selectedMessageForAction._id, emoji)}
                    style={{ padding: 6 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message Content Preview */}
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginBottom: 14,
                  fontStyle: 'italic',
                }}
                numberOfLines={2}
              >
                "{selectedMessageForAction.content}"
              </Text>

              {/* Action Buttons */}
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    await Clipboard.setStringAsync(selectedMessageForAction.content);
                    setSelectedMessageForAction(null);
                    await triggerSuccessHaptic();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                    gap: 10,
                  }}
                >
                  <Ionicons name="copy-outline" size={18} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>Copy Text</Text>
                </TouchableOpacity>

                {userRoleLevel <= 2 && (
                  <TouchableOpacity
                    onPress={async () => {
                      const msgId = selectedMessageForAction._id;
                      setSelectedMessageForAction(null);
                      try {
                        await api.post(`/chat/${targetOrgId}/messages/${msgId}/pin`);
                        await triggerSuccessHaptic();
                      } catch {
                        Alert.alert('Error', 'Failed to update pin state.');
                      }
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                      gap: 10,
                    }}
                  >
                    <Ionicons name="pin-outline" size={18} color="#EAB308" />
                    <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                      {selectedMessageForAction.isPinned ? 'Unpin Announcement' : 'Pin Announcement'}
                    </Text>
                  </TouchableOpacity>
                )}

                {(selectedMessageForAction.sender?._id === currentUserId || userRoleLevel === 1) && (
                  <TouchableOpacity
                    onPress={async () => {
                      const msgId = selectedMessageForAction._id;
                      setSelectedMessageForAction(null);
                      try {
                        await api.delete(`/chat/${targetOrgId}/messages/${msgId}`);
                        await triggerLightHaptic();
                      } catch {
                        Alert.alert('Error', 'Failed to delete message.');
                      }
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      gap: 10,
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>Delete Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}
