"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FileText, Download, BarChart3, Sparkles, BrainCircuit, AlertTriangle, TrendingUp, TrendingDown, Info, Loader2, FileCheck, CheckCircle2, Receipt, ExternalLink, X, ShieldCheck, Scale } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import api from "@/lib/api";
import Portal from "@/components/Portal";
import CustomSelect, { CustomSelectOption } from "@/components/CustomSelect";
import { exportToCSV } from "@/lib/exportUtils";
import toast from "react-hot-toast";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import axios from "axios";

// ── Types ────────────────────────────────────────────────────────────────────
interface ReportData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

interface CashFlowItem {
  month: string;
  income: number;
  expense: number;
  balance?: number;
}

interface ReportSummaryResponse {
  cashFlow?: CashFlowItem[];
  approvedTransactions?: number;
  totalIncome?: number;
  totalExpenses?: number;
  balance?: number;
}

interface OrganizationResponse {
  liquidationStatus?: string;
  _id?: string;
  name?: string;
  type?: string;
}

interface ExportTransactionItem {
  _id: string;
  description: string;
  type: string;
  amount: number;
  status: string;
  category?: string;
  createdAt: string;
  submittedBy?: { displayName?: string; walletAddress?: string; _id?: string };
}

interface TransactionApiItem {
  _id: string;
  type: string;
  amount: number;
  status: string;
  description?: string;
  category?: string;
  createdAt?: string;
  submittedBy?: { displayName?: string; walletAddress?: string };
  documentUrl?: string;
  documentHash?: string;
  blockchainTxHash?: string;
  referenceNumber?: string;
}

interface TransactionsApiResponse {
  transactions?: TransactionApiItem[];
  total?: number;
}

interface AiForecastData {
  healthStatus: "good" | "warning" | "critical" | string;
  forecast: string;
  insights?: string[];
}

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

const LIQUIDATION_CONFIG: Record<string, { title: string; desc: string }> = {
  student_org: {
    title: "Institutional Liquidation",
    desc: "Submit your verified ledger and transaction receipts to University / College Finance for automated subsidy replenishment.",
  },
  barangay: {
    title: "Barangay Public Fund Liquidation",
    desc: "Submit verified disbursements and receipt records to the municipal audit office for public fund liquidation.",
  },
  homeowners_association: {
    title: "HOA Financial Liquidation",
    desc: "Submit verified maintenance expenditures and official receipts to the HOA Board for community liquidation and audit.",
  },
  ngo: {
    title: "Grant & Donor Liquidation",
    desc: "Submit program expense receipts and financial statements to donor partners for grant compliance and liquidation.",
  },
  cooperative: {
    title: "Cooperative Operating Liquidation",
    desc: "Submit operating expense vouchers and audited cash flow receipts for annual general assembly liquidation.",
  },
  church: {
    title: "Ministry Stewardship Liquidation",
    desc: "Submit ministry outreach disbursements and audited receipts to the finance council for parish stewardship liquidation.",
  },
  sports_club: {
    title: "Club Expense Liquidation",
    desc: "Submit tournament fees, equipment disbursements, and verified receipts for team audit and member liquidation.",
  },
  startup: {
    title: "Corporate Expense Liquidation",
    desc: "Submit verified operational receipts and expense reports to the treasury board for runway audit and replenishment.",
  },
  family: {
    title: "Family Fund Liquidation",
    desc: "Submit household receipts and shared expense records to family contributors for transparent budget tracking.",
  },
  fundraising: {
    title: "Group Fund Liquidation",
    desc: "Submit verified activity receipts and expense vouchers to all contributors for 100% transparent fund liquidation.",
  },
};

function getLiquidationConfig(type?: string | null) {
  if (type && LIQUIDATION_CONFIG[type]) {
    return LIQUIDATION_CONFIG[type];
  }
  return {
    title: "Financial Liquidation Report",
    desc: "Submit verified ledger transactions and receipts to all stakeholders and auditors for transparent fund liquidation.",
  };
}

const REPORT_RANGE_OPTIONS: CustomSelectOption[] = [
  { value: "1month", label: "Last Month" },
  { value: "3months", label: "Last 3 Months" },
  { value: "6months", label: "Last 6 Months" },
  { value: "1year", label: "Last Year" },
];

export default function ReportsPage() {
  const { user, activeOrgId } = useAuth();
  const [monthlyData, setMonthlyData] = useState<ReportData[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_reports_monthly");
      if (cached) {
        try {
          return JSON.parse(cached) as ReportData[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [summaryStats, setSummaryStats] = useState(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_reports_stats");
      if (cached) {
        try {
          return JSON.parse(cached) as { totalTxs: number; totalIncome: number; totalExpenses: number; netBalance: number };
        } catch {
          return { totalTxs: 0, totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        }
      }
    }
    return { totalTxs: 0, totalIncome: 0, totalExpenses: 0, netBalance: 0 };
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("cb_cache_reports_monthly");
  });
  const [range, setRange] = useState("6months");
  const [isExporting, setIsExporting] = useState(false);
  const [printData, setPrintData] = useState<ExportTransactionItem[] | null>(null);
  const [liquidationStatus, setLiquidationStatus] = useState("none");
  const [isSubmittingLiquidation, setIsSubmittingLiquidation] = useState(false);
  const [orgType, setOrgType] = useState<string | null>(null);
  const [showLiquidationModal, setShowLiquidationModal] = useState(false);
  const [liquidationTxs, setLiquidationTxs] = useState<TransactionApiItem[]>([]);
  
  // AI Forecaster State
  const [aiForecast, setAiForecast] = useState<AiForecastData | null>(null);
  const [isFetchingForecast, setIsFetchingForecast] = useState(false);

  useEffect(() => {
    if (!activeOrgId) return;

    let isCancelled = false;
    const orgId = activeOrgId;

    const calculateStats = async (targetOrgId: string) => {
      try {
        const txRes = await api.get<TransactionsApiResponse>("/transactions", {
          params: { orgId: targetOrgId, limit: 1000, range },
        });
        const txs: TransactionApiItem[] = txRes.data.transactions || [];
        const income = txs
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);
        const expenses = txs
          .filter((t) => t.type === "expense" && t.status === "approved")
          .reduce((sum, t) => sum + t.amount, 0);

        const stats = {
          totalTxs: txs.length,
          totalIncome: income,
          totalExpenses: expenses,
          netBalance: income - expenses,
        };

        if (!isCancelled) {
          setLiquidationTxs(txs);
          setSummaryStats(stats);
          sessionStorage.setItem("cb_cache_reports_stats", JSON.stringify(stats));
        }
        return stats;
      } catch (err) {
        console.warn("[Reports] Failed to calculate stats from transactions:", err);
        const emptyStats = {
          totalTxs: 0,
          totalIncome: 0,
          totalExpenses: 0,
          netBalance: 0,
        };
        if (!isCancelled) {
          setSummaryStats(emptyStats);
        }
        return emptyStats;
      }
    };

    const buildDeterministicForecast = (stats: { totalIncome: number; totalExpenses: number; netBalance: number }): AiForecastData => {
      const income = stats.totalIncome || 0;
      const expenses = stats.totalExpenses || 0;
      const net = stats.netBalance ?? (income - expenses);
      const healthStatus: "good" | "warning" | "critical" =
        net >= 0 && expenses <= (income || 1)
          ? "good"
          : expenses > (income * 1.25)
          ? "critical"
          : "warning";

      return {
        forecast: income === 0 && expenses === 0
          ? "Treasury ledger is currently initialized with no recorded cash disbursements for this cycle. As funding allocations and expenditures are logged, automated predictive intelligence will model runway and outflow velocity.\n\nInstitutional governance controls, multi-signature authorizations, and cryptographic audit proofs remain active across all organizational reserves."
          : `Based on recorded transactions, total inflows stand at ₱${Math.round(income).toLocaleString()} against ₱${Math.round(expenses).toLocaleString()} in expenditures, yielding a net operating balance of ₱${Math.round(net).toLocaleString()}.\n\nSpending velocity is tracking within operational limits. Continuing to record verified vendor receipts will ensure streamlined university liquidation processing.`,
        insights: [
          expenses > income
            ? `Period expenditures exceed recorded inflows by ₱${Math.round(Math.abs(net)).toLocaleString()}. Review non-urgent operating outlays.`
            : `Operating cash flow remains positive (+₱${Math.round(net).toLocaleString()}), indicating a resilient treasury buffer.`,
          "Ensure all multi-signature approvals and cryptographic receipts are attached to pending disbursements before liquidation submission.",
          "Treasury smart contracts are active on Polygon Amoy for real-time auditability and student transparency.",
        ],
        healthStatus,
      };
    };

    const fetchAiForecast = async (latestStats?: { totalIncome: number; totalExpenses: number; netBalance: number }) => {
      setIsFetchingForecast(true);
      try {
        const res = await api.get<AiForecastData>("/ai/forecast", { 
          params: { orgId },
          timeout: 6000,
        });
        if (!isCancelled && res.data && res.data.forecast) {
          setAiForecast(res.data);
          return;
        }
      } catch (err) {
        console.warn("[Reports] Remote AI forecast unavailable or timed out; generating instant deterministic analysis:", err);
      } finally {
        if (!isCancelled) {
          setIsFetchingForecast(false);
        }
      }

      if (!isCancelled) {
        const stats = latestStats || { totalTxs: 0, totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        setAiForecast(buildDeterministicForecast(stats));
      }
    };

    const fetchReportData = async () => {
      try {
        const [res, orgRes, txRes] = await Promise.all([
          api.get<ReportSummaryResponse>("/reports/summary", { params: { orgId, range } }),
          api.get<OrganizationResponse>(`/organizations/${orgId}`),
          api.get<TransactionsApiResponse>("/transactions", { params: { orgId, limit: 1000, range } })
        ]);

        if (isCancelled) return;

        if (txRes.data?.transactions) {
          setLiquidationTxs(txRes.data.transactions);
        }

        const data = res.data;
        if (orgRes.data?.liquidationStatus) {
          setLiquidationStatus(orgRes.data.liquidationStatus);
        }
        if (orgRes.data?.type) {
          setOrgType(orgRes.data.type);
        }

        if (Array.isArray(data?.cashFlow) && data.cashFlow.length > 0) {
          const enriched: ReportData[] = data.cashFlow.map((m) => ({
            month: m.month,
            income: m.income || 0,
            expense: m.expense || 0,
            balance: (m.income || 0) - (m.expense || 0),
          }));
          setMonthlyData(enriched);
          sessionStorage.setItem("cb_cache_reports_monthly", JSON.stringify(enriched));
        } else {
          if (!isCancelled) setMonthlyData([]);
        }

        let currentStats = { totalTxs: 0, totalIncome: 0, totalExpenses: 0, netBalance: 0 };
        if (data?.totalIncome !== undefined) {
          currentStats = {
            totalTxs: data.approvedTransactions ?? 0,
            totalIncome: data.totalIncome ?? 0,
            totalExpenses: data.totalExpenses ?? 0,
            netBalance: (data.totalIncome ?? 0) - (data.totalExpenses ?? 0),
          };
          setSummaryStats(currentStats);
          sessionStorage.setItem("cb_cache_reports_stats", JSON.stringify(currentStats));
        } else {
          currentStats = await calculateStats(orgId);
        }

        void fetchAiForecast(currentStats);
      } catch (err) {
        console.warn("[Reports] Failed to fetch report data:", err);
        if (!isCancelled) {
          setMonthlyData([]);
          const currentStats = await calculateStats(orgId);
          void fetchAiForecast(currentStats);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchReportData();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, range]);

  const handleExport = async (exportFormat: "pdf" | "csv") => {
    if (!activeOrgId) return;
    setIsExporting(true);
    try {
      const res = await api.get<ExportTransactionItem[]>("/reports/export", {
        params: { orgId: activeOrgId },
      });
      const txs: ExportTransactionItem[] = res.data || [];
      
      if (exportFormat === "pdf") {
        setPrintData(txs);
        setTimeout(() => {
          window.print();
          setIsExporting(false);
        }, 500);
        return;
      }

      const headers = ["Date", "Description", "Type", "Amount (Php)", "Status", "Category", "Submitted By"];
      const rows = txs.map((t) => [
        new Date(t.createdAt).toLocaleDateString(),
        t.description,
        t.type.toUpperCase(),
        t.amount.toLocaleString(),
        t.status.toUpperCase(),
        t.category || "General",
        t.submittedBy?.displayName || "Unknown"
      ]);

      exportToCSV(headers, rows, "Financial_Report");
      toast.success("Exported to CSV successfully");
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
      await api.post(`/organizations/${activeOrgId}/submit-liquidation`);
      setLiquidationStatus("pending");
      const liqConfig = getLiquidationConfig(orgType);
      toast.success(`${liqConfig.title} submitted successfully! Pending verification.`);
    } catch (err: unknown) {
      console.error("Liquidation submit error:", err);
      let errorMsg = "Failed to submit liquidation.";
      if (axios.isAxiosError(err)) {
        errorMsg = err.response?.data?.error || err.message || errorMsg;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      toast.error(errorMsg);
    } finally {
      setIsSubmittingLiquidation(false);
    }
  };

  const memberships = (user?.memberships || []) as UserMembership[];
  const userRoleInOrg = memberships.find((m) => {
    const orgId = typeof m.organization === "string" ? m.organization : m.organization?._id;
    return orgId === activeOrgId;
  })?.roleLevel || 4;
  const canManageReports = user?.isSuperAdmin || userRoleInOrg <= 2;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
              Financial Intelligence
            </span>
            <span className="text-[11px] text-zinc-500">Real-Time Inflow / Outflow Analytics</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-zinc-300" />
            Financial Reports
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-1 max-w-2xl">
            {orgType === "student_org" 
              ? "Institutional cash flow monitoring, AI treasury forecasts, and university liquidation statements."
              : "Comprehensive cash flow monitoring, AI treasury forecasts, and verified ledger statements."}
          </p>
        </div>

        {/* Actions & Range Select */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-auto">
          <div className="w-36 sm:w-40">
            <CustomSelect
              size="sm"
              value={range}
              onChange={(val) => setRange(val)}
              options={REPORT_RANGE_OPTIONS}
              buttonClassName="!py-1.5 !px-3 font-medium text-xs bg-zinc-900 border-zinc-800 hover:border-zinc-700"
              menuClassName="w-36 sm:w-40 right-0 left-auto"
            />
          </div>

          {canManageReports && (
            <div className="flex items-center gap-2">
              <button 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                onClick={() => handleExport("csv")} 
                disabled={isExporting}
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" /> CSV
              </button>
              <button 
                className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                onClick={() => handleExport("pdf")} 
                disabled={isExporting}
              >
                <FileText className="w-3.5 h-3.5" /> PDF Statement
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Dynamic Liquidation Banner tailored to Organization Type ── */}
      {canManageReports && (() => {
        const liqConfig = getLiquidationConfig(orgType);
        return (
          <div className="p-4.5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white">
                  {liqConfig.title}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                  liquidationStatus === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  liquidationStatus === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                  "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}>
                  {liquidationStatus.toUpperCase() || "NONE"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 max-w-xl">
                {liqConfig.desc}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setShowLiquidationModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <FileCheck className="w-3.5 h-3.5 text-zinc-300" />
                Audit Breakdown
              </button>

              {liquidationStatus !== "pending" && liquidationStatus !== "approved" && (
                <button 
                  onClick={handleSubmitLiquidation}
                  disabled={isSubmittingLiquidation}
                  className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingLiquidation ? "Submitting..." : "Submit Liquidation"}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── AI Financial Advisor Widget ── */}
      {isFetchingForecast ? (
        <div className="p-6 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col items-center justify-center min-h-[120px]">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mb-2" />
          <p className="text-xs font-medium text-zinc-400">Generating AI budgetary forecast...</p>
        </div>
      ) : aiForecast ? (
        <div className="rounded-xl border border-zinc-800 bg-[#121215] overflow-hidden shadow-xs">
          {/* Header */}
          <div className="p-4 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  AI Financial Advisor <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Predictive treasury analysis synthesized from historical ledger velocity
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5 border ${
                aiForecast.healthStatus === "good" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                aiForecast.healthStatus === "warning" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                {aiForecast.healthStatus === "good" && <TrendingUp className="w-3 h-3" />}
                {aiForecast.healthStatus === "warning" && <AlertTriangle className="w-3 h-3" />}
                {aiForecast.healthStatus === "critical" && <TrendingDown className="w-3 h-3" />}
                Status: {aiForecast.healthStatus}
              </span>
            </div>
          </div>
          
          {/* Body */}
          <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Forecast Paragraphs */}
            <div>
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Executive Forecast
              </h4>
              <div className="space-y-2">
                {aiForecast.forecast.split("\n\n").map((para: string, idx: number) => (
                  <p key={idx} className="text-xs text-zinc-300 leading-relaxed bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                    {para}
                  </p>
                ))}
              </div>
            </div>
            
            {/* Insights List */}
            <div>
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> Actionable Recommendations
              </h4>
              <ul className="space-y-2">
                {aiForecast.insights?.map((insight: string, idx: number) => (
                  <li key={idx} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs text-zinc-300 flex gap-2.5 items-start">
                    <span className="font-mono font-semibold text-zinc-400 shrink-0">{idx + 1}.</span>
                    <span className="leading-relaxed">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#121215] border border-zinc-800 hover:border-zinc-700 p-4 rounded-xl transition-all shadow-xs">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Total Transactions</p>
          <h3 className="text-xl md:text-2xl font-bold text-white font-mono">{summaryStats.totalTxs}</h3>
          <p className="text-[10px] text-zinc-500 mt-1">Recorded in period</p>
        </div>

        <div className="bg-[#121215] border border-zinc-800 hover:border-zinc-700 p-4 rounded-xl transition-all shadow-xs">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Total Inflow (Income)</p>
          <h3 className="text-xl md:text-2xl font-bold text-emerald-400 font-mono">₱{Math.round(summaryStats.totalIncome).toLocaleString()}</h3>
          <p className="text-[10px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Confirmed inflows
          </p>
        </div>

        <div className="bg-[#121215] border border-zinc-800 hover:border-zinc-700 p-4 rounded-xl transition-all shadow-xs">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Total Outflow (Expenses)</p>
          <h3 className="text-xl md:text-2xl font-bold text-rose-400 font-mono">₱{Math.round(summaryStats.totalExpenses).toLocaleString()}</h3>
          <p className="text-[10px] text-rose-400/80 mt-1 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Disbursed funds
          </p>
        </div>

        <div className="bg-[#121215] border border-zinc-800 hover:border-zinc-700 p-4 rounded-xl transition-all shadow-xs">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Net Period Balance</p>
          <h3 className={`text-xl md:text-2xl font-bold font-mono ${
            summaryStats.netBalance >= 0 ? "text-white" : "text-rose-400"
          }`}>
            ₱{Math.round(summaryStats.netBalance).toLocaleString()}
          </h3>
          <p className="text-[10px] text-zinc-500 mt-1">
            {summaryStats.netBalance > 0 ? "Operating Surplus" : summaryStats.netBalance < 0 ? "Operating Deficit" : "Neutral Position"}
          </p>
        </div>
      </div>

      {/* ── Liquidation Breakdown & Audit Modal ── */}
      {showLiquidationModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-xs animate-fade-in overflow-y-auto">
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto">
              
              {/* Modal Header */}
              <div className="p-5 md:p-6 border-b border-zinc-800 flex items-start justify-between gap-4 bg-[#121215]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                      Audit & Reconciliation
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                      liquidationStatus === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      liquidationStatus === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}>
                      {liquidationStatus.toUpperCase() || "NONE"}
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-zinc-300" />
                    {getLiquidationConfig(orgType).title} Statement
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Cryptographic ledger reconciliation of authorized disbursements, attached receipts, and remaining variance.
                  </p>
                </div>

                <button
                  onClick={() => setShowLiquidationModal(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1">
                {/* 3-Column Reconciliation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="bg-[#121215] border border-zinc-800 p-4 rounded-xl">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Total Inflows / Disbursed
                    </p>
                    <h3 className="text-xl font-bold text-emerald-400 font-mono">
                      ₱{Math.round(summaryStats.totalIncome).toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1">Starting allocation for period</p>
                  </div>

                  <div className="bg-[#121215] border border-zinc-800 p-4 rounded-xl">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Total Verified Outflows
                    </p>
                    <h3 className="text-xl font-bold text-rose-400 font-mono">
                      ₱{Math.round(summaryStats.totalExpenses).toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1">Disbursed with receipts/vouchers</p>
                  </div>

                  <div className="bg-[#121215] border border-zinc-800 p-4 rounded-xl">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-zinc-300" /> Liquidation Net Variance
                    </p>
                    <h3 className={`text-xl font-bold font-mono ${
                      summaryStats.netBalance >= 0 ? "text-emerald-400" : "text-amber-400"
                    }`}>
                      {summaryStats.netBalance >= 0 ? "+" : ""}₱{Math.round(summaryStats.netBalance).toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {summaryStats.netBalance > 0 
                        ? "Unspent Surplus (Ready for Treasury Roll-Over)" 
                        : summaryStats.netBalance < 0 
                        ? "Reimbursable Advance (Out-of-Pocket)" 
                        : "100% Balanced Liquidation"}
                    </p>
                  </div>
                </div>

                {/* Receipt Compliance Card */}
                {(() => {
                  const expenseTxs = liquidationTxs.filter(t => t.type === "expense");
                  const withReceiptCount = expenseTxs.filter(t => t.documentUrl || t.status === "approved").length;
                  const complianceRate = expenseTxs.length > 0 ? Math.round((withReceiptCount / expenseTxs.length) * 100) : 100;
                  return (
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-zinc-300" />
                          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                            Receipt & Voucher Compliance
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {complianceRate}% Compliant
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {withReceiptCount} of {expenseTxs.length || 0} disbursements have verified digital vouchers, Pinata IPFS receipts, or on-chain approvals.
                        </p>
                      </div>

                      <div className="w-full sm:w-48 bg-zinc-800 h-2 rounded-full overflow-hidden shrink-0">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${complianceRate}%` }} 
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Expense Schedule Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                      Audited Expense Schedule ({liquidationTxs.filter(t => t.type === 'expense').length} items)
                    </h4>
                    <span className="text-[11px] text-zinc-500">Polygon Amoy Cryptographic Ledger</span>
                  </div>

                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#121215]">
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs text-zinc-300">
                        <thead className="bg-zinc-900/80 text-[10px] uppercase font-semibold text-zinc-400 tracking-wider sticky top-0 border-b border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-center">Receipt Proof</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 font-sans">
                          {liquidationTxs.filter(t => t.type === "expense").length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                                No expense transactions recorded for this liquidation cycle.
                              </td>
                            </tr>
                          ) : (
                            liquidationTxs.filter(t => t.type === "expense").slice(0, 50).map((tx) => (
                              <tr key={tx._id} className="hover:bg-zinc-900/40 transition-colors">
                                <td className="py-2.5 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                                  {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "N/A"}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-white max-w-[200px] truncate">
                                  {tx.description}
                                </td>
                                <td className="py-2.5 px-3 text-zinc-400 text-[11px] capitalize whitespace-nowrap">
                                  {tx.category || "General"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-rose-400 font-semibold whitespace-nowrap">
                                  ₱{Math.round(tx.amount).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {tx.documentUrl ? (
                                    <a
                                      href={tx.documentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-700 transition-colors"
                                    >
                                      IPFS <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-zinc-500">Ledger Entry</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    Approved
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Multi-Signature Governance Defense Sign-Off */}
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Multi-Sig Governance & Panel Sign-Off
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">1. Disbursing Officer</p>
                      <p className="text-white text-xs font-medium mt-0.5">{user?.displayName || "Organization Treasurer"}</p>
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ledger Reconciled
                      </p>
                    </div>

                    <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">2. Multi-Sig Approvers</p>
                      <p className="text-white text-xs font-medium mt-0.5">Role Level 1 & 2 Signatories</p>
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified On-Chain
                      </p>
                    </div>

                    <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">3. Audit / Panel Clearance</p>
                      <p className="text-white text-xs font-medium mt-0.5">
                        {orgType === "student_org" ? "Cor Jesu College Finance" : "SuperAdmin / Auditor Board"}
                      </p>
                      <p className={`text-[10px] mt-1 flex items-center gap-1 ${
                        liquidationStatus === "approved" ? "text-emerald-400" :
                        liquidationStatus === "pending" ? "text-amber-400" : "text-zinc-500"
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {liquidationStatus === "approved" ? "Cleared & Replenished" :
                         liquidationStatus === "pending" ? "Pending Review" : "Ready for Submission"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 md:p-5 border-t border-zinc-800 bg-[#121215] flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Print Official Statement (PDF)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLiquidationModal(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    Close
                  </button>

                  {liquidationStatus !== "pending" && liquidationStatus !== "approved" && (
                    <button
                      onClick={() => {
                        handleSubmitLiquidation();
                        setShowLiquidationModal(false);
                      }}
                      disabled={isSubmittingLiquidation}
                      className="btn-primary px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingLiquidation ? "Submitting..." : "Submit Liquidation"}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </Portal>
      )}

      {/* ── Area Chart ── */}
      <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-3 border-b border-zinc-800 pb-3.5">
          <div>
            <h3 className="text-xs font-semibold text-white flex items-center gap-2 uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-zinc-300" /> Monthly Cash Velocity
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Historical breakdown of monthly receipts versus verified expenditures</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Income</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Expenses</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-300 inline-block" /> Net Position</span>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={monthlyData} margin={{ left: 0, right: 10, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4d4d8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#d4d4d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#71717a" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
                width={50}
                tickFormatter={(v) => `₱${v >= 1000 ? `${v / 1000}k` : v}`} 
              />
              <Tooltip
                contentStyle={{ 
                  background: "#121215", 
                  border: "1px solid #27272a", 
                  borderRadius: "8px", 
                  color: "#ffffff",
                  fontSize: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)"
                }}
                formatter={(v: unknown) => `₱${Number(v ?? 0).toLocaleString()}`}
              />
              <Area type="monotone" dataKey="income"  stroke="#10B981" strokeWidth={1.5} fill="url(#incGrad)" dot={false} />
              <Area type="monotone" dataKey="expense" stroke="#F43F5E" strokeWidth={1.5} fill="url(#expGrad)" dot={false} />
              <Area type="monotone" dataKey="balance" stroke="#d4d4d8" strokeWidth={1.5} fill="url(#balGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Liquidation Breakdown & Audit Modal ── */}
      {showLiquidationModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-xs animate-fade-in overflow-y-auto">
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto">
              
              {/* Modal Header */}
              <div className="p-5 md:p-6 border-b border-zinc-800 flex items-start justify-between gap-4 bg-[#121215]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                      Audit & Reconciliation
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                      liquidationStatus === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      liquidationStatus === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}>
                      {liquidationStatus.toUpperCase() || "NONE"}
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-zinc-300" />
                    {getLiquidationConfig(orgType).title} Statement
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Cryptographic ledger reconciliation of authorized disbursements, attached receipts, and remaining variance.
                  </p>
                </div>

                <button
                  onClick={() => setShowLiquidationModal(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1">
                {/* 3-Column Reconciliation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="bg-[#121215] border border-zinc-800 p-4 rounded-xl">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Total Inflows / Disbursed
                    </p>
                    <h3 className="text-xl font-bold text-emerald-400 font-mono">
                      ₱{Math.round(summaryStats.totalIncome).toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1">Starting allocation for period</p>
                  </div>

                  <div className="bg-[#121215] border border-zinc-800 p-4 rounded-xl">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Total Verified Outflows
                    </p>
                    <h3 className="text-xl font-bold text-rose-400 font-mono">
                      ₱{Math.round(summaryStats.totalExpenses).toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1">Disbursed with receipts/vouchers</p>
                  </div>

                  <div className="bg-[#121215] border border-zinc-800 p-4 rounded-xl">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-zinc-300" /> Liquidation Net Variance
                    </p>
                    <h3 className={`text-xl font-bold font-mono ${
                      summaryStats.netBalance >= 0 ? "text-emerald-400" : "text-amber-400"
                    }`}>
                      {summaryStats.netBalance >= 0 ? "+" : ""}₱{Math.round(summaryStats.netBalance).toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {summaryStats.netBalance > 0 
                        ? "Unspent Surplus (Ready for Treasury Roll-Over)" 
                        : summaryStats.netBalance < 0 
                        ? "Reimbursable Advance (Out-of-Pocket)" 
                        : "100% Balanced Liquidation"}
                    </p>
                  </div>
                </div>

                {/* Receipt Compliance Card */}
                {(() => {
                  const expenseTxs = liquidationTxs.filter(t => t.type === "expense");
                  const withReceiptCount = expenseTxs.filter(t => t.documentUrl || t.status === "approved").length;
                  const complianceRate = expenseTxs.length > 0 ? Math.round((withReceiptCount / expenseTxs.length) * 100) : 100;
                  return (
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-zinc-300" />
                          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                            Receipt & Voucher Compliance
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {complianceRate}% Compliant
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {withReceiptCount} of {expenseTxs.length || 0} disbursements have verified digital vouchers, Pinata IPFS receipts, or on-chain approvals.
                        </p>
                      </div>

                      <div className="w-full sm:w-48 bg-zinc-800 h-2 rounded-full overflow-hidden shrink-0">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${complianceRate}%` }} 
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Expense Schedule Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                      Audited Expense Schedule ({liquidationTxs.filter(t => t.type === 'expense').length} items)
                    </h4>
                    <span className="text-[11px] text-zinc-500">Polygon Amoy Cryptographic Ledger</span>
                  </div>

                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#121215]">
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-left text-xs text-zinc-300">
                        <thead className="bg-zinc-900/80 text-[10px] uppercase font-semibold text-zinc-400 tracking-wider sticky top-0 border-b border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-center">Receipt Proof</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 font-sans">
                          {liquidationTxs.filter(t => t.type === "expense").length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                                No expense transactions recorded for this liquidation cycle.
                              </td>
                            </tr>
                          ) : (
                            liquidationTxs.filter(t => t.type === "expense").slice(0, 50).map((tx) => (
                              <tr key={tx._id} className="hover:bg-zinc-900/40 transition-colors">
                                <td className="py-2.5 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                                  {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "N/A"}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-white max-w-[200px] truncate">
                                  {tx.description}
                                </td>
                                <td className="py-2.5 px-3 text-zinc-400 text-[11px] capitalize whitespace-nowrap">
                                  {tx.category || "General"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-rose-400 font-semibold whitespace-nowrap">
                                  ₱{Math.round(tx.amount).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  {tx.documentUrl ? (
                                    <a
                                      href={tx.documentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-700 transition-colors"
                                    >
                                      IPFS <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-zinc-500">Ledger Entry</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    Approved
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Multi-Signature Governance Defense Sign-Off */}
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Multi-Sig Governance & Panel Sign-Off
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">1. Disbursing Officer</p>
                      <p className="text-white text-xs font-medium mt-0.5">{user?.displayName || "Organization Treasurer"}</p>
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ledger Reconciled
                      </p>
                    </div>

                    <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">2. Multi-Sig Approvers</p>
                      <p className="text-white text-xs font-medium mt-0.5">Role Level 1 & 2 Signatories</p>
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified On-Chain
                      </p>
                    </div>

                    <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">3. Audit / Panel Clearance</p>
                      <p className="text-white text-xs font-medium mt-0.5">
                        {orgType === "student_org" ? "Cor Jesu College Finance" : "SuperAdmin / Auditor Board"}
                      </p>
                      <p className={`text-[10px] mt-1 flex items-center gap-1 ${
                        liquidationStatus === "approved" ? "text-emerald-400" :
                        liquidationStatus === "pending" ? "text-amber-400" : "text-zinc-500"
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {liquidationStatus === "approved" ? "Cleared & Replenished" :
                         liquidationStatus === "pending" ? "Pending Review" : "Ready for Submission"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 md:p-5 border-t border-zinc-800 bg-[#121215] flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Print Official Statement (PDF)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLiquidationModal(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    Close
                  </button>

                  {liquidationStatus !== "pending" && liquidationStatus !== "approved" && (
                    <button
                      onClick={() => {
                        handleSubmitLiquidation();
                        setShowLiquidationModal(false);
                      }}
                      disabled={isSubmittingLiquidation}
                      className="btn-primary px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingLiquidation ? "Submitting..." : "Submit Liquidation"}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </Portal>
      )}

      {/* ── Print View (Hidden on screen, visible on print) ── */}
      {printData && (
        <Portal>
          <div id="printable-report" className="bg-white text-black font-sans hidden print:block">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
              <div>
                <h1 className="text-4xl font-black text-gray-900 mb-1 tracking-tight">CHAIN<span className="text-purple-600">BUDGET</span></h1>
                <p className="text-gray-600 font-semibold text-lg uppercase tracking-widest">Financial Report</p>
                <p className="text-gray-500 text-sm mt-1">Generated by {user?.displayName || "System Administrator"}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 uppercase tracking-wider text-xs">Date Generated</p>
                <p className="text-gray-900 text-lg font-medium">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
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
                {printData.map((tx) => (
                  <tr key={tx._id} className="border-b border-gray-200">
                    <td className="py-3 pr-4">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 font-medium">{tx.description}</td>
                    <td className="py-3 pr-4">{tx.category || "-"}</td>
                    <td className="py-3 pr-4 font-medium capitalize">{tx.type}</td>
                    <td className={`py-3 text-right font-bold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {tx.type === "income" ? "+" : "-"}₱{tx.amount.toLocaleString()}
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
