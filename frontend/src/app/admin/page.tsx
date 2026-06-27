"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  Building2, Users, ArrowLeftRight, ShieldAlert, Activity,
  Search, RefreshCw, Ban, CheckCircle2, ChevronLeft,
  ChevronRight, Link2, Crown, AlertTriangle, BarChart3,
  Clock, Globe, LogOut, Wallet,
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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
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

  // ── Fetch platform stats ────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch {
      toast.error("Failed to load platform stats");
    }
  }, []);

  // ── Fetch organizations ─────────────────────────────────────────────────────
  const fetchOrgs = useCallback(async () => {
    try {
      const res = await api.get("/admin/organizations", {
        params: { search: orgSearch, status: orgStatus, page: orgPage, limit: 15 },
      });
      setOrgs(res.data.organizations);
      setOrgTotal(res.data.total);
    } catch {
      toast.error("Failed to load organizations");
    }
  }, [orgSearch, orgStatus, orgPage]);

  // ── Fetch users ─────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/admin/users", {
        params: { search: userSearch, page: userPage, limit: 15 },
      });
      setUsers(res.data.users);
      setUserTotal(res.data.total);
    } catch {
      toast.error("Failed to load users");
    }
  }, [userSearch, userPage]);

  // ── Fetch activity ──────────────────────────────────────────────────────────
  const fetchActivity = useCallback(async () => {
    try {
      const res = await api.get("/admin/activity");
      setActivity(res.data);
    } catch {
      toast.error("Failed to load activity");
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    Promise.all([fetchStats(), fetchOrgs(), fetchUsers(), fetchActivity()]).finally(() =>
      setLoading(false)
    );
  }, [user]);

  useEffect(() => { if (user?.isSuperAdmin) fetchOrgs(); }, [fetchOrgs]);
  useEffect(() => { if (user?.isSuperAdmin) fetchUsers(); }, [fetchUsers]);

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Loading Platform Admin...</p>
        </div>
      </div>
    );
  }

  if (!user?.isSuperAdmin) return null;

  const totalOrgPages = Math.ceil(orgTotal / 15);
  const totalUserPages = Math.ceil(userTotal / 15);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 border-b gap-4 sm:gap-0 bg-white/90 backdrop-blur-md"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-2 flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight text-gray-900">Platform Admin</h1>
                <p className="text-xs text-gray-400 leading-tight hidden sm:block">ChainBudget Super Admin Console</p>
              </div>
            </div>
          </div>
          
          {/* Mobile Disconnect Button */}
          <button onClick={logout} className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 text-gray-500 border border-gray-200">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 whitespace-nowrap">
            <Wallet className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-mono text-gray-600">{walletAddress ? shortAddr(walletAddress) : ""}</span>
            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-primary text-white font-semibold">SUPER ADMIN</span>
          </div>
          
          {/* Desktop Disconnect Button */}
          <button onClick={logout} className="hidden sm:flex items-center gap-1.5 text-gray-500 px-3 py-1.5 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" /> Disconnect
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl bg-white border overflow-x-auto hide-scrollbar w-full sm:w-fit" style={{ borderColor: "var(--color-border)" }}>
          {(["overview", "orgs", "users", "activity"] as const).map((t) => {
            const icons = { overview: BarChart3, orgs: Building2, users: Users, activity: Activity };
            const labels = { overview: "Overview", orgs: "Organizations", users: "Users", activity: "Activity" };
            const Icon = icons[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: OVERVIEW                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "overview" && stats && (
          <div className="animate-fade-in space-y-8">
            {/* Hero stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Organizations",
                  value: stats.totalOrgs,
                  sub: `${stats.activeOrgs} active · ${stats.suspendedOrgs} suspended`,
                  icon: Building2,
                  color: "#6B55D9",
                },
                {
                  label: "Registered Users",
                  value: stats.totalUsers,
                  sub: "Unique wallet addresses",
                  icon: Users,
                  color: "#7DBD9B",
                },
                {
                  label: "Total Transactions",
                  value: stats.totalTransactions,
                  sub: `${stats.pendingTransactions} pending approval`,
                  icon: ArrowLeftRight,
                  color: "#A892F0",
                },
                {
                  label: "Audit Events",
                  value: stats.totalAuditLogs,
                  sub: "Platform-wide log entries",
                  icon: Activity,
                  color: "#E05C5C",
                },
              ].map((card) => (
                <div key={card.label} className="stat-card">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{card.label}</p>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${card.color}18` }}>
                      <card.icon className="w-4 h-4" style={{ color: card.color }} />
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold mb-1">{card.value.toLocaleString()}</h3>
                  <p className="text-xs text-gray-400">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Status banner + pending alert */}
            {stats.pendingTransactions > 0 && (
              <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-amber-200 bg-amber-50">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {stats.pendingTransactions} transaction{stats.pendingTransactions !== 1 ? "s" : ""} awaiting approval
                  </p>
                  <p className="text-xs text-amber-600">High-value transactions are pending multi-sig approval across organizations.</p>
                </div>
              </div>
            )}

            {stats.suspendedOrgs > 0 && (
              <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-red-200 bg-red-50">
                <Ban className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    {stats.suspendedOrgs} organization{stats.suspendedOrgs !== 1 ? "s" : ""} currently suspended
                  </p>
                  <p className="text-xs text-red-600">Suspended organizations cannot be accessed by their members.</p>
                </div>
              </div>
            )}

            {/* Recent activity preview */}
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Recent Platform Activity
                </h3>
                <button onClick={() => setTab("activity")} className="text-xs text-primary hover:underline">
                  View all →
                </button>
              </div>
              <div className="space-y-2">
                {activity.slice(0, 6).map((log) => (
                  <div key={log._id} className="flex items-center gap-3 py-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                    <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-gray-700">{log.action}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {log.actor?.displayName || shortAddr(log.actor?.walletAddress || "0x")}
                        {log.organization ? ` · ${log.organization.name}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                ))}
                {activity.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No platform activity yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: ORGANIZATIONS                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "orgs" && (
          <div className="animate-fade-in space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="input !pl-9 w-full"
                  placeholder="Search organizations..."
                  value={orgSearch}
                  onChange={(e) => { setOrgSearch(e.target.value); setOrgPage(1); }}
                />
              </div>
              <select
                className="input w-auto"
                value={orgStatus}
                onChange={(e) => { setOrgStatus(e.target.value); setOrgPage(1); }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <button onClick={fetchOrgs} className="btn-secondary py-2 px-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <span className="text-sm text-gray-500 ml-auto">{orgTotal} organizations</span>
            </div>

            {/* Table */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Type</th>
                    <th>Members</th>
                    <th>Transactions</th>
                    <th>Threshold</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org._id}>
                      <td>
                        <div>
                          <p className="font-medium text-sm">{org.name}</p>
                          <p className="text-xs font-mono text-gray-400">{org._id.slice(-8)}</p>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-pending text-xs">
                          {ORG_TYPE_LABELS[org.type] || org.type}
                        </span>
                      </td>
                      <td>
                        <span className="flex items-center gap-1 text-sm">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          {org.memberCount}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span className="text-sm">{org.txCount}</span>
                          {org.pendingCount > 0 && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                              {org.pendingCount} pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-sm font-mono">₱{org.highValueThreshold.toLocaleString()}</td>
                      <td className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        {org.isActive ? (
                          <span className="badge badge-approved">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="badge badge-rejected">
                            <Ban className="w-3 h-3" /> Suspended
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          id={`admin-suspend-${org._id}`}
                          onClick={() => toggleSuspend(org)}
                          disabled={suspending === org._id}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                            org.isActive
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-green-200 text-green-600 hover:bg-green-50"
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
                      <td colSpan={8} className="text-center py-10 text-gray-400">
                        No organizations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalOrgPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  disabled={orgPage === 1}
                  onClick={() => setOrgPage((p) => p - 1)}
                  className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-sm text-gray-500">Page {orgPage} of {totalOrgPages}</span>
                <button
                  disabled={orgPage === totalOrgPages}
                  onClick={() => setOrgPage((p) => p + 1)}
                  className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-40"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: USERS                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "users" && (
          <div className="animate-fade-in space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="input !pl-9 w-full"
                  placeholder="Search by wallet or name..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                />
              </div>
              <button onClick={fetchUsers} className="btn-secondary py-2 px-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <span className="text-sm text-gray-500 ml-auto">{userTotal} users</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Wallet Address</th>
                    <th>Display Name</th>
                    <th>Platform Role</th>
                    <th>Organizations</th>
                    <th>Last Login</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <span className="font-mono text-xs text-gray-700">
                          {shortAddr(u.walletAddress)}
                        </span>
                      </td>
                      <td className="text-sm font-medium">{u.displayName || "—"}</td>
                      <td>
                        {u.isSuperAdmin ? (
                          <span className="badge bg-gradient-to-r from-primary to-primary-2 text-white border-0">
                            <Crown className="w-3 h-3" /> Super Admin
                          </span>
                        ) : (
                          <span className="badge badge-pending">User</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(u.memberships || []).slice(0, 3).map((m, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {m.organization?.name || "Unknown"} · {ROLE_LABELS[m.roleLevel] || `L${m.roleLevel}`}
                            </span>
                          ))}
                          {(u.memberships || []).length > 3 && (
                            <span className="text-xs text-gray-400">+{(u.memberships || []).length - 3} more</span>
                          )}
                          {(!u.memberships || u.memberships.length === 0) && <span className="text-xs text-gray-400">No memberships</span>}
                        </div>
                      </td>
                      <td className="text-xs text-gray-400">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}
                      </td>
                      <td className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalUserPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button disabled={userPage === 1} onClick={() => setUserPage((p) => p - 1)} className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-sm text-gray-500">Page {userPage} of {totalUserPages}</span>
                <button disabled={userPage === totalUserPages} onClick={() => setUserPage((p) => p + 1)} className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-40">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: ACTIVITY                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "activity" && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> Platform-Wide Activity Feed
              </h2>
              <button onClick={fetchActivity} className="btn-secondary py-2 px-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Organization</th>
                    <th>Blockchain Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((log) => (
                    <tr key={log._id}>
                      <td className="whitespace-nowrap font-mono text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="text-sm font-medium text-gray-700">
                        {log.actor?.displayName || shortAddr(log.actor?.walletAddress || "0x")}
                      </td>
                      <td>
                        <span className="px-2 py-1 rounded bg-primary/8 text-xs text-gray-600 font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">{log.organization?.name || "—"}</td>
                      <td>
                        {log.blockchainTxHash ? (
                          <a
                            href={`https://amoy.polygonscan.com/tx/${log.blockchainTxHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors"
                          >
                            <Link2 className="w-3 h-3" />
                            {log.blockchainTxHash.slice(0, 10)}…
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {activity.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-gray-400">
                        No platform activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
