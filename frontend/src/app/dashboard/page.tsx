"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, ArrowDownRight, Wallet, Activity,
  ShieldCheck, FileText, BarChart2, Link2, CheckCircle,
  AlertTriangle, TrendingDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import api from "@/lib/api";

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

interface CashFlowData {
  month: string;
  income: number;
  expense: number;
}

import DashboardSkeleton from "@/components/DashboardSkeleton";

export default function DashboardPage() {
  const { user, activeOrgId } = useAuth();
  const [cashFlow, setCashFlow] = useState<CashFlowData[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dash_cashflow");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [recentTxs, setRecentTxs] = useState<Transaction[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dash_txs");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [stats, setStats] = useState(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_dash_stats");
      if (cached) return JSON.parse(cached);
    }
    return {
      totalBalance: 0,
      totalIncome: 0,
      totalExpenses: 0,
      pendingCount: 0,
    };
  });
  const [loading, setLoading] = useState(cashFlow.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [transparencyScore, setTransparencyScore] = useState({ approved: 0, onChain: 0, percentage: 0 });
  const [budgetAlerts, setBudgetAlerts] = useState<Array<{name: string; allocated: number; spent: number; percentage: number}>>([]);

  const currentMembership = user?.memberships?.find(
    (m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId
  );
  const roleLevel = user?.isSuperAdmin ? 0 : (currentMembership?.roleLevel || 4);

  useEffect(() => {
    const fetchData = async () => {
      try {
        
        if (!activeOrgId) {
          setLoading(false);
          return;
        }

        const orgId = activeOrgId || "";

        // Fetch transactions
        const txRes = await api.get("/transactions", {
          params: { orgId, limit: 6 },
        });
        const allTxs: Transaction[] = txRes.data.transactions || [];
        const topTxs = allTxs.slice(0, 4);
        setRecentTxs(topTxs);
        sessionStorage.setItem("cb_cache_dash_txs", JSON.stringify(topTxs));

        // Calculate stats from transactions
        const income = allTxs
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);
        const expenses = allTxs
          .filter((t) => t.type === "expense" && t.status === "approved")
          .reduce((sum, t) => sum + t.amount, 0);
        const pending = allTxs.filter(
          (t) => t.status === "pending_approval"
        ).length;

        const computedStats = {
          totalBalance: income - expenses,
          totalIncome: income,
          totalExpenses: expenses,
          pendingCount: pending,
        };
        setStats(computedStats);
        sessionStorage.setItem("cb_cache_dash_stats", JSON.stringify(computedStats));

        // Fetch real summary stats + cashFlow from the reports API
        try {
          const reportRes = await api.get("/reports/summary", {
            params: { orgId },
          });
          const data = reportRes.data;

          // Override stats with the accurate server-computed values
          if (data) {
            const accurateStats = {
              totalBalance: (data.totalIncome || 0) - (data.totalExpenses || 0),
              totalIncome: data.totalIncome || 0,
              totalExpenses: data.totalExpenses || 0,
              pendingCount: data.pendingApprovals ?? pending,
            };
            setStats(accurateStats);
            sessionStorage.setItem("cb_cache_dash_stats", JSON.stringify(accurateStats));

            // Compute Transparency Score
            const approved = data.approvedTransactions || 0;
            const onChain = data.onChainTransactions || 0;
            const pct = approved > 0 ? Math.round((onChain / approved) * 100) : 0;
            setTransparencyScore({ approved, onChain, percentage: pct });
          }

          // Use real cashFlow if available, otherwise fall back to mock
          if (Array.isArray(data?.cashFlow) && data.cashFlow.length > 0) {
            setCashFlow(data.cashFlow);
            sessionStorage.setItem("cb_cache_dash_cashflow", JSON.stringify(data.cashFlow));
          } else {
            generateMockCashFlow();
          }
        } catch {
          // Summary API unavailable — keep stats from transactions, use mock chart
          generateMockCashFlow();
        }

        // Fetch budget data for security alerts
        try {
          const budgetRes = await api.get("/budget", { params: { orgId } });
          const budgets = budgetRes.data || [];
          // Find categories at 80%+ usage
          const alerts = budgets
            .map((b: any) => ({ name: b.name, allocated: b.allocated, spent: b.spent, percentage: b.allocated > 0 ? Math.round((b.spent / b.allocated) * 100) : 0 }))
            .filter((b: any) => b.percentage >= 80)
            .sort((a: any, b: any) => b.percentage - a.percentage);
          setBudgetAlerts(alerts);
        } catch { /* budget alerts are optional */ }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Failed to load dashboard data");
        generateMockCashFlow();
      } finally {
        setLoading(false);
      }
    };

    const generateMockCashFlow = () => {
      setCashFlow([
        { month: "Jan", income: 4000, expense: 2400 },
        { month: "Feb", income: 3000, expense: 1398 },
        { month: "Mar", income: 2000, expense: 9800 },
        { month: "Apr", income: 2780, expense: 3908 },
        { month: "May", income: 1890, expense: 4800 },
        { month: "Jun", income: 2390, expense: 3800 },
      ]);
    };

    fetchData();
  }, [activeOrgId]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in">
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            {roleLevel === 4 ? "Financial Overview" : "Overview"}
          </h1>
          <p className="text-sm text-gray-500">
            {roleLevel === 4 
              ? "Transparent view of the organization's funds and expenditures." 
              : `Welcome back${user?.displayName ? `, ${user.displayName}` : ""}. Here's what's happening with your funds.`}
          </p>
        </div>
        
        {roleLevel <= 3 && (
          <div className="flex gap-3">
            <Link href="/dashboard/reports" className="btn-secondary py-2">
              <FileText className="w-4 h-4" /> Export Report
            </Link>
            <Link href="/dashboard/transactions" className="btn-primary py-2">
              <Wallet className="w-4 h-4" /> New Transaction
            </Link>
          </div>
        )}
      </header>

      {/* ── Stats Row ── */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 ${roleLevel <= 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <div className="stat-card">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <span className="badge badge-approved">
              {stats.totalBalance >= 0 ? "+" : ""}
              {Math.round((stats.totalBalance / (stats.totalIncome || 1)) * 100)}%
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Total Balance</p>
          <h3 className="text-2xl font-bold">₱{Math.round(stats.totalBalance).toLocaleString()}</h3>
        </div>

        <div className="stat-card">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <ArrowUpRight className="w-5 h-5 text-primary/80" />
            </div>
            <span className="text-xs text-gray-500">This Month</span>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Total Income</p>
          <h3 className="text-2xl font-bold">₱{Math.round(stats.totalIncome).toLocaleString()}</h3>
        </div>

        <div className="stat-card">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-danger/10">
              <ArrowDownRight className="w-5 h-5 text-danger" />
            </div>
            <span className="text-xs text-gray-500">This Month</span>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Total Expenses</p>
          <h3 className="text-2xl font-bold">₱{Math.round(stats.totalExpenses).toLocaleString()}</h3>
        </div>

        {roleLevel <= 2 && (
          <Link href="/dashboard/approvals" className="stat-card border-primary/20 bg-primary/5 cursor-pointer block">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                <Activity className="w-5 h-5 text-primary/80" />
              </div>
              <span className="badge badge-pending">Needs Action</span>
            </div>
            <p className="text-sm text-primary/80 font-medium mb-1">Pending Approvals</p>
            <h3 className="text-2xl font-bold text-primary">{stats.pendingCount}</h3>
          </Link>
        )}
      </div>

      {/* ── Critical Security Alerts ── */}
      {roleLevel <= 3 && budgetAlerts.length > 0 && (
        <div className="mb-8 space-y-3">
          {budgetAlerts.map((alert) => (
            <div key={alert.name} className={`flex items-center gap-4 p-4 rounded-xl border ${
              alert.percentage >= 100 
                ? 'bg-red-50 border-red-200' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                alert.percentage >= 100 ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                {alert.percentage >= 100 
                  ? <AlertTriangle className="w-5 h-5 text-red-600" />
                  : <TrendingDown className="w-5 h-5 text-amber-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${alert.percentage >= 100 ? 'text-red-700' : 'text-amber-700'}`}>
                  {alert.percentage >= 100 ? '🚨 Budget Exceeded' : 'Budget Running Low'}: "{alert.name}"
                </p>
                <p className={`text-xs mt-0.5 ${alert.percentage >= 100 ? 'text-red-600' : 'text-amber-600'}`}>
                  ₱{Math.round(alert.spent).toLocaleString()} of ₱{Math.round(alert.allocated).toLocaleString()} used ({alert.percentage}%)
                </p>
              </div>
              <div className="w-24 flex-shrink-0">
                <div className={`w-full rounded-full h-2 ${alert.percentage >= 100 ? 'bg-red-200' : 'bg-amber-200'}`}>
                  <div className={`h-full rounded-full transition-all ${alert.percentage >= 100 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(alert.percentage, 100)}%` }} />
                </div>
                <p className={`text-[10px] text-center mt-1 font-bold ${alert.percentage >= 100 ? 'text-red-600' : 'text-amber-600'}`}>{alert.percentage}%</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Chart ── */}
        <div className="lg:col-span-2 glass p-6 rounded-xl">
          <h3 className="text-base font-semibold mb-6 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" /> Cash Flow
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6B55D9" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#6B55D9" stopOpacity={0.4}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E05C5C" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#E05C5C" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} width={48}
                  tickFormatter={(val) => `₱${val / 1000}k`} />
                <Tooltip
                  cursor={{ fill: "var(--color-border)" }}
                  contentStyle={{ 
                    background: "var(--color-bg)", 
                    border: "1px solid var(--color-border)", 
                    borderRadius: "12px", 
                    color: "var(--color-text)",
                    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)"
                  }}
                  itemStyle={{ fontWeight: 600 }}
                  formatter={(v: any) => `₱${Number(v).toLocaleString()}`}
                />
                <Bar dataKey="income" fill="url(#colorIncome)" radius={[6, 6, 0, 0]} maxBarSize={40} name="Income" />
                <Bar dataKey="expense" fill="url(#colorExpense)" radius={[6, 6, 0, 0]} maxBarSize={40} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="glass p-6 rounded-xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Recent Activity
            </h3>
            <Link href="/dashboard/transactions" className="text-xs text-primary hover:text-primary/70">View All</Link>
          </div>

          <div className="flex-1 space-y-3">
            {recentTxs.length > 0 ? (
              recentTxs.map((tx) => (
                <div key={tx._id} className="flex items-center justify-between p-3 rounded-lg bg-white/90 border border-purple-100 hover:bg-white transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === "income" ? "bg-primary/10" : "bg-danger/10"}`}>
                      {tx.type === "income"
                        ? <ArrowUpRight className="w-4 h-4 text-primary" />
                        : <ArrowDownRight className="w-4 h-4 text-danger" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 line-clamp-1">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</span>
                        {tx.isRecordedOnChain && (
                          tx.blockchainTxHash ? (
                            <a 
                              href={`https://amoy.polygonscan.com/tx/${tx.blockchainTxHash}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                              title="View on Polygonscan"
                            >
                              <span className="chain-dot w-1.5 h-1.5" />
                              <span className="text-[10px] text-primary font-medium">Verified</span>
                            </a>
                          ) : (
                            <span className="chain-dot w-1.5 h-1.5" title="Recorded on Blockchain" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.type === "income" ? "text-primary" : "text-danger"}`}>
                      {tx.type === "income" ? "+" : "-"}₱{Math.round(tx.amount).toLocaleString()}
                    </p>
                    <span className={`badge ${tx.status === "approved" ? "badge-approved" : "badge-pending"} text-[10px] px-1.5 py-0 mt-1`}>
                      {tx.status === "approved" ? "Approved" : "Pending"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">No transactions yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Transparency Score ── */}
      <div className="glass p-6 rounded-xl mt-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Radial Gauge */}
          <div className="relative w-40 h-40 flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              {/* Background circle */}
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e8e1ff" strokeWidth="10" />
              {/* Progress arc */}
              <circle 
                cx="60" cy="60" r="52" fill="none" 
                stroke="url(#scoreGradient)" 
                strokeWidth="10" 
                strokeLinecap="round"
                strokeDasharray={`${(transparencyScore.percentage / 100) * 327} 327`}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6B55D9" />
                  <stop offset="100%" stopColor="#22C55E" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-800">{transparencyScore.percentage}%</span>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Verified</span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <Link2 className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-gray-800">Blockchain Transparency Score</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4 max-w-lg">
              This score represents the percentage of all approved transactions that have been
              permanently recorded and verified on the <strong>Polygon Blockchain</strong>.
              A higher score means greater financial transparency and accountability.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">{transparencyScore.onChain} On-Chain</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">{transparencyScore.approved} Approved</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-100">
                <span className="chain-dot w-2 h-2" />
                <span className="text-sm font-semibold text-purple-700">Polygon Amoy Network</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
