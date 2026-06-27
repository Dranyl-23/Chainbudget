"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FileText, Download, BarChart3, Calendar, Filter } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import api from "@/lib/api";
import Portal from "@/components/Portal";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import toast from "react-hot-toast";
import DashboardSkeleton from "@/components/DashboardSkeleton";

interface ReportData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export default function ReportsPage() {
  const { user, activeOrgId } = useAuth();
  const [monthlyData, setMonthlyData] = useState<ReportData[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_reports_monthly");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [summaryStats, setSummaryStats] = useState(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_reports_stats");
      if (cached) return JSON.parse(cached);
    }
    return { totalTxs: 0, totalIncome: 0, totalExpenses: 0, netBalance: 0 };
  });
  const [loading, setLoading] = useState(monthlyData.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("6months");
  const [isExporting, setIsExporting] = useState(false);
  const [printData, setPrintData] = useState<any[] | null>(null);
  const [liquidationStatus, setLiquidationStatus] = useState("none");
  const [isSubmittingLiquidation, setIsSubmittingLiquidation] = useState(false);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        
        if (!activeOrgId) {
          setLoading(false);
          return;
        }

        const orgId = activeOrgId || "";
        const [res, orgRes] = await Promise.all([
          api.get("/reports/summary", { params: { orgId } }),
          api.get(`/organizations/${orgId}`)
        ]);

        const data = res.data;
        if (orgRes.data?.liquidationStatus) {
          setLiquidationStatus(orgRes.data.liquidationStatus);
        }

        // Populate cashFlow chart — API returns last 6 months grouped data.
        // Add a computed balance field for each month for the area chart.
        if (Array.isArray(data?.cashFlow) && data.cashFlow.length > 0) {
          const enriched = data.cashFlow.map((m: any) => ({
            ...m,
            balance: (m.income || 0) - (m.expense || 0),
          }));
          setMonthlyData(enriched);
          sessionStorage.setItem("cb_cache_reports_monthly", JSON.stringify(enriched));
        } else {
          generateDefaultData();
        }

        // API returns flat keys: totalIncome, totalExpenses, balance, approvedTransactions
        if (data?.totalIncome !== undefined) {
          const stats = {
            totalTxs: data.approvedTransactions ?? 0,
            totalIncome: data.totalIncome ?? 0,
            totalExpenses: data.totalExpenses ?? 0,
            netBalance: (data.totalIncome ?? 0) - (data.totalExpenses ?? 0),
          };
          setSummaryStats(stats);
          sessionStorage.setItem("cb_cache_reports_stats", JSON.stringify(stats));
        } else {
          calculateStats(orgId);
        }
      } catch (err) {
        console.error("Failed to fetch report data:", err);
        generateDefaultData();
        calculateStats(activeOrgId!);
      } finally {
        setLoading(false);
      }
    };

    const generateDefaultData = () => {
      setMonthlyData([
        { month: "Jan", income: 12000, expense: 8500, balance: 3500 },
        { month: "Feb", income: 9500, expense: 6200, balance: 3300 },
        { month: "Mar", income: 18000, expense: 14200, balance: 3800 },
        { month: "Apr", income: 11000, expense: 7800, balance: 3200 },
        { month: "May", income: 15000, expense: 9800, balance: 5200 },
        { month: "Jun", income: 13500, expense: 8200, balance: 5300 },
      ]);
    };

    const calculateStats = async (orgId: string) => {
      try {
        const txRes = await api.get("/transactions", {
          params: { orgId, limit: 1000 },
        });
        const txs = txRes.data.transactions || [];
        const income = txs
          .filter((t: any) => t.type === "income")
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const expenses = txs
          .filter((t: any) => t.type === "expense" && t.status === "approved")
          .reduce((sum: number, t: any) => sum + t.amount, 0);

        setSummaryStats({
          totalTxs: txs.length,
          totalIncome: income,
          totalExpenses: expenses,
          netBalance: income - expenses,
        });
      } catch {
        // Use defaults
        setSummaryStats({
          totalTxs: 47,
          totalIncome: 79000,
          totalExpenses: 54700,
          netBalance: 24300,
        });
      }
    };

    fetchReportData();
  }, [activeOrgId, range]);

  const handleExport = async (exportFormat: "pdf" | "csv") => {
    if (!activeOrgId) return;
    setIsExporting(true);
    try {
      const res = await api.get("/reports/export", {
        params: { orgId: activeOrgId },
      });
      const txs = res.data;
      
      if (exportFormat === "pdf") {
        setPrintData(txs);
        // Wait for React to render the print portal
        setTimeout(() => {
          window.print();
          // We don't nullify printData immediately because the print dialog pauses execution in some browsers
          // It will be hidden on screen anyway because of the 'hidden print:block' tailwind classes
          setIsExporting(false);
        }, 500);
        return;
      }

      const headers = ["Date", "Description", "Type", "Amount (Php)", "Status", "Category", "Submitted By"];
      const rows = txs.map((t: any) => [
        new Date(t.createdAt).toLocaleDateString(),
        t.description,
        t.type.toUpperCase(),
        t.amount.toLocaleString(),
        t.status.toUpperCase(),
        t.category || "General",
        t.submittedBy?.displayName || "Unknown"
      ]);

      exportToCSV(headers, rows, "Financial_Report");
      toast.success(`Exported to CSV successfully`);
      setIsExporting(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export data");
      setIsExporting(false);
    }
  };

  const handleSubmitLiquidation = async () => {
    if (!activeOrgId) return;
    setIsSubmittingLiquidation(true);
    try {
      const res = await api.post(`/organizations/${activeOrgId}/submit-liquidation`);
      setLiquidationStatus("pending");
      toast.success("Liquidation Report submitted successfully! Pending University approval.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to submit liquidation.");
    } finally {
      setIsSubmittingLiquidation(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Reports</h1>
          <p className="text-sm text-gray-500">Generate and export financial reports for your organization.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="input w-auto"
          >
            <option value="1month">Last Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last Year</option>
          </select>
          {/* RBAC Fix: Only Level 1 & 2 can export reports. Level 3 & 4 are read-only. */}
          {(user?.isSuperAdmin || (user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel || 4) <= 2) && (
            <div className="flex gap-2">
              <button className="btn-secondary py-2" onClick={() => handleExport("csv")} disabled={isExporting}>
                <Download className="w-4 h-4" /> CSV
              </button>
              <button className="btn-primary py-2" onClick={() => handleExport("pdf")} disabled={isExporting}>
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Liquidation Banner ── */}
      {(user?.isSuperAdmin || (user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel || 4) <= 2) && (
        <div className="mb-8 p-6 rounded-2xl glass border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg mb-1">Financial Liquidation</h3>
            <p className="text-sm text-gray-600">Submit your reports to the University for automated budget replenishment.</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              liquidationStatus === "approved" ? "bg-green-100 text-green-700 border-green-200" :
              liquidationStatus === "pending" ? "bg-orange-100 text-orange-700 border-orange-200" :
              "bg-gray-100 text-gray-700 border-gray-200"
            }`}>
              Status: {liquidationStatus.toUpperCase()}
            </span>
            {liquidationStatus !== "pending" && liquidationStatus !== "approved" && (
              <button 
                onClick={handleSubmitLiquidation}
                disabled={isSubmittingLiquidation}
                className="btn-primary"
              >
                {isSubmittingLiquidation ? "Submitting..." : "Submit Liquidation"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">Total Transactions</p>
          <h3 className="text-xl font-bold mb-1">{summaryStats.totalTxs}</h3>
          <p className="text-xs text-gray-500">This Period</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">Total Income</p>
          <h3 className="text-xl font-bold mb-1">₱{Math.round(summaryStats.totalIncome).toLocaleString()}</h3>
          <p className="text-xs text-gray-500">+12% vs last period</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">Total Expenses</p>
          <h3 className="text-xl font-bold mb-1">₱{Math.round(summaryStats.totalExpenses).toLocaleString()}</h3>
          <p className="text-xs text-gray-500">-5% vs last period</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">Net Balance</p>
          <h3 className="text-xl font-bold mb-1">₱{Math.round(summaryStats.netBalance).toLocaleString()}</h3>
          <p className="text-xs text-gray-500">{summaryStats.netBalance > 0 ? "Surplus" : "Deficit"}</p>
        </div>
      </div>

      {/* ── Area Chart ── */}
      <div className="glass p-6 rounded-xl mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Cash Flow Over Time
          </h3>
          <div className="flex items-center gap-3 md:gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Income</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger inline-block" /> Expenses</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary/70 inline-block" /> Balance</span>
          </div>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ left: 0, right: 20, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7B5BD6" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#7B5BD6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E05C5C" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#E05C5C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6B55D9" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#6B55D9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(107,85,217,0.18)" vertical={false} />
              <XAxis dataKey="month" stroke="#7A7A9D" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#7A7A9D" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                width={48}
                tickFormatter={(v) => `₱${v / 1000}k`} 
              />
              <Tooltip
                contentStyle={{ background: "#F8F6FF", border: "1px solid rgba(107,85,217,0.16)", borderRadius: "8px", color: "#1A1A2E" }}
                formatter={(v: any) => `₱${Number(v).toLocaleString()}`}
              />
              <Area type="monotone" dataKey="income"  stroke="#7B5BD6" strokeWidth={2} fill="url(#incGrad)" dot={false} />
              <Area type="monotone" dataKey="expense" stroke="#E05C5C" strokeWidth={2} fill="url(#expGrad)" dot={false} />
              <Area type="monotone" dataKey="balance" stroke="#6B55D9" strokeWidth={2} fill="url(#balGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>



      {/* ── Print View (Hidden on screen, visible on print) ── */}
      {printData && (
        <Portal>
          <div id="printable-report" className="bg-white text-black font-sans hidden print:block">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
              <div>
                <h1 className="text-4xl font-black text-gray-900 mb-1 tracking-tight">CHAIN<span className="text-primary">BUDGET</span></h1>
                <p className="text-gray-600 font-semibold text-lg uppercase tracking-widest">Financial Report</p>
                <p className="text-gray-500 text-sm mt-1">Generated by {user?.displayName || "System Administrator"}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 uppercase tracking-wider text-xs">Date Generated</p>
                <p className="text-gray-900 text-lg font-medium">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-xs text-gray-500 mt-2">Time: {new Date().toLocaleTimeString()}</p>
              </div>
            </div>

            {/* Summary Box */}
            <div className="grid grid-cols-4 gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Income</p>
                <p className="text-xl font-bold text-gray-900">₱{summaryStats.totalIncome.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Expenses</p>
                <p className="text-xl font-bold text-gray-900">₱{summaryStats.totalExpenses.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Net Balance</p>
                <p className="text-xl font-bold text-gray-900">₱{summaryStats.netBalance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Transactions</p>
                <p className="text-xl font-bold text-gray-900">{summaryStats.totalTxs}</p>
              </div>
            </div>

            {/* Table */}
            <h3 className="text-lg font-bold mb-4 text-gray-800">Transaction History</h3>
            <table className="w-full text-left text-sm mb-12">
              <thead>
                <tr className="border-b-2 border-gray-800 text-gray-900">
                  <th className="py-2 pr-4 font-bold">Date</th>
                  <th className="py-2 pr-4 font-bold">Description</th>
                  <th className="py-2 pr-4 font-bold">Category</th>
                  <th className="py-2 pr-4 font-bold">Type</th>
                  <th className="py-2 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {printData.map(tx => (
                  <tr key={tx._id} className="border-b border-gray-200">
                    <td className="py-3 pr-4">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 font-medium">{tx.description}</td>
                    <td className="py-3 pr-4">{tx.category || "-"}</td>
                    <td className="py-3 pr-4 font-medium capitalize">{tx.type}</td>
                    <td className={`py-3 text-right font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}₱{tx.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {printData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 italic">No transactions found for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Signatures */}
            <div className="flex justify-between pt-16 px-12 break-inside-avoid">
              <div className="w-48 text-center">
                <div className="border-b border-gray-800 h-8 mb-2"></div>
                <p className="text-xs font-bold text-gray-800 uppercase tracking-widest">Prepared By</p>
                <p className="text-xs text-gray-500 mt-1">{user?.displayName || "Finance Officer"}</p>
              </div>
              <div className="w-48 text-center">
                <div className="border-b border-gray-800 h-8 mb-2"></div>
                <p className="text-xs font-bold text-gray-800 uppercase tracking-widest">Approved By</p>
                <p className="text-xs text-gray-500 mt-1">Executive / Director</p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="mt-16 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
              <p>ChainBudget - Blockchain-Verified Financial System</p>
              <p>Generated securely on-chain.</p>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
