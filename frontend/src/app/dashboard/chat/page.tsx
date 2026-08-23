"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { io, Socket } from "socket.io-client";
import {
  Send, Pin, PinOff, Trash2, Copy, Check, MessageSquare, RefreshCw,
  Smile, CheckCheck, UserCircle
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Image from "next/image";

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
  createdAt: string;
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
        className={`rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-[11px] shadow-sm border border-purple-400/30 select-none shrink-0 ${className}`}
      >
        {initial || <UserCircle className="w-full h-full text-purple-300" />}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full overflow-hidden border border-purple-400/30 bg-purple-900/30 shadow-sm shrink-0 ${className}`}
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
  const label = roleLabel || (roleLevel === 1 ? "President" : roleLevel === 2 ? "Auditor" : roleLevel === 3 ? "Treasurer" : "Member");

  switch (roleLevel) {
    case 1:
      return {
        label: `👑 ${label}`,
        bg: "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300",
      };
    case 2:
      return {
        label: `🛡️ ${label}`,
        bg: "bg-cyan-500/15 border-cyan-500/30 text-cyan-300",
      };
    case 3:
      return {
        label: `💼 ${label}`,
        bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
      };
    default:
      return {
        label: `👤 ${label}`,
        bg: "bg-zinc-800/60 border-zinc-700/40 text-zinc-400",
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

export default function OrgChatPage() {
  const { user, activeOrgId, isConnected } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [activeReactingMessageId, setActiveReactingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);

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

  const userRoleLevel = currentMembership?.roleLevel || 4;

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

  // 1. Fetch initial chat history and pinned messages
  const fetchChatData = useCallback(async (showLoadingSpinner = false) => {
    if (!activeOrgId) return;
    if (showLoadingSpinner) setIsLoading(true);
    try {
      const [msgRes, pinRes] = await Promise.all([
        api.get<{ messages: ChatMessage[] }>(`/chat/${activeOrgId}/messages?limit=50`),
        api.get<{ pinned: ChatMessage[] }>(`/chat/${activeOrgId}/pinned`),
      ]);

      setMessages(msgRes.data.messages || []);
      setPinnedMessages(pinRes.data.pinned || []);
      setTimeout(() => scrollToBottom("auto"), 100);
      void markMessagesAsSeen();
    } catch (err: unknown) {
      console.error("[Chat] Failed to load messages:", err);
      toast.error("Could not load organization chat history");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, markMessagesAsSeen]);

  useEffect(() => {
    let isCancelled = false;

    if (activeOrgId) {
      void (async () => {
        try {
          const [msgRes, pinRes] = await Promise.all([
            api.get<{ messages: ChatMessage[] }>(`/chat/${activeOrgId}/messages?limit=50`),
            api.get<{ pinned: ChatMessage[] }>(`/chat/${activeOrgId}/pinned`),
          ]);

          if (!isCancelled) {
            setMessages(msgRes.data.messages || []);
            setPinnedMessages(pinRes.data.pinned || []);
            setIsLoading(false);
            setTimeout(() => scrollToBottom("auto"), 100);
            void markMessagesAsSeen();
          }
        } catch (err: unknown) {
          console.error("[Chat] Failed to load messages:", err);
          if (!isCancelled) {
            toast.error("Could not load organization chat history");
            setIsLoading(false);
          }
        }
      })();
    }

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, markMessagesAsSeen]);

  // 2. Connect to Socket.IO for real-time chat updates
  useEffect(() => {
    if (!activeOrgId) return;

    const token = typeof window !== "undefined" ? (localStorage.getItem("cb_token") || localStorage.getItem("token")) : null;
    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setIsSocketConnected(false);
    });

    socket.on("new_org_message", (data: { orgId: string; message: ChatMessage }) => {
      if (data.orgId === activeOrgId && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        scrollToBottom("smooth");
        void markMessagesAsSeen();
      }
    });

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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeOrgId, currentUserId, markMessagesAsSeen]);

  // 3. Send message handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending || !activeOrgId) return;

    setInputText("");
    setIsSending(true);

    try {
      const res = await api.post<{ message: ChatMessage }>(`/chat/${activeOrgId}/messages`, {
        content: trimmed,
        messageType: "text",
      });

      const sentMsg = res.data.message;
      if (sentMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === sentMsg._id)) return prev;
          return [...prev, sentMsg];
        });
        scrollToBottom("smooth");
      }
    } catch (err: unknown) {
      console.error("[Chat] Send failed:", err);
      toast.error("Failed to send message");
      setInputText(trimmed);
    } finally {
      setIsSending(false);
    }
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
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      await api.delete(`/chat/${activeOrgId}/messages/${messageId}`);
      toast.success("Message deleted");
    } catch {
      toast.error("Failed to delete message");
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
      <div className="flex flex-col items-center justify-center min-h-[65vh] p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
          <MessageSquare className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Organization Chat</h2>
        <p className="text-sm text-zinc-400 max-w-md">
          Please select an active organization in the top navigation bar to open the organization group chat.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex flex-col h-[calc(100vh-4.5rem)] max-w-6xl mx-auto w-full animate-fade-in">
      {/* ── HEADER BAR ── */}
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/60 backdrop-blur-xl border border-white/8 rounded-2xl mb-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold overflow-hidden">
              {currentOrg?.logoUrl ? (
                <Image src={currentOrg.logoUrl} alt="Org" width={40} height={40} className="w-full h-full object-cover" unoptimized />
              ) : (
                <MessageSquare className="w-5 h-5 text-purple-400" />
              )}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                isSocketConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
              title={isSocketConnected ? "Live Connected" : "Connecting..."}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">{currentOrg?.name || "Organization Group Chat"}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                All Roles (L1-L4)
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSocketConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
              {isSocketConnected ? "Real-time stream active" : "Reconnecting to live channel..."}
            </p>
          </div>
        </div>

        <button
          onClick={() => void fetchChatData(true)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition border border-white/5"
          title="Refresh Messages"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── PINNED ANNOUNCEMENTS BANNER ── */}
      {pinnedMessages.length > 0 && (
        <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center justify-between gap-3 text-amber-200 text-xs shadow-sm">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Pin className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-amber-300 mr-2">PINNED ANNOUNCEMENT:</span>
              <span className="text-amber-100">{pinnedMessages[0].content}</span>
            </div>
          </div>
          <span className="text-[10px] text-amber-400/80 font-mono shrink-0">
            {pinnedMessages[0].sender?.displayName || "Executive"}
          </span>
        </div>
      )}

      {/* ── MESSAGES CHAT STREAM ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-950/60 backdrop-blur-md border border-white/8 rounded-2xl mb-4 space-y-4 shadow-inner [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-sm gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <span>Loading organization messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
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
                className={`group flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
              >
                {/* ── SENDER AVATAR (Only for other members on the left side, compact 28px) ── */}
                {!isMe && (
                  <div className="w-7 h-7 shrink-0 mb-0.5">
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

                {/* ── MESSAGE CONTENT CONTAINER ── */}
                <div className={`max-w-[78%] md:max-w-[62%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {/* Sender Name & Role Badge (shown only for incoming messages) */}
                  {!isMe && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-semibold text-zinc-300">{senderName}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                  )}

                  {/* Message Bubble + Floating Toolbar */}
                  <div className="relative group/bubble">
                    <div
                      className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs shadow-md shadow-purple-900/20"
                          : "bg-zinc-900/90 border border-white/8 text-zinc-100 rounded-bl-xs shadow-sm"
                      } ${msg.isPinned ? "border-amber-500/50 ring-1 ring-amber-500/30" : ""}`}
                    >
                      {msg.isPinned && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300 mb-1 pb-1 border-b border-white/10">
                          <Pin className="w-3 h-3" /> Pinned Announcement
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <div
                        className={`text-[10px] mt-1 font-mono flex items-center gap-1.5 ${
                          isMe ? "text-purple-200/70 justify-end" : "text-zinc-500 justify-end"
                        }`}
                      >
                        <span>{formatChatTime(msg.createdAt)}</span>
                        {isMe && (
                          <span title={otherSeenUsers.length > 0 ? "Seen" : "Delivered"}>
                            {otherSeenUsers.length > 0 ? (
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-300 inline" />
                            ) : (
                              <Check className="w-3 h-3 text-purple-200/70 inline" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── HOVER ACTION TOOLBAR ── */}
                    <div
                      className={`absolute top-0 -translate-y-1/2 hidden group-hover/bubble:flex items-center gap-1 p-1 bg-zinc-900 border border-white/15 rounded-xl shadow-xl z-20 ${
                        isMe ? "right-2" : "left-2"
                      }`}
                    >
                      <button
                        onClick={() =>
                          setActiveReactingMessageId(
                            activeReactingMessageId === msg._id ? null : msg._id
                          )
                        }
                        className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-amber-300 rounded-lg transition"
                        title="React with emoji"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => void handleCopyText(msg._id, msg.content)}
                        className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition"
                        title="Copy text"
                      >
                        {copiedId === msg._id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {userRoleLevel <= 2 && (
                        <button
                          onClick={() => void handleTogglePin(msg)}
                          className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-amber-300 rounded-lg transition"
                          title={msg.isPinned ? "Unpin message" : "Pin message"}
                        >
                          {msg.isPinned ? <PinOff className="w-3.5 h-3.5 text-amber-400" /> : <Pin className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {(isMe || userRoleLevel === 1) && (
                        <button
                          onClick={() => void handleDeleteMessage(msg._id)}
                          className="p-1.5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition"
                          title="Delete message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* ── QUICK REACTION EMOJI POPUP ── */}
                    {activeReactingMessageId === msg._id && (
                      <div
                        className={`absolute -top-10 flex items-center gap-1.5 p-1.5 bg-zinc-900/95 border border-purple-500/40 rounded-full shadow-2xl z-30 animate-fade-in ${
                          isMe ? "right-0" : "left-0"
                        }`}
                      >
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => void handleToggleReaction(msg._id, emoji)}
                            className="text-base hover:scale-125 transition-transform p-1 rounded-full hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── REACTION PILLS UNDER BUBBLE ── */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msg.reactions.map((r) => {
                        const hasReacted = r.users?.some((u) => u._id === currentUserId);
                        return (
                          <button
                            key={r.emoji}
                            onClick={() => void handleToggleReaction(msg._id, r.emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition ${
                              hasReacted
                                ? "bg-purple-600/25 border-purple-500/50 text-purple-200"
                                : "bg-zinc-900 border-white/10 text-zinc-400 hover:border-white/20"
                            }`}
                            title={`Reacted by: ${r.users?.map((u) => u.displayName || "Member").join(", ")}`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-bold font-mono">{r.users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* ── SEEN BY AVATARS (Messenger Style: Sleek 14px mini circles below message) ── */}
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
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT COMPOSER ── */}
      <form onSubmit={(e) => void handleSendMessage(e)} className="relative flex items-center gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${currentOrg?.name || "general"}... (Enter to send, Shift+Enter for new line)`}
            className="w-full px-4 py-3.5 pr-12 bg-zinc-900/80 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none max-h-32 shadow-sm transition"
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="h-12 w-12 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg shadow-purple-900/30 transition shrink-0"
        >
          {isSending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
