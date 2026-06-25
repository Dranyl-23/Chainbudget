"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, Activity, User, FileText, CheckCircle, XCircle } from "lucide-react";
import api from "@/lib/api";

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
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
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

        setLogs(res.data.logs || []);
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
    if (action.includes("approve")) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (action.includes("reject")) return <XCircle className="w-4 h-4 text-red-500" />;
    if (action.includes("create")) return <FileText className="w-4 h-4 text-primary" />;
    return <Activity className="w-4 h-4 text-gray-500" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("approve")) return "bg-green-50 border-green-100 text-green-700";
    if (action.includes("reject")) return "bg-red-50 border-red-100 text-red-700";
    if (action.includes("create")) return "bg-primary/5 border-primary/10 text-primary";
    return "bg-gray-50 border-gray-200 text-gray-600";
  };

  // RBAC: Only super admin, Level 1, or Level 2 can view audit logs
  const membership = user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId);
  const isAuthorized = user?.isSuperAdmin || (membership && membership.roleLevel <= 2);

  const formatDetails = (details: any) => {
    if (!details) return <span className="text-gray-400 italic">No details</span>;
    if (typeof details === "string") {
      try {
        details = JSON.parse(details);
      } catch {
        return details;
      }
    }
    
    if (typeof details === "object") {
      return (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(details).map(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
            let formattedValue = String(value);
            if (key === "amount" && typeof value === "number") {
              formattedValue = `₱${value.toLocaleString()}`;
            } else if (typeof value === "boolean") {
              formattedValue = value ? "Yes" : "No";
            }
            return (
              <span key={key} className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] text-gray-600 shadow-sm">
                <strong className="text-gray-800 mr-1">{formattedKey}:</strong>
                <span className="font-mono">{formattedValue}</span>
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
        <ShieldAlert className="w-16 h-16 text-danger opacity-20 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
        <p className="text-gray-500 mt-2">Only authorized officers (Level 1 & 2) can view the System Audit Trail.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-primary" />
          System Audit Trail
        </h1>
        <p className="text-sm text-gray-500">Immutable record of all system activities and blockchain transactions.</p>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No audit logs found for this organization.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="p-4 font-semibold text-gray-600">Timestamp</th>
                  <th className="p-4 font-semibold text-gray-600">Actor</th>
                  <th className="p-4 font-semibold text-gray-600">Action</th>
                  <th className="p-4 font-semibold text-gray-600">Details</th>
                  <th className="p-4 font-semibold text-gray-600">Security / Chain Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 align-top whitespace-nowrap text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{log.actor?.displayName || "System"}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {log.actor?.walletAddress 
                              ? `${log.actor.walletAddress.slice(0, 6)}...${log.actor.walletAddress.slice(-4)}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium capitalize ${getActionColor(log.action)}`}>
                        {getActionIcon(log.action)}
                        {log.action.replace("transaction.", "").replace("user.", "").replace("_", " ")}
                      </div>
                    </td>
                    <td className="p-4 align-top text-gray-600">
                      {formatDetails(log.details)}
                    </td>
                    <td className="p-4 align-top">
                      {log.blockchainTxHash ? (
                        <div className="flex items-center gap-1.5">
                          <span className="chain-dot w-2 h-2 flex-shrink-0" />
                          <a 
                            href={`https://amoy.polygonscan.com/tx/${log.blockchainTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-primary hover:underline truncate max-w-[120px] block"
                          >
                            {log.blockchainTxHash.slice(0, 10)}...
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-mono">Off-chain event</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
