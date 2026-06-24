"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link2, Search } from "lucide-react";
import api from "@/lib/api";

interface AuditLog {
  _id: string;
  action: string;
  actor?: { displayName: string; walletAddress?: string };
  createdAt: string;
  blockchainTxHash?: string;
  targetType?: string;
  details?: Record<string, unknown> | string | null;
}

export default function AuditTrailPage() {
  const { user, activeOrgId } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        
        if (!activeOrgId) {
          setLoading(false);
          return;
        }

        const orgId = activeOrgId || "";
        const res = await api.get("/audit", {
          params: { orgId, limit: 100 },
        });

        setLogs(res.data.logs || []);
      } catch (err) {
        console.error("Failed to fetch audit logs:", err);
        setError("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [activeOrgId]);

  // Search filter
  useEffect(() => {
    if (!search) {
      setFilteredLogs(logs);
      return;
    }

    const q = search.toLowerCase();
    const filtered = logs.filter(
      (log) =>
        log.action?.toLowerCase().includes(q) ||
        log.actor?.displayName?.toLowerCase().includes(q) ||
        formatDetails(log.details)?.toLowerCase().includes(q)
    );
    setFilteredLogs(filtered);
  }, [logs, search]);

  /** Format the `details` field (which is a mixed object) into a readable string */
  function formatDetails(details: AuditLog["details"]): string {
    if (!details) return "—";
    if (typeof details === "string") return details;
    if (typeof details === "object") {
      return Object.entries(details)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
    }
    return String(details);
  }
  return (
    <div className="p-8 pb-20 animate-fade-in">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Audit Trail</h1>
          <p className="text-sm text-gray-500">Verifiable, tamper-evident log of all system actions.</p>
        </div>
        <div className="flex-1 max-w-xs relative ml-4">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search logs..."
            className="input !pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action / Event</th>
              <th>Details</th>
              <th>Blockchain Ref</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <tr key={log._id}>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="font-medium text-gray-700">{log.actor?.displayName || "System"}</td>
                  <td>
                    <span className="px-2 py-1 rounded bg-[#F2EEFF] text-xs text-gray-600 font-mono">
                      {log.action}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs">{formatDetails(log.details)}</td>
                  <td>
                    {log.blockchainTxHash ? (
                      <a
                        href={`https://amoy.polygonscan.com/tx/${log.blockchainTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors"
                      >
                        <Link2 className="w-3 h-3" />
                        {log.blockchainTxHash.slice(0, 10)}...
                      </a>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">
                  {loading ? "Loading audit logs..." : "No audit logs found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
