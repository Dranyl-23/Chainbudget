"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank,
  ClipboardCheck, FileText, BookOpen, Settings,
  LogOut, Wallet, Users, Menu, X, AlertTriangle, Moon, Sun, Copy
} from "lucide-react";
import toast from "react-hot-toast";
import OrgSelector from "@/components/OrgSelector";
import Onboarding from "@/components/Onboarding";
import Portal from "@/components/Portal";
import api from "@/lib/api";

const navItems = [
  { href: "/dashboard",              icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard",    minRole: 4 },
  { href: "/dashboard/transactions", icon: <ArrowLeftRight  className="w-4 h-4" />, label: "Transactions", minRole: 4 },
  { href: "/dashboard/budget",       icon: <PiggyBank       className="w-4 h-4" />, label: "Budget",       minRole: 3 }, // RBAC Fix: Level 3 can view budgets
  { href: "/dashboard/approvals",    icon: <ClipboardCheck  className="w-4 h-4" />, label: "Approvals",    minRole: 2 }, // Treasurer (Level 2) can approve
  { href: "/dashboard/reports",      icon: <FileText        className="w-4 h-4" />, label: "Reports",      minRole: 4 }, // RBAC Fix: Level 4 can view public reports
  { href: "/dashboard/audit",        icon: <BookOpen        className="w-4 h-4" />, label: "Audit Trail",  minRole: 2 }, // Treasurer should see audit logs
  { href: "/dashboard/team",         icon: <Users           className="w-4 h-4" />, label: "Team",         minRole: 4 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, isLoading, user, logout, walletAddress, activeOrgId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [pendingCount, setPendingCount] = useState(0);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Filter nav items based on role (Super Admins see everything)
  const currentMembership = user?.memberships?.find(
    (m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId
  );
  const roleLevel = currentMembership?.roleLevel || 4; 

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
      if (savedTheme === "dark") {
        setIsDarkMode(true);
        document.documentElement.setAttribute("data-theme", "dark");
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
    : "";

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {/* ── Mobile Header ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-white z-20" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <img src="/images/logo.png" alt="ChainBudget logo" className="w-8 h-8 object-contain rounded-[8px] shadow-sm flex-shrink-0" />
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
          fixed md:static inset-y-0 left-0 z-40 w-64 flex flex-col border-r transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `} 
        style={{ background: "#ffffff", minHeight: "100vh", borderRight: "1px solid var(--color-border)" }}
      >
        {/* Logo (Hidden on very small screens since it's in the header, but keep it for md+) */}
        <div className="px-5 mb-8 mt-4 hidden md:block">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="ChainBudget logo" className="w-8 h-8 object-contain rounded-[8px] shadow-sm flex-shrink-0" />
            <span className="font-bold text-lg tracking-tight">
              Chain<span className="gradient-text">Budget</span>
            </span>
          </div>
        </div>

        {/* Org selector component */}
        <OrgSelector />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          <p className="px-3 text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2">Main</p>
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              id={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
            className={`nav-item flex justify-between ${
              item.href === "/dashboard"
                ? pathname === "/dashboard" ? "active" : ""
                : pathname.startsWith(item.href) ? "active" : ""
            }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </div>
              {item.label === "Approvals" && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm animate-pulse">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}

          {user?.isSuperAdmin && (
            <>
              <p className="px-3 text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2 mt-4">Admin</p>
              <Link href="/admin" className={`nav-item ${pathname.startsWith("/admin") ? "active" : ""}`}>
                <Settings className="w-4 h-4" />
                Platform Admin
              </Link>
            </>
          )}
        </nav>

        {/* Wallet info */}
        <div className="px-3 mt-auto mb-4">
          <button
            onClick={toggleTheme}
            className="nav-item w-full mb-2 text-gray-500 hover:text-primary transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>

          <div className="px-3 py-3 rounded-lg sidebar-card">
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
                <Wallet className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-mono text-gray-600 group-hover:text-primary transition-colors">{shortAddress}</span>
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
            onClick={() => setShowDisconnectModal(true)}
            id="logout-btn"
            className="nav-item w-full mt-2 text-gray-500 hover:text-danger"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
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
