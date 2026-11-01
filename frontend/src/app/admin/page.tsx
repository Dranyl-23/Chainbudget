"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  Building2, Users, ArrowLeftRight, Activity,
  Search, RefreshCw, Ban, CheckCircle2, ChevronLeft,
  ChevronRight, Link2, Crown, AlertTriangle, BarChart3,
  Globe, LogOut, Wallet,
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────
interface PlatformStats {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalUsers: number;
  totalTransactions: number;
  pendingTransactions: number;
  totalAuditLogs: number;
}

interface OrgRow {
  _id: string;
  name: string;
  type: string;
  isActive: boolean;
  memberCount: number;
  txCount: number;
  pendingCount: number;
  highValueThreshold: number;
  createdAt: string;
  createdBy?: { walletAddress: string; displayName?: string };
}

interface UserRow {
  _id: string;
  walletAddress: string;
  displayName?: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  memberships: { organization?: { name: string; type: string }; roleLevel: number; roleLabel?: string }[];
}

interface ActivityLog {
  _id: string;
  action: string;
  createdAt: string;
  actor?: { walletAddress: string; displayName?: string };
  organization?: { name: string };
  blockchainTxHash?: string;
}

const ORG_TYPE_LABELS: Record<string, string> = {
  student_org: "Student Org",
  barangay: "Barangay",
  homeowners_association: "HOA",
  ngo: "NGO",
  cooperative: "Cooperative",
  church: "Church",
  sports_club: "Sports Club",
  startup: "Startup",
  family: "Family",
  fundraising: "Fundraising",
};

const ROLE_LABELS: Record<number, string> = {
  1: "Executive Approver",
  2: "Finance Officer",
  3: "Member",
  4: "Public Viewer",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isConnected, isLoading, logout, walletAddress } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<"overview" | "orgs" | "users" | "activity">("overview");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgTotal, setOrgTotal] = useState(0);
  const [orgPage, setOrgPage] = useState(1);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgStatus, setOrgStatus] = useState("all");
  const [orgRefreshTrigger, setOrgRefreshTrigger] = useState(0);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userRefreshTrigger, setUserRefreshTrigger] = useState(0);

  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [suspending, setSuspending] = useState<string | null>(null);

  const shortAddr = (addr?: string) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "No Wallet";

  // Guard: redirect non-super-admins
  useEffect(() => {
    if (!isLoading && (!isConnected || !user?.isSuperAdmin)) {
      router.push("/dashboard");
    }
  }, [isLoading, isConnected, user, router]);

  // ── Effect 1: Initial Platform Stats & Activity ────────────────────────────
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    let isCancelled = false;

    const loadOverview = async () => {
      try {
        const [statsRes, activityRes] = await Promise.all([
          api.get("/admin/stats"),
          api.get("/admin/activity"),
        ]);
        if (!isCancelled) {
          setStats(statsRes.data);
          setActivity(activityRes.data);
        }
      } catch {
        if (!isCancelled) {
          toast.error("Failed to load platform stats");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadOverview();

    return () => {
      isCancelled = true;
    };
  }, [user?.isSuperAdmin]);

  // ── Effect 2: Load Organizations on filter, pagination, or refresh ────────
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    let isCancelled = false;

    const loadOrgs = async () => {
      try {
        const res = await api.get("/admin/organizations", {
          params: { search: orgSearch, status: orgStatus, page: orgPage, limit: 15 },
        });
        if (!isCancelled) {
          setOrgs(res.data.organizations);
          setOrgTotal(res.data.total);
        }
      } catch {
        if (!isCancelled) {
          toast.error("Failed to load organizations");
        }
      }
    };

    loadOrgs();

    return () => {
      isCancelled = true;
    };
  }, [user?.isSuperAdmin, orgSearch, orgStatus, orgPage, orgRefreshTrigger]);

  // ── Effect 3: Load Users on search, pagination, or refresh ────────────────
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    let isCancelled = false;

    const loadUsers = async () => {
      try {
        const res = await api.get("/admin/users", {
          params: { search: userSearch, page: userPage, limit: 15 },
        });
        if (!isCancelled) {
          setUsers(res.data.users);
          setUserTotal(res.data.total);
        }
      } catch {
        if (!isCancelled) {
          toast.error("Failed to load users");
        }
      }
    };

    loadUsers();

    return () => {
      isCancelled = true;
    };
  }, [user?.isSuperAdmin, userSearch, userPage, userRefreshTrigger]);

  // ── Refresh helpers ────────────────────────────────────────────────────────
  const refreshActivity = async () => {
    try {
      const res = await api.get("/admin/activity");
      setActivity(res.data);
      toast.success("Activity refreshed");
    } catch {
      toast.error("Failed to load activity");
    }
  };

  const refreshOrgs = () => setOrgRefreshTrigger((t) => t + 1);
  const refreshUsers = () => setUserRefreshTrigger((t) => t + 1);

  // ── Suspend / Activate org ──────────────────────────────────────────────────
  const toggleSuspend = async (org: OrgRow) => {
    setSuspending(org._id);
    try {
      const res = await api.patch(`/admin/organizations/${org._id}/suspend`);
      const updated = res.data.organization;
      setOrgs((prev) => prev.map((o) => (o._id === org._id ? { ...o, isActive: updated.isActive } : o)));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              activeOrgs: updated.isActive ? prev.activeOrgs + 1 : prev.activeOrgs - 1,
              suspendedOrgs: updated.isActive ? prev.suspendedOrgs - 1 : prev.suspendedOrgs + 1,
            }
          : prev
      );
      toast.success(`"${org.name}" ${updated.isActive ? "re-activated" : "suspended"}`);
    } catch {
      toast.error("Failed to update organization status");
    } finally {
      setSuspending(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-white animate-spin" />
          <p className="text-xs text-zinc-400">Loading Platform Admin...</p>
        </div>
      </div>
    );
  }

  if (!user?.isSuperAdmin) return null;

  const totalOrgPages = Math.ceil(orgTotal / 15);
  const totalUserPages = Math.ceil(userTotal / 15);

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-white">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800 gap-4 sm:gap-0 bg-[#09090b]/90 backdrop-blur-md"
      >
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-850 border border-zinc-750 flex items-center justify-center shrink-0">
                <Crown className="w-3.5 h-3.5 text-zinc-200" />
              </div>
              <div>
                <h1 className="text-xs font-semibold leading-tight text-white uppercase tracking-wider">Platform Admin</h1>
                <p className="text-[10px] text-zinc-400 leading-tight hidden sm:block">ChainBudget Super Admin Console</p>
              </div>
            </div>
          </div>
          
          {/* Mobile Disconnect Button */}
          <button onClick={logout} className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 whitespace-nowrap">
            <Wallet className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-xs font-mono text-zinc-300">{walletAddress ? shortAddr(walletAddress) : ""}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-white font-medium border border-zinc-700">SUPER ADMIN</span>
          </div>
          
          {/* Desktop Disconnect Button */}
          <button onClick={logout} className="hidden sm:flex items-center gap-1.5 text-zinc-400 text-xs px-2.5 py-1.5 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-800">
            <LogOut className="w-3.5 h-3.5" /> Disconnect
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg bg-zinc-900 border border-zinc-800 overflow-x-auto hide-scrollbar w-full sm:w-fit">
          {(["overview", "orgs", "users", "activity"] as const).map((t) => {
            const icons = { overview: BarChart3, orgs: Building2, users: Users, activity: Activity };
            const labels = { overview: "Overview", orgs: "Organizations", users: "Users", activity: "Activity" };
            const Icon = icons[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  tab === t
                    ? "bg-white text-zinc-950 font-semibold shadow-xs"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: OVERVIEW                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "overview" && stats && (
          <div className="animate-fade-in space-y-6">
            {/* Hero stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[
                {
                  label: "Total Organizations",
                  value: stats.totalOrgs,
                  sub: `${stats.activeOrgs} active · ${stats.suspendedOrgs} suspended`,
                  icon: Building2,
                },
                {
                  label: "Registered Users",
                  value: stats.totalUsers,
                  sub: "Unique wallet addresses",
                  icon: Users,
                },
                {
                  label: "Total Transactions",
                  value: stats.totalTransactions,
                  sub: `${stats.pendingTransactions} pending approval`,
                  icon: ArrowLeftRight,
                },
                {
                  label: "Audit Events",
                  value: stats.totalAuditLogs,
                  sub: "Platform-wide log entries",
                  icon: Activity,
                },
              ].map((card) => (
                <div key={card.label} className="bg-[#121215] border border-zinc-800 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{card.label}</p>
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <card.icon className="w-3.5 h-3.5 text-zinc-300" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold font-mono text-white mb-1">{card.value.toLocaleString()}</h3>
                  <p className="text-[11px] text-zinc-500">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Status banner + pending alert */}
            {stats.pendingTransactions > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/10">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-300">
                    {stats.pendingTransactions} transaction{stats.pendingTransactions !== 1 ? "s" : ""} awaiting approval
                  </p>
                  <p className="text-[11px] text-amber-400/80">High-value transactions are pending multi-sig approval across organizations.</p>
                </div>
              </div>
            )}

            {stats.suspendedOrgs > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-rose-500/20 bg-rose-500/10">
                <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-rose-300">
                    {stats.suspendedOrgs} organization{stats.suspendedOrgs !== 1 ? "s" : ""} currently suspended
                  </p>
                  <p className="text-[11px] text-rose-400/80">Suspended organizations cannot be accessed by their members.</p>
                </div>
              </div>
            )}

            {/* Recent activity preview */}
            <div className="bg-[#121215] border border-zinc-800 p-5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-zinc-400" /> Recent Platform Activity
                </h3>
                <button onClick={() => setTab("activity")} className="text-xs text-zinc-400 hover:text-white transition-colors">
                  View all →
                </button>
              </div>
              <div className="space-y-2">
                {activity.slice(0, 6).map((log) => (
                  <div key={log._id} className="flex items-center gap-3 py-2 border-b border-zinc-800/80 last:border-b-0">
                    <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                      <Activity className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-zinc-200">{log.action}</p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {log.actor?.displayName || shortAddr(log.actor?.walletAddress || "0x")}
                        {log.organization ? ` · ${log.organization.name}` : ""}
                      </p>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                ))}
                {activity.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-4">No platform activity yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: ORGANIZATIONS                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "orgs" && (
          <div className="animate-fade-in space-y-3.5">
            {/* Filters */}
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full pl-9 pr-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                  placeholder="Search organizations..."
                  value={orgSearch}
                  onChange={(e) => { setOrgSearch(e.target.value); setOrgPage(1); }}
                />
              </div>
              <select
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors appearance-none"
                value={orgStatus}
                onChange={(e) => { setOrgStatus(e.target.value); setOrgPage(1); }}
              >
                <option value="all" className="bg-zinc-900">All Status</option>
                <option value="active" className="bg-zinc-900">Active</option>
                <option value="suspended" className="bg-zinc-900">Suspended</option>
              </select>
              <button onClick={refreshOrgs} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <span className="text-xs text-zinc-500 ml-auto">{orgTotal} organizations</span>
            </div>

            {/* Table */}
            <div className="bg-[#121215] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0e0e11] border-b border-zinc-800 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                      <th className="p-3 pl-4">Organization</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Members</th>
                      <th className="p-3">Transactions</th>
                      <th className="p-3">Threshold</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 pr-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {orgs.map((org) => (
                      <tr key={org._id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-3 pl-4">
                          <div>
                            <p className="font-medium text-white text-xs">{org.name}</p>
                            <p className="text-[10px] font-mono text-zinc-500">{org._id.slice(-8)}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 text-[10px] uppercase font-medium">
                            {ORG_TYPE_LABELS[org.type] || org.type}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="flex items-center gap-1 text-zinc-300">
                            <Users className="w-3.5 h-3.5 text-zinc-500" />
                            {org.memberCount}
                          </span>
                        </td>
                        <td className="p-3">
                          <div>
                            <span className="text-zinc-200">{org.txCount}</span>
                            {org.pendingCount > 0 && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                                {org.pendingCount} pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-zinc-300 font-mono">₱{org.highValueThreshold.toLocaleString()}</td>
                        <td className="p-3 text-zinc-500 whitespace-nowrap font-mono text-[11px]">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          {org.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-medium">
                              <Ban className="w-3 h-3" /> Suspended
                            </span>
                          )}
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <button
                            id={`admin-suspend-${org._id}`}
                            onClick={() => toggleSuspend(org)}
                            disabled={suspending === org._id}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                              org.isActive
                                ? "border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            } disabled:opacity-50`}
                          >
                            {suspending === org._id
                              ? "..."
                              : org.isActive
                              ? "Suspend"
                              : "Re-activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {orgs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-zinc-500 text-xs">
                          No organizations found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalOrgPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  disabled={orgPage === 1}
                  onClick={() => setOrgPage((p) => p - 1)}
                  className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-xs text-zinc-500">Page {orgPage} of {totalOrgPages}</span>
                <button
                  disabled={orgPage === totalOrgPages}
                  onClick={() => setOrgPage((p) => p + 1)}
                  className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: USERS                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "users" && (
          <div className="animate-fade-in space-y-3.5">
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full pl-9 pr-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                  placeholder="Search by wallet or name..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                />
              </div>
              <button onClick={refreshUsers} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <span className="text-xs text-zinc-500 ml-auto">{userTotal} users</span>
            </div>

            <div className="bg-[#121215] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0e0e11] border-b border-zinc-800 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                      <th className="p-3 pl-4">Wallet Address</th>
                      <th className="p-3">Display Name</th>
                      <th className="p-3">Platform Role</th>
                      <th className="p-3">Organizations</th>
                      <th className="p-3">Last Login</th>
                      <th className="p-3 pr-4">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {users.map((u) => (
                      <tr key={u._id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-3 pl-4">
                          <span className="font-mono text-xs text-zinc-300">
                            {shortAddr(u.walletAddress)}
                          </span>
                        </td>
                        <td className="p-3 text-xs font-medium text-white">{u.displayName || "—"}</td>
                        <td className="p-3">
                          {u.isSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-white border border-zinc-700 text-[10px] font-semibold">
                              <Crown className="w-3 h-3 text-zinc-300" /> Super Admin
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10px]">User</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(u.memberships || []).slice(0, 3).map((m, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                                {m.organization?.name || "Unknown"} · {ROLE_LABELS[m.roleLevel] || `L${m.roleLevel}`}
                              </span>
                            ))}
                            {(u.memberships || []).length > 3 && (
                              <span className="text-[10px] text-zinc-500">+{(u.memberships || []).length - 3} more</span>
                            )}
                            {(!u.memberships || u.memberships.length === 0) && <span className="text-[10px] text-zinc-500">No memberships</span>}
                          </div>
                        </td>
                        <td className="p-3 text-zinc-500 font-mono text-[11px]">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}
                        </td>
                        <td className="p-3 pr-4 text-zinc-500 whitespace-nowrap font-mono text-[11px]">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-zinc-500 text-xs">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {totalUserPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button disabled={userPage === 1} onClick={() => setUserPage((p) => p - 1)} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-xs text-zinc-500">Page {userPage} of {totalUserPages}</span>
                <button disabled={userPage === totalUserPages} onClick={() => setUserPage((p) => p + 1)} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: ACTIVITY                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "activity" && (
          <div className="animate-fade-in space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-400" /> Platform-Wide Activity Feed
              </h2>
              <button onClick={refreshActivity} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="bg-[#121215] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0e0e11] border-b border-zinc-800 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                      <th className="p-3 pl-4">Timestamp</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Organization</th>
                      <th className="p-3 pr-4">Blockchain Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {activity.map((log) => (
                      <tr key={log._id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-3 pl-4 whitespace-nowrap font-mono text-zinc-500 text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-xs font-medium text-zinc-300">
                          {log.actor?.displayName || shortAddr(log.actor?.walletAddress || "0x")}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-mono">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-zinc-400">{log.organization?.name || "—"}</td>
                        <td className="p-3 pr-4">
                          {log.blockchainTxHash ? (
                            <a
                              href={`https://amoy.polygonscan.com/tx/${log.blockchainTxHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 hover:text-white text-[10px] font-mono border border-zinc-800 transition-colors"
                            >
                              <Link2 className="w-3 h-3 text-zinc-500" />
                              {log.blockchainTxHash.slice(0, 10)}…
                            </a>
                          ) : (
                            <span className="text-zinc-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {activity.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-zinc-500 text-xs">
                          No platform activity recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
