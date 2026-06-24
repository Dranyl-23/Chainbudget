"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, ArrowDownRight, Wallet, Activity,
  ShieldCheck, FileText, BarChart2,
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
}

interface CashFlowData {
  month: string;
  income: number;
  expense: number;
}

export default function DashboardPage() {
  const { user, activeOrgId } = useAuth();
  const [cashFlow, setCashFlow] = useState<CashFlowData[]>([]);
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({
    totalBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    pendingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setRecentTxs(allTxs.slice(0, 4));

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

        setStats({
          totalBalance: income - expenses,
          totalIncome: income,
          totalExpenses: expenses,
          pendingCount: pending,
        });

        // Fetch real summary stats + cashFlow from the reports API
        try {
          const reportRes = await api.get("/reports/summary", {
            params: { orgId },
          });
          const data = reportRes.data;

          // Override stats with the accurate server-computed values
          if (data) {
            setStats({
              totalBalance: (data.totalIncome || 0) - (data.totalExpenses || 0),
              totalIncome: data.totalIncome || 0,
              totalExpenses: data.totalExpenses || 0,
              pendingCount: data.pendingApprovals ?? pending,
            });
          }

          // Use real cashFlow if available, otherwise fall back to mock
          if (Array.isArray(data?.cashFlow) && data.cashFlow.length > 0) {
            setCashFlow(data.cashFlow);
          } else {
            generateMockCashFlow();
          }
        } catch {
          // Summary API unavailable — keep stats from transactions, use mock chart
          generateMockCashFlow();
        }
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

  return (
    <div className="p-8 pb-20 animate-fade-in">
      <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Overview</h1>
          <p className="text-sm text-gray-500">
            Welcome back{user?.displayName ? `, ${user.displayName}` : ""}. Here's what's happening with your funds.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/reports" className="btn-secondary py-2">
            <FileText className="w-4 h-4" /> Export Report
          </Link>
          <Link href="/dashboard/transactions" className="btn-primary py-2">
            <Wallet className="w-4 h-4" /> New Transaction
          </Link>
        </div>
      </header>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Chart ── */}
        <div className="lg:col-span-2 glass p-6 rounded-xl">
          <h3 className="text-base font-semibold mb-6 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" /> Cash Flow
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,85,217,0.18)" vertical={false} />
                <XAxis dataKey="month" stroke="#7A7A9D" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7A7A9D" fontSize={12} tickLine={false} axisLine={false}
                  tickFormatter={(val) => `₱${val / 1000}k`} />
                <Tooltip
                  cursor={{ fill: "rgba(107,85,217,0.08)" }}
                  contentStyle={{ background: "#F8F6FF", border: "1px solid rgba(107,85,217,0.16)", borderRadius: "8px", color: "#1A1A2E" }}
                  formatter={(v: any) => `₱${Number(v).toLocaleString()}`}
                />
                <Bar dataKey="income" fill="#6B55D9" radius={[4, 4, 0, 0]} maxBarSize={40} name="Income" />
                <Bar dataKey="expense" fill="#E05C5C" radius={[4, 4, 0, 0]} maxBarSize={40} name="Expense" />
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
                          <span className="chain-dot w-1.5 h-1.5" title="Recorded on Blockchain" />
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
    </div>
  );
}
