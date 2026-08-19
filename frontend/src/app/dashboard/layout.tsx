"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank,
  ClipboardCheck, FileText, BookOpen, Settings,
  LogOut, Users, Menu, X, AlertTriangle, Copy, Vote, ChevronLeft, ChevronRight, UserCircle, ShieldCheck, Box, Crown, CheckCircle2, User as UserIcon, Eye, HelpCircle
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

const navItems = [
  { href: "/dashboard",              icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard",    minRole: 4 },
  { href: "/dashboard/transactions", icon: <ArrowLeftRight  className="w-4 h-4" />, label: "Transactions", minRole: 4 },
  { href: "/dashboard/budget",       icon: <PiggyBank       className="w-4 h-4" />, label: "Budget",       minRole: 3 }, // RBAC Fix: Level 3 can view budgets
  { href: "/dashboard/approvals",    icon: <ClipboardCheck  className="w-4 h-4" />, label: "Approvals",    minRole: 2 }, // Treasurer (Level 2) can approve
  { href: "/dashboard/treasury",     icon: <Box             className="w-4 h-4" />, label: "Treasury",     minRole: 1 }, // Executive (Level 1)
  { href: "/dashboard/reports",      icon: <FileText        className="w-4 h-4" />, label: "Reports",      minRole: 4 }, // RBAC Fix: Level 4 can view public reports
  { href: "/dashboard/audit",        icon: <BookOpen        className="w-4 h-4" />, label: "Audit Trail",  minRole: 2 }, // Treasurer should see audit logs
  { href: "/dashboard/dao",          icon: <Vote            className="w-4 h-4" />, label: "DAO Governance", minRole: 4 }, // All members can vote
  { href: "/dashboard/team",         icon: <Users           className="w-4 h-4" />, label: "Team",         minRole: 4 },
  { href: "/dashboard/settings",     icon: <UserCircle      className="w-4 h-4" />, label: "Profile",      minRole: 4 },
];

function UserAvatar({ src, name, size = 40, className = "" }: { src?: string; name?: string; size?: number; className?: string }) {
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
      <div className={`w-full h-full flex items-center justify-center bg-purple-500/20 text-purple-300 font-bold text-xs ${className}`}>
        {name ? name.trim().charAt(0).toUpperCase() : <UserCircle className="w-full h-full text-purple-400" />}
      </div>
    );
  }

  return (
    <Image
      src={formattedSrc}
      alt={name || "Avatar"}
      width={size}
      height={size}
      unoptimized
      className={`w-full h-full object-cover ${className}`}
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

  // Filter nav items based on role (Super Admins see everything)
  const memberships = (user?.memberships || []) as UserMembership[];
  const currentMembership = memberships.find(
    (m) => getOrgId(m.organization) === activeOrgId
  );
  const roleLevel = user?.isSuperAdmin ? 1 : (currentMembership?.roleLevel || 4); 

  const backendUrl = "http://127.0.0.1:5001";
  const orgObj = typeof currentMembership?.organization === "object" ? currentMembership.organization : null;
  const displayLogo = orgObj?.logoUrl 
    ? (orgObj.logoUrl.startsWith("http") 
        ? orgObj.logoUrl 
        : `${backendUrl}${orgObj.logoUrl}`)
    : "/images/logo.png"; 

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (user?.isSuperAdmin) return true;
      return roleLevel <= item.minRole;
    });
  }, [user?.isSuperAdmin, roleLevel]);

  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.push("/");
    }
  }, [isLoading, isConnected, router]);

  // Synchronize dark theme attribute with DOM and localStorage
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("chainbudget-theme", "dark");
  }, []);

  // Asynchronous pending approvals count loader
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
        console.error("Failed to fetch pending approvals count:", err);
      }
    };

    void fetchPendingCount();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, roleLevel, pathname]);

  const visiblePendingCount = (activeOrgId && roleLevel <= 2) ? pendingCount : 0;

  if (isLoading || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  // Show onboarding if user has no organization memberships
  const hasMemberships = user?.memberships && user.memberships.length > 0;
  if (!hasMemberships) {
    return <Onboarding />;
  }

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "No Wallet Linked";

  const chainId = typeof window !== "undefined" ? window.ethereum?.chainId : undefined;
  const networkName = getNetworkName(chainId);
  const shortNetworkName = getShortNetworkName(chainId);

  const handleNavClick = () => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden" style={{ background: "var(--color-bg)" }}>
      <OnboardingTour />
      <SessionExpiredModal />
      {/* ── Mobile Header ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-white z-20" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-3">
          <Image src="/3D-Chainbudget.png" alt="ChainBudget logo" width={52} height={52} unoptimized className="w-12 h-12 object-contain drop-shadow-md shrink-0" />
          <span className="font-extrabold text-2xl tracking-tight">
            Chain<span className="gradient-text">Budget</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="mt-1 mr-1 z-50">
            <NotificationsCenter />
          </div>
          <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 -mr-2 text-gray-500 focus:outline-none" aria-label="Toggle Navigation">
            {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Overlay ── */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-40 flex flex-col border-r transform transition-all duration-300 ease-in-out
          ${isCollapsed ? "w-20" : "w-64"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `} 
        style={{ background: "#ffffff", minHeight: "100vh", borderRight: "1px solid var(--color-border)" }}
      >
        {/* Floating Sidebar Toggle Button on the Right Border */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3.5 top-6 w-7 h-7 rounded-full bg-[#121215] border border-white/20 text-gray-300 hover:text-white hover:border-fuchsia-500/60 hover:bg-[#1a1a22] shadow-md items-center justify-center transition-all z-50 cursor-pointer active:scale-95"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-fuchsia-400" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand Header */}
        <div className={`h-16 mt-2 mb-4 hidden md:flex items-center transition-all duration-300 ${isCollapsed ? "justify-center px-2" : "justify-start px-5"}`}>
          <div className="flex items-center gap-3">
            <Image 
              src="/3D-Chainbudget.png" 
              alt="ChainBudget logo" 
              width={52} 
              height={52} 
              unoptimized 
              className="w-12 h-12 object-contain drop-shadow-md shrink-0 transition-transform hover:scale-105 cursor-pointer"
              onClick={() => isCollapsed && setIsCollapsed(false)}
            />
            <span className={`font-extrabold text-2xl tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? "max-w-0 opacity-0 hidden" : "max-w-40 opacity-100"}`}>
              Chain<span className="gradient-text">Budget</span>
            </span>
          </div>
        </div>

        {/* Org selector component */}
        <div className={`transition-all duration-300 ${isCollapsed ? "overflow-hidden max-h-0 opacity-0 m-0 p-0" : "max-h-[500px] opacity-100 z-50 relative"}`}>
          <OrgSelector />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 mt-2 overflow-hidden">
          <p className={`px-3 text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2 transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? "max-h-0 opacity-0 m-0" : "max-h-10 opacity-100 mt-2"}`}>Main</p>
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              title={isCollapsed ? item.label : ""}
              id={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              className={`nav-item flex justify-between ${
                item.href === "/dashboard"
                  ? pathname === "/dashboard" ? "active" : ""
                  : pathname.startsWith(item.href) ? "active" : ""
              } ${isCollapsed ? "justify-center px-0" : ""}`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="shrink-0">{item.icon}</div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? "max-w-0 opacity-0" : "max-w-37.5 opacity-100"}`}>
                  {item.label}
                </span>
              </div>
              {item.label === "Approvals" && visiblePendingCount > 0 && (
                <>
                  <span className={`bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm animate-pulse transition-all duration-300 ${isCollapsed ? "max-w-0 max-h-0 opacity-0 p-0 m-0 border-0 overflow-hidden" : "max-w-10 opacity-100"}`}>
                    {visiblePendingCount}
                  </span>
                  {isCollapsed && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shrink-0 shadow-sm animate-pulse">
                      {visiblePendingCount}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}

          {user?.isSuperAdmin && (
            <>
              <p className={`px-3 text-xs font-semibold text-gray-600 uppercase tracking-widest transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? "max-h-0 opacity-0 m-0" : "max-h-10 opacity-100 mt-4 mb-2"}`}>Admin</p>
              <Link 
                title={isCollapsed ? "Platform Admin" : ""}
                href="/admin" 
                onClick={handleNavClick}
                className={`nav-item flex items-center gap-3 transition-all duration-300 ${isCollapsed ? "justify-center px-0" : ""} ${pathname.startsWith("/admin") ? "active" : ""}`}
              >
                <div className="shrink-0"><Settings className="w-4 h-4" /></div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? "max-w-0 opacity-0" : "max-w-37.5 opacity-100"}`}>
                  Platform Admin
                </span>
              </Link>
            </>
          )}
        </nav>

        {/* Wallet info & Bottom Links */}
        <div className="px-3 mt-auto mb-4 flex flex-col gap-1">
          {/* Mobile Profile Card */}
          <div className={`md:hidden transition-all duration-300 overflow-hidden ${isCollapsed ? "max-h-0 opacity-0 m-0 p-0 border-0" : "max-h-[200px] opacity-100 px-3 py-3 mb-2 rounded-lg sidebar-card"}`}>
            <div 
              className="flex items-center justify-between mb-2 group cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
              onClick={() => {
                if (walletAddress) {
                  navigator.clipboard.writeText(walletAddress);
                  toast.success("Wallet address copied!");
                }
              }}
              title="Copy full wallet address"
            >
              <div className="flex items-center gap-2">
                <div className="nft-avatar-wrapper scale-[0.7] origin-left">
                  <div className="w-10 h-10 nft-avatar border border-purple-500/30 shadow-[inset_0_0_10px_rgba(139,92,246,0.2)] overflow-hidden">
                    <UserAvatar src={user?.avatarUrl} name={user?.displayName} size={40} />
                  </div>
                </div>
                <div className="flex flex-col -ml-2 gap-0.5">
                  <div className="flex items-center gap-1.5">
                    {user?.displayName && (
                      <span className="text-xs font-bold text-gray-100 flex items-center gap-1">
                        {user.displayName}
                        {currentMembership?.hasSBT && (
                          <span title="SBT Verified Member" className="flex items-center">
                            <ShieldCheck className="w-3 h-3 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-[1px] rounded-sm text-[8px] uppercase tracking-widest font-bold flex items-center gap-1 w-fit ${
                      roleLevel === 1 ? "role-badge-superadmin" :
                      roleLevel === 2 ? "role-badge-approver" :
                      roleLevel === 3 ? "role-badge-member" : "role-badge-readonly"
                    }`}>
                      {roleLevel === 1 ? <><Crown className="w-2.5 h-2.5" /> Exec</> : 
                       roleLevel === 2 ? <><CheckCircle2 className="w-2.5 h-2.5" /> Apprv</> : 
                       roleLevel === 3 ? <><UserIcon className="w-2.5 h-2.5" /> Mem</> : 
                       <><Eye className="w-2.5 h-2.5" /> Pub</>}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400/70 group-hover:text-cyan-300 transition-colors">{shortAddress}</span>
                  </div>
                </div>
              </div>
              <Copy className="w-3.5 h-3.5 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="chain-dot" />
              <span className="text-xs text-gray-600">
                {networkName}
              </span>
            </div>
          </div>

          <Link
            href="/tutorials"
            onClick={handleNavClick}
            title={isCollapsed ? "Tutorials" : ""}
            className={`nav-item flex items-center gap-3 w-full transition-all duration-300 text-gray-500 hover:text-primary ${isCollapsed ? "justify-center px-0" : ""}`}
          >
            <div className="shrink-0"><HelpCircle className="w-4 h-4" /></div>
            <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? "max-w-0 opacity-0" : "max-w-37.5 opacity-100"}`}>
              Tutorials
            </span>
          </Link>

          <button
            title={isCollapsed ? "Disconnect" : ""}
            onClick={() => setShowDisconnectModal(true)}
            id="logout-btn"
            className={`md:hidden nav-item flex items-center gap-3 w-full transition-all duration-300 text-gray-500 hover:text-danger ${isCollapsed ? "justify-center px-0" : ""}`}
          >
            <div className="shrink-0"><LogOut className="w-4 h-4" /></div>
            <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? "max-w-0 opacity-0" : "max-w-37.5 opacity-100"}`}>
              Disconnect
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto w-full md:w-auto relative flex flex-col">
        
        {/* Desktop Top Navigation Bar */}
        <div className="hidden md:flex items-center justify-end px-8 py-4 sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-white/5 gap-4">
          <NotificationsCenter />

          {/* Top Nav Profile Pill */}
          <div className="flex items-center gap-4 pl-4 border-l border-white/10">
            {/* Role & Network */}
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-sm text-[9px] uppercase tracking-widest font-bold flex items-center gap-1 w-fit ${
                  roleLevel === 1 ? "role-badge-superadmin" :
                  roleLevel === 2 ? "role-badge-approver" :
                  roleLevel === 3 ? "role-badge-member" : "role-badge-readonly"
                }`}>
                  {roleLevel === 1 ? <><Crown className="w-3 h-3" /> Exec</> : 
                   roleLevel === 2 ? <><CheckCircle2 className="w-3 h-3" /> Apprv</> : 
                   roleLevel === 3 ? <><UserIcon className="w-3 h-3" /> Mem</> : 
                   <><Eye className="w-3 h-3" /> Pub</>}
              </span>
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] text-gray-400">
                  {shortNetworkName}
                </span>
              </div>
            </div>

            {/* Profile Info */}
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => {
                if (walletAddress) {
                  navigator.clipboard.writeText(walletAddress);
                  toast.success("Wallet address copied!");
                }
              }}
              title="Copy full wallet address"
            >
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-white flex items-center gap-1">
                  {user?.displayName || "User"}
                  {currentMembership?.hasSBT && (
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                  )}
                </span>
                <span className="text-[10px] font-mono text-cyan-400/70 group-hover:text-cyan-300 transition-colors">{shortAddress}</span>
              </div>
              <div className="w-10 h-10 rounded-full border border-purple-500/30 overflow-hidden shadow-[inset_0_0_10px_rgba(139,92,246,0.2)]">
                <UserAvatar src={user?.avatarUrl} name={user?.displayName} size={40} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
          {children}
        </div>
      </main>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <Portal>
          <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="glass rounded-2xl p-6 w-full max-w-sm shadow-[0_0_40px_rgba(239,68,68,0.15)] border border-red-500/20 animate-modal-pop">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  </div>
                  <h2 className="text-xl font-bold text-white drop-shadow-sm">Disconnect Wallet</h2>
                </div>
                <button onClick={() => setShowDisconnectModal(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-white/60 mb-6 text-sm">
                Are you sure you want to disconnect? You will need to sign in again with your wallet to access the dashboard.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDisconnectModal(false);
                    logout();
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-red-100 bg-red-500/80 hover:bg-red-500 border border-red-500/50 rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] hover:-translate-y-0.5"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
