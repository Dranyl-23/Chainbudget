"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank,
  ClipboardCheck, FileText, BookOpen, Settings,
  LogOut, Wallet, Users, Menu, X, AlertTriangle, Moon, Sun, Copy, Vote, ChevronLeft, ChevronRight, UserCircle, ShieldCheck
} from "lucide-react";
import toast from "react-hot-toast";
import OrgSelector from "@/components/OrgSelector";
import Onboarding from "@/components/Onboarding";
import Portal from "@/components/Portal";
import api from "@/lib/api";
import OnboardingTour from "@/components/OnboardingTour";
import SessionExpiredModal from "@/components/SessionExpiredModal";

const navItems = [
  { href: "/dashboard",              icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard",    minRole: 4 },
  { href: "/dashboard/transactions", icon: <ArrowLeftRight  className="w-4 h-4" />, label: "Transactions", minRole: 4 },
  { href: "/dashboard/budget",       icon: <PiggyBank       className="w-4 h-4" />, label: "Budget",       minRole: 3 }, // RBAC Fix: Level 3 can view budgets
  { href: "/dashboard/approvals",    icon: <ClipboardCheck  className="w-4 h-4" />, label: "Approvals",    minRole: 2 }, // Treasurer (Level 2) can approve
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
      const savedTheme = localStorage.getItem("chainbudget-theme");
      if (savedTheme === "light") {
        setIsDarkMode(false);
        document.documentElement.removeAttribute("data-theme");
      } else {
        setIsDarkMode(true);
        document.documentElement.setAttribute("data-theme", "dark");
        if (!savedTheme) localStorage.setItem("chainbudget-theme", "dark");
      }
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
    const newTheme = !isDarkMode ? "dark" : "light";
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("chainbudget-theme", newTheme);
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
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 -mr-2 text-gray-500 focus:outline-none">
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
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

        {/* Wallet info */}
        <div className="px-3 mt-auto mb-4">
          <button
            title={isCollapsed ? (isDarkMode ? "Light Mode" : "Dark Mode") : ""}
            onClick={toggleTheme}
            className={`nav-item flex items-center gap-3 w-full transition-all duration-300 mb-2 text-gray-500 hover:text-primary transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex-shrink-0">{isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</div>
            <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          <div className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'max-h-0 opacity-0 m-0 p-0 border-0' : 'max-h-[200px] opacity-100 px-3 py-3 mb-2 rounded-lg sidebar-card'}`}>
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
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <UserCircle className="w-4 h-4 text-primary" />
                )}
                <div className="flex flex-col">
                  {user?.displayName && (
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      {user.displayName}
                      {currentMembership?.hasSBT && (
                        <span title="SBT Verified Member" className="flex items-center">
                          <ShieldCheck className="w-3 h-3 text-indigo-500" />
                        </span>
                      )}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-gray-500 group-hover:text-primary transition-colors">{shortAddress}</span>
                </div>
              </div>
              <Copy className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="chain-dot" />
              <span className="text-xs text-gray-600">
                {(() => {
                  // BUG-4 FIX: Dynamic network name
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
          <button
            title={isCollapsed ? "Disconnect" : ""}
            onClick={() => setShowDisconnectModal(true)}
            id="logout-btn"
            className={`nav-item flex items-center gap-3 w-full transition-all duration-300 text-gray-500 hover:text-danger ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="flex-shrink-0"><LogOut className="w-4 h-4" /></div>
            <span className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
              Disconnect
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto w-full md:w-auto relative">
        {children}
      </main>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <Portal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-3 mb-4 text-danger">
                <AlertTriangle className="w-6 h-6" />
                <h2 className="text-xl font-bold text-gray-900">Disconnect Wallet</h2>
              </div>
              <p className="text-gray-600 mb-6 text-sm">
                Are you sure you want to disconnect? You will need to sign in again with your wallet to access the dashboard.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDisconnectModal(false);
                    logout();
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-red-600 rounded-lg transition-colors"
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
