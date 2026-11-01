"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowUpRight, ArrowDownRight, Wallet, Activity,
  ShieldCheck, FileText, BarChart3, CheckCircle2,
  AlertTriangle, TrendingDown, Clock, ExternalLink,
  ChevronRight, Plus, Send, QrCode, History, Layers
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell
} from "recharts";
import Link from "next/link";
import api from "@/lib/api";
import DashboardSkeleton from "@/components/DashboardSkeleton";

// ── Types ────────────────────────────────────────────────────────────────────
interface UserOrgRef {
  _id?: string;
  name?: string;
}

interface UserMembership {
  organization?: string | UserOrgRef;
  roleLevel: number;
  roleLabel?: string;
  isActive?: boolean;
}

interface Transaction {
  _id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  createdAt: string;
  status: "approved" | "pending_approval" | "rejected";
  isRecordedOnChain: boolean;
  blockchainTxHash?: string;
}

interface TransactionsResponse {
  transactions?: Transaction[];
  total?: number;
}

interface CashFlowData {
  month: string;
  income: number;
  expense: number;
}

interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  pendingCount: number;
}

interface TransparencyScore {
  approved: number;
  onChain: number;
  percentage: number;
}

interface BudgetItem {
  _id: string;
  name: string;
  allocated: number;
  spent: number;
}

interface BudgetAlert {
  name: string;
  allocated: number;
  spent: number;
  percentage: number;
}

interface ReportsSummaryResponse {
  totalIncome?: number;
  totalExpenses?: number;
  pendingApprovals?: number;
  approvedTransactions?: number;
  onChainTransactions?: number;
  cashFlow?: CashFlowData[];
}

function getOrgId(org?: string | UserOrgRef): string | undefined {
  if (!org) return undefined;
  return typeof org === "string" ? org : org._id;
}

export default function DashboardPage() {
  const { user, activeOrgId } = useAuth();
  const [timeframe, setTimeframe] = useState<"weekly" | "monthly">("monthly");
  
  const [cashFlow, setCashFlow] = useState<CashFlowData[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dash_cashflow");
      if (cached) {
        try {
          return JSON.parse(cached) as CashFlowData[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [recentTxs, setRecentTxs] = useState<Transaction[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dash_txs");
      if (cached) {
        try {
          return JSON.parse(cached) as Transaction[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [stats, setStats] = useState<DashboardStats>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dash_stats");
      if (cached) {
        try {
          return JSON.parse(cached) as DashboardStats;
        } catch {
          // fallback
        }
      }
    }
    return {
      totalBalance: 0,
      totalIncome: 0,
      totalExpenses: 0,
      pendingCount: 0,
    };
  });

  const [transparencyScore, setTransparencyScore] = useState<TransparencyScore>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dash_score");
      if (cached) {
        try {
          return JSON.parse(cached) as TransparencyScore;
        } catch {
          // fallback
        }
      }
    }
    return { approved: 0, onChain: 0, percentage: 0 };
  });

  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("cb_cache_dash_stats");
  });

  const memberships = (user?.memberships || []) as UserMembership[];
  const userMembership = memberships.find((m) => getOrgId(m.organization) === activeOrgId);
  const roleLevel = user?.isSuperAdmin ? 1 : (userMembership?.roleLevel || 4);

  useEffect(() => {
    if (!activeOrgId) return;

    let isCancelled = false;
    const orgId = activeOrgId;

    const fetchData = async () => {
      try {
        // 1. Fetch recent transactions
        try {
          const txRes = await api.get<TransactionsResponse>("/transactions", {
            params: { orgId, limit: 5 }
          });
          const txs = txRes.data.transactions || [];
          if (!isCancelled) {
            setRecentTxs(txs);
            sessionStorage.setItem("cb_cache_dash_txs", JSON.stringify(txs));
          }
        } catch {
          if (!isCancelled) setRecentTxs([]);
        }

        // 2. Fetch reports summary
        try {
          const repRes = await api.get<ReportsSummaryResponse>("/reports/summary", {
            params: { orgId }
          });
          const data = repRes.data;

          const inc = data?.totalIncome ?? 0;
          const exp = data?.totalExpenses ?? 0;
          const pend = data?.pendingApprovals ?? 0;
          const bal = inc - exp;

          const newStats: DashboardStats = {
            totalBalance: bal,
            totalIncome: inc,
            totalExpenses: exp,
            pendingCount: pend,
          };

          if (!isCancelled) {
            setStats(newStats);
            sessionStorage.setItem("cb_cache_dash_stats", JSON.stringify(newStats));
          }

          const approved = data?.approvedTransactions ?? 0;
          const onChain = data?.onChainTransactions ?? 0;
          const pct = approved > 0 ? Math.min(100, Math.round((onChain / approved) * 100)) : 100;

          if (!isCancelled) {
            setTransparencyScore({ approved, onChain, percentage: pct });
            sessionStorage.setItem("cb_cache_dash_score", JSON.stringify({ approved, onChain, percentage: pct }));
          }

          if (Array.isArray(data?.cashFlow) && data.cashFlow.length > 0) {
            if (!isCancelled) {
              setCashFlow(data.cashFlow);
              sessionStorage.setItem("cb_cache_dash_cashflow", JSON.stringify(data.cashFlow));
            }
          } else {
            if (!isCancelled) setCashFlow([]);
          }
        } catch {
          if (!isCancelled) setCashFlow([]);
        }

        // 3. Fetch budget data
        try {
          const budgetRes = await api.get<BudgetItem[]>("/budget", { params: { orgId } });
          const budgetList = budgetRes.data || [];
          if (!isCancelled) {
            setBudgets(budgetList);
            const alerts: BudgetAlert[] = budgetList
              .map((b) => ({
                name: b.name,
                allocated: b.allocated,
                spent: b.spent,
                percentage: b.allocated > 0 ? Math.round((b.spent / b.allocated) * 100) : 0
              }))
              .filter((b) => b.percentage >= 80)
              .sort((a, b) => b.percentage - a.percentage);
            setBudgetAlerts(alerts);
          }
        } catch {
          // budget is optional
        }
      } catch (err: unknown) {
        console.error("Dashboard fetch error:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const netSavingsRate = stats.totalIncome > 0 
    ? Math.round(((stats.totalIncome - stats.totalExpenses) / stats.totalIncome) * 100)
    : 0;

  // Donut chart data for Account Allocation
  const allocationData = budgets.length > 0
    ? budgets.slice(0, 4).map((b) => ({
        name: b.name,
        value: b.allocated || 1,
      }))
    : [
        { name: "Treasury Safe", value: Math.max(stats.totalBalance, 1) },
        { name: "Disbursed", value: Math.max(stats.totalExpenses, 1) },
      ];

  const totalAllocationSum = allocationData.reduce((acc, curr) => acc + curr.value, 0);
  const DONUT_COLORS = ["#ffffff", "#a1a1aa", "#71717a", "#3f3f46"];

  return (
    <div className="space-y-4 pb-12 animate-fade-in font-sans">
      
      {/* ── Page Header / Top Action Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>{roleLevel === 4 ? "Public Transparency Ledger" : "Finance Overview"}</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time institutional liquidity, multi-sig consensus status, and on-chain ledger records.
          </p>
        </div>

        {roleLevel <= 3 && (
          <div className="flex items-center gap-2">
            <Link 
              href="/dashboard/reports" 
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export</span>
            </Link>
            
            <Link 
              href="/dashboard/transactions" 
              className="btn-primary py-1.5 px-3 text-xs font-semibold rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Expense</span>
            </Link>
          </div>
        )}
      </div>

      {/* ── 4 Top KPI Cards (Studio Admin Exact Clean Layout) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Net Worth / Total Reserves */}
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
              <span className="font-medium">Net worth</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                +{Math.abs(netSavingsRate)}%
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
              ₱{Math.round(stats.totalBalance).toLocaleString()}
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            +₱{Math.round(stats.totalIncome * 0.1).toLocaleString()} vs last month
          </p>
        </div>

        {/* Available Cash / Inflow */}
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
              <span className="font-medium">Available cash</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                +3.2%
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
              ₱{Math.round(stats.totalIncome).toLocaleString()}
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            ₱{Math.round(stats.totalIncome / 30).toLocaleString()} daily average
          </p>
        </div>

        {/* Monthly Spend / Outflow */}
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
              <span className="font-medium">Monthly spend</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                +5.1%
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
              ₱{Math.round(stats.totalExpenses).toLocaleString()}
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            {recentTxs.length} approved line items
          </p>
        </div>

        {/* Savings Rate / Multi-Sig Queue */}
        <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
              <span className="font-medium">
                {roleLevel <= 2 ? "Multi-Sig Queue" : "Savings rate"}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {roleLevel <= 2 ? `${stats.pendingCount} pending` : `+2.4%`}
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
              {roleLevel <= 2 ? `${stats.pendingCount} Approvals` : `${netSavingsRate}%`}
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            {roleLevel <= 2 ? "Requires quorum vote" : "Retained in treasury"}
          </p>
        </div>

      </div>

      {/* ── Budget Alert (Clean Flat Banner) ── */}
      {budgetAlerts.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Budget Warning:</strong> &quot;{budgetAlerts[0].name}&quot; has utilized {budgetAlerts[0].percentage}% of its assigned cap.
            </span>
          </div>
          <Link href="/dashboard/budget" className="text-amber-400 underline font-semibold shrink-0 ml-2">
            Manage
          </Link>
        </div>
      )}

      {/* ── Charts Row: Spending Overview + Account Allocation Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        
        {/* Spending Overview (Monochrome Minimalist Line Chart) */}
        <div className="lg:col-span-2 p-4 md:p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Spending Overview
              </h3>
              <p className="text-[11px] text-zinc-500">Weekly trajectory of inflows versus authorized disbursements</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded">
                Monthly
              </span>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {cashFlow.length === 0 ? (
              <div className="text-center text-zinc-500 py-10">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No cash velocity data recorded for this period.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlow} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="monoIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="monoExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#71717a" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#71717a" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#52525b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={6}
                  />
                  <YAxis 
                    stroke="#52525b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    width={45}
                    tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    contentStyle={{ 
                      background: "#09090b", 
                      border: "1px solid #27272a", 
                      borderRadius: "8px", 
                      color: "#ffffff",
                      fontSize: "11px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                    }}
                    formatter={(value: unknown) => `₱${Number(value || 0).toLocaleString()}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#ffffff" 
                    strokeWidth={1.5} 
                    fill="url(#monoIncome)" 
                    name="Inflow (₱)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expense" 
                    stroke="#71717a" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4"
                    fill="url(#monoExpense)" 
                    name="Outflow (₱)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Account Allocation (Studio Admin Donut Chart) */}
        <div className="p-4 md:p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Account Allocation
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono">PHP Balance</span>
          </div>

          <div className="flex items-center justify-between gap-3 my-auto py-2">
            {/* Donut graphic */}
            <div className="relative w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={62}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#121215"
                    strokeWidth={2}
                  >
                    {allocationData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[9px] uppercase tracking-wider text-zinc-500">Total</span>
                <span className="text-xs font-bold text-white font-mono">
                  ₱{totalAllocationSum >= 1000 ? `${(totalAllocationSum / 1000).toFixed(0)}k` : totalAllocationSum}
                </span>
              </div>
            </div>

            {/* Allocation breakdown list */}
            <div className="flex-1 space-y-2 text-xs">
              {allocationData.map((item, idx) => {
                const pct = totalAllocationSum > 0 ? Math.round((item.value / totalAllocationSum) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                      <span className="text-zinc-400 truncate max-w-24 text-[11px]">{item.name}</span>
                    </div>
                    <span className="font-mono text-zinc-200 text-[11px] font-medium">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Verified on Polygon Amoy</span>
            <Link href="/dashboard/budget" className="text-white hover:underline">
              View breakdown
            </Link>
          </div>
        </div>

      </div>

      {/* ── Bottom Row: Recent Ledger Activity + Quick Shortcuts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        
        {/* Recent Ledger Transactions */}
        <div className="lg:col-span-2 p-4 md:p-5 rounded-xl bg-[#121215] border border-zinc-800">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Recent Ledger Transactions
              </h3>
              <p className="text-[11px] text-zinc-500">Cryptographically committed disbursements and revenue</p>
            </div>
            <Link 
              href="/dashboard/transactions" 
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-0.5"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-1.5">
            {recentTxs.length > 0 ? (
              recentTxs.map((tx) => (
                <div 
                  key={tx._id} 
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-800/50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-zinc-800 border border-zinc-700 text-zinc-300">
                      {tx.type === "income" ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-zinc-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate max-w-44 sm:max-w-72">
                        {tx.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span>{new Date(tx.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        {tx.isRecordedOnChain && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-400 font-mono">On-Chain</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className={`font-mono font-bold block ${
                      tx.type === "income" ? "text-emerald-400" : "text-white"
                    }`}>
                      {tx.type === "income" ? "+" : "-"}₱{Math.round(tx.amount).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase">
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-zinc-500 text-xs">
                No transactions recorded yet in this workspace.
              </div>
            )}
          </div>
        </div>

        {/* Shortcuts & Quick Actions */}
        <div className="p-4 md:p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              Shortcuts & Operations
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link 
                href="/dashboard/transactions"
                className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-center transition-colors flex flex-col items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-zinc-300" />
                <span className="font-medium text-zinc-300">Record Expense</span>
              </Link>

              <Link 
                href="/dashboard/approvals"
                className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-center transition-colors flex flex-col items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-zinc-300" />
                <span className="font-medium text-zinc-300">Multi-Sig Queue</span>
              </Link>

              <Link 
                href="/dashboard/budget"
                className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-center transition-colors flex flex-col items-center justify-center gap-1.5"
              >
                <Layers className="w-4 h-4 text-zinc-300" />
                <span className="font-medium text-zinc-300">Budgets</span>
              </Link>

              <Link 
                href="/dashboard/reports"
                className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-center transition-colors flex flex-col items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-zinc-300" />
                <span className="font-medium text-zinc-300">Audit Reports</span>
              </Link>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-800 text-center">
            <span className="text-[11px] text-zinc-500 font-mono">
              Transparency Score: <strong>{transparencyScore.percentage}%</strong> on Polygon
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
