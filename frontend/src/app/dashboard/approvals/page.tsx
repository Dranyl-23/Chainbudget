"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, XCircle, Clock, AlertCircle, AlertTriangle, TrendingDown } from "lucide-react";
import { ethers } from "ethers";
import ChainBudgetABI from "@/lib/ChainBudget.json";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import TableSkeleton from "@/components/TableSkeleton";
import confetti from "canvas-confetti";

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
  onChainTxId?: string;
  category?: string;
  type?: string;
  documentUrl?: string;
  urgency?: "normal" | "urgent";
}

interface BudgetItem {
  _id: string;
  name: string;
  allocated: number;
  spent: number;
}

export default function ApprovalsPage() {
  const { user, activeOrgId } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_approvals");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [loading, setLoading] = useState(pendingApprovals.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetItem[]>([]);
  const [verifiedReceipts, setVerifiedReceipts] = useState<Record<string, boolean>>({});

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
          onChainTxId: tx.onChainTxId,
          category: tx.category || tx.budgetCategory || "",
          type: tx.type,
          urgency: tx.urgency || "normal",
          documentUrl: tx.documentUrl,
        }));

        setPendingApprovals(approvals);
        sessionStorage.setItem("cb_cache_approvals", JSON.stringify(approvals));

        // Fetch budget data for overspend detection
        try {
          const budgetRes = await api.get("/budget", { params: { orgId } });
          setBudgetData(budgetRes.data || []);
        } catch { /* budget not required */ }
      } catch (err) {
        console.error("Failed to fetch approvals:", err);
        setError("Failed to load approvals");
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [activeOrgId]);

  // BUG-6 FIX: Re-fetch approvals from server to show updated vote count
  const refreshApprovals = async () => {
    if (!activeOrgId) return;
    try {
      const res = await api.get("/transactions", {
        params: { orgId: activeOrgId, status: "pending_approval", limit: 100 },
      });
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
        onChainTxId: tx.onChainTxId,
        category: tx.category || tx.budgetCategory || "",
        type: tx.type,
        urgency: tx.urgency || "normal",
        documentUrl: tx.documentUrl,
      }));
      setPendingApprovals(approvals);
    } catch (err) {
      console.error("Failed to refresh approvals:", err);
    }
  };

  const handleApprove = async (txId: string, onChainTxId?: string) => {
    if (!activeOrgId) return;
    setActionLoading(txId);
    try {
      // BUG-2 FIX: Call backend FIRST to record the vote in MongoDB
      toast.loading("Recording approval...", { id: "txToast" });
      await api.post(`/approvals/${txId}`, {
        action: "approved",
        comment: "Approved via dashboard",
        organizationId: activeOrgId,
      });

      // THEN do MetaMask on-chain signing (if available)
      if (onChainTxId && typeof window !== "undefined" && (window as any).ethereum) {
        const ethereum = (window as any).ethereum;
        toast.loading("Connecting to Hardhat Network...", { id: "txToast" });
        
        // Auto-switch to Localhost 8545 (Chain ID 31337 -> 0x7a69)
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x7a69' }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            try {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0x7a69',
                    chainName: 'Hardhat Localhost',
                    rpcUrls: ['http://localhost:8545'],
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  },
                ],
              });
            } catch (addError: any) {
              console.error("Add network error:", addError);
              toast.error("Failed to add Hardhat network", { id: "txToast" });
            }
          }
        }

        try {
          toast.loading("Please sign the transaction in MetaMask...", { id: "txToast" });
          const provider = new ethers.BrowserProvider(ethereum);
          const signer = await provider.getSigner();
          const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
          
          if (contractAddress) {
            const contract = new ethers.Contract(contractAddress, ChainBudgetABI.abi, signer);
            const tx = await contract.submitApproval(onChainTxId);
            toast.loading("Waiting for blockchain confirmation...", { id: "txToast" });
            await tx.wait();

            // Update the backend with the blockchain hash
            await api.patch(`/approvals/${txId}/hash`, {
              blockchainTxHash: tx.hash,
            });
            toast.success("Blockchain verified!", { id: "txToast" });
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#6B55D9', '#7DBD9B', '#4F46E5', '#10B981']
            });
          }
        } catch (chainErr: any) {
          console.warn("On-chain approval failed (vote already recorded in DB):", chainErr.message);
          toast.success("Vote recorded! On-chain confirmation pending.", { id: "txToast" });
        }
      } else {
        toast.success("Approval recorded!", { id: "txToast" });
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6B55D9', '#7DBD9B', '#4F46E5', '#10B981']
        });
      }

      // BUG-6 FIX: Re-fetch instead of filtering out
      await refreshApprovals();
    } catch (err: any) {
      console.error("Approval failed:", err);
      toast.error(err.response?.data?.error || "Failed to approve transaction", { id: "txToast" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (txId: string) => {
    if (!activeOrgId) return;
    setActionLoading(txId);
    try {
      await api.post(`/approvals/${txId}`, {
        action: "rejected",
        comment: "Rejected via dashboard",
        organizationId: activeOrgId,
      });
      // BUG-6 FIX: Re-fetch to show updated state (BUG-3: rejection now needs threshold)
      await refreshApprovals();
      toast.success("Rejection vote recorded");
    } catch (err: any) {
      console.error("Rejection failed:", err);
      toast.error(err.response?.data?.error || "Failed to reject transaction");
    } finally {
      setActionLoading(null);
    }
  };
  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in">
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

      {loading ? (
        <TableSkeleton />
      ) : (
      <div className="space-y-4">
        {pendingApprovals.length > 0 ? (
          pendingApprovals.map((req) => (
            <div key={req._id} className="glass p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="badge badge-pending whitespace-nowrap"><Clock className="w-3 h-3" /> Action Required</span>
                  {req.urgency === "urgent" && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse">
                      Urgent
                    </span>
                  )}
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

                {/* Budget Overspend Warning */}
                {req.type === "expense" && req.category && (() => {
                  const budget = budgetData.find(b => b.name.toLowerCase() === (req.category || "").toLowerCase());
                  if (!budget) return null;
                  const remaining = budget.allocated - budget.spent;
                  const wouldOverspend = req.amount > remaining;
                  const usageAfter = Math.round(((budget.spent + req.amount) / budget.allocated) * 100);
                  const usageBefore = Math.round((budget.spent / budget.allocated) * 100);

                  if (wouldOverspend) {
                    return (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-red-700">Budget Overspend Warning</p>
                            <p className="text-xs text-red-600 mt-1">
                              Approving this will exceed the <strong>"{budget.name}"</strong> budget.
                              Currently ₱{Math.round(budget.spent).toLocaleString()} of ₱{Math.round(budget.allocated).toLocaleString()} used ({usageBefore}%).
                              After approval: <strong>₱{Math.round(budget.spent + req.amount).toLocaleString()} ({usageAfter}%)</strong> — over by ₱{Math.round(req.amount - remaining).toLocaleString()}.
                            </p>
                            <div className="mt-2 w-full bg-red-200 rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${Math.min(usageAfter, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (usageAfter >= 80) {
                    return (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <TrendingDown className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-amber-700">Budget Running Low</p>
                            <p className="text-xs text-amber-600 mt-1">
                              After approval, <strong>"{budget.name}"</strong> will be at {usageAfter}% utilization.
                              Remaining: ₱{Math.round(remaining - req.amount).toLocaleString()} of ₱{Math.round(budget.allocated).toLocaleString()}.
                            </p>
                            <div className="mt-2 w-full bg-amber-200 rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(usageAfter, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Receipt Verification Checkbox */}
                <label className="mt-4 flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={verifiedReceipts[req._id] || false}
                    onChange={(e) => setVerifiedReceipts(prev => ({ ...prev, [req._id]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-[#6B55D9]"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">I have verified the attached receipt/document</p>
                    <p className="text-[10px] text-gray-400">Required before approving this transaction</p>
                  </div>
                  {req.documentUrl && (
                    <a
                      href={req.documentUrl.startsWith("http") ? req.documentUrl : `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}${req.documentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-primary hover:bg-gray-50 transition-colors"
                    >
                      View Receipt
                    </a>
                  )}
                </label>
              </div>

              <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                <div className="text-2xl font-bold text-gray-800">₱{Math.round(req.amount).toLocaleString()}</div>
                <div className="flex w-full gap-2">
                  <button
                    onClick={() => handleReject(req._id)}
                    disabled={actionLoading === req._id}
                    className="flex-1 md:flex-none btn-danger py-2 px-4 whitespace-nowrap disabled:opacity-50"
                  >
                    {actionLoading === req._id ? "Processing..." : (
                      <span className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleApprove(req._id, req.onChainTxId)}
                    disabled={actionLoading === req._id || !verifiedReceipts[req._id]}
                    className="flex-1 md:flex-none btn-primary py-2 px-4 whitespace-nowrap disabled:opacity-50"
                  >
                    {actionLoading === req._id ? "Processing..." : (
                      <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Approve</span>
                    )}
                  </button>
                </div>
                {!verifiedReceipts[req._id] && (
                  <p className="text-[10px] text-amber-600 w-full text-center mt-1">✓ Verify receipt first</p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 glass rounded-2xl border border-dashed border-primary/20 bg-white/40 flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-50 rounded-full flex items-center justify-center mb-5 shadow-sm border border-green-200/50">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">You're all caught up!</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              There are no pending high-value transactions requiring your approval at this time.
            </p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
