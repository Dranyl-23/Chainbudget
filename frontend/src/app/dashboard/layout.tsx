"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank,
  ClipboardCheck, FileText, BookOpen, Settings,
  LogOut, Users, Menu, X, Copy, Vote,
  ChevronLeft, ChevronRight, UserCircle, ShieldCheck,
  Box, Crown, CheckCircle2, User as UserIcon, Eye,
  LifeBuoy, Shield, MessageSquare, Search, Plus,
  ChevronDown, Bell, Download, RefreshCw, PanelLeft
} from "lucide-react";

import toast from "react-hot-toast";
import OrgSelector from "@/components/OrgSelector";
import Onboarding from "@/components/Onboarding";
import Portal from "@/components/Portal";
import api from "@/lib/api";
import OnboardingTour from "@/components/OnboardingTour";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import NotificationsCenter from "@/components/NotificationsCenter";

// ── Types ────────────────────────────────────────────────────────────────────
interface UserOrgRef {
  _id?: string;
  name?: string;
  logoUrl?: string;
}

interface UserMembership {
  organization?: string | UserOrgRef;
  roleLevel: number;
  roleLabel?: string;
  isActive?: boolean;
  hasSBT?: boolean;
  sbtTokenId?: string;
}

interface PendingCountResponse {
  count?: number;
}

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  minRole: number;
  badge?: number;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

function getOrgId(org?: string | UserOrgRef): string | undefined {
  if (!org) return undefined;
  return typeof org === "string" ? org : org._id;
}

function getNetworkName(chainId?: string): string {
  if (!chainId) return "Polygon Amoy";
  if (chainId === "0x7a69" || chainId === "0x7A69") return "Hardhat Localhost";
  if (chainId === "0x13882") return "Polygon Amoy";
  if (chainId === "0x89") return "Polygon Mainnet";
  if (chainId === "0x1") return "Ethereum Mainnet";
  return "Polygon Amoy";
}

function getShortNetworkName(chainId?: string): string {
  if (!chainId) return "Amoy";
  if (chainId === "0x7a69" || chainId === "0x7A69") return "Localhost";
  if (chainId === "0x13882") return "Amoy";
  if (chainId === "0x89") return "Polygon";
  if (chainId === "0x1") return "Ethereum";
  return "Amoy";
}

function UserAvatar({ src, name, size = 32, className = "" }: { src?: string; name?: string; size?: number; className?: string }) {
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
    return src;
  }, [src]);

  if (!formattedSrc || hasError) {
    return (
      <div 
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-zinc-800 text-zinc-300 font-bold text-xs rounded-full border border-zinc-700 ${className}`}
      >
        {name ? name.trim().charAt(0).toUpperCase() : <UserCircle className="w-full h-full text-zinc-400" />}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={formattedSrc}
      alt={name || "Avatar"}
      style={{ width: size, height: size }}
      className={`rounded-full object-cover border border-zinc-700 ${className}`}
      onError={() => setHasError(true)}
    />
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, isLoading, user, logout, walletAddress, activeOrgId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [pendingCount, setPendingCount] = useState(0);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [topSearch, setTopSearch] = useState("");

  const memberships = (user?.memberships || []) as UserMembership[];
  const currentMembership = memberships.find(
    (m) => getOrgId(m.organization) === activeOrgId
  );
  const roleLevel = user?.isSuperAdmin ? 1 : (currentMembership?.roleLevel || 4);

  // Grouped Navigation Structure (Studio Admin Monochrome)
  const navGroups: NavGroup[] = useMemo(() => [
    {
      groupTitle: "Dashboards",
      items: [
        { href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0" />, label: "Overview", minRole: 4 },
        { href: "/chat", icon: <MessageSquare className="w-4 h-4 shrink-0" />, label: "Organization Chat", minRole: 4 },
      ]
    },
    {
      groupTitle: "Financials",
      items: [
        { href: "/dashboard/transactions", icon: <ArrowLeftRight className="w-4 h-4 shrink-0" />, label: "Transactions", minRole: 4 },
        { href: "/dashboard/budget", icon: <PiggyBank className="w-4 h-4 shrink-0" />, label: "Budgets & Envelopes", minRole: 3 },
        { href: "/dashboard/treasury", icon: <Box className="w-4 h-4 shrink-0" />, label: "Treasury Safe", minRole: 1 },
      ]
    },
    {
      groupTitle: "Governance",
      items: [
        { 
          href: "/dashboard/approvals", 
          icon: <ClipboardCheck className="w-4 h-4 shrink-0" />, 
          label: "Multi-Sig Approvals", 
          minRole: 2,
          badge: pendingCount 
        },
        { href: "/dashboard/dao", icon: <Vote className="w-4 h-4 shrink-0" />, label: "DAO Proposals", minRole: 4 },
      ]
    },
    {
      groupTitle: "Accountability",
      items: [
        { href: "/dashboard/reports", icon: <FileText className="w-4 h-4 shrink-0" />, label: "Reports & Statements", minRole: 4 },
        { href: "/dashboard/audit", icon: <BookOpen className="w-4 h-4 shrink-0" />, label: "Cryptographic Audit", minRole: 2 },
      ]
    },
    {
      groupTitle: "Workspace",
      items: [
        { href: "/dashboard/notifications", icon: <Bell className="w-4 h-4 shrink-0" />, label: "Notifications", minRole: 4 },
        { href: "/dashboard/team", icon: <Users className="w-4 h-4 shrink-0" />, label: "Team & Permissions", minRole: 4 },
        { href: "/dashboard/settings", icon: <Settings className="w-4 h-4 shrink-0" />, label: "Settings", minRole: 4 },
      ]
    }
  ], [pendingCount]);

  // Dynamic Contextual Breadcrumbs
  const breadcrumb = useMemo(() => {
    if (pathname === "/dashboard") return { group: "Workspace", page: "Overview" };
    if (pathname.startsWith("/dashboard/transactions")) return { group: "Financials", page: "Transactions" };
    if (pathname.startsWith("/dashboard/budget")) return { group: "Financials", page: "Budgets & Envelopes" };
    if (pathname.startsWith("/dashboard/treasury")) return { group: "Financials", page: "Treasury Safe" };
    if (pathname.startsWith("/dashboard/approvals")) return { group: "Governance", page: "Multi-Sig Approvals" };
    if (pathname.startsWith("/dashboard/dao")) return { group: "Governance", page: "DAO Proposals" };
    if (pathname.startsWith("/dashboard/reports")) return { group: "Accountability", page: "Reports & Statements" };
    if (pathname.startsWith("/dashboard/audit")) return { group: "Accountability", page: "Cryptographic Audit" };
    if (pathname.startsWith("/dashboard/notifications")) return { group: "Workspace", page: "Notifications" };
    if (pathname.startsWith("/dashboard/team")) return { group: "Workspace", page: "Team & Permissions" };
    if (pathname.startsWith("/dashboard/settings")) return { group: "Workspace", page: "Settings" };
    return { group: "Dashboard", page: "Overview" };
  }, [pathname]);

  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.push("/");
    }
  }, [isLoading, isConnected, router]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("chainbudget-theme", "dark");
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!activeOrgId || roleLevel > 2) {
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const res = await api.get<PendingCountResponse>("/transactions/pending-count", {
          params: { orgId: activeOrgId }
        });
        if (!isCancelled) {
          setPendingCount(res.data.count || 0);
        }
      } catch (err: unknown) {
        console.error("Failed to fetch pending count:", err);
      }
    };

    void fetchPendingCount();

    const handleApprovalsUpdated = () => {
      void fetchPendingCount();
    };
    window.addEventListener("cb_approvals_updated", handleApprovalsUpdated);

    return () => {
      isCancelled = true;
      window.removeEventListener("cb_approvals_updated", handleApprovalsUpdated);
    };
  }, [activeOrgId, roleLevel, pathname]);

  if (isLoading || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
          <span className="text-zinc-500 text-xs font-medium">Loading ChainBudget...</span>
        </div>
      </div>
    );
  }

  const hasMemberships = user?.memberships && user.memberships.length > 0;
  if (!hasMemberships) {
    return <Onboarding />;
  }

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "No Wallet Linked";

  const chainId = typeof window !== "undefined" ? window.ethereum?.chainId : undefined;
  const shortNetworkName = getShortNetworkName(chainId);

  const handleNavClick = () => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success("Wallet address copied to clipboard!");
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-[#09090b] text-zinc-100 font-sans">
      <OnboardingTour />
      <SessionExpiredModal />

      {/* ── Mobile Top Bar ── */}
      <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-[#09090b] border-b border-zinc-800 z-30 shrink-0">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/3D-Chainbudget.png" 
            alt="ChainBudget Logo" 
            className="w-7 h-7 object-contain drop-shadow" 
          />
          <span className="font-bold text-base tracking-tight text-white">
            ChainBudget
          </span>
        </div>

        <div className="flex items-center gap-2">
          <NotificationsCenter />
          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)} 
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-900 border border-zinc-800" 
            aria-label="Toggle navigation"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── Mobile Backdrop ── */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          onClick={() => setIsMobileOpen(false)} 
        />
      )}

      {/* ── Studio Minimalist Sidebar ── */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50 flex flex-col border-r h-full max-h-screen 
          bg-[#09090b] border-zinc-800 transition-all duration-150 ease-out shrink-0 select-none
          ${isCollapsed ? "w-[68px]" : "w-60"}
          ${isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} md:translate-x-0
        `}
      >
        {/* Sidebar Brand Header */}
        <div className={`h-14 shrink-0 flex items-center border-b border-zinc-800 ${isCollapsed ? "justify-center px-2" : "justify-between px-4"}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/3D-Chainbudget.png" 
              alt="Logo" 
              className="w-7 h-7 object-contain shrink-0 cursor-pointer"
              onClick={() => isCollapsed && setIsCollapsed(false)}
            />
            {!isCollapsed && (
              <span className="font-bold text-sm tracking-tight text-white">
                Chainbudget
              </span>
            )}
          </div>

          {!isCollapsed && (
            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
              v1.1
            </span>
          )}
        </div>

        {/* Quick Create Action Button (Studio Admin signature) */}
        <div className={`p-3 shrink-0 ${isCollapsed ? "px-2" : "px-3"}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/dashboard/transactions"
                className="btn-primary w-full py-2 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Quick Create</span>
              </Link>
              <Link
                href="/chat"
                title="Organization Chat (Fullscreen)"
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <Link
              href="/dashboard/transactions"
              title="Quick Create"
              className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Active Organization Selector */}
        {!isCollapsed && (
          <div className="px-3 pb-2 shrink-0">
            <OrgSelector />
          </div>
        )}

        {/* Navigation Groups List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-1 space-y-3 no-scrollbar">
          {navGroups.map((group) => {
            const filteredItems = group.items.filter((item) => {
              if (user?.isSuperAdmin) return true;
              return roleLevel <= item.minRole;
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={group.groupTitle} className="space-y-0.5">
                {!isCollapsed ? (
                  <p className="px-2 py-1 text-[11px] font-semibold text-zinc-500 tracking-wide">
                    {group.groupTitle}
                  </p>
                ) : (
                  <div className="h-px bg-zinc-800 my-1 mx-2" />
                )}

                {filteredItems.map((item) => {
                  const isActive = item.href === "/dashboard" 
                    ? pathname === "/dashboard" 
                    : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      id={
                        item.href === "/dashboard/transactions" ? "nav-transactions" :
                        item.href === "/dashboard/budget" ? "nav-budget" :
                        item.href === "/dashboard/approvals" ? "nav-approvals" :
                        item.href === "/dashboard/dao" ? "nav-dao-governance" : undefined
                      }
                      onClick={handleNavClick}
                      title={isCollapsed ? item.label : ""}
                      className={`
                        studio-nav-item group
                        ${isActive ? "active" : ""}
                        ${isCollapsed ? "justify-center px-0 py-2" : ""}
                      `}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`transition-colors ${isActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`}>
                          {item.icon}
                        </div>
                        {!isCollapsed && (
                          <span className="truncate text-xs">
                            {item.label}
                          </span>
                        )}
                      </div>

                      {/* Approval Counter Badge */}
                      {item.badge !== undefined && item.badge > 0 && (
                        <>
                          {!isCollapsed ? (
                            <span className="ml-auto bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold px-1.5 py-0.2 rounded-full font-mono">
                              {item.badge}
                            </span>
                          ) : (
                            <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}

          {/* Super Admin Section */}
          {user?.isSuperAdmin && (
            <div className="pt-2 border-t border-zinc-800 space-y-0.5">
              {!isCollapsed && (
                <p className="px-2 py-1 text-[11px] font-semibold text-rose-400 tracking-wide">
                  SuperAdmin
                </p>
              )}
              <Link 
                href="/admin" 
                onClick={handleNavClick}
                title={isCollapsed ? "Platform Admin" : ""}
                className={`studio-nav-item ${pathname.startsWith("/admin") ? "active" : ""} ${isCollapsed ? "justify-center px-0 py-2" : ""}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Settings className="w-4 h-4 text-rose-400 shrink-0" />
                  {!isCollapsed && <span className="truncate text-xs text-rose-300">Platform Admin</span>}
                </div>
              </Link>
            </div>
          )}

          {/* Support Links */}
          <div className="pt-2 border-t border-zinc-800 space-y-0.5">
            {!isCollapsed && (
              <p className="px-2 py-1 text-[11px] font-semibold text-zinc-500 tracking-wide">
                Help & Public
              </p>
            )}
            <Link
              href="/explorer"
              onClick={handleNavClick}
              title={isCollapsed ? "Public Explorer" : ""}
              className={`studio-nav-item ${isCollapsed ? "justify-center px-0 py-2" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 shrink-0 text-zinc-500 group-hover:text-white" />
                {!isCollapsed && <span className="text-xs">Public Explorer</span>}
              </div>
            </Link>

            <Link
              href="/tutorials"
              onClick={handleNavClick}
              title={isCollapsed ? "Tutorials & Guides" : ""}
              className={`studio-nav-item ${pathname.startsWith("/tutorials") ? "active" : ""} ${isCollapsed ? "justify-center px-0 py-2" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 shrink-0 text-zinc-500 group-hover:text-white" />
                {!isCollapsed && <span className="text-xs">Tutorials & Guides</span>}
              </div>
            </Link>

            <Link
              href="/help"
              onClick={handleNavClick}
              title={isCollapsed ? "Help Center" : ""}
              className={`studio-nav-item ${pathname.startsWith("/help") ? "active" : ""} ${isCollapsed ? "justify-center px-0 py-2" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <LifeBuoy className="w-4 h-4 shrink-0 text-zinc-500 group-hover:text-white" />
                {!isCollapsed && <span className="text-xs">Help & FAQs</span>}
              </div>
            </Link>
          </div>
        </div>

        {/* Sidebar Footer User Card */}
        <div className="shrink-0 p-2 border-t border-zinc-800 bg-[#09090b]">
          {!isCollapsed ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <div 
                className="flex items-center gap-2 min-w-0 cursor-pointer"
                onClick={copyAddress}
                title="Click to copy wallet address"
              >
                <UserAvatar src={user?.avatarUrl} name={user?.displayName} size={30} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate max-w-28">
                    {user?.displayName || "User"}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono truncate max-w-28">
                    {shortAddress}
                  </span>
                </div>
              </div>

              <button
                id="logout-btn"
                onClick={() => setShowDisconnectModal(true)}
                title="Sign Out"
                className="p-1 text-zinc-400 hover:text-rose-400 rounded transition-colors ml-1 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <button 
                onClick={copyAddress}
                title={`Copy ${shortAddress}`}
                className="p-1 rounded-full hover:ring-1 hover:ring-zinc-600 transition-all cursor-pointer"
              >
                <UserAvatar src={user?.avatarUrl} name={user?.displayName} size={28} />
              </button>
              <button
                id="logout-btn"
                onClick={() => setShowDisconnectModal(true)}
                title="Disconnect"
                className="p-1 text-zinc-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content Area with Studio Top Bar ── */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* Desktop Sticky Header Bar (Exact match to Studio Admin benchmark) */}
        <header className="hidden md:flex items-center justify-between h-14 px-5 bg-[#09090b] border-b border-zinc-800 z-30 shrink-0">
          
          {/* Left: Sidebar Toggle, Search, & Navigation Tabs */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Sidebar Collapse Toggle */}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {/* Studio Search Input */}
            <div className="relative w-48 lg:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 text-white rounded-lg pl-8 pr-8 py-1.5 text-xs placeholder:text-zinc-500 focus:outline-none transition-colors"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 border border-zinc-800 bg-zinc-950 px-1 rounded font-mono">
                ⌘K
              </span>
            </div>

            {/* Dynamic Breadcrumbs */}
            <div className="hidden lg:flex items-center gap-2 border-l border-zinc-800 pl-4 text-xs">
              <span className="text-zinc-500 font-medium">{breadcrumb.group}</span>
              <span className="text-zinc-700">/</span>
              <span className="text-white font-semibold">{breadcrumb.page}</span>
            </div>
          </div>

          {/* Right: Updated Info, Settings, Export, Notifications, User */}
          <div className="flex items-center gap-2.5 shrink-0">
            
            {/* Updated Indicator */}
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-zinc-500 pr-2">
              <RefreshCw className="w-3 h-3 text-zinc-500" />
              <span>Updated just now</span>
            </div>

            {/* Network Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-mono">{shortNetworkName}</span>
            </div>

            {/* Role Badge */}
            <div className="hidden sm:flex items-center">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-zinc-900 border border-zinc-800 text-zinc-300">
                {roleLevel === 1 && "Executive"}
                {roleLevel === 2 && "Approver"}
                {roleLevel === 3 && "Member"}
                {roleLevel > 3 && "Public"}
              </span>
            </div>

            {/* Quick Settings Link */}
            <Link
              href="/dashboard/settings"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </Link>

            {/* Export Link */}
            <Link
              href="/dashboard/reports"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </Link>

            {/* Notifications */}
            <NotificationsCenter />

            {/* User Profile Thumbnail */}
            <div 
              onClick={copyAddress}
              className="cursor-pointer ml-1"
              title="Click to copy wallet address"
            >
              <UserAvatar src={user?.avatarUrl} name={user?.displayName} size={28} />
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-[#09090b] relative custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-5">
            {children}
          </div>
        </main>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
            <div className="bg-[#121215] rounded-xl p-5 w-full max-w-sm border border-zinc-800 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white">Sign Out Session</h2>
                <button 
                  onClick={() => setShowDisconnectModal(false)} 
                  className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-zinc-400 mb-5 text-xs leading-relaxed">
                Are you sure you want to sign out? You will need to re-authenticate with your wallet to access your organization dashboard.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  className="flex-1 px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDisconnectModal(false);
                    logout();
                  }}
                  className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-all shadow-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function Globe(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
