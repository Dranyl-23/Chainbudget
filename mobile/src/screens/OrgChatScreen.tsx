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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';

const REACTION_EMOJIS = ['👍', '❤️', '🥰', '😆', '👎', '😡'];
const CHAT_CACHE_KEY_PREFIX = 'cb_chat_cache_';

interface MobileChatCacheData {
  messages: ChatMessageItem[];
  pinned?: ChatMessageItem | null;
  logo?: string;
  cachedAt?: number;
}

async function getMobileLocalChatCache(orgId: string): Promise<MobileChatCacheData | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CHAT_CACHE_KEY_PREFIX}${orgId}`);
    return raw ? (JSON.parse(raw) as MobileChatCacheData) : null;
  } catch {
    return null;
  }
}

async function setMobileLocalChatCache(
  orgId: string,
  data: { messages: ChatMessageItem[]; pinned?: ChatMessageItem | null; logo?: string }
) {
  try {
    const payload: MobileChatCacheData = {
      ...data,
      messages: (data.messages || []).slice(-100),
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(`${CHAT_CACHE_KEY_PREFIX}${orgId}`, JSON.stringify(payload));
  } catch {
    // non-blocking
  }
}

const CHAT_OUTBOX_KEY_PREFIX = 'cb_chat_outbox_';

interface MobileOutboxItem {
  clientMessageId: string;
  orgId: string;
  content: string;
  messageType?: string;
  replyToId?: string;
  createdAt: string;
}

async function getMobileLocalOutbox(orgId: string): Promise<MobileOutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(`${CHAT_OUTBOX_KEY_PREFIX}${orgId}`);
    return raw ? (JSON.parse(raw) as MobileOutboxItem[]) : [];
  } catch {
    return [];
  }
}

async function saveMobileLocalOutbox(orgId: string, items: MobileOutboxItem[]) {
  try {
    await AsyncStorage.setItem(`${CHAT_OUTBOX_KEY_PREFIX}${orgId}`, JSON.stringify(items));
  } catch {}
}

async function addToMobileLocalOutbox(orgId: string, item: MobileOutboxItem) {
  const current = await getMobileLocalOutbox(orgId);
  if (!current.some((i) => i.clientMessageId === item.clientMessageId)) {
    await saveMobileLocalOutbox(orgId, [...current, item]);
  }
}

async function removeFromMobileLocalOutbox(orgId: string, clientMessageId: string) {
  const current = await getMobileLocalOutbox(orgId);
  await saveMobileLocalOutbox(
    orgId,
    current.filter((i) => i.clientMessageId !== clientMessageId)
  );
}

interface UserRef {
  _id: string;
  displayName?: string;
  avatarUrl?: string;
}

interface ReactionGroup {
  emoji: string;
  users: UserRef[];
}

/** Client-side only. 'sending' and 'failed' are never stored on the server. */
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

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
  deliveredTo?: UserRef[];
  replyTo?: {
    _id: string;
    content: string;
    roleLabel?: string;
    messageType?: string;
    sender?: {
      _id: string;
      displayName?: string;
      avatarUrl?: string;
    };
  };
  createdAt: string;
  /** Client-side delivery state — not persisted to DB */
  status?: MessageStatus;
  /** Client-generated idempotency key to prevent duplicates */
  clientMessageId?: string;
  /** Original text preserved for retry on failed messages */
  _localContent?: string;
}

/**
 * Always-visible message status tick — shown on the sender's own messages.
 * Sending: grey clock | Sent: grey single-tick | Delivered: grey double-tick
 * Read: cyan double-tick | Failed: red ×-circle
 */
function MessageStatusTick({
  status,
  colors,
}: {
  status: MessageStatus;
  colors: any;
}) {
  if (status === 'sending') {
    return (
      <Ionicons name="time-outline" size={11} color={colors.textMuted} />
    );
  }
  if (status === 'failed') {
    return (
      <Ionicons name="alert-circle" size={12} color="#EF4444" />
    );
  }
  if (status === 'read') {
    return (
      <Ionicons name="checkmark-done" size={12} color="#22D3EE" />
    );
  }
  if (status === 'delivered') {
    return (
      <Ionicons name="checkmark-done" size={12} color={colors.textMuted} />
    );
  }
  // 'sent'
  return (
    <Ionicons name="checkmark" size={12} color={colors.textMuted} />
  );
}

function getRoleBadge(roleLevel: number, roleLabel?: string, isDark: boolean = true) {
  const cleanLabel =
    roleLabel && roleLabel.trim()
      ? roleLabel.trim().replace(/^[\p{Emoji}\s]+/u, '')
      : roleLevel === 1
      ? 'President'
      : roleLevel === 2
      ? 'Auditor'
      : roleLevel === 3
      ? 'Treasurer'
      : 'Member';

  switch (roleLevel) {
    case 1:
      // President / Founder
      return {
        label: cleanLabel || 'President',
        color: isDark ? '#D8B4FE' : '#6B21A8',
        bg: isDark ? 'rgba(192, 132, 252, 0.20)' : 'rgba(126, 34, 206, 0.12)',
        border: isDark ? 'rgba(192, 132, 252, 0.40)' : 'rgba(126, 34, 206, 0.30)',
      };
    case 2:
      // Auditor
      return {
        label: cleanLabel || 'Auditor',
        color: isDark ? '#38BDF8' : '#0369A1',
        bg: isDark ? 'rgba(56, 189, 248, 0.20)' : 'rgba(3, 105, 161, 0.12)',
        border: isDark ? 'rgba(56, 189, 248, 0.40)' : 'rgba(3, 105, 161, 0.30)',
      };
    case 3:
      // Treasurer
      return {
        label: cleanLabel || 'Treasurer',
        color: isDark ? '#34D399' : '#047857',
        bg: isDark ? 'rgba(52, 211, 153, 0.20)' : 'rgba(4, 120, 87, 0.12)',
        border: isDark ? 'rgba(52, 211, 153, 0.40)' : 'rgba(4, 120, 87, 0.30)',
      };
    default:
      // Member
      return {
        label: cleanLabel || 'Member',
        color: isDark ? '#94A3B8' : '#334155',
        bg: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(71, 85, 105, 0.10)',
        border: isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(71, 85, 105, 0.25)',
      };
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

const BACKEND_BASE = 'https://chainbudget-api.fly.dev';

function formatMobileAvatarUrl(uri?: string) {
  if (!uri || typeof uri !== 'string') return undefined;
  if (uri.startsWith('data:image/') || uri.startsWith('blob:')) {
    return uri;
  }
  if (uri.startsWith('/uploads')) {
    return `${BACKEND_BASE}${uri}`;
  }
  if (uri.includes('localhost:5001') || uri.includes('127.0.0.1:5001')) {
    return uri.replace(/http:\/\/(localhost|127\.0\.0\.1):5001/, BACKEND_BASE);
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }
  return undefined;
}

function OrgHeaderAvatar({
  uri,
  name,
  size = 32,
}: {
  uri?: string;
  name?: string;
  size?: number;
}) {
  const [error, setError] = useState(false);
  const initial = (name || 'O').trim().charAt(0).toUpperCase();
  const resolvedUri = formatMobileAvatarUrl(uri);

  useEffect(() => {
    setError(false);
  }, [uri]);

  if (!resolvedUri || error) {
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
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.44 }}>{initial}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setError(true)}
    />
  );
}

function ChatMobileAvatar({
  uri,
  name,
  size = 22,
}: {
  uri?: string;
  name?: string;
  size?: number;
}) {
  const [error, setError] = useState(false);
  const initial = (name || 'M').trim().charAt(0).toUpperCase();
  const resolvedUri = formatMobileAvatarUrl(uri);

  useEffect(() => {
    setError(false);
  }, [uri]);

  if (!resolvedUri || error) {
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
      source={{ uri: resolvedUri }}
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
  const { organizations, activeOrgId, refreshOrgs } = useOrg();
  const { on, emit, isConnected } = useSocket();
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
  const [selectedTimestampMessageId, setSelectedTimestampMessageId] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | undefined>(
    (currentOrg as any)?.logoUrl || currentOrg?.logo
  );

  // Messenger Conversation Search States
  const [isSearchActive, setIsSearchActive] = useState(Boolean(route.params?.initialSearch));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<ChatMessageItem[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessageItem | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (route.params?.initialSearch) {
      setIsSearchActive(true);
    }
  }, [route.params?.initialSearch]);

  // Auto-scroll to latest message when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current && !isSearchActive) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToEnd({ animated: true });
        } catch {}
      }, 100);
    }
  }, [messages.length, isSearchActive]);

  // Jump to specific message and highlight it
  const jumpToMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    setMessages((currentMsgs) => {
      const idx = currentMsgs.findIndex((m) => m._id === messageId);
      if (idx !== -1 && flatListRef.current) {
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
          } catch {
            // fallback
          }
        }, 100);
      }
      return currentMsgs;
    });

    // Remove highlight after 3.5 seconds
    setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
    }, 3500);
  }, []);

  // Debounced search effect across local memory & server history
  useEffect(() => {
    if (!isSearchActive || !searchQuery.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      const q = searchQuery.toLowerCase().trim();
      const localMatches = messages.filter((m) => m.content.toLowerCase().includes(q));

      setIsSearchingServer(true);
      try {
        const res = await api.get(`/chat/${targetOrgId}/search?q=${encodeURIComponent(q)}`);
        const serverResults: ChatMessageItem[] = res.data?.results || [];

        // Merge local and server matches
        const merged = [...localMatches];
        for (const s of serverResults) {
          if (!merged.some((m) => m._id === s._id)) {
            merged.push(s);
          }
        }

        setSearchMatches(merged);
        setCurrentMatchIndex(0);
        if (merged.length > 0) {
          jumpToMessage(merged[0]._id);
        }
      } catch (err) {
        console.warn('[search error]', err);
        setSearchMatches(localMatches);
        if (localMatches.length > 0) {
          jumpToMessage(localMatches[0]._id);
        }
      } finally {
        setIsSearchingServer(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchActive, targetOrgId, messages, jumpToMessage]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    jumpToMessage(searchMatches[nextIdx]._id);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    jumpToMessage(searchMatches[prevIdx]._id);
  };

  useEffect(() => {
    if (currentOrg?.logo) {
      setOrgLogoUrl(currentOrg.logo);
    }
  }, [currentOrg?.logo]);

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

  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Cursor-based backward pagination (older messages upwards)
  const handleLoadOlderMessages = useCallback(async () => {
    if (!targetOrgId || loadingOlder || !hasMoreOlder || messages.length === 0) return;

    const oldest = messages[0];
    if (!oldest?.createdAt) return;

    setLoadingOlder(true);
    try {
      const res = await api.get<{ messages: ChatMessageItem[]; hasMore?: boolean }>(
        `/chat/${targetOrgId}/messages?before=${encodeURIComponent(oldest.createdAt)}&limit=30`
      );

      const olderMessages = res.data?.messages || [];
      if (olderMessages.length === 0) {
        setHasMoreOlder(false);
      } else {
        setHasMoreOlder(res.data?.hasMore ?? olderMessages.length === 30);
        setMessages((prev) => {
          const map = new Map<string, ChatMessageItem>();
          for (const m of olderMessages) {
            map.set(m._id, m);
          }
          for (const m of prev) {
            map.set(m._id, m);
          }
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          void setMobileLocalChatCache(targetOrgId, {
            messages: merged,
            pinned: pinnedMessage,
            logo: orgLogoUrl,
          });
          return merged;
        });
      }
    } catch (err) {
      console.warn('[OrgChat] Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [targetOrgId, loadingOlder, hasMoreOlder, messages, pinnedMessage, orgLogoUrl]);

  // Flush local Outbox (automatically sends pending offline messages upon reconnect)
  const flushMobileOutbox = useCallback(async () => {
    if (!targetOrgId || isSending) return;
    const pending = await getMobileLocalOutbox(targetOrgId);
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        const res = await api.post(`/chat/${targetOrgId}/messages`, {
          content: item.content,
          messageType: item.messageType || 'text',
          replyTo: item.replyToId || undefined,
          clientMessageId: item.clientMessageId,
        });

        await removeFromMobileLocalOutbox(targetOrgId, item.clientMessageId);

        if (res.data?.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === item.clientMessageId || m._id === item.clientMessageId
                ? { ...res.data.message, status: 'sent' as MessageStatus, _localContent: item.content }
                : m
            )
          );
        }
      } catch {
        break; // Stop and retry later if network still unavailable
      }
    }
  }, [targetOrgId, isSending]);

  // Fetch initial chat messages, pinned announcements, and organization details in 1 fast roundtrip
  const loadChatHistory = useCallback(async () => {
    if (!targetOrgId) return;
    try {
      const res = await api.get(`/chat/${targetOrgId}/bootstrap?limit=50`);
      const {
        messages: msgs = [],
        pinned = [],
        organization: orgData,
        onlineUserIds: onlineIds = [],
        hasMore,
      } = res.data || {};

      setMessages((prev) => {
        const optimistic = prev.filter((m) => m._id.startsWith('temp-'));
        const map = new Map<string, ChatMessageItem>();
        for (const m of msgs) {
          map.set(m._id, m);
        }
        for (const opt of optimistic) {
          if (!map.has(opt._id)) {
            map.set(opt._id, opt);
          }
        }
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        void setMobileLocalChatCache(targetOrgId, {
          messages: merged,
          pinned: pinned[0] || null,
          logo: orgData?.logoUrl || orgData?.logo || orgLogoUrl,
        });
        return merged;
      });

      if (typeof hasMore === 'boolean') {
        setHasMoreOlder(hasMore);
      }

      if (pinned.length > 0) {
        setPinnedMessage(pinned[0]);
        setShowPinnedBanner(true);
      } else {
        setPinnedMessage(null);
      }

      if (orgData?.logoUrl || orgData?.logo) {
        setOrgLogoUrl(orgData.logoUrl || orgData.logo);
      }

      if (Array.isArray(onlineIds)) {
        setOnlineUserIds(onlineIds);
      }

      void markMessagesAsSeen();
    } catch (err) {
      console.warn('[OrgChat] Failed to bootstrap chat messages:', err);
    } finally {
      setLoadingInitial(false);
    }
  }, [targetOrgId, markMessagesAsSeen, orgLogoUrl]);

  useEffect(() => {
    let isCancelled = false;

    // 1. Instant AsyncStorage Cache Hydration (0ms display!)
    if (targetOrgId) {
      getMobileLocalChatCache(targetOrgId).then((cached) => {
        if (!isCancelled && cached && cached.messages && cached.messages.length > 0) {
          setMessages(cached.messages);
          if (cached.pinned) {
            setPinnedMessage(cached.pinned);
            setShowPinnedBanner(true);
          }
          if (cached.logo) {
            setOrgLogoUrl(cached.logo);
          }
          setLoadingInitial(false);
        }
      });
    }

    // 2. Background Revalidation
    loadChatHistory();

    return () => {
      isCancelled = true;
    };
  }, [loadChatHistory, targetOrgId]);

  // Refresh organization logo whenever screen is focused (e.g. returning from Chat Info)
  useFocusEffect(
    useCallback(() => {
      if (!targetOrgId) return;
      api
        .get(`/organizations/${targetOrgId}`)
        .then((res) => {
          if (res.data?.logoUrl || res.data?.logo) {
            setOrgLogoUrl(res.data.logoUrl || res.data.logo);
          }
        })
        .catch(() => {});

      api
        .get(`/chat/${targetOrgId}/online`)
        .then((res) => {
          if (res.data?.onlineUserIds) {
            setOnlineUserIds(res.data.onlineUserIds);
          }
        })
        .catch(() => {});

      void flushMobileOutbox();
    }, [targetOrgId, flushMobileOutbox])
  );

  // Explicitly join and leave the organization chat room on connection / focus
  useEffect(() => {
    if (targetOrgId) {
      emit('join_org', targetOrgId);
      if (isConnected) {
        void flushMobileOutbox();
      }
    }
    return () => {
      if (targetOrgId) {
        emit('leave_org', targetOrgId);
      }
    };
  }, [targetOrgId, emit, isConnected, flushMobileOutbox]);

  // Live background polling sync (every 3s) ensuring messages arrive even if WebSocket drops or reconnects
  useEffect(() => {
    if (!targetOrgId) return;
    const syncInterval = setInterval(() => {
      api
        .get(`/chat/${targetOrgId}/messages?limit=25`)
        .then((res) => {
          const freshList: ChatMessageItem[] = res.data?.messages || [];
          if (freshList.length > 0) {
            setMessages((prev) => {
              let hasNew = false;
              const merged = [...prev];
              for (const fresh of freshList) {
                const exists = merged.some((m) => m._id === fresh._id);
                if (!exists) {
                  // Replace matching temporary optimistic message if any
                  const tempIdx = merged.findIndex(
                    (m) =>
                      (fresh.clientMessageId && (m.clientMessageId === fresh.clientMessageId || m._id === fresh.clientMessageId)) ||
                      ((m._id.startsWith('temp-') || m._id.startsWith('msg-')) &&
                        m.content === fresh.content &&
                        m.sender?._id === fresh.sender?._id)
                  );
                  if (tempIdx !== -1) {
                    merged[tempIdx] = fresh;
                  } else {
                    merged.push(fresh);
                  }
                  hasNew = true;
                }
              }

              // Deduplicate merged array by _id as a safety net
              const seen = new Set<string>();
              const unique = merged.filter((m) => {
                const id = m._id || m.clientMessageId;
                if (!id) return true;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
              });

              return hasNew || unique.length !== prev.length ? unique : prev;
            });
          }
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(syncInterval);
  }, [targetOrgId]);

  // Live WebSocket subscriptions for real-time messages, reactions, seen receipts, and online users
  useEffect(() => {
    const unsubNewMsg = on('new_org_message', (data: { orgId: string; message: ChatMessageItem }) => {
      if (data.orgId === targetOrgId && data.message) {
        setMessages((prev) => {
          const tempMsg = prev.find(
            (m) =>
              (data.message.clientMessageId &&
                (m.clientMessageId === data.message.clientMessageId || m._id === data.message.clientMessageId)) ||
              ((m._id.startsWith('temp-') || m._id.startsWith('msg-')) &&
                m.content === data.message.content &&
                m.sender?._id === data.message.sender?._id)
          );
          if (tempMsg) {
            return prev.map((m) =>
              m._id === tempMsg._id
                ? { ...data.message, status: 'sent', _localContent: data.message.content }
                : m
            );
          }
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        triggerLightHaptic();
        void markMessagesAsSeen();

        // Auto-acknowledge delivery for messages from OTHER users (fire-and-forget)
        if (data.message.sender?._id !== currentUserId) {
          api
            .post(`/chat/${targetOrgId}/messages/${data.message._id}/delivered`)
            .catch(() => {});
        }
      }
    });

    // Upgrade sender's tick from 'sent' → 'delivered' when recipient acknowledges receipt
    const unsubDelivered = on(
      'org_message_delivered',
      (data: { orgId: string; messageId: string; user: UserRef }) => {
        if (data.orgId === targetOrgId && data.user._id !== currentUserId) {
          setMessages((prev) =>
            prev.map((m) => {
              if (m._id !== data.messageId) return m;
              const alreadyDelivered = m.deliveredTo?.some((u) => u._id === data.user._id);
              if (alreadyDelivered) return m;
              return { ...m, deliveredTo: [...(m.deliveredTo || []), data.user] };
            })
          );
        }
      }
    );

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

    const unsubOnline = on('org_online_users', (data: { orgId: string; onlineUserIds: string[] }) => {
      if (data.orgId === targetOrgId && Array.isArray(data.onlineUserIds)) {
        setOnlineUserIds(data.onlineUserIds);
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

    const unsubOrgUpdated = on('org_updated', (data: { orgId: string; logoUrl?: string; name?: string }) => {
      if (data.orgId === targetOrgId && data.logoUrl) {
        setOrgLogoUrl(data.logoUrl);
      }
    });

    return () => {
      unsubNewMsg();
      unsubDelivered();
      unsubReaction();
      unsubSeen();
      unsubOnline();
      unsubPin();
      unsubDelete();
      unsubOrgUpdated();
    };
  }, [targetOrgId, pinnedMessage, currentUserId, on, markMessagesAsSeen]);

  // Handle Changing Organization Profile Picture
  const handleChangeOrgLogo = async () => {
    if (userRoleLevel > 2) {
      Alert.alert('Permission Notice', 'Only Organization Officers (Level 1 & Level 2) can change the organization profile image.');
      return;
    }

    Alert.alert(
      'Organization Picture',
      'Choose an option to update this organization\'s profile picture',
      [
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Gallery access is needed to pick a picture.');
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });

            if (!result.canceled && result.assets[0]?.uri) {
              await uploadOrgLogo(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera access is needed to take a picture.');
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });

            if (!result.canceled && result.assets[0]?.uri) {
              await uploadOrgLogo(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadOrgLogo = async (uri: string) => {
    setIsUploadingLogo(true);
    await triggerLightHaptic();
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'org-logo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpeg';
      const type = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedUrl = uploadRes.data?.documentUrl;
      if (uploadedUrl) {
        await api.patch(`/organizations/${targetOrgId}`, { logoUrl: uploadedUrl });
        setOrgLogoUrl(uploadedUrl);
        await refreshOrgs();
        await triggerSuccessHaptic();
        Alert.alert('Success', 'Organization profile picture updated successfully!');
      }
    } catch (err: any) {
      console.warn('[uploadOrgLogo error]', err?.response?.data || err.message);
      Alert.alert('Error', err?.response?.data?.error || 'Failed to upload organization picture.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  /**
   * Derives the display status of a sent message from its current data.
   * 'sending'/'failed' are client-side only (temp- messages).
   * 'read' > 'delivered' > 'sent' once the message is on the server.
   */
  const deriveStatus = (msg: ChatMessageItem): MessageStatus => {
    if (msg.status === 'sending') return 'sending';
    if (msg.status === 'failed') return 'failed';
    const otherSeen = (msg.seenBy || []).some((u) => u._id !== currentUserId);
    if (otherSeen) return 'read';
    const otherDelivered = (msg.deliveredTo || []).some(
      (u: any) => (u?._id || u) !== currentUserId
    );
    if (otherDelivered) return 'delivered';
    return 'sent';
  };

  // 3. Instant Optimistic Send message handler (0ms UI latency)
  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    const currentReply = replyingToMessage;
    setReplyingToMessage(null);

    const clientMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const tempId = clientMessageId;
    const roleLevel = userRoleLevel;
    const roleLabel =
      currentMembership?.roleLabel ||
      (roleLevel === 1 ? 'President' : roleLevel === 2 ? 'Auditor' : roleLevel === 3 ? 'Treasurer' : 'Member');

    const optimisticMessage: ChatMessageItem = {
      _id: tempId,
      clientMessageId,
      organization: targetOrgId,
      sender: {
        _id: currentUserId || 'me',
        displayName: user?.displayName || 'Me',
        avatarUrl: user?.avatarUrl,
        walletAddress: user?.walletAddress,
        email: user?.email,
      },
      content: trimmed,
      messageType: 'text',
      roleLevel,
      roleLabel,
      isPinned: false,
      reactions: [],
      seenBy: [
        {
          _id: currentUserId || 'me',
          displayName: user?.displayName || 'Me',
          avatarUrl: user?.avatarUrl,
        },
      ],
      deliveredTo: [],
      replyTo: currentReply
        ? {
            _id: currentReply._id,
            content: currentReply.content,
            roleLabel: currentReply.roleLabel,
            messageType: currentReply.messageType,
            sender: currentReply.sender,
          }
        : undefined,
      createdAt: new Date().toISOString(),
      status: 'sending',
      _localContent: trimmed,
    };

    // 1. Instantly display in UI (0ms latency!)
    setInputText('');
    setMessages((prev) => [...prev, optimisticMessage]);
    setIsSending(true);
    await triggerLightHaptic();

    // 2. Persist in local Outbox queue for offline resilience
    void addToMobileLocalOutbox(targetOrgId, {
      clientMessageId,
      orgId: targetOrgId,
      content: trimmed,
      messageType: 'text',
      replyToId: currentReply?._id,
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await api.post(`/chat/${targetOrgId}/messages`, {
        content: trimmed,
        messageType: 'text',
        replyTo: currentReply?._id || undefined,
        clientMessageId,
      });

      void removeFromMobileLocalOutbox(targetOrgId, clientMessageId);

      const sentMsg: ChatMessageItem = res.data?.message;
      if (sentMsg) {
        setMessages((prev) => {
          const alreadyExists = prev.some((m) => m._id === sentMsg._id && m._id !== tempId);
          if (alreadyExists) {
            return prev.filter((m) => m._id !== tempId);
          }
          return prev.map((m) =>
            m._id === tempId || m.clientMessageId === clientMessageId
              ? { ...sentMsg, status: 'sent', _localContent: trimmed }
              : m
          );
        });
      }
    } catch (err: any) {
      console.warn('[chat:send error]', err?.response?.data || err.message);
      // Keep the message bubble visible with 'failed' status and in Outbox for retry
      setMessages((prev) =>
        prev.map((m) =>
          m._id === tempId ? { ...m, status: 'failed' } : m
        )
      );
      if (currentReply) {
        setReplyingToMessage(currentReply);
      }
    } finally {
      setIsSending(false);
    }
  };

  // 3b. Retry a failed message — re-sends using preserved _localContent and idempotent key
  const handleRetryMessage = async (failedMsg: ChatMessageItem) => {
    if (!failedMsg._localContent) return;
    await triggerLightHaptic();

    const trimmed = failedMsg._localContent;
    const clientMessageId = failedMsg.clientMessageId || failedMsg._id;

    // Set status back to 'sending'
    setMessages((prev) =>
      prev.map((m) =>
        m._id === failedMsg._id ? { ...m, status: 'sending' } : m
      )
    );

    try {
      const res = await api.post(`/chat/${targetOrgId}/messages`, {
        content: trimmed,
        messageType: failedMsg.messageType || 'text',
        replyTo: failedMsg.replyTo?._id || undefined,
        clientMessageId,
      });

      void removeFromMobileLocalOutbox(targetOrgId, clientMessageId);

      const sentMsg: ChatMessageItem = res.data?.message;
      if (sentMsg) {
        setMessages((prev) => {
          const alreadyExists = prev.some((m) => m._id === sentMsg._id && m._id !== failedMsg._id);
          if (alreadyExists) {
            return prev.filter((m) => m._id !== failedMsg._id);
          }
          return prev.map((m) =>
            m._id === failedMsg._id || m.clientMessageId === clientMessageId
              ? { ...sentMsg, status: 'sent', _localContent: trimmed }
              : m
          );
        });
      }
    } catch (err: any) {
      console.warn('[chat:retry error]', err?.response?.data || err.message);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === failedMsg._id ? { ...m, status: 'failed' } : m
        )
      );
    }
  };

  // Toggle emoji reaction on message
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setSelectedMessageForAction(null);
    if (!messageId || messageId.startsWith('temp-')) {
      return;
    }
    await triggerLightHaptic();

    // Optimistic toggle for instant responsive UI
    setMessages((prev) =>
      prev.map((m) => {
        if (m._id !== messageId) return m;
        const reactions = [...(m.reactions || [])];
        const groupIndex = reactions.findIndex((r) => r.emoji === emoji);
        if (groupIndex === -1) {
          reactions.push({
            emoji,
            users: [{ _id: currentUserId, displayName: user?.displayName || 'You', avatarUrl: user?.avatarUrl }],
          });
        } else {
          const group = { ...reactions[groupIndex], users: [...(reactions[groupIndex].users || [])] };
          const userIdx = group.users.findIndex((u) => u._id === currentUserId);
          if (userIdx > -1) {
            group.users.splice(userIdx, 1);
            if (group.users.length === 0) {
              reactions.splice(groupIndex, 1);
            } else {
              reactions[groupIndex] = group;
            }
          } else {
            group.users.push({ _id: currentUserId, displayName: user?.displayName || 'You', avatarUrl: user?.avatarUrl });
            reactions[groupIndex] = group;
          }
        }
        return { ...m, reactions };
      })
    );

    try {
      const res = await api.post(`/chat/${targetOrgId}/messages/${messageId}/react`, { emoji });
      if (res.data?.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions: res.data.reactions } : m))
        );
      }
    } catch (err: any) {
      console.warn('[chat:react error]', err?.response?.data || err.message);
    }
  };

  // Render individual message bubble (Messenger style)
  const renderMessageItem = ({ item, index }: { item: ChatMessageItem; index: number }) => {
    const isMyMessage = item.sender?._id === currentUserId;
    const senderName = item.sender?.displayName || 'Member';
    const repliedToName =
      item.replyTo?.sender?._id === currentUserId
        ? 'yourself'
        : item.replyTo?.sender?.displayName || 'Member';
    const badge = getRoleBadge(item.roleLevel, item.roleLabel, isDark);

    const isLastInSequence =
      index === messages.length - 1 ||
      messages[index + 1]?.sender?._id !== item.sender?._id;

    const avatarUrl =
      item.sender?.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=9333ea&color=fff&size=100`;

    const otherSeenUsers = (item.seenBy || []).filter(
      (u) => u._id !== currentUserId && u._id !== item.sender?._id
    );

    const isTimestampVisible = selectedTimestampMessageId === item._id;

    if (isMyMessage) {
      return (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', marginBottom: 8, paddingHorizontal: 14, gap: 8 }}>
          <View style={{ alignItems: 'flex-end', maxWidth: '85%' }}>
            {/* ── MESSENGER REPLY HEADER (e.g. "↩ You replied to Z Andrie") ── */}
            {item.replyTo && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, paddingRight: 4 }}>
                <Ionicons name="arrow-undo" size={11} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                  You replied to {repliedToName}
                </Text>
              </View>
            )}

            {/* ── QUOTED MESSAGE PILL (Messenger Muted Capsule on Top) ── */}
            {item.replyTo && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => item.replyTo?._id && jumpToMessage(item.replyTo._id)}
                style={{
                  backgroundColor: isDark ? '#27272A' : '#E2E8F0',
                  borderRadius: 16,
                  borderBottomRightRadius: 4,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  marginBottom: 2,
                  maxWidth: '88%',
                  alignSelf: 'flex-end',
                }}
              >
                <Text
                  style={{
                    color: isDark ? '#A1A1AA' : '#64748B',
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  {item.replyTo.content}
                </Text>
              </TouchableOpacity>
            )}

            {/* ── MAIN REPLY MESSAGE BUBBLE ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedTimestampMessageId((prev) => (prev === item._id ? null : item._id))}
              onLongPress={() => setSelectedMessageForAction(item)}
              style={{
                backgroundColor: '#9333EA',
                borderRadius: 18,
                borderTopRightRadius: item.replyTo ? 4 : 18,
                borderBottomRightRadius: 4,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderWidth: highlightedMessageId === item._id ? 2 : item.status === 'failed' ? 1.5 : 0,
                borderColor: highlightedMessageId === item._id ? '#FDE047' : '#EF4444',
                shadowColor: '#9333EA',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              {item.isPinned && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <MaterialCommunityIcons name="pin" size={13} color="#FDE047" style={{ transform: [{ rotate: '-45deg' }] }} />
                  <Text style={{ color: '#FDE047', fontSize: 10, fontWeight: '700' }}>PINNED</Text>
                </View>
              )}
              <Text style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
            </TouchableOpacity>

            {/* ── ALWAYS-VISIBLE STATUS ROW: time + tick + retry ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingRight: 2 }}>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '500' }}>
                {formatChatTime(item.createdAt)}
              </Text>
              <MessageStatusTick status={deriveStatus(item)} colors={colors} />
              {deriveStatus(item) === 'failed' && (
                <TouchableOpacity
                  onPress={() => handleRetryMessage(item)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderRadius: 8,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    marginLeft: 2,
                  }}
                >
                  <Ionicons name="refresh" size={10} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── REACTIONS PILLS UNDER BUBBLE ── */}
            {item.reactions && item.reactions.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {item.reactions.map((r, rIdx) => {
                  const hasReacted = r.users?.some((u) => u._id === currentUserId);
                  return (
                    <TouchableOpacity
                      key={`${item._id}-react-${r.emoji}-${rIdx}`}
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
                    <View key={u?._id || `seen-${item._id}-${i}`} style={{ marginLeft: i > 0 ? -4 : 0 }}>
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

          {/* ── SENDER AVATAR (Right side of own message, 22px) ── */}
          <View style={{ width: 22, height: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 2 }}>
            {isLastInSequence ? (
              <ChatMobileAvatar
                uri={item.sender?.avatarUrl}
                name={senderName}
                size={22}
              />
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, paddingHorizontal: 14, gap: 8 }}>
        {/* ── SENDER AVATAR (Messenger Style: Beside message bubble, 22px) ── */}
        <View style={{ width: 22, height: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 2, position: 'relative' }}>
          {isLastInSequence ? (
            <>
              <ChatMobileAvatar
                uri={item.sender?.avatarUrl}
                name={senderName}
                size={22}
              />
              {onlineUserIds.includes(item.sender?._id) && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: '#10B981',
                    borderWidth: 1.5,
                    borderColor: isDark ? colors.background : '#FFFFFF',
                  }}
                />
              )}
            </>
          ) : null}
        </View>

        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          {/* ── MESSENGER REPLY HEADER OR SENDER ROW ── */}
          {item.replyTo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, paddingLeft: 4 }}>
              <Ionicons name="arrow-undo" size={11} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                {senderName} replied to {item.replyTo.sender?._id === currentUserId ? 'you' : item.replyTo.sender?.displayName || 'Member'}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
                {senderName}
              </Text>
              <View
                style={{
                  backgroundColor: badge.bg,
                  borderColor: badge.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    color: badge.color,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 0.2,
                    includeFontPadding: false,
                  }}
                >
                  {badge.label}
                </Text>
              </View>
            </View>
          )}

          {/* ── QUOTED MESSAGE PILL (Incoming Muted Capsule on Top) ── */}
          {item.replyTo && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => item.replyTo?._id && jumpToMessage(item.replyTo._id)}
              style={{
                backgroundColor: isDark ? '#27272A' : '#E2E8F0',
                borderRadius: 16,
                borderBottomLeftRadius: 4,
                paddingHorizontal: 13,
                paddingVertical: 7,
                marginBottom: 2,
                maxWidth: '88%',
                alignSelf: 'flex-start',
              }}
            >
              <Text
                style={{
                  color: isDark ? '#A1A1AA' : '#64748B',
                  fontSize: 13,
                  lineHeight: 18,
                }}
                numberOfLines={2}
              >
                {item.replyTo.content}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── MAIN INCOMING MESSAGE BUBBLE ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedTimestampMessageId((prev) => (prev === item._id ? null : item._id))}
            onLongPress={() => setSelectedMessageForAction(item)}
            style={{
              backgroundColor:
                highlightedMessageId === item._id
                  ? (isDark ? 'rgba(245, 158, 11, 0.25)' : '#FEF3C7')
                  : (isDark ? colors.surface : '#FFFFFF'),
              borderColor:
                highlightedMessageId === item._id
                  ? '#F59E0B'
                  : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
              borderWidth: highlightedMessageId === item._id ? 2 : 1,
              borderRadius: 18,
              borderTopLeftRadius: item.replyTo ? 4 : 18,
              borderBottomLeftRadius: 4,
              paddingHorizontal: 14,
              paddingVertical: 9,
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
                <MaterialCommunityIcons name="pin" size={13} color="#EAB308" style={{ transform: [{ rotate: '-45deg' }] }} />
                <Text style={{ color: '#EAB308', fontSize: 10, fontWeight: '700' }}>PINNED ANNOUNCEMENT</Text>
              </View>
            )}
            <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
          </TouchableOpacity>

          {/* ── TAP-TO-SHOW TIMESTAMP FOR INCOMING MESSAGES ── */}
          {isTimestampVisible && (
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3, marginLeft: 4 }}>
              {formatChatTime(item.createdAt)}
            </Text>
          )}

          {/* ── REACTIONS PILLS UNDER BUBBLE ── */}
          {item.reactions && item.reactions.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {item.reactions.map((r, rIdx) => {
                const hasReacted = r.users?.some((u) => u._id === currentUserId);
                return (
                  <TouchableOpacity
                    key={`${item._id}-incoming-react-${r.emoji}-${rIdx}`}
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

      {/* ── CUSTOM ORG CHAT HEADER (Messenger Search / Normal Header) ── */}
      {isSearchActive ? (
        <View
          style={{
            paddingTop: insets.top + 6,
            paddingBottom: 10,
            paddingHorizontal: 14,
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setIsSearchActive(false);
              setSearchQuery('');
              setSearchMatches([]);
              setHighlightedMessageId(null);
            }}
            style={{ padding: 4, marginLeft: -4 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: Platform.OS === 'ios' ? 8 : 4,
              gap: 8,
            }}
          >
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search conversation..."
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, color: colors.textPrimary, fontSize: 14, padding: 0 }}
              returnKeyType="search"
            />
            {isSearchingServer && <ActivityIndicator size="small" color={colors.primary} />}
            {searchQuery.length > 0 && !isSearchingServer && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {searchMatches.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                {currentMatchIndex + 1}/{searchMatches.length}
              </Text>
              <TouchableOpacity onPress={handlePrevMatch} style={{ padding: 3 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="chevron-up" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNextMatch} style={{ padding: 3 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="chevron-down" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
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

            <TouchableOpacity
              onPress={handleChangeOrgLogo}
              activeOpacity={0.8}
              style={{ position: 'relative' }}
            >
              {isUploadingLogo ? (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.primaryMuted,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <OrgHeaderAvatar
                  uri={orgLogoUrl || (currentOrg as any)?.logoUrl || currentOrg?.logo}
                  name={currentOrg?.name}
                  size={32}
                />
              )}
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: isConnected ? '#10B981' : '#F59E0B',
                  borderWidth: 1.5,
                  borderColor: isDark ? colors.surface : '#FFFFFF',
                }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('OrgChatInfo', { orgId: targetOrgId })}
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
                {currentOrg?.name || 'Organization Chat'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4.5, marginTop: 1 }}>
                <View
                  style={{
                    width: 6.5,
                    height: 6.5,
                    borderRadius: 3.25,
                    backgroundColor: onlineUserIds.length > 0 ? '#10B981' : '#94A3B8',
                  }}
                />
                <Text
                  style={{
                    color: onlineUserIds.length > 0 ? '#10B981' : colors.textMuted,
                    fontSize: 11,
                    fontWeight: '600',
                  }}
                >
                  {onlineUserIds.length > 0
                    ? `${onlineUserIds.length} ${onlineUserIds.length === 1 ? 'member' : 'members'} online`
                    : 'Offline'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── MESSENGER-STYLE (i) INFO BUTTON ── */}
          <TouchableOpacity
            onPress={() => navigation.navigate('OrgChatInfo', { orgId: targetOrgId })}
            activeOpacity={0.7}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="information-circle" size={22} color="#6366F1" />
          </TouchableOpacity>
        </View>
      )}

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
            <MaterialCommunityIcons name="pin" size={17} color="#CA8A04" style={{ transform: [{ rotate: '-45deg' }] }} />
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
            keyExtractor={(item, index) => item._id ? `${item._id}` : (item.clientMessageId || `msg-${index}`)}
            renderItem={renderMessageItem}
            contentContainerStyle={{ paddingVertical: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              loadingOlder ? (
                <View style={{ paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            onScroll={(event) => {
              const offsetY = event.nativeEvent.contentOffset.y;
              if (offsetY <= 30 && hasMoreOlder && !loadingOlder && messages.length > 0) {
                void handleLoadOlderMessages();
              }
            }}
            scrollEventThrottle={32}
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
          }}
        >
          {/* ── REPLYING TO PREVIEW BANNER ── */}
          {replyingToMessage && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isDark ? 'rgba(147, 51, 234, 0.12)' : '#F3E8FF',
                borderLeftWidth: 4,
                borderLeftColor: '#9333EA',
                borderTopWidth: 1,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: isDark ? 'rgba(168, 85, 247, 0.25)' : '#E9D5FF',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 7,
                marginBottom: 8,
              }}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <Ionicons name="arrow-undo" size={11} color="#A855F7" />
                  <Text style={{ color: isDark ? '#D8B4FE' : '#6B21A8', fontSize: 11, fontWeight: '800' }}>
                    Replying to {replyingToMessage.sender?.displayName || 'Member'}
                  </Text>
                </View>
                <Text style={{ color: isDark ? '#CBD5E1' : '#475569', fontSize: 12 }} numberOfLines={1}>
                  {replyingToMessage.content}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  setReplyingToMessage(null);
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
                ref={textInputRef}
                style={{
                  color: colors.textPrimary,
                  fontSize: 14,
                  padding: 0,
                }}
                placeholder={
                  replyingToMessage
                    ? `Reply to ${replyingToMessage.sender?.displayName || 'message'}...`
                    : `Message ${currentOrg?.name || 'organization'}...`
                }
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
                {/* ── REPLY ACTION (Instagram/Messenger style) ── */}
                <TouchableOpacity
                  onPress={() => {
                    const target = selectedMessageForAction;
                    setSelectedMessageForAction(null);
                    setReplyingToMessage(target);
                    triggerLightHaptic();
                    setTimeout(() => {
                      textInputRef.current?.focus();
                    }, 150);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(147, 51, 234, 0.15)' : '#F3E8FF',
                    borderColor: isDark ? 'rgba(168, 85, 247, 0.35)' : '#E9D5FF',
                    borderWidth: 1,
                    gap: 10,
                  }}
                >
                  <Ionicons name="arrow-undo-outline" size={18} color="#A855F7" />
                  <Text style={{ color: isDark ? '#D8B4FE' : '#7E22CE', fontWeight: '700', fontSize: 13 }}>
                    Reply to Message
                  </Text>
                </TouchableOpacity>

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

                {userRoleLevel <= 3 && (
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
                    <MaterialCommunityIcons
                      name={selectedMessageForAction.isPinned ? "pin-off" : "pin"}
                      size={19}
                      color="#F59E0B"
                      style={{ transform: [{ rotate: '-45deg' }] }}
                    />
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
