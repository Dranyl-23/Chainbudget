"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Bell, AlertTriangle, ArrowRight, RefreshCw, Check, Box, Info, Clock
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { io, Socket } from "socket.io-client";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { BACKEND_URL } from "@/lib/config";

// ── Types ────────────────────────────────────────────────────────────────────
interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "urgent" | "blockchain" | "system" | "info" | "approval";
  timestamp: string;
  isRead: boolean;
  orgId?: string | null;
  orgName?: string;
}

interface NewNotificationPayload {
  id?: string;
  _id?: string;
  title: string;
  message: string;
  type?: "urgent" | "blockchain" | "system" | "info" | "approval";
  timestamp?: string;
  createdAt?: string;
  orgId?: string;
  organizationId?: string;
  orgName?: string;
}

interface NotificationsResponse {
  notifications?: NotificationItem[];
}

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationsPage() {
  const { activeOrgId, isConnected } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "urgent" | "blockchain" | "system">("all");
  const [orgScope, setOrgScope] = useState<"current" | "all">("current");
  const socketRef = useRef<Socket | null>(null);

  // Manual refresh triggered by user action
  const handleManualRefresh = async () => {
    if (!isConnected || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const scopeOrgId = orgScope === "all" ? "all" : (activeOrgId || "all");
      const res = await api.get<NotificationsResponse>(`/notifications?orgId=${scopeOrgId}`);
      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
        toast.success("Notifications refreshed");
      }
    } catch (err: unknown) {
      console.error("Failed to load notifications:", err);
      toast.error("Failed to load notifications");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial and reactive data loader (no synchronous setState in effect body)
  useEffect(() => {
    let isCancelled = false;

    const loadNotifications = async () => {
      try {
        if (isConnected) {
          const scopeOrgId = orgScope === "all" ? "all" : (activeOrgId || "all");
          const res = await api.get<NotificationsResponse>(`/notifications?orgId=${scopeOrgId}`);
          if (!isCancelled && res.data?.notifications) {
            setNotifications(res.data.notifications);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadNotifications();

    return () => {
      isCancelled = true;
    };
  }, [isConnected, activeOrgId, orgScope]);

  // Real-time Socket.IO listener for live notification events
  useEffect(() => {
    if (!isConnected) return;

    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    const handleNewNotification = (data: NewNotificationPayload) => {
      const targetOrg = data.orgId || data.organizationId;
      if (orgScope === "all" || !targetOrg || targetOrg === activeOrgId) {
        const newNotif: NotificationItem = {
          id: data.id || data._id || String(Date.now()),
          title: data.title,
          message: data.message,
          type: data.type || "info",
          timestamp: data.timestamp || data.createdAt || new Date().toISOString(),
          isRead: false,
          orgId: targetOrg || null,
          orgName: data.orgName || "Organization",
        };

        setNotifications((prev) => [newNotif, ...prev]);
        toast(newNotif.title, {
          icon: "🔔",
          style: {
            borderRadius: "10px",
            background: "#121215",
            color: "#fff",
            border: "1px solid #27272a",
          },
        });
      }
    };

    socket.on("new_notification", handleNewNotification);
    socket.on("notification", handleNewNotification);

    return () => {
      socket.off("new_notification", handleNewNotification);
      socket.off("notification", handleNewNotification);
      socket.disconnect();
    };
  }, [isConnected, activeOrgId, orgScope]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await api.post(`/notifications/${id}/read`);
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    const scopeOrgId = orgScope === "all" ? "all" : (activeOrgId || "all");
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.post("/notifications/read-all", { orgId: scopeOrgId });
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error("Failed to mark all read:", err);
      toast.error("Failed to mark all as read");
    }
  };

  // Filtered Notifications based on active tab
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (activeTab === "unread") return !notif.isRead;
      if (activeTab === "urgent") return notif.type === "urgent" || notif.type === "approval";
      if (activeTab === "blockchain") return notif.type === "blockchain";
      if (activeTab === "system") return notif.type === "system" || notif.type === "info";
      return true;
    });
  }, [notifications, activeTab]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Helper to determine destination link from notification text
  const getActionLink = (notif: NotificationItem) => {
    const lower = `${notif.title} ${notif.message}`.toLowerCase();
    if (lower.includes("approval") || lower.includes("multi-sig") || lower.includes("sign")) {
      return { href: "/dashboard/approvals", label: "Review Multi-Sig" };
    }
    if (lower.includes("transaction") || lower.includes("disbursed") || lower.includes("expense") || lower.includes("receipt")) {
      return { href: "/dashboard/transactions", label: "View Ledger" };
    }
    if (lower.includes("budget") || lower.includes("cap") || lower.includes("envelope")) {
      return { href: "/dashboard/budget", label: "Inspect Budget" };
    }
    if (lower.includes("dao") || lower.includes("proposal") || lower.includes("vote")) {
      return { href: "/dashboard/dao", label: "View Proposal" };
    }
    if (lower.includes("chat") || lower.includes("message")) {
      return { href: "/chat", label: "Open Studio Chat" };
    }
    return null;
  };

  // Icon for notification type
  const getNotificationIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "urgent":
      case "approval":
        return (
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      case "blockchain":
        return (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Box className="w-4 h-4" />
          </div>
        );
      case "system":
        return (
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Info className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      
      {/* ── 1. HEADER SECTION (STUDIO ADMIN STYLE) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-white">Notifications</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-zinc-900 border border-zinc-800 text-zinc-300">
              System Activity
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
            Monitor real-time institutional fund dispatches, multi-sig signoff queues, cryptographic audit entries, and governance alerts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition disabled:opacity-50"
            title="Refresh Notifications"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 transition shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. FILTER TABS & ORG SCOPE SELECTOR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#121215] border border-zinc-800 rounded-xl overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "all"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            All ({notifications.length})
          </button>

          <button
            onClick={() => setActiveTab("unread")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "unread"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("urgent")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "urgent"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            Approvals & Urgent
          </button>

          <button
            onClick={() => setActiveTab("blockchain")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "blockchain"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            Blockchain
          </button>

          <button
            onClick={() => setActiveTab("system")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "system"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            System
          </button>
        </div>

        {/* Organization Filter Scope */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl p-1 self-start sm:self-auto">
          <button
            onClick={() => setOrgScope("current")}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
              orgScope === "current"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Current Org
          </button>
          <button
            onClick={() => setOrgScope("all")}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
              orgScope === "all"
                ? "bg-zinc-800 text-white font-semibold shadow-xs"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            All Organizations
          </button>
        </div>
      </div>

      {/* ── 3. NOTIFICATIONS STREAM ── */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-4 bg-[#121215] border border-zinc-800 rounded-xl animate-pulse flex items-start gap-3.5"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-4 bg-zinc-800 rounded" />
                  <div className="w-2/3 h-3 bg-zinc-850 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-16 text-center bg-[#101014] border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3 shadow-xs">
              <Bell className="w-5 h-5 opacity-40" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">All Caught Up!</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              {activeTab === "unread"
                ? "You have no unread notifications right now."
                : "There are no notifications matching the selected filter criteria."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const action = getActionLink(notif);
            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) {
                    void handleMarkAsRead(notif.id);
                  }
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                  notif.isRead
                    ? "bg-[#101014] border-zinc-800/80 hover:bg-zinc-900/60"
                    : "bg-[#141418] border-zinc-700/80 hover:bg-[#16161b] shadow-xs"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {getNotificationIcon(notif.type)}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold ${notif.isRead ? "text-zinc-300" : "text-white"}`}>
                        {notif.title}
                      </span>

                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" title="Unread" />
                      )}

                      {notif.orgName && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                          {notif.orgName}
                        </span>
                      )}
                    </div>

                    <p className={`text-xs leading-relaxed ${notif.isRead ? "text-zinc-400" : "text-zinc-200"}`}>
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        {timeAgo(notif.timestamp)}
                      </span>
                      <span>•</span>
                      <span>{new Date(notif.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Quick Action Button & Mark Read */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60 w-full sm:w-auto justify-end">
                  {action && (
                    <Link
                      href={action.href}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!notif.isRead) void handleMarkAsRead(notif.id);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 transition shadow-xs"
                    >
                      <span>{action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                    </Link>
                  )}

                  {!notif.isRead && (
                    <button
                      onClick={(e) => void handleMarkAsRead(notif.id, e)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
