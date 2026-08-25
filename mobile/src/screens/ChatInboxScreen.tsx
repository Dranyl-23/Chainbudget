/**
 * ChatInboxScreen.tsx
 *
 * Messenger-style Inbox / Conversation List Screen.
 * Allows users to choose which organization to chat in (Org 1, Org 2, etc.),
 * featuring real-time last message previews, active presence stories strip,
 * unread badges, and live search.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';

const BACKEND_BASE = 'https://chainbudget-api.fly.dev';

function formatAvatarUrl(uri?: string) {
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

function formatInboxTime(isoDate?: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  if (diffHours < 168) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface ConversationItem {
  organization: {
    _id: string;
    name: string;
    logo?: string;
    category?: string;
    memberCount?: number;
  };
  lastMessage?: {
    _id: string;
    content: string;
    messageType: 'text' | 'image' | 'system';
    createdAt: string;
    sender?: {
      _id: string;
      displayName?: string;
      avatarUrl?: string;
    };
  } | null;
  unreadCount: number;
  onlineCount: number;
  onlineUserIds: string[];
}

export default function ChatInboxScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { organizations, setActiveOrgId } = useOrg();
  const { on, isConnected } = useSocket();
  const { colors, isDark } = useTheme();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentUserId = user?.id || (user as any)?._id;

  // Load all conversations from server
  const loadConversations = useCallback(async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const res = await api.get('/chat/conversations');
      if (res.data?.conversations) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.warn('[ChatInbox] Failed to load conversations:', err);
      // Fallback: populate from OrgContext
      if (organizations.length > 0) {
        setConversations((prev) => {
          if (prev.length > 0) return prev;
          return organizations.map((org) => ({
            organization: {
              _id: org._id,
              name: org.name,
              logo: (org as any).logoUrl || org.logo,
              category: org.category,
              memberCount: org.memberCount || 1,
            },
            lastMessage: null,
            unreadCount: 0,
            onlineCount: 0,
            onlineUserIds: [],
          }));
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizations]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  // Live real-time updates via Socket.IO
  useEffect(() => {
    const unsubMsg = on('new_org_message', (data: { orgId: string; message: any }) => {
      if (!data.orgId || !data.message) return;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.organization._id === data.orgId);
        if (idx === -1) return prev;
        const updated = [...prev];
        const conv = updated[idx];
        const isFromMe = data.message.sender?._id === currentUserId;
        const updatedConv: ConversationItem = {
          ...conv,
          lastMessage: {
            _id: data.message._id,
            content: data.message.content,
            messageType: data.message.messageType,
            createdAt: data.message.createdAt,
            sender: data.message.sender,
          },
          unreadCount: isFromMe ? conv.unreadCount : conv.unreadCount + 1,
        };
        // Move updated conversation to top of list
        updated.splice(idx, 1);
        return [updatedConv, ...updated];
      });
    });

    const unsubOnline = on('org_online_users', (data: { orgId: string; onlineUserIds: string[] }) => {
      if (!data.orgId || !Array.isArray(data.onlineUserIds)) return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.organization._id === data.orgId) {
            return {
              ...c,
              onlineCount: data.onlineUserIds.length,
              onlineUserIds: data.onlineUserIds,
            };
          }
          return c;
        })
      );
    });

    return () => {
      unsubMsg();
      unsubOnline();
    };
  }, [on, currentUserId]);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.organization.name.toLowerCase().includes(q) ||
        (c.organization.category && c.organization.category.toLowerCase().includes(q)) ||
        (c.lastMessage?.content && c.lastMessage.content.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const handleSelectConversation = (orgId: string) => {
    triggerLightHaptic();
    setActiveOrgId(orgId);
    navigation.navigate('OrgChat', { orgId });
  };

  // Render Messenger-style Conversation Row
  const renderConversationItem = ({ item }: { item: ConversationItem }) => {
    const org = item.organization;
    const logoUri = formatAvatarUrl(org.logo);
    const hasUnread = item.unreadCount > 0;
    const isOnline = item.onlineCount > 0;
    const lastMsg = item.lastMessage;

    // Snippet formatting (e.g. You: ... · Time)
    let snippet = 'No messages yet';
    if (lastMsg) {
      const isMe = lastMsg.sender?._id === currentUserId;
      const senderPrefix = isMe ? 'You: ' : lastMsg.sender?.displayName ? `${lastMsg.sender.displayName.split(' ')[0]}: ` : '';
      if (lastMsg.messageType === 'image') {
        snippet = `${senderPrefix}📷 Photo`;
      } else {
        snippet = `${senderPrefix}${lastMsg.content}`;
      }
    }

    return (
      <TouchableOpacity
        onPress={() => handleSelectConversation(org._id)}
        activeOpacity={0.7}
        style={[
          styles.conversationRow,
          {
            backgroundColor: isDark ? colors.background : '#FFFFFF',
            borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
          },
        ]}
      >
        {/* ── AVATAR WITH ONLINE BADGE (56px Messenger Style) ── */}
        <View style={styles.avatarContainer}>
          <View
            style={[
              styles.avatarBox,
              {
                backgroundColor: isDark ? '#312E81' : '#EEF2FF',
                borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#E0E7FF',
              },
            ]}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarInitial, { color: isDark ? '#C7D2FE' : '#4F46E5' }]}>
                {org.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          {/* Messenger-style Vibrant Green Online Badge */}
          {isOnline && (
            <View
              style={[
                styles.onlineBadge,
                { borderColor: isDark ? colors.background : '#FFFFFF' },
              ]}
            />
          )}
        </View>

        {/* ── CONVERSATION DETAILS ── */}
        <View style={styles.conversationContent}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.orgName,
                {
                  color: colors.textPrimary,
                  fontWeight: hasUnread ? '800' : '700',
                },
              ]}
              numberOfLines={1}
            >
              {org.name}
            </Text>

            {lastMsg?.createdAt && (
              <Text
                style={[
                  styles.timestamp,
                  {
                    color: hasUnread ? '#6366F1' : colors.textMuted,
                    fontWeight: hasUnread ? '700' : '500',
                  },
                ]}
              >
                {formatInboxTime(lastMsg.createdAt)}
              </Text>
            )}
          </View>

          <View style={styles.previewRow}>
            <Text
              style={[
                styles.snippetText,
                {
                  color: hasUnread ? (isDark ? '#F8FAFC' : '#0F172A') : colors.textSecondary,
                  fontWeight: hasUnread ? '700' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {snippet}
            </Text>

            {/* Unread Count Badge */}
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? colors.background : '#FFFFFF' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── TOP HEADER (Messenger Style) ── */}
      <View
        style={[
          styles.headerContainer,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDark ? colors.background : '#FFFFFF',
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                styles.iconButton,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Chats</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => loadConversations(true)}
              style={[
                styles.iconButton,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SEARCH BAR (Messenger "Ask Meta AI or search" style) ── */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
            },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search organizations or chats..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── ACTIVE ORGANIZATIONS / STORIES HORIZONTAL CAROUSEL ── */}
      {conversations.length > 0 && (
        <View style={styles.storiesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesContent}
          >
            {/* Active Organizations Stories */}
            {conversations.map((conv) => {
              const org = conv.organization;
              const logoUri = formatAvatarUrl(org.logo);
              const isOnline = conv.onlineCount > 0;

              return (
                <TouchableOpacity
                  key={org._id}
                  onPress={() => handleSelectConversation(org._id)}
                  activeOpacity={0.7}
                  style={styles.storyItem}
                >
                  <View
                    style={[
                      styles.storyAvatarBox,
                      {
                        backgroundColor: isDark ? '#312E81' : '#EEF2FF',
                        borderColor: isOnline ? '#10B981' : isDark ? '#4338CA' : '#C7D2FE',
                      },
                    ]}
                  >
                    {logoUri ? (
                      <Image source={{ uri: logoUri }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                    ) : (
                      <Text
                        style={{
                          color: isDark ? '#C7D2FE' : '#4F46E5',
                          fontWeight: '800',
                          fontSize: 18,
                        }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </Text>
                    )}

                    {/* Green Online Dot Badge */}
                    {isOnline && (
                      <View
                        style={[
                          styles.onlineBadge,
                          {
                            bottom: 0,
                            right: 0,
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            borderColor: isDark ? colors.background : '#FFFFFF',
                          },
                        ]}
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.storyName,
                      {
                        color: colors.textPrimary,
                        fontWeight: conv.unreadCount > 0 ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {org.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── CONVERSATIONS LIST ── */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading conversations...
          </Text>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconBox,
              { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF' },
            ]}
          >
            <Ionicons name="chatbubbles" size={44} color="#6366F1" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No conversations found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {searchQuery
              ? `No matches found for "${searchQuery}"`
              : 'Join or create an organization to start group conversations with DAO members.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.organization._id}
          renderItem={renderConversationItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadConversations(true)}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  storiesContainer: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  storiesContent: {
    paddingHorizontal: 14,
    gap: 14,
    alignItems: 'center',
  },
  storyItem: {
    alignItems: 'center',
    width: 68,
  },
  storyAvatarBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  storyName: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 54,
    height: 54,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '800',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  orgName: {
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 11,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snippetText: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#6366F1',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
