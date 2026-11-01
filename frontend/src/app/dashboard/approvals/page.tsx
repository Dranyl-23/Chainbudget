"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  CheckCircle2, XCircle, Clock, AlertCircle, AlertTriangle,
  TrendingDown, ShieldCheck, FileText, ExternalLink,
  ChevronRight, Sparkles, User, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { ethers } from "ethers";
import ChainBudgetABI from "@/lib/ChainBudget.json";
import api from "@/lib/api";
import toast from "react-hot-toast";
import TableSkeleton from "@/components/TableSkeleton";
import WalletMismatchGuideModal from "@/components/WalletMismatchGuideModal";
import confetti from "canvas-confetti";
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

      await refreshToken();
      const signature = await requestSignature("approved", req);

      // On-chain smart-contract approval (when tx has an onChainTxId)
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
          return;
        }
      }

      await refreshToken();

      const approvalPayload = {
        action: "approved",
        comment: "Approved via dashboard",
        organizationId: activeOrgId,
        signature,
        to: req.to || req.submittedBy?.walletAddress || ethers.ZeroAddress,
        amountWei: req.amount.toString(),
      };

      toast.loading("Recording approval...", { id: "txToast" });
      try {
        await api.post(`/approvals/${req._id}`, approvalPayload);
      } catch (postErr: unknown) {
        if (
          postErr &&
          typeof postErr === "object" &&
          "response" in postErr &&
          (postErr as { response?: { status?: number } }).response?.status === 401
        ) {
          console.warn("[Approvals] 401 on first attempt — refreshing token and retrying...");
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
          await api.post(`/approvals/${req._id}`, approvalPayload);
        } else {
          throw postErr;
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
      sessionStorage.removeItem("cb_action_in_progress");
      setActionLoading(null);
    }
  };

  const handleReject = async (req: Approval) => {
    if (!activeOrgId) return;
    setActionLoading(req._id);
    sessionStorage.setItem("cb_action_in_progress", "true");

    try {
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

      await refreshToken();
      const signature = await requestSignature("rejected", req);
      await refreshToken();

      const rejectionPayload = {
        action: "rejected",
        comment: "Rejected via dashboard",
        organizationId: activeOrgId,
        signature,
        to: req.to || req.submittedBy?.walletAddress || ethers.ZeroAddress,
        amountWei: req.amount.toString(),
      };

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
    <div className="space-y-6 pb-16 animate-fade-in">
      
      {/* ── Page Header & Segmented Tabs ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Multi-Sig Approvals & Review
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
              Governance
            </span>
          </div>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Review member fund requests and execute cryptographic 2-of-N co-signatures on Polygon Amoy.
          </p>
        </div>

        {/* Studio Admin Style Segmented Control Tabs */}
        <div className="inline-flex p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === "all"
                ? "bg-zinc-800 text-white font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>All Pending</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-950 text-zinc-300 font-mono">
              {pendingApprovals.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("multi_sig")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === "multi_sig"
                ? "bg-zinc-800 text-white font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>Multi-Sig Queue</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-950 text-zinc-300 font-mono">
              {multiSigCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("requested")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === "requested"
                ? "bg-zinc-800 text-white font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>Member Requests</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-950 text-zinc-300 font-mono">
              {requestedCount}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="space-y-4">
          {displayedApprovals.length > 0 ? (
            displayedApprovals.map((req) => (
              <div 
                key={req._id} 
                className="p-4 md:p-5 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
              >
                <div className="flex-1 min-w-0 space-y-2.5">
                  
                  {/* Status Pills & Meta Row */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {req.status === "requested" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <Clock className="w-3 h-3" /> Member Request (Level 3)
                      </span>
                    ) : req.hasVoted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Signed by You ({req.votes}/{req.required})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white/[0.08] border border-white/[0.15] text-white">
                        <Clock className="w-3 h-3" /> Action Required (2-of-N Multi-Sig)
                      </span>
                    )}

                    {req.type && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        req.type === "income" 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {req.type}
                      </span>
                    )}

                    {req.urgency === "urgent" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        Urgent
                      </span>
                    )}

                    <span className="text-zinc-500 text-xs">
                      Submitted {new Date(req.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} by{" "}
                      <strong className="text-zinc-300">{req.submittedBy?.displayName || "Member"}</strong>
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm md:text-base font-bold text-white tracking-tight">
                      {req.description}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      {req.status === "requested"
                        ? `Awaiting officer review to authorize entry into financial ledger.`
                        : `High-value disbursement requiring 2-of-N cryptographic signatures under EIP-712 protocol.`}
                    </p>
                  </div>

                  {/* Progress Indicator Meter */}
                  {req.status !== "requested" ? (
                    <div className="flex items-center gap-2.5 pt-0.5">
                      <span className="text-[11px] font-medium text-zinc-400">Signatures:</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: req.required }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`h-1.5 rounded-full w-8 transition-all ${
                              i < req.votes ? "bg-white" : "bg-zinc-800"
                            }`} 
                          />
                        ))}
                      </div>
                      <span className="text-xs font-mono font-bold text-white">
                        {req.votes} of {req.required} Required
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400/90 pt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Stage 1 Review: Approval promotes transaction or records directly on-chain.</span>
                    </div>
                  )}

                  {/* Budget Headroom / Overspend Alert */}
                  {req.type === "expense" && req.category && (() => {
                    const budget = budgetData.find((b) => b.name.toLowerCase() === (req.category || "").toLowerCase());
                    if (!budget) return null;
                    const remaining = budget.allocated - budget.spent;
                    const wouldOverspend = req.amount > remaining;
                    const usageAfter = Math.round(((budget.spent + req.amount) / budget.allocated) * 100);
                    const usageBefore = Math.round((budget.spent / budget.allocated) * 100);

                    if (wouldOverspend) {
                      return (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs space-y-1.5">
                          <div className="flex items-center gap-2 text-rose-300 font-bold">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <span>Budget Overspend Warning</span>
                          </div>
                          <p className="text-zinc-300">
                            Approving this <strong>₱{req.amount.toLocaleString()}</strong> expense will exceed the <strong>{budget.name}</strong> envelope (₱{budget.allocated.toLocaleString()} cap).
                          </p>
                          <div className="flex items-center gap-3 pt-1 text-[11px] font-mono">
                            <span className="text-zinc-400">Current: {usageBefore}%</span>
                            <span className="text-rose-400 font-bold">Projected: {usageAfter}%</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Verification Checkbox */}
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(verifiedReceipts[req._id])}
                        onChange={(e) => setVerifiedReceipts({ ...verifiedReceipts, [req._id]: e.target.checked })}
                        className="rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 cursor-pointer"
                      />
                      <span>I have verified the receipt and vendor legitimacy</span>
                    </label>

                    {req.documentUrl && (
                      <a
                        href={req.documentUrl.startsWith("http") ? req.documentUrl : `${BACKEND_URL}${req.documentUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> View Receipt
                      </a>
                    )}
                  </div>
                </div>

                {/* Right Side: Amount & Action Buttons */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-800">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Requested Amount</span>
                    <span className="text-2xl font-bold font-mono text-white">
                      ₱{req.amount.toLocaleString()}
                    </span>
                  </div>

                  {req.status !== "requested" && req.hasVoted ? (
                    <div className="flex flex-col items-start md:items-end gap-1">
                      <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Signed by You ({req.votes}/{req.required})</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 text-left md:text-right">
                        Awaiting 2nd officer signature to finalize.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 w-full md:w-auto">
                      <div className="flex items-center gap-2 w-full">
                        <button
                          onClick={() => handleReject(req)}
                          disabled={actionLoading === req._id}
                          className="flex-1 md:flex-none px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-rose-400 border border-zinc-800 text-xs font-semibold transition-colors disabled:opacity-40"
                        >
                          {actionLoading === req._id ? "Processing..." : (
                            <span className="flex items-center justify-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => handleApprove(req)}
                          disabled={actionLoading === req._id || !verifiedReceipts[req._id]}
                          className="flex-1 md:flex-none btn-primary py-2 px-4 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {actionLoading === req._id ? "Signing..." : (
                            <span className="flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {req.status === "requested" ? "Approve Request" : "Sign with Web3"}
                            </span>
                          )}
                        </button>
                      </div>

                      {!verifiedReceipts[req._id] && (
                        <p className="text-[10px] text-zinc-500 text-center md:text-right">
                          ✓ Check verification above to unlock
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-1">
                <CheckCircle2 className="w-5 h-5 text-zinc-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">All Caught Up!</h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                There are no pending multi-sig approvals or member proposals awaiting your signature right now.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Interactive Wallet Mismatch Guide Modal */}
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
