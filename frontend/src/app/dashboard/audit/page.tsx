"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, Activity, User, FileText, CheckCircle, XCircle, Download, BookOpen } from "lucide-react";
import api from "@/lib/api";
import { exportToCSV } from "@/lib/exportUtils";
import Portal from "@/components/Portal";

interface AuditLog {
  _id: string;
  actor?: { displayName?: string; walletAddress?: string };
  action: string;
  targetType: string;
  details?: string;
  createdAt: string;
  ipAddress?: string;
  blockchainTxHash?: string;
}

export default function AuditPage() {
  const { user, activeOrgId } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_audit");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [loading, setLoading] = useState(logs.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        if (!activeOrgId) {
          setLoading(false);
          return;
        }

        const res = await api.get("/audit", {
          params: { orgId: activeOrgId, limit: 100 },
        });

        const data = res.data.logs || [];
        setLogs(data);
        sessionStorage.setItem("cb_cache_audit", JSON.stringify(data));
      } catch (err: any) {
        console.error("Failed to fetch audit logs:", err);
        setError(err.response?.data?.error || "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [activeOrgId]);

  const getActionIcon = (action: string) => {
    if (action.includes("approve")) return <CheckCircle className="w-4 h-4 text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" />;
    if (action.includes("reject")) return <XCircle className="w-4 h-4 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]" />;
    if (action.includes("create")) return <FileText className="w-4 h-4 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" />;
    return <Activity className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("approve")) return "bg-green-500/10 border-green-400/30 text-green-300";
    if (action.includes("reject")) return "bg-red-500/10 border-red-400/30 text-red-300";
    if (action.includes("create")) return "bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-300";
    return "bg-cyan-500/10 border-cyan-400/30 text-cyan-300";
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'pdf') {
      setIsExporting(true);
      setIsPrintMode(true);
      setTimeout(() => {
        window.print();
        setIsPrintMode(false);
        setIsExporting(false);
      }, 500);
      return;
    }

    const headers = ["Timestamp", "Actor", "Wallet Address", "Action", "Details", "Blockchain Tx"];
    const exportData = logs.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.actor?.displayName || "System",
      log.actor?.walletAddress || "",
      log.action,
      JSON.stringify(log.details || {}),
      log.blockchainTxHash || "Off-chain event"
    ]);

    exportToCSV(headers, exportData, `Audit_Trail_${new Date().toISOString().split('T')[0]}`);
  };

  // RBAC: Only super admin, Level 1, or Level 2 can view audit logs
  const membership = user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId);
  const isAuthorized = user?.isSuperAdmin || (membership && membership.roleLevel <= 2);

  const formatDetails = (details: any) => {
    if (!details) return <span className="text-white/40 italic">No details</span>;
    if (typeof details === "string") {
      try {
        details = JSON.parse(details);
      } catch {
        return <span className="text-white/70">{details}</span>;
      }
    }
    
    if (typeof details === "object") {
      return (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {Object.entries(details).map(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
            let formattedValue = String(value);
            if (key === "amount" && typeof value === "number") {
              formattedValue = `₱${value.toLocaleString()}`;
            } else if (typeof value === "boolean") {
              formattedValue = value ? "Yes" : "No";
            }
            return (
              <span key={key} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] text-white/70 shadow-sm whitespace-nowrap">
                <strong className="text-white mr-1">{formattedKey}:</strong>
                <span className="font-mono text-cyan-300">{formattedValue}</span>
              </span>
            );
          })}
        </div>
      );
    }
    return String(details);
  };

  if (!isAuthorized && !loading) {
    return (
      <div className="p-8 text-center animate-fade-in flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
          <ShieldAlert className="w-20 h-20 text-red-500 relative z-10 drop-shadow-[0_0_15px_rgba(248,113,113,0.8)]" />
        </div>
        <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Access Denied</h2>
        <p className="text-white/50 max-w-md mx-auto">Only authorized executives (Level 1 & 2) can view the immutable System Audit Trail to prevent internal reconnaissance.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in w-full max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-black mb-2 flex items-center gap-3 drop-shadow-md">
            <BookOpen className="w-8 h-8 text-fuchsia-400 drop-shadow-[0_0_15px_rgba(217,70,239,0.8)]" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              System Audit Trail
            </span>
          </h1>
          <p className="text-sm text-white/50 max-w-xl">
            Immutable cryptographic record of all executive actions, approvals, and blockchain verifications within the system.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleExport('csv')} className="btn glass border border-white/10 hover:border-cyan-400/50 hover:bg-white/5 text-white text-sm flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <Download className="w-4 h-4 text-cyan-400" /> Export CSV
          </button>
          <button onClick={() => handleExport('pdf')} className="btn glass border border-fuchsia-500/50 bg-gradient-to-r from-fuchsia-600/40 to-purple-600/40 hover:from-fuchsia-500/60 hover:to-purple-500/60 text-white text-sm flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold transition-all shadow-[0_0_20px_rgba(217,70,239,0.3)]">
            <FileText className="w-4 h-4 text-white" /> Export PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 glass bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 shadow-[0_0_20px_rgba(248,113,113,0.2)] flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 w-full glass rounded-xl border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(139,92,246,0.1)] border border-purple-500/20 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-cyan-500/5 pointer-events-none" />
          
          {logs.length === 0 ? (
            <div className="p-16 text-center text-white/50 relative z-10">
              <div className="w-20 h-20 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                <Activity className="w-10 h-10 text-cyan-500/50" />
              </div>
              <p className="text-lg">No audit logs found for this organization.</p>
            </div>
          ) : (
            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-[#160B2E]/80 backdrop-blur-md">
                    <th className="p-4 font-bold text-white/60 uppercase tracking-widest text-xs">Timestamp</th>
                    <th className="p-4 font-bold text-white/60 uppercase tracking-widest text-xs">Actor</th>
                    <th className="p-4 font-bold text-white/60 uppercase tracking-widest text-xs">Action</th>
                    <th className="p-4 font-bold text-white/60 uppercase tracking-widest text-xs">Details</th>
                    <th className="p-4 font-bold text-white/60 uppercase tracking-widest text-xs text-right pr-6">Chain Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4 align-top whitespace-nowrap text-xs text-white/50 font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]">
                            <User className="w-4 h-4 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
                          </div>
                          <div>
                            <p className="font-bold text-white group-hover:text-fuchsia-300 transition-colors">
                              {log.actor?.displayName || "System"}
                            </p>
                            <p className="text-[10px] text-cyan-400/70 font-mono tracking-widest mt-0.5">
                              {log.actor?.walletAddress 
                                ? `${log.actor.walletAddress.slice(0, 6)}...${log.actor.walletAddress.slice(-4)}`
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-widest ${getActionColor(log.action)} shadow-[0_0_15px_rgba(255,255,255,0.05)]`}>
                          {getActionIcon(log.action)}
                          {log.action.replace("transaction.", "").replace("user.", "").replace("_", " ")}
                        </div>
                      </td>
                      <td className="p-4 align-top text-white/70 text-xs">
                        {formatDetails(log.details)}
                      </td>
                      <td className="p-4 align-top text-right pr-6">
                        {log.blockchainTxHash ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)] flex-shrink-0" />
                            <a 
                              href={`https://amoy.polygonscan.com/tx/${log.blockchainTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline truncate max-w-[120px] block"
                            >
                              {log.blockchainTxHash.slice(0, 10)}...
                            </a>
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/20 font-mono italic uppercase tracking-widest">Off-chain event</span>
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
                <p className="text-gray-900 text-lg font-medium">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
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
                {logs.map(log => (
                  <tr key={log._id}>
                    <td className="py-3 pr-2 align-top">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-3 pr-2 align-top font-medium">
                      {log.actor?.displayName || "System"}
                      <div className="text-[10px] font-mono text-gray-500 break-all">{log.actor?.walletAddress || ""}</div>
                    </td>
                    <td className="py-3 pr-2 align-top capitalize font-bold text-purple-700">{log.action.replace("transaction.", "").replace("user.", "").replace("_", " ")}</td>
                    <td className="py-3 pr-2 align-top text-[9px]">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
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
