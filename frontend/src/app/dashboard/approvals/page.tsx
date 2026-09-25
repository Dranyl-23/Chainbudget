"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, XCircle, Clock, AlertCircle, AlertTriangle, TrendingDown } from "lucide-react";
import { ethers } from "ethers";
import ChainBudgetABI from "@/lib/ChainBudget.json";
import api from "@/lib/api";
import toast from "react-hot-toast";
import TableSkeleton from "@/components/TableSkeleton";
import WalletMismatchGuideModal from "@/components/WalletMismatchGuideModal";
import confetti from "canvas-confetti";
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";
import { getErrorMessage } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface SubmittedByUser {
  displayName?: string;
  walletAddress?: string;
  _id?: string;
}

interface ApproverItem {
  _id?: string;
  walletAddress?: string;
  displayName?: string;
  action?: string;
}

interface TransactionApiItem {
  _id: string;
  description: string;
  amount: number;
  submittedBy?: SubmittedByUser;
  createdAt: string;
  status: string;
  approvalCount?: number;
  hasVoted?: boolean;
  approvedBy?: ApproverItem[];
  organization?: {
    requiredApprovals?: number;
    highValueThreshold?: number;
  };
  onChainTxId?: string | number;
  category?: string;
  budgetCategory?: string;
  type?: string;
  urgency?: "normal" | "urgent";
  documentUrl?: string;
  to?: string;
}

interface TransactionsResponse {
  transactions?: TransactionApiItem[];
  total?: number;
}

interface Approval {
  _id: string;
  description: string;
  amount: number;
  submittedBy?: SubmittedByUser;
  createdAt: string;
  status: string;
  votes: number;
  required: number;
  hasVoted: boolean;
  approvedBy?: ApproverItem[];
  organization: { highValueThreshold: number };
  onChainTxId?: string | number;
  category?: string;
  type?: string;
  documentUrl?: string;
  urgency?: "normal" | "urgent";
  to?: string;
}

interface BudgetItem {
  _id: string;
  name: string;
  allocated: number;
  spent: number;
}

interface RpcError {
  code?: number;
  message?: string;
}



function getRpcErrorCode(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const rpcErr = err as RpcError;
    return typeof rpcErr.code === "number" ? rpcErr.code : undefined;
  }
  return undefined;
}

export default function ApprovalsPage() {
  const { activeOrgId, refreshToken, user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_approvals");
      if (cached) {
        try {
          return JSON.parse(cached) as Approval[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(pendingApprovals.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetItem[]>([]);
  const [verifiedReceipts, setVerifiedReceipts] = useState<Record<string, boolean>>({});

  const [activeFilter, setActiveFilter] = useState<"all" | "multi_sig" | "requested">("all");

  // Wallet Mismatch Interactive Guide Modal
  const [mismatchGuide, setMismatchGuide] = useState<{
    isOpen: boolean;
    expectedAddress: string;
    activeAddress: string;
    targetTx?: Approval;
  }>({
    isOpen: false,
    expectedAddress: "",
    activeAddress: "",
  });

  const mapTxListToApprovals = (txList: TransactionApiItem[]): Approval[] => {
    return txList.map((tx) => {
      const userVoted =
        Boolean(tx.hasVoted) ||
        Boolean(
          tx.approvedBy?.some(
            (a) =>
              (a._id && a._id === user?.id) ||
              (a.walletAddress &&
                ((user?.walletAddress && a.walletAddress.toLowerCase() === user.walletAddress.toLowerCase()) ||
                  Boolean(user?.linkedWallets?.some((w) => w.toLowerCase() === a.walletAddress?.toLowerCase()))))
          )
        );

      return {
        _id: tx._id,
        description: tx.description,
        amount: tx.amount,
        submittedBy: tx.submittedBy,
        createdAt: tx.createdAt,
        status: tx.status,
        votes: tx.approvalCount || 0,
        required: tx.organization?.requiredApprovals || 2,
        hasVoted: userVoted,
        approvedBy: tx.approvedBy,
        organization: { highValueThreshold: tx.organization?.highValueThreshold || 10000 },
        onChainTxId: tx.onChainTxId,
        category: tx.category || tx.budgetCategory || "",
        type: tx.type,
        urgency: tx.urgency || "normal",
        documentUrl: tx.documentUrl,
        to: tx.to,
      };
    });
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchApprovals = async () => {
      try {
        if (!activeOrgId) {
          if (!isCancelled) setLoading(false);
          return;
        }

        const orgId = activeOrgId;
        const [pendingRes, requestedRes] = await Promise.all([
          api.get<TransactionsResponse>("/transactions", {
            params: { orgId, status: "pending_approval", limit: 100 },
          }),
          api.get<TransactionsResponse>("/transactions", {
            params: { orgId, status: "requested", limit: 100 },
          }).catch(() => ({ data: { transactions: [] as TransactionApiItem[] } })),
        ]);

        const txMap = new Map<string, TransactionApiItem>();
        (pendingRes.data.transactions || []).forEach((t) => txMap.set(t._id, t));
        (requestedRes.data.transactions || []).forEach((t) => txMap.set(t._id, t));
        const txList: TransactionApiItem[] = Array.from(txMap.values());

        // Map transactions to approval display format
        const approvals: Approval[] = mapTxListToApprovals(txList);

        if (!isCancelled) {
          setPendingApprovals(approvals);
          sessionStorage.setItem("cb_cache_approvals", JSON.stringify(approvals));
        }

        // Fetch budget data for overspend detection
        try {
          const budgetRes = await api.get<BudgetItem[]>("/budget", { params: { orgId } });
          if (!isCancelled) {
            setBudgetData(budgetRes.data || []);
          }
        } catch {
          /* budget optional */
        }
      } catch (err: unknown) {
        console.error("Failed to fetch approvals:", err);
        if (!isCancelled) {
          setError("Failed to load approvals");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchApprovals();

    return () => {
      isCancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, user?.id, user?.walletAddress, user?.linkedWallets]);

  const refreshApprovals = async () => {
    if (!activeOrgId) return;
    try {
      const [pendingRes, requestedRes] = await Promise.all([
        api.get<TransactionsResponse>("/transactions", {
          params: { orgId: activeOrgId, status: "pending_approval", limit: 100 },
        }),
        api.get<TransactionsResponse>("/transactions", {
          params: { orgId: activeOrgId, status: "requested", limit: 100 },
        }).catch(() => ({ data: { transactions: [] as TransactionApiItem[] } })),
      ]);
      const txMap = new Map<string, TransactionApiItem>();
      (pendingRes.data.transactions || []).forEach((t) => txMap.set(t._id, t));
      (requestedRes.data.transactions || []).forEach((t) => txMap.set(t._id, t));
      const txList: TransactionApiItem[] = Array.from(txMap.values());
      const approvals: Approval[] = mapTxListToApprovals(txList);
      setPendingApprovals(approvals);
      sessionStorage.setItem("cb_cache_approvals", JSON.stringify(approvals));
    } catch (err: unknown) {
      console.error("Failed to refresh approvals:", err);
    }
  };

  const requestSignature = async (action: string, req: Approval): Promise<string> => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMask is not installed. Web3 signatures require MetaMask.");
    }
    const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const activeAddress = await signer.getAddress();

    const isPrimary = Boolean(user?.walletAddress && activeAddress.toLowerCase() === user.walletAddress.toLowerCase());
    const isLinked = Boolean(user?.linkedWallets?.some((w: string) => w.toLowerCase() === activeAddress.toLowerCase()));

    if (!isPrimary && !isLinked) {
      setMismatchGuide({
        isOpen: true,
        expectedAddress: user?.walletAddress || "",
        activeAddress,
        targetTx: req,
      });
      throw new Error(
        `MetaMask account mismatch! Active MetaMask wallet is ${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}, but your logged-in account is ${user?.walletAddress ? user.walletAddress.slice(0, 6) + "..." + user.walletAddress.slice(-4) : "not set"}.`
      );
    }
    
    const domain = { name: "ChainBudget", version: "1" };
    const types = {
      Approval: [
        { name: "action", type: "string" },
        { name: "txId", type: "string" },
        { name: "amount", type: "string" },
        { name: "description", type: "string" },
        { name: "to", type: "address" },
        { name: "amountWei", type: "uint256" }
      ]
    };

    const candidateTo = req.to || req.submittedBy?.walletAddress || "";
    const safeTo = ethers.isAddress(candidateTo) ? ethers.getAddress(candidateTo) : ethers.ZeroAddress;

    const message = {
      action,
      txId: req._id,
      amount: req.amount.toString(),
      description: req.description || "",
      to: safeTo,
      amountWei: req.amount.toString()
    };
    
    toast.loading(`Please sign the ${action} action in MetaMask...`, { id: "txToast" });
    const signature = await signer.signTypedData(domain, types, message);
    return signature;
  };

  const handleApprove = async (req: Approval) => {
    if (!activeOrgId) return;
    setActionLoading(req._id);

    // ── Guard: tell the global 401 interceptor not to trigger session-expired ──
    // while this action is in flight. The flag is always cleared in finally.
    sessionStorage.setItem("cb_action_in_progress", "true");

    try {
      // ── Level 3 Member Request Review ──
      if (req.status === "requested") {
        toast.loading("Processing Member Request...", { id: "txToast" });
        await api.patch(
          `/transactions/${req._id}/process-request`,
          { action: "approve", organizationId: activeOrgId },
          { params: { orgId: activeOrgId } }
        );
        const isHighValue = req.amount >= (req.organization?.highValueThreshold || 10000);
        toast.success(
          isHighValue
            ? "Request approved! Promoted to 2-of-N Multi-Sig on Polygon Amoy."
            : "Request approved & recorded on Polygon Amoy!",
          { id: "txToast" }
        );
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#6B55D9", "#7DBD9B", "#4F46E5", "#10B981"]
        });
        await refreshApprovals();
        window.dispatchEvent(new CustomEvent("cb_approvals_updated"));
        return;
      }

      // 1. Proactively refresh the Asgardeo token BEFORE opening MetaMask so that
      //    the token stored in localStorage is as fresh as possible when the backend
      //    POST fires after the user signs.
      await refreshToken();

      // 2. Request EIP-712 Web3 Signature (opens MetaMask)
      const signature = await requestSignature("approved", req);

      // 3. Optional on-chain smart-contract approval (only when tx has an onChainTxId)
      if (req.onChainTxId && typeof window !== "undefined" && window.ethereum) {
        toast.loading("Connecting to Network...", { id: "txToast" });

        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x13882" }],
          });
        } catch (switchError: unknown) {
          if (getRpcErrorCode(switchError) === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0x13882",
                    chainName: "Polygon Amoy Testnet",
                    rpcUrls: ["https://polygon-amoy.drpc.org"],
                    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
                  },
                ],
              });
            } catch (addError: unknown) {
              console.error("Add network error:", addError);
              toast.error("Failed to add Polygon Amoy network", { id: "txToast" });
            }
          }
        }

        try {
          toast.loading("Please approve the blockchain transaction in MetaMask...", { id: "txToast" });
          const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
          const signer = await provider.getSigner();
          const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

          if (contractAddress) {
            const contract = new ethers.Contract(contractAddress, ChainBudgetABI.abi, signer);
            const tx = await contract.submitApproval(req.onChainTxId);
            toast.loading("Waiting for blockchain confirmation...", { id: "txToast" });
            await tx.wait();
            toast.success("Blockchain verified!", { id: "txToast" });
          }
        } catch (chainErr: unknown) {
          const errMsg = chainErr instanceof Error ? chainErr.message : "On-chain approval failed";
          console.error("On-chain approval failed:", errMsg);
          toast.error("MetaMask approval failed or was cancelled.", { id: "txToast" });
          setActionLoading(null);
          return; // STOP — do NOT call backend if MetaMask was cancelled
        }
      }

      // 4. Refresh the token again right before the backend POST — the MetaMask
      //    popup may have been open for several minutes, the token could have expired.
      await refreshToken();

      // 5. Helper to build the backend POST payload
      const approvalPayload = {
        action: "approved",
        comment: "Approved via dashboard",
        organizationId: activeOrgId,
        signature,
        to: req.to || req.submittedBy?.walletAddress || ethers.ZeroAddress,
        amountWei: req.amount.toString(),
      };

      // 6. Call backend — retry once on 401 after a final token refresh attempt
      toast.loading("Recording approval...", { id: "txToast" });
      try {
        await api.post(`/approvals/${req._id}`, approvalPayload);
      } catch (postErr: unknown) {
        // On a 401, attempt one token refresh and retry before giving up
        if (
          postErr &&
          typeof postErr === "object" &&
          "response" in postErr &&
          (postErr as { response?: { status?: number } }).response?.status === 401
        ) {
          console.warn("[Approvals] 401 on first attempt — refreshing token and retrying...");
          const newToken = await refreshToken();
          if (!newToken) {
            // Genuinely cannot renew the session — show session expired and bail
            sessionStorage.removeItem("cb_action_in_progress");
            if (!sessionStorage.getItem("session_expired_alert")) {
              sessionStorage.setItem("session_expired_alert", "true");
              localStorage.removeItem("cb_token");
              localStorage.removeItem("cb_user");
              window.dispatchEvent(new CustomEvent("cb_session_expired"));
            }
            return;
          }
          // Retry with fresh token (interceptor will attach it from localStorage)
          await api.post(`/approvals/${req._id}`, approvalPayload);
        } else {
          throw postErr; // Not a 401 — re-throw for the outer catch
        }
      }

      toast.success("Approval recorded successfully!", { id: "txToast" });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6B55D9", "#7DBD9B", "#4F46E5", "#10B981"]
      });

      await refreshApprovals();
      window.dispatchEvent(new CustomEvent("cb_approvals_updated"));
    } catch (err: unknown) {
      console.error("Approval failed:", err);
      toast.error(getErrorMessage(err, "Failed to approve transaction"), { id: "txToast" });
    } finally {
      // Always clear the action guard so the global 401 interceptor works normally again
      sessionStorage.removeItem("cb_action_in_progress");
      setActionLoading(null);
    }
  };

  const handleReject = async (req: Approval) => {
    if (!activeOrgId) return;
    setActionLoading(req._id);

    // ── Guard: tell the global 401 interceptor not to trigger session-expired ──
    sessionStorage.setItem("cb_action_in_progress", "true");

    try {
      // ── Level 3 Member Request Reject ──
      if (req.status === "requested") {
        toast.loading("Rejecting Member Request...", { id: "txToast" });
        await api.patch(
          `/transactions/${req._id}/process-request`,
          { action: "reject", organizationId: activeOrgId },
          { params: { orgId: activeOrgId } }
        );
        toast.success("Member request rejected.", { id: "txToast" });
        await refreshApprovals();
        window.dispatchEvent(new CustomEvent("cb_approvals_updated"));
        return;
      }

      // 1. Proactively refresh token before opening MetaMask
      await refreshToken();

      // 2. Request EIP-712 Web3 Signature (opens MetaMask)
      const signature = await requestSignature("rejected", req);

      // 3. Refresh token again right before the backend POST
      await refreshToken();

      const rejectionPayload = {
        action: "rejected",
        comment: "Rejected via dashboard",
        organizationId: activeOrgId,
        signature,
        to: req.to || req.submittedBy?.walletAddress || ethers.ZeroAddress,
        amountWei: req.amount.toString(),
      };

      // 4. Call backend — retry once on 401
      toast.loading("Recording rejection...", { id: "txToast" });
      try {
        await api.post(`/approvals/${req._id}`, rejectionPayload);
      } catch (postErr: unknown) {
        if (
          postErr &&
          typeof postErr === "object" &&
          "response" in postErr &&
          (postErr as { response?: { status?: number } }).response?.status === 401
        ) {
          console.warn("[Approvals] 401 on reject — refreshing token and retrying...");
          const newToken = await refreshToken();
          if (!newToken) {
            sessionStorage.removeItem("cb_action_in_progress");
            if (!sessionStorage.getItem("session_expired_alert")) {
              sessionStorage.setItem("session_expired_alert", "true");
              localStorage.removeItem("cb_token");
              localStorage.removeItem("cb_user");
              window.dispatchEvent(new CustomEvent("cb_session_expired"));
            }
            return;
          }
          await api.post(`/approvals/${req._id}`, rejectionPayload);
        } else {
          throw postErr;
        }
      }

      await refreshApprovals();
      window.dispatchEvent(new CustomEvent("cb_approvals_updated"));
      toast.success("Rejection vote recorded", { id: "txToast" });
    } catch (err: unknown) {
      console.error("Rejection failed:", err);
      toast.error(getErrorMessage(err, "Failed to reject transaction"), { id: "txToast" });
    } finally {
      // Always clear the action guard
      sessionStorage.removeItem("cb_action_in_progress");
      setActionLoading(null);
    }
  };

  const multiSigCount = pendingApprovals.filter((a) => a.status === "pending_approval").length;
  const requestedCount = pendingApprovals.filter((a) => a.status === "requested").length;
  const displayedApprovals = pendingApprovals.filter((a) => {
    if (activeFilter === "multi_sig") return a.status === "pending_approval";
    if (activeFilter === "requested") return a.status === "requested";
    return true;
  });

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in">
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pending Approvals</h1>
          <p className="text-sm text-gray-500">Review member proposals and approve high-value transactions (2-of-N Multi-Sig).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === "all"
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "glass text-gray-400 hover:text-white border border-white/10"
            }`}
          >
            All Pending ({pendingApprovals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("multi_sig")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === "multi_sig"
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "glass text-gray-400 hover:text-white border border-white/10"
            }`}
          >
            Multi-Sig ({multiSigCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("requested")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === "requested"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
                : "glass text-gray-400 hover:text-white border border-white/10"
            }`}
          >
            Member Requests ({requestedCount})
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="space-y-4">
          {displayedApprovals.length > 0 ? (
            displayedApprovals.map((req) => (
              <div key={req._id} className="glass p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {req.status === "requested" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5" /> Member Request (Level 3)
                      </span>
                    ) : req.hasVoted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved by You ({req.votes} of {req.required} Signed)
                      </span>
                    ) : (
                      <span className="badge badge-pending whitespace-nowrap"><Clock className="w-3 h-3" /> Action Required</span>
                    )}
                    {req.type && (
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        req.type === "income"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}>
                        {req.type}
                      </span>
                    )}
                    {req.urgency === "urgent" && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse">
                        Urgent
                      </span>
                    )}
                    <span className="text-xs text-gray-500">Submitted {new Date(req.createdAt).toLocaleDateString()} by {req.submittedBy?.displayName || "Unknown"}</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-700">{req.description}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {req.status === "requested"
                      ? `Member proposal submitted by ${req.submittedBy?.displayName || "a member"} awaiting Officer review.`
                      : `Amount exceeds the high-value threshold of ₱${Math.round(req.organization.highValueThreshold).toLocaleString()}.`}
                  </p>
                  
                  {req.status === "requested" ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-amber-400 tracking-wider">Stage 1: Officer Review</span>
                      <span className="text-xs text-gray-400">
                        • {req.amount >= req.organization.highValueThreshold ? "Approving promotes this request to 2-of-N Multi-Sig" : "Approving finalizes & records on Polygon Amoy"}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Approval Progress</div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: req.required }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`h-2 rounded-full w-8 ${i < req.votes ? "bg-primary" : "bg-[#e8e1ff]"}`} 
                          />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-primary">{req.votes} of {req.required} required</span>
                    </div>
                  )}

                  {/* Budget Overspend Warning */}
                  {req.type === "expense" && req.category && (() => {
                    const budget = budgetData.find((b) => b.name.toLowerCase() === (req.category || "").toLowerCase());
                    if (!budget) return null;
                    const remaining = budget.allocated - budget.spent;
                    const wouldOverspend = req.amount > remaining;
                    const usageAfter = Math.round(((budget.spent + req.amount) / budget.allocated) * 100);
                    const usageBefore = Math.round((budget.spent / budget.allocated) * 100);

                    if (wouldOverspend) {
                      return (
                        <div className="mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-red-300">Budget Overspend Warning</p>
                              <p className="text-xs text-red-400 mt-1">
                                Approving this will exceed the <strong>&quot;{budget.name}&quot;</strong> budget.
                                Currently ₱{Math.round(budget.spent).toLocaleString()} of ₱{Math.round(budget.allocated).toLocaleString()} used ({usageBefore}%).
                                After approval: <strong>₱{Math.round(budget.spent + req.amount).toLocaleString()} ({usageAfter}%)</strong> — over by ₱{Math.round(req.amount - remaining).toLocaleString()}.
                              </p>
                              <div className="mt-2 w-full bg-red-950/60 border border-red-500/20 rounded-full h-2 overflow-hidden">
                                <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${Math.min(usageAfter, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (usageAfter >= 80) {
                      return (
                        <div className="mt-4 p-3 bg-amber-950/40 border border-amber-500/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <TrendingDown className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-amber-300">Budget Running Low</p>
                              <p className="text-xs text-amber-400 mt-1">
                                After approval, <strong>&quot;{budget.name}&quot;</strong> will be at {usageAfter}% utilization.
                                Remaining: ₱{Math.round(remaining - req.amount).toLocaleString()} of ₱{Math.round(budget.allocated).toLocaleString()}.
                              </p>
                              <div className="mt-2 w-full bg-amber-950/60 border border-amber-500/20 rounded-full h-2 overflow-hidden">
                                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(usageAfter, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Receipt / Proposal Verification Checkbox */}
                  <label className="mt-4 flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors select-none">
                    <input
                      type="checkbox"
                      checked={verifiedReceipts[req._id] || false}
                      onChange={(e) => setVerifiedReceipts((prev) => ({ ...prev, [req._id]: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-[#6B55D9]"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {req.documentUrl ? "I have verified the attached receipt/document" : "I have reviewed and verified this proposal"}
                      </p>
                      <p className="text-[10px] text-gray-400">Required before approving this transaction</p>
                    </div>
                    {req.documentUrl && (
                      <a
                        href={req.documentUrl.startsWith("http") ? req.documentUrl : `${BACKEND_URL}${req.documentUrl}`}
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
                  {req.status !== "requested" && req.hasVoted ? (
                    <div className="flex flex-col items-end gap-1.5 w-full md:w-auto">
                      <div className="px-4 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/35 text-purple-400 font-bold text-xs flex items-center gap-2 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Signed by You ({req.votes} of {req.required})
                      </div>
                      <p className="text-[11px] text-gray-400 text-right">
                        Awaiting 2nd officer signature to execute.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex w-full gap-2">
                        <button
                          onClick={() => handleReject(req)}
                          disabled={actionLoading === req._id}
                          className="flex-1 md:flex-none btn-danger py-2 px-4 whitespace-nowrap disabled:opacity-50"
                        >
                          {actionLoading === req._id ? "Processing..." : (
                            <span className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={actionLoading === req._id || !verifiedReceipts[req._id]}
                          className="flex-1 md:flex-none btn-primary py-2 px-4 whitespace-nowrap disabled:opacity-50"
                        >
                          {actionLoading === req._id ? "Processing..." : (
                            <span className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" />
                              {req.status === "requested" ? "Approve Request" : "Approve"}
                            </span>
                          )}
                        </button>
                      </div>
                      {!verifiedReceipts[req._id] && (
                        <p className="text-[10px] text-amber-600 w-full text-center mt-1">
                          ✓ {req.documentUrl ? "Verify receipt first" : "Confirm review first"}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 glass rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-5 shadow-sm border border-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">You&apos;re all caught up!</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                There are no pending transactions or member requests requiring your approval at this time.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Interactive Wallet Mismatch Guide & Tutorial Modal */}
      <WalletMismatchGuideModal
        isOpen={mismatchGuide.isOpen}
        onClose={() => setMismatchGuide((prev) => ({ ...prev, isOpen: false }))}
        expectedAddress={mismatchGuide.expectedAddress}
        activeAddress={mismatchGuide.activeAddress}
        onRetry={() => {
          if (mismatchGuide.targetTx) {
            handleApprove(mismatchGuide.targetTx);
          }
        }}
      />
    </div>
  );
}
