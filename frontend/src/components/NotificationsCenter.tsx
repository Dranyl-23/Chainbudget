"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, AlertCircle, CheckCircle2, Link as LinkIcon, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { io, Socket } from "socket.io-client";
import api from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "urgent" | "blockchain" | "system" | "info";
  timestamp: string;
  isRead: boolean;
}

export default function NotificationsCenter() {
  const { activeOrgId, isConnected } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

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

    const fetchNotifications = async () => {
      try {
        const res = await api.get(`/notifications?orgId=${activeOrgId}`);
        if (res.data.notifications) {
          setNotifications(res.data.notifications);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };
    fetchNotifications();
  }, [isConnected, activeOrgId]);

  // Connect to Socket.IO and listen for events
  useEffect(() => {
    if (!isConnected || !activeOrgId) return;

    const backendUrl = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace("/api", "") 
      : "http://localhost:5000";

    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on("new_notification", (data: any) => {
      // Only process notifications for the active organization
      if (data.orgId === activeOrgId) {
        setNotifications((prev) => [
          {
            id: data.id || Math.random().toString(),
            title: data.title,
            message: data.message,
            type: data.type || "info",
            timestamp: data.timestamp || new Date().toISOString(),
            isRead: false,
          },
          ...prev,
        ]);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [isConnected, activeOrgId]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.post("/notifications/read-all", { orgId: activeOrgId });
    } catch (err) {
      console.error(err);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "urgent":
        return <AlertCircle className="w-5 h-5 text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]" />;
      case "blockchain":
        return <LinkIcon className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />;
      case "system":
        return <CheckCircle2 className="w-5 h-5 text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  if (!isConnected) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full transition-all duration-300 ${
          isOpen ? "bg-white/10" : "hover:bg-white/5"
        }`}
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? "text-cyan-400" : "text-gray-400"} transition-colors`} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-cyan-400 rounded-full border border-[var(--color-bg)] animate-pulse-glow" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 glass rounded-xl border border-purple-500/20 shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 animate-fade-in origin-top-right">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/40">
            <h3 className="font-bold text-gray-100 flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-cyan-500/20 text-cyan-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} New
                </span>
              )}
            </h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[350px] overflow-y-auto custom-scrollbar bg-[#0B0C10]/80">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-gray-500">
                <Bell className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No recent alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 flex gap-3 hover:bg-white/5 transition-colors cursor-pointer ${
                      !notif.isRead ? "bg-purple-900/10" : ""
                    }`}
                    onClick={async () => {
                      if (!notif.isRead) {
                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                        try {
                          await api.post(`/notifications/${notif.id}/read`);
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getIconForType(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${!notif.isRead ? "text-gray-100" : "text-gray-400"}`}>
                        {notif.title}
                      </p>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${!notif.isRead ? "text-gray-300" : "text-gray-500"}`}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1.5 font-mono">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="flex-shrink-0 flex items-center justify-center w-2">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
