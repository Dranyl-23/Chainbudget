"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard, ArrowLeftRight, PiggyBank,
  ClipboardCheck, FileText, BookOpen, Settings,
  LogOut, Link2, Wallet, ChevronDown, Users
} from "lucide-react";
import OrgSelector from "@/components/OrgSelector";

const navItems = [
  { href: "/dashboard",              icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard",    minRole: 4 },
  { href: "/dashboard/transactions", icon: <ArrowLeftRight  className="w-4 h-4" />, label: "Transactions", minRole: 4 },
  { href: "/dashboard/budget",       icon: <PiggyBank       className="w-4 h-4" />, label: "Budget",       minRole: 2 },
  { href: "/dashboard/approvals",    icon: <ClipboardCheck  className="w-4 h-4" />, label: "Approvals",    minRole: 1 },
  { href: "/dashboard/reports",      icon: <FileText        className="w-4 h-4" />, label: "Reports",      minRole: 2 },
  { href: "/dashboard/audit",        icon: <BookOpen        className="w-4 h-4" />, label: "Audit Trail",  minRole: 1 },
  { href: "/dashboard/team",         icon: <Users           className="w-4 h-4" />, label: "Team",         minRole: 4 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, isLoading, user, logout, walletAddress, activeOrgId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.push("/");
    }
  }, [isLoading, isConnected, router]);

  if (isLoading || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";

  // Determine the user's role level for the current organization
  const currentMembership = user?.memberships?.find(
    (m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId
  );
  // roleLevel 1 = highest, 4 = lowest
  const roleLevel = currentMembership?.roleLevel || 4; 

  // Filter nav items based on role (Super Admins see everything)
  const visibleNavItems = navItems.filter((item) => {
    if (user?.isSuperAdmin) return true;
    return roleLevel <= item.minRole;
  });

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      {/* ── Sidebar ── */}
      <aside className="w-64 flex flex-col border-r" style={{ background: "#ffffff", minHeight: "100vh", borderRight: "1px solid var(--color-border)" }}>
        {/* Logo */}
        <div className="px-5 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/0 overflow-hidden">
              <img src="/images/logo.png" alt="ChainBudget logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold text-sm tracking-tight">
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
              className={`nav-item ${pathname.startsWith(item.href) ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
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
        <div className="px-3 mt-4">
          <div className="px-3 py-3 rounded-lg" style={{ background: "rgba(249,249,251,0.8)", border: "1px solid rgba(26,26,46,0.04)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-mono text-gray-600">{shortAddress}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="chain-dot" />
              <span className="text-xs text-gray-600">Polygon Amoy</span>
            </div>
          </div>
          <button
            onClick={logout}
            id="logout-btn"
            className="nav-item w-full mt-2 text-gray-500 hover:text-primary"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
