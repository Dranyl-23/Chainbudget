"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, Activity, User, FileText, CheckCircle, XCircle, Download, BookOpen, Filter, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/exportUtils";
import { getExplorerTxUrl } from "@/lib/config";
import Portal from "@/components/Portal";
import TableSkeleton from "@/components/TableSkeleton";
import CustomSelect from "@/components/CustomSelect";
import axios from "axios";

// ── Types ────────────────────────────────────────────────────────────────────
interface AuditActor {
  displayName?: string;
  walletAddress?: string;
  _id?: string;
}

interface AuditLog {
  _id: string;
  actor?: AuditActor;
  action: string;
  targetType: string;
  details?: Record<string, unknown> | string;
  createdAt: string;
  ipAddress?: string;
  blockchainTxHash?: string;
}

interface AuditResponse {
  logs?: AuditLog[];
  total?: number;
}

interface UserOrgRef {
  _id?: string;
  name?: string;
}

interface MembershipItem {
  organization?: string | UserOrgRef;
  roleLevel: number;
  roleLabel?: string;
  isActive?: boolean;
}

export default function AuditPage() {
  const { user, activeOrgId } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_audit");
      if (cached) {
        try {
          return JSON.parse(cached) as AuditLog[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [rangeFilter, setRangeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(logs.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const fetchLogs = async () => {
      try {
        if (!activeOrgId) {
          if (!isCancelled) setLoading(false);
          return;
        }

        const res = await api.get<AuditResponse>("/audit", {
          params: {
            orgId: activeOrgId,
            limit: 100,
            action: actionFilter !== "all" ? actionFilter : undefined,
            range: rangeFilter !== "all" ? rangeFilter : undefined,
          },
        });

        const data = res.data.logs || [];
        if (!isCancelled) {
          setLogs(data);
          if (actionFilter === "all" && rangeFilter === "all") {
            sessionStorage.setItem("cb_cache_audit", JSON.stringify(data));
          }
        }
      } catch (err: unknown) {
        console.error("Failed to fetch audit logs:", err);
        if (!isCancelled) {
          let msg = "Failed to load audit logs";
          if (axios.isAxiosError(err)) {
            msg = err.response?.data?.error || err.message || msg;
          } else if (err instanceof Error) {
            msg = err.message;
          }
          setError(msg);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId, actionFilter, rangeFilter]);

  const getActionIcon = (action: string) => {
    if (action.includes("approve")) return <CheckCircle className="w-3 h-3 text-emerald-400" />;
    if (action.includes("reject")) return <XCircle className="w-3 h-3 text-rose-400" />;
    if (action.includes("create")) return <FileText className="w-3 h-3 text-zinc-300" />;
    return <Activity className="w-3 h-3 text-zinc-400" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("approve")) return "bg-zinc-900 border-zinc-700 text-emerald-400";
    if (action.includes("reject")) return "bg-zinc-900 border-zinc-700 text-rose-400";
    if (action.includes("create")) return "bg-zinc-900 border-zinc-800 text-zinc-200";
    return "bg-zinc-900 border-zinc-800 text-zinc-300";
  };

  const handleExport = (format: "csv" | "pdf") => {
    if (format === "pdf") {
      setIsPrintMode(true);
      setTimeout(() => {
        window.print();
        setIsPrintMode(false);
      }, 500);
      return;
    }

    const headers = ["Timestamp", "Actor", "Wallet Address", "Action", "Details", "Blockchain Tx"];
    const exportData = logs.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.actor?.displayName || "System",
      log.actor?.walletAddress || "",
      log.action,
      typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details || ""),
      log.blockchainTxHash || "Off-chain event",
    ]);

    exportToCSV(headers, exportData, `Audit_Trail_${new Date().toISOString().split("T")[0]}`);
  };

  // RBAC: Only super admin, Level 1, or Level 2 can view audit logs
  const memberships = (user?.memberships || []) as MembershipItem[];
  const membership = memberships.find((m) => {
    const orgId = typeof m.organization === "string" ? m.organization : m.organization?._id;
    return orgId === activeOrgId;
  });
  const isAuthorized = user?.isSuperAdmin || (membership && membership.roleLevel <= 2);

  const formatDetails = (details: unknown) => {
    if (!details) return <span className="text-zinc-600 italic">No details</span>;

    let parsedDetails: Record<string, unknown> | null = null;

    if (typeof details === "string") {
      try {
        const parsed = JSON.parse(details);
        if (typeof parsed === "object" && parsed !== null) {
          parsedDetails = parsed as Record<string, unknown>;
        } else {
          return <span className="text-zinc-300">{details}</span>;
        }
      } catch {
        return <span className="text-zinc-300">{details}</span>;
      }
    } else if (typeof details === "object" && details !== null) {
      parsedDetails = details as Record<string, unknown>;
    }

    if (parsedDetails) {
      return (
        <div className="flex flex-wrap gap-1.5 my-0.5">
          {Object.entries(parsedDetails).map(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
            let formattedValue = String(value ?? "");
            if (key === "amount" && typeof value === "number") {
              formattedValue = `₱${value.toLocaleString()}`;
            } else if (typeof value === "boolean") {
              formattedValue = value ? "Yes" : "No";
            }

            const isUrl = formattedValue.startsWith("http");
            const isHash = formattedValue.length > 20 && !isUrl;

            return (
              <span key={key} className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 rounded text-[10px] text-zinc-400">
                <span className="font-medium text-zinc-400">{formattedKey}:</span>
                {isUrl ? (
                  <a 
                    href={formattedValue} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-zinc-200 hover:text-white underline inline-flex items-center gap-1 font-mono font-medium max-w-44 truncate"
                    title={formattedValue}
                  >
                    <span>{formattedValue.split("/").pop() || "View Link"}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                ) : isHash ? (
                  <span className="font-mono text-zinc-200" title={formattedValue}>
                    {`${formattedValue.slice(0, 10)}...${formattedValue.slice(-6)}`}
                  </span>
                ) : (
                  <span className="font-mono text-zinc-200">{formattedValue}</span>
                )}
              </span>
            );
          })}
        </div>
      );
    }

    return <span className="text-zinc-300">{String(details)}</span>;
  };

  if (!isAuthorized && !loading) {
    return (
      <div className="p-8 text-center animate-fade-in flex flex-col items-center justify-center min-h-[55vh]">
        <div className="bg-[#121215] border border-zinc-800 p-8 rounded-xl max-w-md w-full shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-white mb-1">Access Denied</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Only authorized executives (Level 1 &amp; Level 2) can inspect the immutable cryptographic Audit Trail to safeguard system integrity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in w-full max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
              Cryptographic Accountability
            </span>
            <span className="text-[11px] text-zinc-500">Append-Only Event Store</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-zinc-300" />
            System Audit Trail
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-1 max-w-2xl">
            Verifiable log of all executive actions, multi-sig approvals, and Polygon blockchain interactions.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <button 
            onClick={() => handleExport("csv")} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" /> Export CSV
          </button>
          <button 
            onClick={() => handleExport("pdf")} 
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#121215] p-2 rounded-xl border border-zinc-800">
        {/* Action Type Select */}
        <div className="w-full sm:w-48">
          <CustomSelect
            size="sm"
            value={actionFilter}
            onChange={(val) => setActionFilter(val)}
            options={[
              { value: "all", label: "All Event Types" },
              { value: "approve", label: "Approvals" },
              { value: "reject", label: "Rejections" },
              { value: "create", label: "Creations" },
              { value: "transaction", label: "Transactions" },
              { value: "budget", label: "Budget Adjustments" },
              { value: "member", label: "Member Updates" },
            ]}
            placeholder="All Event Types"
          />
        </div>

        {/* Date Range Segmented Controls */}
        <div className="flex items-center gap-1 overflow-x-auto p-0.5 custom-scrollbar w-full sm:w-auto">
          {[
            { key: "all", label: "All Time" },
            { key: "24h", label: "Today" },
            { key: "7d", label: "7D" },
            { key: "30d", label: "30D" },
            { key: "90d", label: "90D" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setRangeFilter(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                rangeFilter === item.key
                  ? "bg-zinc-800 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table Container ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="bg-[#121215] border border-zinc-800 rounded-xl overflow-hidden shadow-xs">
          {logs.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 p-8">
              <div className="w-10 h-10 mx-auto bg-zinc-900 rounded-xl flex items-center justify-center mb-3 border border-zinc-800 text-zinc-500">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-white font-semibold text-sm mb-1">No audit logs found</h3>
              <p className="text-xs text-zinc-500">No immutable events recorded for this organization during the selected period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Actor</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Audit Context</th>
                    <th className="p-3.5 text-right pr-6">Proof / Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-300">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3.5 align-top whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 align-top">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-zinc-300" />
                          </div>
                          <div>
                            <p className="font-semibold text-white text-xs">
                              {log.actor?.displayName || "System"}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono">
                              {log.actor?.walletAddress 
                                ? `${log.actor.walletAddress.slice(0, 6)}...${log.actor.walletAddress.slice(-4)}`
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider ${getActionColor(log.action)}`}>
                          {getActionIcon(log.action)}
                          {log.action.replace("transaction.", "").replace("user.", "").replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3.5 align-top text-zinc-300 max-w-md">
                        {formatDetails(log.details)}
                      </td>
                      <td className="p-3.5 align-top text-right pr-6 whitespace-nowrap">
                        {log.blockchainTxHash ? (
                          <div className="flex items-center justify-end">
                            <a 
                              href={getExplorerTxUrl(log.blockchainTxHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 font-mono text-[10px] transition-colors"
                              title="View on PolygonScan"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              <span>{log.blockchainTxHash.slice(0, 6)}...{log.blockchainTxHash.slice(-4)}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                            </a>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
                            Off-chain
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Print View (Hidden on screen, visible on print) ── */}
      {isPrintMode && (
        <Portal>
          <div id="printable-report" className="bg-white text-black font-sans hidden print:block p-8">
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
              <div>
                <h1 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">CHAIN<span className="text-purple-600">BUDGET</span></h1>
                <p className="text-gray-600 font-semibold text-lg uppercase tracking-widest">System Audit Trail</p>
                <p className="text-gray-500 text-sm mt-1">Generated by {user?.displayName || "System Administrator"}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 uppercase tracking-wider text-xs">Date Generated</p>
                <p className="text-gray-900 text-lg font-medium">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                <p className="text-xs text-gray-500 mt-2">Time: {new Date().toLocaleTimeString()}</p>
              </div>
            </div>
            
            <table className="w-full text-left text-xs mb-12">
              <thead>
                <tr className="border-b-2 border-gray-800 text-gray-900">
                  <th className="py-2 pr-2 font-bold w-[15%]">Timestamp</th>
                  <th className="py-2 pr-2 font-bold w-[20%]">Actor</th>
                  <th className="py-2 pr-2 font-bold w-[15%]">Action</th>
                  <th className="py-2 pr-2 font-bold w-[25%]">Details</th>
                  <th className="py-2 font-bold w-[25%]">Blockchain Tx</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td className="py-3 pr-2 align-top">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-3 pr-2 align-top font-medium">
                      {log.actor?.displayName || "System"}
                      <div className="text-[10px] font-mono text-gray-500 break-all">{log.actor?.walletAddress || ""}</div>
                    </td>
                    <td className="py-3 pr-2 align-top capitalize font-bold text-purple-700">{log.action.replace("transaction.", "").replace("user.", "").replace("_", " ")}</td>
                    <td className="py-3 pr-2 align-top text-[9px]">
                      {typeof log.details === "object" ? JSON.stringify(log.details) : log.details}
                    </td>
                    <td className="py-3 align-top font-mono text-[9px] break-all text-purple-600">{log.blockchainTxHash || "Off-chain event"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400">
              <p>ChainBudget - Blockchain-Verified Financial System</p>
              <p>Immutable Audit Record.</p>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
