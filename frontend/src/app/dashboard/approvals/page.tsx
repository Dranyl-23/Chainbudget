"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Approval {
  _id: string;
  description: string;
  amount: number;
  submittedBy: { displayName: string };
  createdAt: string;
  status: string;
  votes: number;
  required: number;
  organization: { highValueThreshold: number };
}

export default function ApprovalsPage() {
  const { user, activeOrgId } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        
        if (!activeOrgId) {
          setLoading(false);
          return;
        }

        const orgId = activeOrgId || "";
        const res = await api.get("/transactions", {
          params: { orgId, status: "pending_approval", limit: 100 },
        });

        // Map transactions to approval display format
        const approvals = (res.data.transactions || []).map((tx: any) => ({
          _id: tx._id,
          description: tx.description,
          amount: tx.amount,
          submittedBy: tx.submittedBy,
          createdAt: tx.createdAt,
          status: tx.status,
          votes: tx.approvalCount || 0,
          required: tx.organization?.requiredApprovals || 2,
          organization: { highValueThreshold: tx.organization?.highValueThreshold || 10000 },
        }));

        setPendingApprovals(approvals);
      } catch (err) {
        console.error("Failed to fetch approvals:", err);
        setError("Failed to load approvals");
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [activeOrgId]);

  const handleApprove = async (txId: string) => {
    setActionLoading(txId);
    try {
      await api.post(`/approvals/${txId}`, {
        action: "approved",
        comment: "Approved via dashboard",
      });
      // Refresh approvals
      setPendingApprovals((prev) => prev.filter((a) => a._id !== txId));
      toast.success("Transaction approved successfully");
    } catch (err: any) {
      console.error("Approval failed:", err);
      toast.error(err.response?.data?.error || "Failed to approve transaction");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (txId: string) => {
    setActionLoading(txId);
    try {
      await api.post(`/approvals/${txId}`, {
        action: "rejected",
        comment: "Rejected via dashboard",
      });
      // Refresh approvals
      setPendingApprovals((prev) => prev.filter((a) => a._id !== txId));
      toast.success("Transaction rejected");
    } catch (err: any) {
      console.error("Rejection failed:", err);
      toast.error(err.response?.data?.error || "Failed to reject transaction");
    } finally {
      setActionLoading(null);
    }
  };
  return (
    <div className="p-8 pb-20 animate-fade-in">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Pending Approvals</h1>
        <p className="text-sm text-gray-500">Review and approve high-value transactions (2-of-N Multi-Sig).</p>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {pendingApprovals.length > 0 ? (
          pendingApprovals.map((req) => (
            <div key={req._id} className="glass p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-l-4" style={{ borderLeftColor: "#6B55D9" }}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-pending"><Clock className="w-3 h-3" /> Action Required</span>
                  <span className="text-xs text-gray-500">Submitted {new Date(req.createdAt).toLocaleDateString()} by {req.submittedBy?.displayName || "Unknown"}</span>
                </div>
                <h3 className="text-lg font-medium text-gray-700">{req.description}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Amount exceeds the high-value threshold of ₱{Math.round(req.organization.highValueThreshold).toLocaleString()}.
                </p>
                
                <div className="mt-4 flex items-center gap-3">
                  <div className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Approval Progress</div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: req.required }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-2 rounded-full w-8 ${i < req.votes ? 'bg-primary' : 'bg-[#e8e1ff]'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-primary">{req.votes} of {req.required} required</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                <div className="text-2xl font-bold text-gray-800">₱{Math.round(req.amount).toLocaleString()}</div>
                <div className="flex w-full gap-2">
                  <button
                    onClick={() => handleReject(req._id)}
                    disabled={actionLoading === req._id}
                    className="flex-1 md:flex-none btn-danger py-2 px-4 whitespace-nowrap disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => handleApprove(req._id)}
                    disabled={actionLoading === req._id}
                    className="flex-1 md:flex-none btn-primary py-2 px-4 whitespace-nowrap disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #6B55D9, #A892F0)" }}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>{loading ? "Loading pending approvals..." : "No pending approvals at this time"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
