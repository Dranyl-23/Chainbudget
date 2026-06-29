"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank,
  ClipboardCheck, FileText, BookOpen, Settings,
  LogOut, Wallet, Users, Menu, X, AlertTriangle, Moon, Sun, Copy, Vote, ChevronLeft, ChevronRight, UserCircle, ShieldCheck, Box, Crown, CheckCircle2, User as UserIcon, Eye, HelpCircle
} from "lucide-react";
import toast from "react-hot-toast";
import OrgSelector from "@/components/OrgSelector";
import Onboarding from "@/components/Onboarding";
import Portal from "@/components/Portal";
import api from "@/lib/api";
import OnboardingTour from "@/components/OnboardingTour";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import NotificationsCenter from "@/components/NotificationsCenter";

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, isLoading, user, logout, walletAddress, activeOrgId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [pendingCount, setPendingCount] = useState(0);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter nav items based on role (Super Admins see everything)
  const currentMembership = user?.memberships?.find(
    (m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId
  );
  const roleLevel = currentMembership?.roleLevel || 4; 

  const backendUrl = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.replace("/api", "") 
    : "http://localhost:5000";

  const displayLogo = currentMembership?.organization?.logoUrl 
    ? (currentMembership.organization.logoUrl.startsWith('http') 
        ? currentMembership.organization.logoUrl 
        : `${backendUrl}${currentMembership.organization.logoUrl}`)

    : "/images/logo.png"; 

  const visibleNavItems = navItems.filter((item) => {
    if (user?.isSuperAdmin) return true;
    return roleLevel <= item.minRole;
  });

  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.push("/");
    }
  }, [isLoading, isConnected, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDarkMode(true);
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("chainbudget-theme", "dark");
    }
  }, []);

  useEffect(() => {
    if (activeOrgId && roleLevel <= 2) {
      api.get("/transactions/pending-count", { params: { orgId: activeOrgId } })
        .then(res => setPendingCount(res.data.count || 0))
        .catch(console.error);
    } else {
      setPendingCount(0);
    }
  }, [activeOrgId, roleLevel, pathname]);

  // Close sidebar on route change for mobile
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    // Disabled: Fully committed to Dark Premium Web3
  };

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

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden" style={{ background: "var(--color-bg)" }}>
      <OnboardingTour />
      <SessionExpiredModal />
      {/* ── Mobile Header ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-white z-20" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <img src={displayLogo} alt="ChainBudget logo" className="w-8 h-8 object-contain rounded-[8px] shadow-sm flex-shrink-0" />
          <span className="font-bold text-lg tracking-tight">
            Chain<span className="gradient-text">Budget</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="mt-1 mr-1 z-50">
            <NotificationsCenter />
          </div>
          <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 -mr-2 text-gray-500 focus:outline-none">
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
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `} 
        style={{ background: "#ffffff", minHeight: "100vh", borderRight: "1px solid var(--color-border)" }}
      >
        {/* Logo (Hidden on very small screens since it's in the header, but keep it for md+) */}
        <div className={`px-5 mb-8 mt-4 hidden md:flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <img src={displayLogo} alt="ChainBudget logo" className="w-8 h-8 object-contain rounded-[8px] shadow-sm flex-shrink-0" />
            <span className={`font-bold text-lg tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
              Chain<span className="gradient-text">Budget</span>
            </span>
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors hidden md:block"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Org selector component */}
        <div className={`transition-all duration-300 ${isCollapsed ? 'overflow-hidden max-h-0 opacity-0 m-0 p-0' : 'max-h-[500px] opacity-100 z-50 relative'}`}>
          <OrgSelector />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 mt-2 overflow-hidden">
          <p className={`px-3 text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2 transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'max-h-0 opacity-0 m-0' : 'max-h-10 opacity-100 mt-2'}`}>Main</p>
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : ""}
              id={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
            className={`nav-item flex justify-between ${
              item.href === "/dashboard"
                ? pathname === "/dashboard" ? "active" : ""
                : pathname.startsWith(item.href) ? "active" : ""
            } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex-shrink-0">{item.icon}</div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
                  {item.label}
                </span>
              </div>
              {item.label === "Approvals" && pendingCount > 0 && (
                <>
                  <span className={`bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm animate-pulse transition-all duration-300 ${isCollapsed ? 'max-w-0 max-h-0 opacity-0 p-0 m-0 border-0 overflow-hidden' : 'max-w-[40px] opacity-100'}`}>
                    {pendingCount}
                  </span>
                  {isCollapsed && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0 shadow-sm animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}

          {user?.isSuperAdmin && (
            <>
              <p className={`px-3 text-xs font-semibold text-gray-600 uppercase tracking-widest transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'max-h-0 opacity-0 m-0' : 'max-h-10 opacity-100 mt-4 mb-2'}`}>Admin</p>
              <Link 
                title={isCollapsed ? "Platform Admin" : ""}
                href="/admin" 
                className={`nav-item flex items-center gap-3 transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : ''} ${pathname.startsWith("/admin") ? "active" : ""}`}
              >
                <div className="flex-shrink-0"><Settings className="w-4 h-4" /></div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
                  Platform Admin
                </span>
              </Link>
            </>
          )}
        </nav>

        {/* Wallet info & Bottom Links */}
        <div className="px-3 mt-auto mb-4 flex flex-col gap-1">
          {/* Mobile Profile Card */}
          <div className={`md:hidden transition-all duration-300 overflow-hidden ${isCollapsed ? 'max-h-0 opacity-0 m-0 p-0 border-0' : 'max-h-[200px] opacity-100 px-3 py-3 mb-2 rounded-lg sidebar-card'}`}>
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
                  <div className="w-10 h-10 nft-avatar border border-purple-500/30 shadow-[inset_0_0_10px_rgba(139,92,246,0.2)]">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-5 h-5 text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
                    )}
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
                      roleLevel === 1 ? 'role-badge-superadmin' :
                      roleLevel === 2 ? 'role-badge-approver' :
                      roleLevel === 3 ? 'role-badge-member' : 'role-badge-readonly'
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
                {(() => {
                  if (typeof window !== "undefined" && (window as any).ethereum) {
                    const chainId = (window as any).ethereum.chainId;
                    if (chainId === "0x7a69" || chainId === "0x7A69") return "Hardhat Localhost";
                    if (chainId === "0x13882") return "Polygon Amoy";
                    if (chainId === "0x89") return "Polygon Mainnet";
                    if (chainId === "0x1") return "Ethereum Mainnet";
                  }
                  return "Polygon Amoy";
                })()}
              </span>
            </div>
          </div>

          <Link
            href="/tutorials"
            title={isCollapsed ? "Tutorials" : ""}
            className={`nav-item flex items-center gap-3 w-full transition-all duration-300 text-gray-500 hover:text-primary ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex-shrink-0"><HelpCircle className="w-4 h-4" /></div>
            <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
              Tutorials
            </span>
          </Link>

          <button
            title={isCollapsed ? "Disconnect" : ""}
            onClick={() => setShowDisconnectModal(true)}
            id="logout-btn"
            className={`md:hidden nav-item flex items-center gap-3 w-full transition-all duration-300 text-gray-500 hover:text-danger ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex-shrink-0"><LogOut className="w-4 h-4" /></div>
            <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
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
                  roleLevel === 1 ? 'role-badge-superadmin' :
                  roleLevel === 2 ? 'role-badge-approver' :
                  roleLevel === 3 ? 'role-badge-member' : 'role-badge-readonly'
                }`}>
                  {roleLevel === 1 ? <><Crown className="w-3 h-3" /> Exec</> : 
                   roleLevel === 2 ? <><CheckCircle2 className="w-3 h-3" /> Apprv</> : 
                   roleLevel === 3 ? <><UserIcon className="w-3 h-3" /> Mem</> : 
                   <><Eye className="w-3 h-3" /> Pub</>}
              </span>
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] text-gray-400">
                  {(() => {
                    if (typeof window !== "undefined" && (window as any).ethereum) {
                      const chainId = (window as any).ethereum.chainId;
                      if (chainId === "0x7a69" || chainId === "0x7A69") return "Localhost";
                      if (chainId === "0x13882") return "Amoy";
                      if (chainId === "0x89") return "Polygon";
                      if (chainId === "0x1") return "Ethereum";
                    }
                    return "Amoy";
                  })()}
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
                 {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-purple-400 bg-white/5" />}
              </div>
            </div>

            {/* Disconnect */}
            <button 
              onClick={() => setShowDisconnectModal(true)}
              className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/5 hover:border-red-500/30 transition-all ml-1"
              title="Disconnect"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative">
          {children}
        </div>
      </main>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <Portal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
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
