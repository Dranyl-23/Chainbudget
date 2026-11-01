"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { io, Socket } from "socket.io-client";
import {
  Send, Pin, PinOff, Trash2, Copy, Check, MessageSquare, RefreshCw,
  Smile, CheckCheck, UserCircle, Camera, Info, X, ChevronDown, ChevronUp,
  ShieldCheck, Users, Search, Paperclip, Download, Reply, Hash,
  Inbox, MoreHorizontal, ArrowUpRight, Clock, ArrowLeft
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import ConfirmModal from "@/components/ConfirmModal";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://chainbudget-api.fly.dev";

const REACTION_EMOJIS = ["👍", "❤️", "🥰", "😆", "👎", "😡"];

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
type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

interface ChatMessage {
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
  messageType: "text" | "image" | "system";
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
 * Always-visible message status indicator using Lucide icons.
 * Sending: grey clock | Sent: grey single-check | Delivered: grey double-check
 * Read: cyan double-check | Failed: red x-circle
 */
function MessageStatusIndicator({ status }: { status: MessageStatus }) {
  if (status === "sending") {
    return <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin" />;
  }
  if (status === "failed") {
    return <X className="w-3 h-3 text-red-400" />;
  }
  if (status === "read") {
    return <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />;
  }
  // "sent"
  return <Check className="w-3 h-3 text-zinc-400" />;
}

function ChatAvatar({
  src,
  name,
  size = 28,
  className = "",
}: {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  const formattedSrc = useMemo(() => {
    if (!src) return null;
    if (src.startsWith("data:")) return src;
    if (src.startsWith("/uploads")) {
      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "https://chainbudget-api.fly.dev";
      return `${backendBase}${src}`;
    }
    if (src.includes("localhost:5001") || src.includes("127.0.0.1:5001")) {
      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "https://chainbudget-api.fly.dev";
      return src.replace(/http:\/\/(localhost|127\.0\.0\.1):5001/, backendBase);
    }
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }
    return null;
  }, [src]);

  const initial = (name || "M").trim().charAt(0).toUpperCase();

  if (!formattedSrc || hasError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-semibold text-[11px] select-none shrink-0 ${className}`}
      >
        {initial || <UserCircle className="w-full h-full text-zinc-400" />}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 shrink-0 ${className}`}
    >
      <Image
        src={formattedSrc}
        alt={name || "Avatar"}
        width={size}
        height={size}
        unoptimized
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function getRoleBadge(roleLevel: number, roleLabel?: string) {
  const cleanLabel =
    roleLabel && roleLabel.trim()
      ? roleLabel.trim().replace(/^[\p{Emoji}\s]+/u, '')
      : roleLevel === 1
      ? "President"
      : roleLevel === 2
      ? "Auditor"
      : roleLevel === 3
      ? "Treasurer"
      : "Member";

  switch (roleLevel) {
    case 1:
      return {
        label: cleanLabel || "President",
        bg: "bg-zinc-800 border-zinc-700 text-white font-medium",
      };
    case 2:
      return {
        label: cleanLabel || "Auditor",
        bg: "bg-zinc-850 border-zinc-700 text-zinc-200 font-medium",
      };
    case 3:
      return {
        label: cleanLabel || "Treasurer",
        bg: "bg-zinc-900 border-zinc-800 text-zinc-300 font-medium",
      };
    default:
      return {
        label: cleanLabel || "Member",
        bg: "bg-zinc-900/60 border-zinc-850 text-zinc-400 font-medium",
      };
  }
}

function formatChatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return timeStr;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
}

interface OrgMemberItem {
  _id: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  roleLevel: number;
  roleLabel: string;
}

interface OrgFullDetails {
  _id?: string;
  name?: string;
  description?: string;
  logoUrl?: string;
  treasuryWallet?: string;
  walletAddress?: string;
  highValueThreshold?: number;
  requiredApprovals?: number;
}

interface ChatBootstrapResponse {
  organization?: OrgFullDetails;
  messages: ChatMessage[];
  pinned?: ChatMessage[];
  onlineUserIds?: string[];
  hasMore?: boolean;
  serverTime?: string;
}

interface RawUserMember {
  _id: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  memberships?: Array<{
    organization: string | { _id: string };
    roleLevel?: number;
    roleLabel?: string;
    isActive?: boolean;
  }>;
}

interface LocalChatCacheData {
  messages: ChatMessage[];
  pinned?: ChatMessage[];
  logoUrl?: string;
  cachedAt?: number;
}

function getLocalChatCache(orgId: string): LocalChatCacheData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`cb_chat_cache_${orgId}`);
    return raw ? (JSON.parse(raw) as LocalChatCacheData) : null;
  } catch {
    return null;
  }
}

function setLocalChatCache(orgId: string, data: LocalChatCacheData) {
  if (typeof window === "undefined") return;
  try {
    const payload: LocalChatCacheData = {
      ...data,
      messages: (data.messages || []).slice(-100),
      cachedAt: Date.now(),
    };
    localStorage.setItem(`cb_chat_cache_${orgId}`, JSON.stringify(payload));
  } catch {
    // non-blocking
  }
}

function getLocalMembersCache(orgId: string): OrgMemberItem[] {
  if (typeof window === "undefined" || !orgId) return [];
  try {
    const raw = sessionStorage.getItem(`cb_chat_members_${orgId}`);
    return raw ? (JSON.parse(raw) as OrgMemberItem[]) : [];
  } catch {
    return [];
  }
}

function setLocalMembersCache(orgId: string, members: OrgMemberItem[]) {
  if (typeof window === "undefined" || !orgId) return;
  try {
    sessionStorage.setItem(`cb_chat_members_${orgId}`, JSON.stringify(members));
  } catch {
    // non-blocking
  }
}

interface OutboxItem {
  clientMessageId: string;
  orgId: string;
  content: string;
  messageType?: "text" | "image" | "system";
  replyToId?: string;
  createdAt: string;
}

function getLocalOutbox(orgId: string): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`cb_chat_outbox_${orgId}`);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalOutbox(orgId: string, items: OutboxItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`cb_chat_outbox_${orgId}`, JSON.stringify(items));
  } catch {}
}

function addToLocalOutbox(orgId: string, item: OutboxItem) {
  const current = getLocalOutbox(orgId);
  if (!current.some((i) => i.clientMessageId === item.clientMessageId)) {
    saveLocalOutbox(orgId, [...current, item]);
  }
}

function removeFromLocalOutbox(orgId: string, clientMessageId: string) {
  const current = getLocalOutbox(orgId);
  saveLocalOutbox(
    orgId,
    current.filter((i) => i.clientMessageId !== clientMessageId)
  );
}

export default function StandaloneChatPage() {
  const { user, token: authToken, activeOrgId, setActiveOrgId, isConnected } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [activeReactingMessageId, setActiveReactingMessageId] = useState<string | null>(null);
  const [activeTimestampMessageId, setActiveTimestampMessageId] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | undefined>(undefined);
  const [showChatInfoDrawer, setShowChatInfoDrawer] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMemberItem[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [orgFullDetails, setOrgFullDetails] = useState<OrgFullDetails | null>(null);
  const [openSection, setOpenSection] = useState<{ [key: string]: boolean }>({
    chatInfo: true,
    members: false,
    pinned: false,
    privacy: false,
  });

  // Messenger Search States (Web)
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<ChatMessage[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Studio Admin Layout States
  const [activeTab, setActiveTab] = useState<"all" | "pinned" | "members">("all");
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [activeChannel, setActiveChannel] = useState<string>("general");
  const [threadSearch, setThreadSearch] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"channels" | "threads" | "chat">("chat");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const toggleSection = (key: string) => {
    setOpenSection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Jump to specific message by ID and highlight it
  const jumpToMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
    }, 3500);
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!isSearchActive || !searchQuery.trim()) {
        setSearchMatches([]);
        setCurrentMatchIndex(0);
        return;
      }

      const q = searchQuery.toLowerCase().trim();
      const localMatches = messages.filter((m) => m.content.toLowerCase().includes(q));

      setIsSearchingServer(true);
      try {
        const res = await api.get<{ results: ChatMessage[] }>(
          `/chat/${activeOrgId}/search?q=${encodeURIComponent(q)}`
        );
        const serverResults = res.data?.results || [];

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
      } catch {
        setSearchMatches(localMatches);
        if (localMatches.length > 0) {
          jumpToMessage(localMatches[0]._id);
        }
      } finally {
        setIsSearchingServer(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, isSearchActive, activeOrgId, messages, jumpToMessage]);

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

  const currentUserId = user?.id || (user as { _id?: string })?._id;

  const currentMembership = useMemo(() => {
    return user?.memberships?.find(
      (m) =>
        (typeof m.organization === "object" ? m.organization?._id : m.organization) === activeOrgId
    );
  }, [user, activeOrgId]);

  const currentOrg = useMemo(() => {
    if (!currentMembership?.organization) return null;
    return typeof currentMembership.organization === "object"
      ? currentMembership.organization
      : { _id: currentMembership.organization, name: "Organization", logoUrl: undefined };
  }, [currentMembership]);

  const recentSenders = useMemo(() => {
    const seen = new Set<string>();
    const list: ChatMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const sid = msg.sender?._id;
      if (sid && !seen.has(sid)) {
        seen.add(sid);
        list.push(msg);
      }
      if (list.length >= 8) break;
    }
    return list;
  }, [messages]);

  const filteredMembers = useMemo(() => {
    if (!threadSearch.trim()) return orgMembers;
    const q = threadSearch.toLowerCase().trim();
    return orgMembers.filter(
      (m) =>
        m.displayName?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.roleLabel?.toLowerCase().includes(q)
    );
  }, [orgMembers, threadSearch]);

  const userRoleLevel = currentMembership?.roleLevel || 4;
  const activeOrgLogo = orgLogoUrl || currentOrg?.logoUrl;
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const isLogoVisible = Boolean(activeOrgLogo && activeOrgLogo !== failedLogoUrl);

  // Organization Switcher states (Discord/Slack style)
  const [fetchedOrgs, setFetchedOrgs] = useState<Array<{ _id: string; name: string; logoUrl?: string }>>([]);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchOrgs = async () => {
      try {
        const res = await api.get<Array<{ _id: string; name: string; logoUrl?: string }>>("/organizations/my-orgs");
        if (!isCancelled && Array.isArray(res.data)) {
          setFetchedOrgs(res.data);
        }
      } catch (err) {
        console.warn("Failed to load organizations:", err);
      }
    };
    if (isConnected) {
      void fetchOrgs();
    }
    return () => {
      isCancelled = true;
    };
  }, [isConnected]);

  // Combined list of organizations from API + memberships
  const availableOrgs = useMemo(() => {
    const map = new Map<string, { _id: string; name: string; logoUrl?: string }>();
    
    fetchedOrgs.forEach((o) => {
      if (o._id) map.set(o._id, o);
    });

    const memberships = (user?.memberships || []) as Array<{
      organization?: string | { _id: string; name?: string; logoUrl?: string };
    }>;
    memberships.forEach((m) => {
      const org = m.organization;
      if (typeof org === "object" && org?._id) {
        if (!map.has(org._id)) {
          map.set(org._id, { _id: org._id, name: org.name || "Organization", logoUrl: org.logoUrl });
        }
      } else if (typeof org === "string") {
        if (!map.has(org)) {
          map.set(org, { _id: org, name: "Organization" });
        }
      }
    });

    return Array.from(map.values());
  }, [fetchedOrgs, user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setOrgDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeOrgId) return;

    if (userRoleLevel > 2) {
      toast.error("Only Organization Officers (Level 1 & Level 2) can change the organization picture");
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await api.post<{ documentUrl?: string }>("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const uploadedUrl = uploadRes.data?.documentUrl;
      if (uploadedUrl) {
        await api.patch(`/organizations/${activeOrgId}`, { logoUrl: uploadedUrl });
        setOrgLogoUrl(uploadedUrl);
        toast.success("Organization profile picture updated successfully!");
      }
    } catch {
      toast.error("Failed to upload organization picture");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  // Fetch organization members and full details
  const fetchOrgMembers = useCallback(async (orgId: string) => {
    if (!orgId) return;
    try {
      const [mRes, oRes] = await Promise.all([
        api.get<RawUserMember[]>(`/users/${orgId}/members`),
        api.get<OrgFullDetails>(`/organizations/${orgId}`),
      ]);
      const formatted: OrgMemberItem[] = (mRes.data || []).map((u) => {
        const m = u.memberships?.find(
          (mem) =>
            (typeof mem.organization === "object"
              ? mem.organization?._id
              : mem.organization) === orgId
        );
        return {
          _id: u._id,
          displayName: u.displayName || u.email?.split("@")[0] || "Member",
          avatarUrl: u.avatarUrl,
          email: u.email,
          roleLevel: m?.roleLevel || 4,
          roleLabel:
            m?.roleLabel ||
            (m?.roleLevel === 1 ? "President" : m?.roleLevel === 2 ? "Auditor" : m?.roleLevel === 3 ? "Treasurer" : "Member"),
        };
      });
      setOrgMembers(formatted);
      setLocalMembersCache(orgId, formatted);
      if (oRes.data) {
        setOrgFullDetails(oRes.data);
        if (oRes.data.logoUrl) {
          setOrgLogoUrl(oRes.data.logoUrl);
        }
      }
    } catch (e) {
      console.warn("[Chat] Failed to load organization members:", e);
    }
  }, []);

  // Hydrate members from session cache on mount/switch and background refresh
  useEffect(() => {
    let isCancelled = false;
    if (!activeOrgId) return;

    void (async () => {
      // 1. Instant Cache Hydration (0ms display!)
      const cached = getLocalMembersCache(activeOrgId);
      if (cached && cached.length > 0) {
        if (!isCancelled) {
          setOrgMembers(cached);
        }
      } else {
        if (!isCancelled) {
          setIsLoadingMembers(true);
        }
      }

      // 2. Fetch latest from API
      try {
        const [mRes, oRes] = await Promise.all([
          api.get<RawUserMember[]>(`/users/${activeOrgId}/members`),
          api.get<OrgFullDetails>(`/organizations/${activeOrgId}`),
        ]);
        if (isCancelled) return;
        const formatted: OrgMemberItem[] = (mRes.data || []).map((u) => {
          const m = u.memberships?.find(
            (mem) =>
              (typeof mem.organization === "object"
                ? mem.organization?._id
                : mem.organization) === activeOrgId
          );
          return {
            _id: u._id,
            displayName: u.displayName || u.email?.split("@")[0] || "Member",
            avatarUrl: u.avatarUrl,
            email: u.email,
            roleLevel: m?.roleLevel || 4,
            roleLabel:
              m?.roleLabel ||
              (m?.roleLevel === 1 ? "President" : m?.roleLevel === 2 ? "Auditor" : m?.roleLevel === 3 ? "Treasurer" : "Member"),
          };
        });
        setOrgMembers(formatted);
        setLocalMembersCache(activeOrgId, formatted);
        if (oRes.data) {
          setOrgFullDetails(oRes.data);
          if (oRes.data.logoUrl) {
            setOrgLogoUrl(oRes.data.logoUrl);
          }
        }
      } catch (e) {
        console.warn("[Chat] Failed to load organization members:", e);
      } finally {
        if (!isCancelled) {
          setIsLoadingMembers(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Mark all unread messages in current org as seen
  const markMessagesAsSeen = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      await api.post(`/chat/${activeOrgId}/seen`, {});
    } catch {
      // non-blocking
    }
  }, [activeOrgId]);

  // Load older messages (cursor pagination going upwards)
  const handleLoadOlderMessages = useCallback(async () => {
    if (!activeOrgId || isLoadingOlder || !hasMoreOlder || messages.length === 0) return;

    const oldest = messages[0];
    if (!oldest?.createdAt) return;

    setIsLoadingOlder(true);
    const container = messagesContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    try {
      const res = await api.get<{ messages: ChatMessage[]; hasMore?: boolean }>(
        `/chat/${activeOrgId}/messages?before=${encodeURIComponent(oldest.createdAt)}&limit=30`
      );

      const olderMessages = res.data?.messages || [];
      if (olderMessages.length === 0) {
        setHasMoreOlder(false);
      } else {
        setHasMoreOlder(res.data?.hasMore ?? olderMessages.length === 30);
        setMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          for (const m of olderMessages) {
            map.set(m._id, m);
          }
          for (const m of prev) {
            map.set(m._id, m);
          }
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setLocalChatCache(activeOrgId, {
            messages: merged,
            pinned: pinnedMessages,
            logoUrl: orgLogoUrl,
          });
          return merged;
        });

        // Maintain exact scroll position after prepending messages
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
          }
        });
      }
    } catch (err) {
      console.error("[Chat] Failed to load older messages:", err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [activeOrgId, isLoadingOlder, hasMoreOlder, messages, pinnedMessages, orgLogoUrl]);

  // Detect reaching top of feed to load earlier messages
  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop <= 40 && hasMoreOlder && !isLoadingOlder) {
      void handleLoadOlderMessages();
    }
  };

  // 1. Fetch initial chat history, pinned messages, organization details, and online members in a single fast roundtrip
  const fetchChatData = useCallback(async (showLoadingSpinner = false) => {
    if (!activeOrgId) return;
    if (showLoadingSpinner) setIsLoading(true);
    try {
      const res = await api.get<ChatBootstrapResponse>(`/chat/${activeOrgId}/bootstrap?limit=50`);
      const { messages: serverMsgs = [], pinned = [], organization: org, onlineUserIds: onlineIds = [], hasMore } = res.data || {};

      setMessages((prev) => {
        const optimistic = prev.filter((m) => m._id.startsWith("temp-"));
        const map = new Map<string, ChatMessage>();
        for (const m of serverMsgs) {
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
        setLocalChatCache(activeOrgId, {
          messages: merged,
          pinned,
          logoUrl: org?.logoUrl || orgLogoUrl,
        });
        return merged;
      });

      setPinnedMessages(pinned);
      if (typeof hasMore === "boolean") setHasMoreOlder(hasMore);
      if (org?.logoUrl) {
        setOrgLogoUrl(org.logoUrl);
      }
      if (onlineIds) {
        setOnlineUserIds(onlineIds);
      }
      setTimeout(() => scrollToBottom("auto"), 100);
      void markMessagesAsSeen();
    } catch (err: unknown) {
      console.error("[Chat] Failed to bootstrap chat data:", err);
      toast.error("Could not load organization chat history");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, markMessagesAsSeen, orgLogoUrl]);

  useEffect(() => {
    let isCancelled = false;

    if (!activeOrgId) return;

    // Silent Cache Hydration + Background Revalidation via Unified Bootstrap
    void (async () => {
      // 1. Instant Cache Hydration (0ms display!)
      const cached = getLocalChatCache(activeOrgId);
      if (cached && cached.messages && cached.messages.length > 0) {
        if (!isCancelled) {
          setMessages(cached.messages);
          if (cached.pinned) setPinnedMessages(cached.pinned);
          if (cached.logoUrl) setOrgLogoUrl(cached.logoUrl);
          setIsLoading(false);
          setTimeout(() => scrollToBottom("auto"), 20);
        }
      } else {
        if (!isCancelled) {
          setIsLoading(true);
        }
      }

      // 2. Background Revalidation via Unified Bootstrap
      try {
        const res = await api.get<ChatBootstrapResponse>(`/chat/${activeOrgId}/bootstrap?limit=50`);
        if (!isCancelled && res.data) {
          const { messages: serverMsgs = [], pinned = [], organization: org, onlineUserIds: onlineIds = [], hasMore } = res.data;
          setMessages((prev) => {
            const optimistic = prev.filter((m) => m._id.startsWith("temp-"));
            const map = new Map<string, ChatMessage>();
            for (const m of serverMsgs) {
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
            setLocalChatCache(activeOrgId, {
              messages: merged,
              pinned,
              logoUrl: org?.logoUrl,
            });
            return merged;
          });

          setPinnedMessages(pinned);
          if (typeof hasMore === "boolean") setHasMoreOlder(hasMore);
          if (org?.logoUrl) {
            setOrgLogoUrl(org.logoUrl);
          }
          if (onlineIds) {
            setOnlineUserIds(onlineIds);
          }
          setIsLoading(false);
          if (!cached || cached.messages.length === 0) {
            setTimeout(() => scrollToBottom("auto"), 50);
          }
          void markMessagesAsSeen();
        }
      } catch (err: unknown) {
        console.error("[Chat] Failed to bootstrap chat data:", err);
        if (!isCancelled) {
          if (!cached) {
            toast.error("Could not load organization chat history");
          }
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, markMessagesAsSeen]);

  // Flush local Outbox (automatically sends pending offline messages upon reconnect)
  const flushOutbox = useCallback(async () => {
    if (!activeOrgId) return;
    const pending = getLocalOutbox(activeOrgId);
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        const res = await api.post<{ message: ChatMessage }>(`/chat/${activeOrgId}/messages`, {
          content: item.content,
          messageType: item.messageType || "text",
          replyTo: item.replyToId || undefined,
          clientMessageId: item.clientMessageId,
        });

        removeFromLocalOutbox(activeOrgId, item.clientMessageId);

        if (res.data?.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMessageId === item.clientMessageId || m._id === item.clientMessageId
                ? { ...res.data.message, status: "sent", _localContent: item.content }
                : m
            )
          );
        }
      } catch {
        break; // Stop and retry later if network still unavailable
      }
    }
  }, [activeOrgId]);

  // 2. Connect to Socket.IO for real-time chat updates with token resolution
  useEffect(() => {
    if (!activeOrgId) return;

    let socket: Socket | null = null;
    let isCancelled = false;

    const setupSocket = async () => {
      let token = authToken;
      if (!token) {
        try {
          const tokenRes = await fetch("/api/auth/token", { cache: "no-store" });
          if (tokenRes.ok) {
            const data = await tokenRes.json();
            token = data.token || undefined;
          }
        } catch {
          // Continue with undefined token (read-only broadcast fallback)
        }
      }

      if (isCancelled) return;

      socket = io(BACKEND_URL, {
        auth: { token },
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 25,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setIsSocketConnected(true);
        socket?.emit("join_org", activeOrgId);
        socket?.emit("get_org_online", activeOrgId);
        if (token) {
          socket?.emit("authenticate", { token });
        }
        void flushOutbox();
      });

      socket.on("connect_error", (err) => {
        console.warn("[Chat] Socket connection warning:", err.message);
      });

      socket.on("reconnect", () => {
        setIsSocketConnected(true);
        socket?.emit("join_org", activeOrgId);
        socket?.emit("get_org_online", activeOrgId);
        if (token) {
          socket?.emit("authenticate", { token });
        }
        void flushOutbox();
      });

      socket.on("disconnect", () => {
        setIsSocketConnected(false);
      });

      socket.on("org_online_users", (data: { orgId: string; onlineUserIds: string[] }) => {
        if (data.orgId === activeOrgId && Array.isArray(data.onlineUserIds)) {
          setOnlineUserIds(data.onlineUserIds);
        }
      });

      socket.on("new_org_message", (data: { orgId: string; message: ChatMessage }) => {
        if (data.orgId === activeOrgId && data.message) {
          setMessages((prev) => {
            const tempMsg = prev.find(
              (m) =>
                (data.message.clientMessageId && m.clientMessageId === data.message.clientMessageId) ||
                (data.message.clientMessageId && m._id === data.message.clientMessageId) ||
                (m._id.startsWith("temp-") && m.content === data.message.content)
            );
            if (tempMsg) {
              return prev.map((m) =>
                m._id === tempMsg._id
                  ? { ...data.message, status: "sent" as MessageStatus, _localContent: data.message.content }
                  : m
              );
            }
            if (prev.some((m) => m._id === data.message._id)) return prev;
            return [...prev, data.message];
          });
          scrollToBottom("smooth");
          void markMessagesAsSeen();

          // Auto-acknowledge delivery for messages from OTHER users (fire-and-forget)
          if (data.message.sender?._id !== currentUserId) {
            api
              .post(`/chat/${activeOrgId}/messages/${data.message._id}/delivered`)
              .catch(() => {});
          }
        }
      });

      // Upgrade sender's tick from 'sent' → 'delivered' when recipient's browser receives it
      socket.on(
        "org_message_delivered",
        (data: { orgId: string; messageId: string; user: UserRef }) => {
          if (data.orgId === activeOrgId && data.user._id !== currentUserId) {
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

      socket.on("org_message_reacted", (data: { orgId: string; messageId: string; reactions: ReactionGroup[] }) => {
        if (data.orgId === activeOrgId) {
          setMessages((prev) =>
            prev.map((m) => (m._id === data.messageId ? { ...m, reactions: data.reactions } : m))
          );
        }
      });

      socket.on("org_messages_seen", (data: { orgId: string; userId: string; user: UserRef }) => {
        if (data.orgId === activeOrgId && data.userId !== currentUserId) {
          setMessages((prev) =>
            prev.map((m) => {
              const alreadySeen = m.seenBy?.some((u) => u._id === data.userId);
              if (alreadySeen) return m;
              return { ...m, seenBy: [...(m.seenBy || []), data.user] };
            })
          );
        }
      });

      socket.on("org_message_pinned", (data: { orgId: string; message: ChatMessage }) => {
        if (data.orgId === activeOrgId && data.message) {
          setMessages((prev) =>
            prev.map((m) => (m._id === data.message._id ? data.message : m))
          );
          if (data.message.isPinned) {
            setPinnedMessages((prev) => [data.message, ...prev.filter((p) => p._id !== data.message._id)]);
          } else {
            setPinnedMessages((prev) => prev.filter((p) => p._id !== data.message._id));
          }
        }
      });

      socket.on("org_message_deleted", (data: { orgId: string; messageId: string }) => {
        if (data.orgId === activeOrgId) {
          setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
          setPinnedMessages((prev) => prev.filter((p) => p._id !== data.messageId));
        }
      });

      socket.on("org_updated", (data: { orgId: string; logoUrl?: string; name?: string }) => {
        if (data.orgId === activeOrgId) {
          if (data.logoUrl) {
            setOrgLogoUrl(data.logoUrl);
          }
          void fetchOrgMembers(activeOrgId);
        }
      });

      socket.on("org_membership_updated", (data: { orgId: string }) => {
        if (data?.orgId === activeOrgId) {
          void fetchOrgMembers(activeOrgId);
        }
      });
    };

    void setupSocket();

    const handleOnline = () => {
      void flushOutbox();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      isCancelled = true;
      window.removeEventListener("online", handleOnline);
      if (socket) {
        socket.emit("leave_org", activeOrgId);
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [activeOrgId, authToken, currentUserId, markMessagesAsSeen, flushOutbox, fetchOrgMembers]);

  // Synchronize dynamic socket authentication whenever authToken updates
  useEffect(() => {
    if (authToken && socketRef.current?.connected) {
      socketRef.current.emit("authenticate", { token: authToken });
    }
  }, [authToken]);

  // 3. Live background polling sync (every 3.5s) ensuring messages arrive even if WebSocket drops or reconnects
  useEffect(() => {
    if (!activeOrgId) return;

    const syncInterval = setInterval(() => {
      api
        .get<{ messages: ChatMessage[] }>(`/chat/${activeOrgId}/messages?limit=25`)
        .then((res) => {
          const freshList = res.data?.messages || [];
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
                      (fresh.clientMessageId &&
                        (m.clientMessageId === fresh.clientMessageId || m._id === fresh.clientMessageId)) ||
                      ((m._id.startsWith("temp-") || m._id.startsWith("msg-")) &&
                        m.content === fresh.content &&
                        Math.abs(new Date(m.createdAt).getTime() - new Date(fresh.createdAt).getTime()) < 60000)
                  );
                  if (tempIdx !== -1) {
                    merged[tempIdx] = { ...fresh, status: "sent" as MessageStatus };
                    hasNew = true;
                  } else {
                    merged.push(fresh);
                    hasNew = true;
                  }
                }
              }
              if (!hasNew) return prev;
              merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
              setLocalChatCache(activeOrgId, {
                messages: merged,
                pinned: pinnedMessages,
                logoUrl: orgLogoUrl,
              });
              return merged;
            });
          }
        })
        .catch(() => {});
    }, 3500);

    return () => {
      clearInterval(syncInterval);
    };
  }, [activeOrgId, pinnedMessages, orgLogoUrl]);

  /**
   * Derives the display status of a sent message from its data.
   * 'sending'/'failed' are client-side only. 'read' > 'delivered' > 'sent' on server.
   */
  const deriveStatus = (msg: ChatMessage): MessageStatus => {
    if (msg.status === "sending") return "sending";
    if (msg.status === "failed") return "failed";
    const otherSeen = (msg.seenBy || []).some((u) => u._id !== currentUserId);
    if (otherSeen) return "read";
    const otherDelivered = (msg.deliveredTo || []).some(
      (u) => (typeof u === "object" && u?._id ? u._id : u) !== currentUserId
    );
    if (otherDelivered) return "delivered";
    return "sent";
  };

  // 3. Instant Optimistic Send message handler (0ms UI latency)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending || !activeOrgId) return;

    const currentReply = replyingToMessage;
    setReplyingToMessage(null);

    const clientMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const tempId = clientMessageId;
    const roleLevel = userRoleLevel;
    const roleLabel =
      currentMembership?.roleLabel ||
      (roleLevel === 1 ? "President" : roleLevel === 2 ? "Auditor" : roleLevel === 3 ? "Treasurer" : "Member");

    const optimisticMessage: ChatMessage = {
      _id: tempId,
      clientMessageId,
      organization: activeOrgId,
      sender: {
        _id: currentUserId || "me",
        displayName: user?.displayName || "Me",
        avatarUrl: user?.avatarUrl,
        walletAddress: user?.walletAddress,
        email: (user as { email?: string })?.email,
      },
      content: trimmed,
      messageType: "text",
      roleLevel,
      roleLabel,
      isPinned: false,
      reactions: [],
      seenBy: [
        {
          _id: currentUserId || "me",
          displayName: user?.displayName || "Me",
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
      status: "sending",
      _localContent: trimmed,
    };

    // 1. Instantly render in UI with 0ms delay!
    setInputText("");
    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom("smooth"), 20);
    setIsSending(true);

    // 2. Persist in local Outbox queue for offline resilience
    addToLocalOutbox(activeOrgId, {
      clientMessageId,
      orgId: activeOrgId,
      content: trimmed,
      messageType: "text",
      replyToId: currentReply?._id,
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await api.post<{ message: ChatMessage; isDuplicate?: boolean }>(
        `/chat/${activeOrgId}/messages`,
        {
          content: trimmed,
          messageType: "text",
          replyTo: currentReply?._id || undefined,
          clientMessageId,
        }
      );

      removeFromLocalOutbox(activeOrgId, clientMessageId);

      const sentMsg = res.data.message;
      if (sentMsg) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === tempId || m.clientMessageId === clientMessageId
              ? { ...sentMsg, status: "sent", _localContent: trimmed }
              : m
          )
        );
      }
    } catch (err: unknown) {
      console.error("[Chat] Send failed:", err);
      // Keep message bubble with 'failed' status and in Outbox for manual/auto retry
      setMessages((prev) =>
        prev.map((m) =>
          m._id === tempId ? { ...m, status: "failed" } : m
        )
      );
      if (currentReply) {
        setReplyingToMessage(currentReply);
      }
    } finally {
      setIsSending(false);
    }
  };

  // 3b. Retry a failed message with idempotent key
  const handleRetryMessage = async (failedMsg: ChatMessage) => {
    if (!failedMsg._localContent || !activeOrgId) return;
    const trimmed = failedMsg._localContent;
    const clientMessageId = failedMsg.clientMessageId || failedMsg._id;

    setMessages((prev) =>
      prev.map((m) =>
        m._id === failedMsg._id ? { ...m, status: "sending" } : m
      )
    );

    try {
      const res = await api.post<{ message: ChatMessage; isDuplicate?: boolean }>(
        `/chat/${activeOrgId}/messages`,
        {
          content: trimmed,
          messageType: failedMsg.messageType || "text",
          replyTo: failedMsg.replyTo?._id || undefined,
          clientMessageId,
        }
      );

      removeFromLocalOutbox(activeOrgId, clientMessageId);

      const sentMsg = res.data?.message;
      if (sentMsg) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === failedMsg._id || m.clientMessageId === clientMessageId
              ? { ...sentMsg, status: "sent", _localContent: trimmed }
              : m
          )
        );
      }
    } catch (err: unknown) {
      console.error("[Chat] Retry failed:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === failedMsg._id ? { ...m, status: "failed" } : m
        )
      );
    }
  };

  // 3.5 Send Image Attachment Handler
  const handleSendAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeOrgId) {
      toast.error("No active organization selected");
      return;
    }
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB");
      return;
    }

    setIsUploadingAttachment(true);
    const clientMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const tempId = clientMessageId;
    const roleLevel = userRoleLevel;
    const roleLabel =
      currentMembership?.roleLabel ||
      (roleLevel === 1 ? "President" : roleLevel === 2 ? "Auditor" : roleLevel === 3 ? "Treasurer" : "Member");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const localDataUrl = event.target?.result as string;

      const optimisticMessage: ChatMessage = {
        _id: tempId,
        clientMessageId,
        organization: activeOrgId,
        sender: {
          _id: currentUserId || "me",
          displayName: user?.displayName || "Me",
          avatarUrl: user?.avatarUrl,
          walletAddress: user?.walletAddress,
          email: (user as { email?: string })?.email,
        },
        content: localDataUrl,
        messageType: "image",
        roleLevel,
        roleLabel,
        isPinned: false,
        reactions: [],
        seenBy: [
          {
            _id: currentUserId || "me",
            displayName: user?.displayName || "Me",
            avatarUrl: user?.avatarUrl,
          },
        ],
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setTimeout(() => scrollToBottom("smooth"), 20);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await api.post<{ documentUrl?: string }>("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const finalUrl = uploadRes.data?.documentUrl || localDataUrl;

        const res = await api.post<{ message: ChatMessage }>(`/chat/${activeOrgId}/messages`, {
          content: finalUrl,
          messageType: "image",
          clientMessageId,
        });

        if (res.data?.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === tempId || m.clientMessageId === clientMessageId
                ? res.data.message
                : m
            )
          );
        }
      } catch (err: unknown) {
        console.error("Failed to send image attachment:", err);
        toast.error("Failed to upload image");
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
      } finally {
        setIsUploadingAttachment(false);
        if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  // 4. Toggle Reaction Handler
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActiveReactingMessageId(null);
    try {
      const res = await api.post<{ reactions: ReactionGroup[] }>(
        `/chat/${activeOrgId}/messages/${messageId}/react`,
        { emoji }
      );
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions: res.data.reactions } : m))
      );
    } catch {
      toast.error("Failed to update reaction");
    }
  };

  // 5. Pin / Unpin message handler
  const handleTogglePin = async (message: ChatMessage) => {
    try {
      await api.post(`/chat/${activeOrgId}/messages/${message._id}/pin`);
      toast.success(message.isPinned ? "Message unpinned" : "Message pinned to announcements");
    } catch {
      toast.error("Failed to update pin state");
    }
  };

  // 6. Delete message handler
  const [messageToDeleteId, setMessageToDeleteId] = useState<string | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  const handleDeleteMessage = (messageId: string) => {
    setMessageToDeleteId(messageId);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDeleteId || !activeOrgId) return;
    setIsDeletingMessage(true);
    try {
      await api.delete(`/chat/${activeOrgId}/messages/${messageToDeleteId}`);
      toast.success("Message deleted");
      setMessageToDeleteId(null);
    } catch {
      toast.error("Failed to delete message");
    } finally {
      setIsDeletingMessage(false);
    }
  };

  // 7. Copy text helper
  const handleCopyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  if (!isConnected || !activeOrgId) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#09090b] p-6 text-center select-none">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mb-4 shadow-sm">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white mb-1.5">No Active Organization Selected</h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
          Please select an active organization in your dashboard or log in to participate in decentralized DAO chat channels.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <Link
            href="/"
            className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg transition shadow-sm"
          >
            Connect Wallet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen min-h-screen bg-[#09090b] flex flex-col overflow-hidden text-zinc-100 select-none">
      
      {/* ── TOP HEADER (FULL-WIDTH STUDIO ADMIN STANDALONE BAR) ── */}
      <header className="h-14 px-4 bg-[#09090b] border-b border-zinc-800 flex items-center justify-between shrink-0 z-30 select-none">
        {/* Left: Back to Dashboard */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition shadow-xs"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>

        {/* Center: Search conversations... */}
        <div className="hidden md:flex items-center w-72 lg:w-96">
          <div className="flex items-center gap-2 bg-[#121215] border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-400 w-full transition">
            <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              placeholder="Search conversations, channels..."
              className="bg-transparent text-xs text-white placeholder-zinc-500 outline-none w-full"
            />
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-800 rounded border border-zinc-700">
              /
            </kbd>
          </div>
        </div>

        {/* Right: Network Status, Refresh, User Profile */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Polygon Amoy</span>
          </div>

          <button
            onClick={() => void fetchChatData(true)}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            title="Refresh Feed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
            <div className="relative">
              <ChatAvatar src={user?.avatarUrl} name={user?.displayName} size={28} />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-950" />
            </div>
            <span className="text-xs font-semibold text-white hidden lg:inline max-w-[120px] truncate">
              {user?.displayName || "Member"}
            </span>
          </div>
        </div>
      </header>

      {/* ── 3-COLUMN WORKSPACE (EDGE-TO-EDGE, FILLING REMAINING HEIGHT) ── */}
      <div className="flex-1 min-h-0 w-full flex flex-col md:flex-row bg-[#0c0c0e] overflow-hidden relative">
      
      {/* ── MOBILE VIEW NAVIGATION SWITCHER BAR (ONLY ON MOBILE: md:hidden) ── */}
      <div className="md:hidden flex items-center justify-between p-2.5 bg-[#0e0e11] border-b border-zinc-800 shrink-0 select-none">
        <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-xl w-full">
          <button
            type="button"
            onClick={() => setMobilePanel("channels")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              mobilePanel === "channels"
                ? "bg-white text-zinc-950 font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Hash className="w-3.5 h-3.5 shrink-0" />
            <span>Channels</span>
          </button>

          <button
            type="button"
            onClick={() => setMobilePanel("threads")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              mobilePanel === "threads"
                ? "bg-white text-zinc-950 font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Inbox className="w-3.5 h-3.5 shrink-0" />
            <span>Inbox</span>
            <span className={`text-[10px] font-mono px-1 rounded-full ${
              mobilePanel === "threads" ? "bg-zinc-200 text-zinc-950 font-bold" : "bg-zinc-800 text-zinc-400"
            }`}>
              {messages.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobilePanel("chat")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              mobilePanel === "chat"
                ? "bg-white text-zinc-950 font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>Chat</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>
      </div>

      {/* ── 1. COLUMN 1: INBOXES & CHANNELS (LEFT SIDEBAR) ── */}
      <div className={`w-full md:w-60 shrink-0 flex-col bg-[#09090b] border-r border-zinc-800 select-none ${
        mobilePanel === "channels" ? "flex" : "hidden xl:flex"
      }`}>
        {/* ── DISCORD / SLACK STYLE ORGANIZATION SELECTOR HEADER ── */}
        <div className="relative border-b border-zinc-800 shrink-0" ref={orgDropdownRef}>
          <button
            type="button"
            onClick={() => setOrgDropdownOpen((prev) => !prev)}
            className="w-full px-3.5 py-3 flex items-center justify-between hover:bg-zinc-900/80 transition-colors text-left group select-none"
            title="Click to switch organization"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-zinc-850 border border-zinc-750 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0 overflow-hidden shadow-xs">
                {activeOrgLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeOrgLogo} alt={currentOrg?.name || "Org"} className="w-full h-full object-cover" />
                ) : (
                  <span>{(currentOrg?.name || "O").charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-white truncate max-w-[125px]">
                    {currentOrg?.name || "Select Organization"}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <p className="text-[10px] text-zinc-400 truncate">
                  {currentMembership?.roleLabel || "Member"} • Switch DAO
                </p>
              </div>
            </div>

            <ChevronDown
              className={`w-4 h-4 text-zinc-400 group-hover:text-white transition-transform shrink-0 ${
                orgDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {orgDropdownOpen && (
            <div className="absolute top-full left-2 right-2 mt-1 bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 animate-fade-in">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80 flex items-center justify-between">
                <span>Select Organization</span>
                <span className="font-mono text-[10px] text-zinc-400">{availableOrgs.length}</span>
              </div>
              <div className="max-h-56 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                {availableOrgs.map((org) => {
                  const isSelected = org._id === activeOrgId;
                  return (
                    <button
                      key={org._id}
                      type="button"
                      onClick={() => {
                        setActiveOrgId(org._id);
                        setOrgDropdownOpen(false);
                        toast.success(`Switched to ${org.name}`);
                      }}
                      className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? "bg-zinc-800 text-white font-semibold"
                          : "text-zinc-300 hover:text-white hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-[11px] text-white shrink-0 overflow-hidden">
                          {org.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{org.name.charAt(0)}</span>
                          )}
                        </div>
                        <span className="truncate text-left">{org.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                    </button>
                  );
                })}
                {availableOrgs.length === 0 && (
                  <div className="px-3 py-3 text-xs text-zinc-500 italic text-center">
                    No other organizations
                  </div>
                )}
              </div>
              <div className="border-t border-zinc-800/80 mt-1 pt-1 px-1">
                <Link
                  href="/dashboard"
                  onClick={() => setOrgDropdownOpen(false)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center justify-between transition"
                >
                  <span>Manage in Dashboard</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-500" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Quick Search Conversations Input */}
        <div className="p-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400">
            <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              placeholder="Search conversations..."
              className="bg-transparent text-xs text-white placeholder-zinc-500 outline-none w-full"
            />
          </div>
        </div>

        {/* Inboxes Navigation List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 custom-scrollbar">
          <div>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  setActiveChannel("general");
                  setActiveTab("all");
                  setMobilePanel("chat");
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeChannel === "general" && activeTab === "all"
                    ? "bg-zinc-800/90 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Inbox className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Inbox</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                  {messages.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("pinned");
                  setMobilePanel("threads");
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "pinned"
                    ? "bg-zinc-800/90 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Pin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Pinned</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                  {pinnedMessages.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("members");
                  setMobilePanel("threads");
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "members"
                    ? "bg-zinc-800/90 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Members</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                  {orgMembers.length}
                </span>
              </button>
            </div>
          </div>

          {/* DAO Channels Section */}
          <div>
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
              Channels
            </span>
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  setActiveChannel("general");
                  setMobilePanel("chat");
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeChannel === "general"
                    ? "bg-zinc-800/90 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">general-discussion</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              </button>

              <Link
                href="/dashboard/dao"
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">dao-governance</span>
                </span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500" />
              </Link>

              <Link
                href="/dashboard/treasury"
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">treasury-vault</span>
                </span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500" />
              </Link>

              <Link
                href="/dashboard/approvals"
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">multi-sig-queue</span>
                </span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500" />
              </Link>

              <Link
                href="/dashboard/audit"
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">cryptographic-audit</span>
                </span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500" />
              </Link>
            </div>
          </div>

          {/* Views & Accountability */}
          <div>
            <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
              Views
            </span>
            <div className="space-y-0.5">
              <button
                onClick={() => setShowChatInfoDrawer(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">Executive Signers</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {orgMembers.filter((m) => m.roleLevel <= 2).length || 2}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* User Profile Footer Pill */}
        <div className="p-3 border-t border-zinc-800 bg-[#09090b] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <ChatAvatar src={user?.avatarUrl} name={user?.displayName || "Me"} size={28} />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-950" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.displayName || "Member"}</p>
              <p className="text-[10px] text-zinc-400 truncate">{currentMembership?.roleLabel || "Member"}</p>
            </div>
          </div>
          <Link href="/dashboard/settings" className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition">
            <MoreHorizontal className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── 2. COLUMN 2: CONVERSATION & THREAD LIST (MIDDLE PANEL) ── */}
      <div className={`w-full md:w-72 lg:w-80 shrink-0 flex flex-col bg-[#101014] border-r border-zinc-800 ${
        mobilePanel === "threads" ? "flex" : "hidden md:flex"
      }`}>
        {/* Panel Header */}
        <div className="px-4 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobilePanel("channels")}
              className="md:hidden p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1 text-xs mr-1"
              title="Open Channels"
            >
              <Hash className="w-3.5 h-3.5" />
            </button>
            <Inbox className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm font-semibold text-white">Inbox</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void fetchChatData(true)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Refresh conversation list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMobilePanel("chat")}
              className="md:hidden px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1 text-xs font-medium"
              title="Open Chat"
            >
              <span>Chat</span>
              <MessageSquare className="w-3 h-3 text-emerald-400" />
            </button>
          </div>
        </div>

        {/* Segmented Filter Tabs (Studio Admin Style) */}
        <div className="flex items-center border-b border-zinc-800 px-3 gap-4 text-xs bg-zinc-900/40">
          <button
            onClick={() => setActiveTab("all")}
            className={`py-2.5 font-medium transition-all ${
              activeTab === "all" ? "text-white font-semibold border-b-2 border-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            All ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab("pinned")}
            className={`py-2.5 font-medium transition-all ${
              activeTab === "pinned" ? "text-white font-semibold border-b-2 border-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Pinned ({pinnedMessages.length})
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`py-2.5 font-medium transition-all ${
              activeTab === "members" ? "text-white font-semibold border-b-2 border-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            Members ({orgMembers.length})
          </button>
        </div>

        {/* Thread Cards List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60 custom-scrollbar">
          {activeTab === "all" && (
            <>
              {/* Pinned Announcements Section Header */}
              {pinnedMessages.length > 0 && (
                <div className="bg-zinc-900/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Pin className="w-3 h-3" />
                  <span>Pinned ({pinnedMessages.length})</span>
                </div>
              )}

              {pinnedMessages.map((pinned) => (
                <div
                  key={`pin-thread-${pinned._id}`}
                  onClick={() => {
                    jumpToMessage(pinned._id);
                    setMobilePanel("chat");
                  }}
                  className="p-3 hover:bg-zinc-900/80 cursor-pointer transition-colors border-l-2 border-l-amber-400/80"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChatAvatar src={pinned.sender?.avatarUrl} name={pinned.sender?.displayName || "Officer"} size={22} />
                      <span className="text-xs font-semibold text-white truncate">
                        {pinned.sender?.displayName || "Officer"}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                      {formatChatTime(pinned.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/90 line-clamp-2 leading-relaxed">
                    {pinned.content}
                  </p>
                </div>
              ))}

              {/* General Active Chat Discussion Card */}
              <div className="bg-zinc-900/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>Active Conversation</span>
              </div>

              <div
                onClick={() => setMobilePanel("chat")}
                className="p-3 bg-zinc-900/90 border-l-2 border-l-white cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden">
                        {(currentOrg?.name || "O").charAt(0)}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-900" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white block truncate">
                        {currentOrg?.name || "Organization General"}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-medium block">Active DAO Channel</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                    {messages.length > 0 ? formatChatTime(messages[messages.length - 1].createdAt) : "Just now"}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed pl-9">
                  {messages.length > 0 ? messages[messages.length - 1].content : "No messages yet. Start the conversation!"}
                </p>
              </div>

              {/* Recent Active Members in Chat */}
              {recentSenders.length > 0 && (
                <>
                  <div className="bg-zinc-900/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Recent Participants
                  </div>
                  {recentSenders.map((msg) => (
                    <div
                      key={`sender-${msg._id}`}
                      onClick={() => {
                        jumpToMessage(msg._id);
                        setMobilePanel("chat");
                      }}
                      className="p-3 hover:bg-zinc-900/60 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChatAvatar src={msg.sender?.avatarUrl} name={msg.sender?.displayName || "Member"} size={22} />
                          <span className="text-xs font-medium text-zinc-200 truncate">
                            {msg.sender?.displayName || "Member"}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {formatChatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed pl-7">
                        {msg.content}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === "pinned" && (
            <div className="p-2 space-y-2">
              {pinnedMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  <Pin className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
                  No pinned announcements in this channel
                </div>
              ) : (
                pinnedMessages.map((pin) => (
                  <div
                    key={`pinned-tab-${pin._id}`}
                    onClick={() => {
                      jumpToMessage(pin._id);
                      setMobilePanel("chat");
                    }}
                    className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-white">{pin.sender?.displayName || "Officer"}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{formatChatTime(pin.createdAt)}</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{pin.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "members" && (
            <div className="p-2 space-y-1">
              {isLoadingMembers && orgMembers.length === 0 ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 animate-pulse">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-zinc-800" />
                        <div className="space-y-1.5">
                          <div className="w-24 h-3 bg-zinc-800 rounded" />
                          <div className="w-12 h-2 bg-zinc-800/70 rounded" />
                        </div>
                      </div>
                      <div className="w-14 h-4 bg-zinc-800 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  <Users className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
                  {threadSearch.trim() ? "No members matching your search" : "No members found in this organization"}
                </div>
              ) : (
                filteredMembers.map((m) => {
                  const badge = getRoleBadge(m.roleLevel, m.roleLabel);
                  const isOnline = onlineUserIds.includes(m._id);
                  return (
                    <div
                      key={`member-tab-${m._id}`}
                      className="p-2.5 rounded-lg hover:bg-zinc-900 flex items-center justify-between gap-2 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <ChatAvatar src={m.avatarUrl} name={m.displayName || "Member"} size={26} />
                          {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-900" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-white block truncate">{m.displayName || "Member"}</span>
                          <span className={`text-[10px] ${isOnline ? "text-emerald-400 font-medium" : "text-zinc-500"}`}>
                            {isOnline ? "Active now" : "Offline"}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. COLUMN 3: ACTIVE CONVERSATION & STUDIO ADMIN COMPOSER (MAIN PANEL) ── */}
      <div className={`flex-1 flex flex-col bg-[#09090b] min-w-0 h-full relative ${
        mobilePanel === "chat" ? "flex" : "hidden md:flex"
      }`}>
        {/* Top Active Chat Header Bar */}
        <div className="px-4 py-3 bg-[#121215] border-b border-zinc-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back button on mobile */}
            <div className="md:hidden flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setMobilePanel("threads")}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1 text-xs"
                title="Back to Inbox"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Inbox</span>
              </button>
            </div>

            {/* Org Logo / Avatar with Live Dot */}
            <div className="relative group/logo shrink-0">
              <input
                type="file"
                ref={logoInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleLogoUpload(e)}
              />
              <button
                type="button"
                onClick={() => {
                  if (userRoleLevel <= 2) {
                    logoInputRef.current?.click();
                  }
                }}
                disabled={userRoleLevel > 2 || isUploadingLogo}
                className={`w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold overflow-hidden relative ${
                  userRoleLevel <= 2 ? "cursor-pointer hover:border-zinc-700 hover:opacity-90" : "cursor-default"
                }`}
                title={userRoleLevel <= 2 ? "Click to change organization emblem" : "Organization Emblem"}
              >
                {isUploadingLogo ? (
                  <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
                ) : isLogoVisible && activeOrgLogo ? (
                  <Image
                    src={activeOrgLogo.startsWith("/") ? `${BACKEND_URL}${activeOrgLogo}` : activeOrgLogo}
                    alt="Org"
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                    unoptimized
                    onError={() => setFailedLogoUrl(activeOrgLogo)}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-850 flex items-center justify-center text-zinc-200 text-xs font-bold uppercase">
                    {(currentOrg?.name || "O").charAt(0)}
                  </div>
                )}

                {userRoleLevel <= 2 && !isUploadingLogo && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#121215] pointer-events-none ${
                  isSocketConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
                title={isSocketConnected ? "Live Connected" : "Connecting..."}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-white truncate">
                  {currentOrg?.name || "Organization"} • General
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  DAO
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {onlineUserIds.length > 0 ? `${onlineUserIds.length} online` : "Connected"} • Active DAO • Polygon Amoy
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchActive((prev) => !prev)}
              className={`p-2 rounded-lg transition border ${
                isSearchActive
                  ? "bg-white text-zinc-950 border-white font-semibold"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800"
              }`}
              title="Search conversation"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => void fetchChatData(true)}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition border border-zinc-800"
              title="Refresh Messages"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowChatInfoDrawer((prev) => !prev)}
              className={`p-2 rounded-lg transition border ${
                showChatInfoDrawer
                  ? "bg-white text-zinc-950 border-white font-semibold"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800"
              }`}
              title="Chat details & DAO stats"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline Search Bar (when active) */}
        {isSearchActive && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#121215] border-b border-zinc-800 shadow-xs gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                ref={searchInputRef}
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages in this conversation..."
                className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none flex-1"
              />
              {isSearchingServer && <RefreshCw className="w-3.5 h-3.5 text-zinc-400 animate-spin" />}
              {searchQuery && !isSearchingServer && (
                <button onClick={() => setSearchQuery("")} className="text-zinc-500 hover:text-white p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {searchMatches.length > 0 && (
                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300">
                  <span className="font-mono text-[11px] font-bold">
                    {currentMatchIndex + 1}/{searchMatches.length}
                  </span>
                  <button
                    onClick={handlePrevMatch}
                    className="p-0.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition"
                    title="Previous match"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextMatch}
                    className="p-0.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition"
                    title="Next match"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  setIsSearchActive(false);
                  setSearchQuery("");
                  setSearchMatches([]);
                  setHighlightedMessageId(null);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Pinned Announcement Pill Alert (Studio Admin Style) */}
        {pinnedMessages.length > 0 && (
          <div
            onClick={() => jumpToMessage(pinnedMessages[0]._id)}
            className="px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-zinc-900 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 shrink-0">
                <Pin className="w-3 h-3" /> Pinned
              </span>
              <p className="text-zinc-300 truncate">
                {pinnedMessages[0].content}
              </p>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono shrink-0">
              {pinnedMessages[0].sender?.displayName || "Officer"}
            </span>
          </div>
        )}

        {/* ── MESSAGES CHAT STREAM ── */}
        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar"
        >
          {isLoadingOlder && (
            <div className="flex items-center justify-center py-2 text-xs text-zinc-400 gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Loading older messages...</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-sm gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-400" />
              <span>Loading organization messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Welcome to {currentOrg?.name || "Org"} Chat!</h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                Start the discussion! Send proposals, clarify fund liquidation questions, or share updates with your organization members.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender?._id === currentUserId;
              const badge = getRoleBadge(msg.roleLevel, msg.roleLabel);
              const senderName = msg.sender?.displayName || "Member";

              const isLastInSequence =
                index === messages.length - 1 ||
                messages[index + 1]?.sender?._id !== msg.sender?._id;

              const otherSeenUsers = (msg.seenBy || []).filter(
                (u) => u._id !== currentUserId && u._id !== msg.sender?._id
              );

              return (
                <div
                  key={msg._id}
                  className={`group flex items-end gap-2.5 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {/* Left Avatar for other members */}
                  {!isMe && (
                    <div className="w-7 h-7 shrink-0 mb-1 relative">
                      {isLastInSequence ? (
                        <>
                          <ChatAvatar
                            src={msg.sender?.avatarUrl}
                            name={senderName}
                            size={28}
                          />
                          {onlineUserIds.includes(msg.sender?._id || "") && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-900" />
                          )}
                        </>
                      ) : (
                        <div className="w-7 h-7" />
                      )}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className={`max-w-[82%] md:max-w-[65%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {/* Reply Header if Quoted */}
                    {msg.replyTo ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium mb-1 px-1">
                        <Reply className="w-3 h-3 text-zinc-400" />
                        <span>
                          {isMe
                            ? `You replied to ${msg.replyTo.sender?._id === user?.id ? "yourself" : msg.replyTo.sender?.displayName || "Member"}`
                            : `${senderName} replied to ${msg.replyTo.sender?._id === user?.id ? "you" : msg.replyTo.sender?.displayName || "Member"}`}
                        </span>
                      </div>
                    ) : !isMe ? (
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-semibold text-zinc-300">{senderName}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>
                    ) : null}

                    {/* Quoted Message Pill */}
                    {msg.replyTo && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (msg.replyTo?._id) jumpToMessage(msg.replyTo._id);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs max-w-sm mb-1 cursor-pointer select-none transition-all ${
                          isMe
                            ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700/90 self-end"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700/90 self-start"
                        }`}
                      >
                        <p className="line-clamp-2 text-[12px] leading-snug opacity-90">{msg.replyTo.content}</p>
                      </div>
                    )}

                    {/* Message Bubble + Floating Hover Toolbar */}
                    <div className="relative group/bubble">
                      <div
                        id={`msg-${msg._id}`}
                        onClick={() =>
                          setActiveTimestampMessageId(
                            activeTimestampMessageId === msg._id ? null : msg._id
                          )
                        }
                        className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed cursor-pointer select-text transition-all ${
                          isMe
                            ? `bg-white text-zinc-950 font-normal rounded-tr-xs shadow-xs ${msg.replyTo ? "rounded-tr-xs" : ""}`
                            : `bg-[#18181b] border border-zinc-800 text-zinc-200 rounded-tl-xs shadow-xs ${msg.replyTo ? "rounded-tl-xs" : ""}`
                        } ${msg.isPinned ? "border-amber-500/50 ring-1 ring-amber-500/30" : ""} ${
                          highlightedMessageId === msg._id
                            ? "ring-2 ring-white border-white scale-[1.01]"
                            : msg.status === "failed" && isMe
                            ? "ring-1 ring-rose-500/60"
                            : ""
                        }`}
                      >
                        {msg.isPinned && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300 mb-1 pb-1 border-b border-white/10">
                            <Pin className="w-3 h-3" /> Pinned Announcement
                          </div>
                        )}
                        {msg.messageType === "image" || (typeof msg.content === "string" && (msg.content.startsWith("data:image/") || msg.content.match(/\.(jpeg|jpg|png|gif|webp)(\?.*)?$/i))) ? (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImagePreview(msg.content.startsWith("/") ? `${BACKEND_URL}${msg.content}` : msg.content);
                            }}
                            className="rounded-lg overflow-hidden my-1 max-w-xs cursor-pointer group/img relative border border-zinc-800 shadow-xs hover:border-zinc-600 transition-all"
                          >
                            <Image
                              src={msg.content.startsWith("/") ? `${BACKEND_URL}${msg.content}` : msg.content}
                              alt="Shared photo"
                              width={320}
                              height={240}
                              unoptimized
                              className="w-full max-h-72 object-cover transition-transform duration-200 group-hover/img:scale-105"
                            />
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap wrap-break-word">{msg.content}</p>
                        )}
                      </div>

                      {/* Always-visible Status Row (own messages only) */}
                      {isMe && (
                        <div
                          className={`text-[10px] mt-1 font-mono flex items-center gap-1.5 px-1 ${
                            isMe ? "text-zinc-400 justify-end" : "text-zinc-500 justify-start"
                          }`}
                        >
                          <span>{formatChatTime(msg.createdAt)}</span>
                          <MessageStatusIndicator status={deriveStatus(msg)} />
                          {deriveStatus(msg) === "failed" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleRetryMessage(msg);
                              }}
                              className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors ml-1"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              Retry
                            </button>
                          )}
                        </div>
                      )}

                      {/* Hover Action Toolbar */}
                      <div
                        className={`absolute top-0 -translate-y-1/2 hidden group-hover/bubble:flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-20 ${
                          isMe ? "right-2" : "left-2"
                        }`}
                      >
                        {/* Reply button */}
                        <button
                          onClick={() => {
                            setReplyingToMessage(msg);
                            textareaRef.current?.focus();
                          }}
                          className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
                          title="Reply to message"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() =>
                            setActiveReactingMessageId(
                              activeReactingMessageId === msg._id ? null : msg._id
                            )
                          }
                          className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
                          title="React with emoji"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => void handleCopyText(msg._id, msg.content)}
                          className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
                          title="Copy message"
                        >
                          {copiedId === msg._id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {userRoleLevel <= 3 && (
                          <button
                            onClick={() => void handleTogglePin(msg)}
                            className={`p-1.5 hover:bg-zinc-800 rounded-lg transition ${
                              msg.isPinned ? "text-amber-400 hover:text-amber-300" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                            title={msg.isPinned ? "Unpin message" : "Pin announcement"}
                          >
                            {msg.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {(isMe || userRoleLevel <= 2) && (
                          <button
                            onClick={() => void handleDeleteMessage(msg._id)}
                            className="p-1.5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Emoji Picker Popup */}
                      {activeReactingMessageId === msg._id && (
                        <div
                          className={`absolute -top-12 ${
                            isMe ? "right-0" : "left-0"
                          } flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 p-1.5 rounded-xl shadow-2xl z-30 animate-in zoom-in-90 duration-150`}
                        >
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => void handleToggleReaction(msg._id, emoji)}
                              className="text-lg hover:scale-125 hover:bg-zinc-800 p-1 rounded-lg transition transform"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reactions Pills */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {msg.reactions.map((r, rIdx) => {
                          const hasReacted = r.users.some((u) => u._id === currentUserId);
                          return (
                            <button
                              key={rIdx}
                              onClick={() => void handleToggleReaction(msg._id, r.emoji)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${
                                hasReacted
                                  ? "bg-white text-zinc-950 font-bold border-zinc-200"
                                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                              }`}
                              title={r.users.map((u) => u.displayName || "Member").join(", ")}
                            >
                              <span>{r.emoji}</span>
                              <span className="text-[10px] font-bold font-mono">{r.users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Seen by avatars */}
                    {isMe && otherSeenUsers.length > 0 && isLastInSequence && (
                      <div
                        className="flex items-center gap-1 mt-1 pr-1 self-end"
                        title={`Seen by ${otherSeenUsers.map((u) => u.displayName || "Member").join(", ")}`}
                      >
                        <span className="text-[9px] text-zinc-500 font-medium mr-0.5">Seen</span>
                        <div className="flex -space-x-1 overflow-hidden">
                          {otherSeenUsers.slice(0, 4).map((u) => (
                            <ChatAvatar
                              key={u._id}
                              src={u.avatarUrl}
                              name={u.displayName || "M"}
                              size={14}
                              className="text-[7px]"
                            />
                          ))}
                        </div>
                        {otherSeenUsers.length > 4 && (
                          <span className="text-[8px] text-zinc-400">+{otherSeenUsers.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sender Avatar for own messages */}
                  {isMe && (
                    <div className="w-7 h-7 shrink-0 mb-1">
                      {isLastInSequence ? (
                        <ChatAvatar
                          src={msg.sender?.avatarUrl}
                          name={senderName}
                          size={28}
                        />
                      ) : (
                        <div className="w-7 h-7" />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── STUDIO ADMIN COMPOSER (BOTTOM PANEL) ── */}
        <div className="p-3 md:p-4 bg-[#0c0c0e] border-t border-zinc-800">
          {/* Mode Switcher Tabs (Studio Admin Style: Reply | Internal Note) */}
          <div className="flex items-center gap-4 mb-2 px-1">
            <button
              type="button"
              onClick={() => setComposerTab("reply")}
              className={`text-xs pb-1 font-medium transition-colors ${
                composerTab === "reply"
                  ? "text-white font-semibold border-b-2 border-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Reply
            </button>

            {userRoleLevel <= 2 && (
              <button
                type="button"
                onClick={() => setComposerTab("note")}
                className={`text-xs pb-1 font-medium transition-colors flex items-center gap-1.5 ${
                  composerTab === "note"
                    ? "text-white font-semibold border-b-2 border-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Pin className="w-3 h-3 text-amber-400" />
                <span>Officer Announcement</span>
              </button>
            )}
          </div>

          {/* Replying Preview Banner */}
          {replyingToMessage && (
            <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-zinc-900 border border-zinc-800 border-l-2 border-l-white rounded-lg text-xs shadow-xs">
              <div className="flex items-center gap-2 overflow-hidden mr-2">
                <Reply className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-zinc-200 mr-1.5">
                    Replying to {replyingToMessage.sender?.displayName || "Member"}:
                  </span>
                  <span className="text-zinc-400 italic">
                    {replyingToMessage.content}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingToMessage(null)}
                className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition shrink-0 cursor-pointer"
                title="Cancel reply"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input Card Container */}
          <div className="bg-[#121215] border border-zinc-800 focus-within:border-zinc-700 rounded-xl p-2.5 shadow-xs transition-colors">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                composerTab === "note"
                  ? "Post an official pinned announcement to all organization members..."
                  : replyingToMessage
                  ? `Reply to ${replyingToMessage.sender?.displayName || "message"}... (Enter to send)`
                  : `Type your message... (Enter to send, Shift+Enter for new line)`
              }
              className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none resize-none max-h-32 custom-scrollbar"
            />

            {/* Bottom Actions Toolbar inside Card */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 mt-1">
              <div className="flex items-center gap-1 text-zinc-400">
                <input
                  type="file"
                  ref={attachmentInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleSendAttachment(e)}
                />

                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isUploadingAttachment || isSending}
                  className="p-1.5 rounded-lg hover:bg-zinc-850 hover:text-white transition disabled:opacity-50"
                  title="Attach file or photo"
                >
                  {isUploadingAttachment ? (
                    <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                  className="p-1.5 rounded-lg hover:bg-zinc-850 hover:text-white transition"
                  title="Insert emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>

                {isEmojiPickerOpen && (
                  <div className="absolute bottom-16 left-4 flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 p-2 rounded-xl shadow-2xl z-30 animate-in zoom-in-95 duration-150">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setInputText((prev) => prev + emoji);
                          setIsEmojiPickerOpen(false);
                          textareaRef.current?.focus();
                        }}
                        className="text-lg hover:scale-125 hover:bg-zinc-800 p-1 rounded-lg transition transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={(e) => void handleSendMessage(e)}
                disabled={!inputText.trim() || isSending}
                className="bg-white hover:bg-zinc-200 text-zinc-950 px-3.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {isSending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FULLSCREEN IMAGE PREVIEW MODAL ── */}
      {selectedImagePreview && (
        <div 
          onClick={() => setSelectedImagePreview(null)}
          className="fixed inset-0 z-9999 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              title="Close image"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
              <Image
                src={selectedImagePreview}
                alt="Enlarged photo"
                width={800}
                height={600}
                unoptimized
                className="max-h-[82vh] w-auto object-contain"
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <a
                href={selectedImagePreview}
                target="_blank"
                rel="noreferrer"
                download="chat-image"
                className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold flex items-center gap-2 shadow-sm transition"
              >
                <Download className="w-4 h-4" /> Open Full Image
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── STUDIO ADMIN / MESSENGER CHAT INFO DRAWER (SLIDE-OVER) ── */}
      {showChatInfoDrawer && (
        <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-[#121215] border-l border-zinc-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Info className="w-4 h-4 text-zinc-400" /> Chat details
            </h2>
            <button
              onClick={() => setShowChatInfoDrawer(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Close info"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Org Profile Header */}
            <div className="flex flex-col items-center text-center pt-2">
              <div className="relative group/avatar mb-3">
                <div className="w-20 h-20 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 font-bold overflow-hidden shadow-sm">
                  {activeOrgLogo && !failedLogoUrl ? (
                    <Image
                      src={activeOrgLogo.startsWith("/") ? `${BACKEND_URL}${activeOrgLogo}` : activeOrgLogo}
                      alt="Org"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                      unoptimized
                      onError={() => setFailedLogoUrl(activeOrgLogo)}
                    />
                  ) : (
                    <span className="text-2xl">{currentOrg?.name?.charAt(0).toUpperCase() || "O"}</span>
                  )}
                </div>

                {userRoleLevel <= 2 && (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-white hover:bg-zinc-200 rounded-lg text-zinc-950 shadow-md transition"
                    title="Change picture"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <h3 className="text-base font-semibold text-zinc-100">{currentOrg?.name}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {orgMembers.length > 0 ? `${orgMembers.length} members` : "Organization Group"} • Active DAO
              </p>

              {/* Quick Actions */}
              <div className="flex items-center justify-center gap-2 mt-4 w-full">
                <button
                  onClick={() => {
                    setShowChatInfoDrawer(false);
                    setIsSearchActive(true);
                  }}
                  className="flex-1 py-2 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 flex items-center justify-center gap-1.5 transition"
                >
                  <Search className="w-3.5 h-3.5 text-zinc-400" /> Search
                </button>
                {userRoleLevel <= 2 && (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="flex-1 py-2 px-2.5 bg-white hover:bg-zinc-200 border border-white rounded-lg text-xs font-semibold text-zinc-950 flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Camera className="w-3.5 h-3.5" /> Photo
                  </button>
                )}
                <button
                  onClick={() => {
                    const wallet = orgFullDetails?.treasuryWallet || orgFullDetails?.walletAddress;
                    if (wallet) {
                      void navigator.clipboard.writeText(wallet);
                      toast.success("Wallet address copied!");
                    }
                  }}
                  className="flex-1 py-2 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 flex items-center justify-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" /> Copy
                </button>
              </div>
            </div>

            {/* Accordion 1: Chat Info */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40">
              <button
                onClick={() => toggleSection("chatInfo")}
                className="w-full p-3 flex items-center justify-between text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
              >
                <span className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-zinc-400" /> Chat info
                </span>
                {openSection.chatInfo ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
              </button>

              {openSection.chatInfo && (
                <div className="p-3 border-t border-zinc-800 text-xs space-y-3 text-zinc-300 bg-zinc-950/40">
                  {orgFullDetails?.description && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Description</span>
                      <p className="text-zinc-300 leading-relaxed">{orgFullDetails.description}</p>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Treasury Address</span>
                    <p className="font-mono text-[11px] text-zinc-200 break-all">
                      {orgFullDetails?.treasuryWallet || orgFullDetails?.walletAddress || "0x..."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Threshold</span>
                      <span className="font-semibold text-zinc-100">
                        ₱{Number(orgFullDetails?.highValueThreshold || 5000).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Approvals</span>
                      <span className="font-semibold text-zinc-100">
                        {orgFullDetails?.requiredApprovals || 2} Signatures
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Chat Members */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40">
              <button
                onClick={() => toggleSection("members")}
                className="w-full p-3 flex items-center justify-between text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-zinc-400" /> Chat members ({orgMembers.length})
                </span>
                {openSection.members ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
              </button>

              {openSection.members && (
                <div className="p-3 border-t border-zinc-800 space-y-2.5 max-h-60 overflow-y-auto bg-zinc-950/40">
                  {orgMembers.map((m, idx) => {
                    const badge = getRoleBadge(m.roleLevel, m.roleLabel);
                    const mName = m.displayName || "Member";
                    const isOnline = onlineUserIds.includes(m._id);
                    return (
                      <div key={m._id || idx} className="flex items-center justify-between text-xs py-1 border-b border-zinc-800/80 last:border-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <ChatAvatar src={m.avatarUrl} name={mName} size={26} />
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-900" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-zinc-200 block truncate">{mName}</span>
                            {isOnline && (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Active now
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Accordion 3: Pinned Announcements */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40">
              <button
                onClick={() => toggleSection("pinned")}
                className="w-full p-3 flex items-center justify-between text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
              >
                <span className="flex items-center gap-2">
                  <Pin className="w-3.5 h-3.5 text-zinc-400" /> Pinned announcements ({pinnedMessages.length})
                </span>
                {openSection.pinned ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
              </button>

              {openSection.pinned && (
                <div className="p-3 border-t border-zinc-800 space-y-2 bg-zinc-950/40">
                  {pinnedMessages.length === 0 ? (
                    <p className="text-xs text-zinc-500">No pinned announcements</p>
                  ) : (
                    pinnedMessages.map((pin) => (
                      <div key={pin._id} className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs space-y-1">
                        <p className="text-zinc-200">{pin.content}</p>
                        <span className="text-[10px] text-zinc-400 font-mono block">
                          Pinned by {pin.sender?.displayName || "Officer"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Accordion 4: Privacy & Governance */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40">
              <button
                onClick={() => toggleSection("privacy")}
                className="w-full p-3 flex items-center justify-between text-xs font-semibold text-zinc-200 hover:bg-zinc-800/40 transition"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" /> Privacy & governance
                </span>
                {openSection.privacy ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
              </button>

              {openSection.privacy && (
                <div className="p-3 border-t border-zinc-800 text-xs text-zinc-400 space-y-2 bg-zinc-950/40 leading-relaxed">
                  <p>All organizational budget votes, multi-sig signoffs, and expense liquidations are cryptographically recorded and decentralized.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ── Delete Message Confirmation Modal ── */}
      <ConfirmModal
        isOpen={Boolean(messageToDeleteId)}
        title="Delete Message"
        message="Are you sure you want to delete this message? This message will be permanently removed from this channel."
        confirmText="Delete Message"
        variant="danger"
        isLoading={isDeletingMessage}
        onConfirm={confirmDeleteMessage}
        onCancel={() => setMessageToDeleteId(null)}
      />
    </div>
  );
}
