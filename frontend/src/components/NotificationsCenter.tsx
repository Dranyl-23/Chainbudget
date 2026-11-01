"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, AlertCircle, CheckCircle2, Link as LinkIcon, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { io, Socket } from "socket.io-client";
import api from "@/lib/api";
import { BACKEND_URL } from "@/lib/config";

// ── Types ────────────────────────────────────────────────────────────────────
interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "urgent" | "blockchain" | "system" | "info";
  timestamp: string;
  isRead: boolean;
}

interface NewNotificationPayload {
  id?: string;
  _id?: string;
  title: string;
  message: string;
  type?: "urgent" | "blockchain" | "system" | "info";
  timestamp?: string;
  createdAt?: string;
  orgId?: string;
  organizationId?: string;
}

interface NotificationsResponse {
  notifications?: NotificationItem[];
}

export default function NotificationsCenter() {
  const { activeOrgId, isConnected } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Fetch initial notifications
  useEffect(() => {
    if (!isConnected || !activeOrgId) return;

    let isCancelled = false;

    const fetchNotifications = async () => {
      try {
        const res = await api.get<NotificationsResponse>(`/notifications?orgId=${activeOrgId}`);
        if (!isCancelled && res.data.notifications) {
          setNotifications(res.data.notifications);
        }
      } catch (error: unknown) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    void fetchNotifications();

    return () => {
      isCancelled = true;
    };
  }, [isConnected, activeOrgId]);

  // Connect to Socket.IO and listen for real-time events
  useEffect(() => {
    if (!isConnected || !activeOrgId) return;

    const backendUrl = BACKEND_URL;
    const socket = io(backendUrl);
    socketRef.current = socket;

    const handleNewNotification = (data: NewNotificationPayload) => {
      const targetOrg = data.orgId || data.organizationId;
      // Only process notifications for the active organization
      if (!targetOrg || targetOrg === activeOrgId) {
        const newNotif: NotificationItem = {
          id: data.id || data._id || String(Date.now()),
          title: data.title,
          message: data.message,
          type: data.type || "info",
          timestamp: data.timestamp || data.createdAt || new Date().toISOString(),
          isRead: false,
        };

        setNotifications((prev) => [newNotif, ...prev]);
      }
    };

    socket.on("new_notification", handleNewNotification);

    return () => {
      socket.off("new_notification", handleNewNotification);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isConnected, activeOrgId]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.post("/notifications/read-all", { orgId: activeOrgId });
    } catch (err: unknown) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "urgent":
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case "blockchain":
        return <LinkIcon className="w-4 h-4 text-zinc-300" />;
      case "system":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  if (!isConnected) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors border ${
          isOpen 
            ? "bg-zinc-800 border-zinc-700 text-white" 
            : "border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
        }`}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full ring-2 ring-[#09090b]" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#121215] rounded-xl border border-zinc-800 shadow-2xl overflow-hidden z-50 animate-fade-in origin-top-right">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#0e0e11]">
            <h3 className="font-semibold text-xs tracking-wider uppercase text-zinc-300 flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-zinc-800 text-zinc-200 text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 font-medium">
                  {unreadCount} New
                </span>
              )}
            </h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-zinc-500">
                <Bell className="w-7 h-7 mb-2 opacity-30 text-zinc-500" />
                <p className="text-xs">No recent notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 flex gap-3 hover:bg-zinc-900/60 transition-colors cursor-pointer ${
                      !notif.isRead ? "bg-zinc-900/30" : ""
                    }`}
                    onClick={async () => {
                      if (!notif.isRead) {
                        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
                        try {
                          await api.post(`/notifications/${notif.id}/read`);
                        } catch (err: unknown) {
                          console.error("Failed to mark notification as read:", err);
                        }
                      }
                    }}
                  >
                    <div className="shrink-0 mt-0.5">
                      {getIconForType(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${!notif.isRead ? "text-zinc-100" : "text-zinc-400"}`}>
                        {notif.title}
                      </p>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${!notif.isRead ? "text-zinc-300" : "text-zinc-500"}`}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1.5 font-mono">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="shrink-0 flex items-center justify-center w-2">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer View All Link */}
          <div className="p-2 border-t border-zinc-800 bg-[#0c0c0e]">
            <Link
              href="/dashboard/notifications"
              onClick={() => setIsOpen(false)}
              className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>View all notifications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
