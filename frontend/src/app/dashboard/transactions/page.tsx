"use client";

import React, { useEffect, useState, useRef } from "react";
import Portal from "@/components/Portal";
import { useAuth } from "@/context/AuthContext";
import { ethers } from "ethers";
import ChainBudgetABI from "@/lib/ChainBudget.json";
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  X,
  Paperclip,
  Upload,
  FileText,
  Image,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Clock,
  ChevronDown,
  Send,
  ShieldCheck,
  Link2,
  XCircle,
} from "lucide-react";
import api from "@/lib/api";
import TableSkeleton from "@/components/TableSkeleton";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000";

interface Transaction {
  _id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category?: string;
  createdAt: string;
  updatedAt?: string;
  status: "approved" | "pending_approval" | "requested" | "rejected" | "cancelled";
  urgency?: "normal" | "urgent";
  isRecordedOnChain: boolean;
  isHighValue?: boolean;
  blockchainTxHash?: string;
  approvalCount?: number;
  organization?: { requiredApprovals?: number; highValueThreshold?: number };
  submittedBy?: { displayName?: string; walletAddress?: string };
  documentUrl?: string;
  documentHash?: string;
  referenceNumber?: string;
  isEscrow?: boolean;
  escrowStatus?: string;
  payerApproved?: boolean;
  payeeApproved?: boolean;
  executed?: boolean;
  onChainTxId?: string;
}

interface CreateTxForm {
  type: "income" | "expense";
  amount: string;
  description: string;
  category: string;
  referenceNumber: string;
  notes: string;
  urgency: "normal" | "urgent";
  isEscrow?: boolean;
}

interface UploadedFile {
  documentUrl: string;
  documentHash: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export default function TransactionsPage() {
  const { user, activeOrgId } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_transactions");
      if (cached) return JSON.parse(cached);
    }
    return [];
  });
  const [filteredTxs, setFilteredTxs] = useState<Transaction[]>(transactions);
  const [loading, setLoading] = useState(transactions.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState({ search: "", type: "", status: "" });
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [expenseData, setExpenseData] = useState<CreateTxForm>({
    type: "expense", amount: "", description: "", category: "", referenceNumber: "", notes: "", urgency: "normal",
  });
  const [incomeData, setIncomeData] = useState<CreateTxForm>({
    type: "income", amount: "", description: "", category: "", referenceNumber: "", notes: "", urgency: "normal",
  });

  const formData = activeTab === "expense" ? expenseData : incomeData;
  const setFormData = activeTab === "expense" ? setExpenseData : setIncomeData;

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Attach receipt later state
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const [attachingTxId, setAttachingTxId] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        if (!activeOrgId) { setLoading(false); return; }
        const orgId = activeOrgId || "";
        const res = await api.get("/transactions", { params: { orgId, limit: 100 } });
        const data = res.data.transactions || [];
        setTransactions(data);
        sessionStorage.setItem("cb_cache_transactions", JSON.stringify(data));
        
        // Re-apply filters if any exist, otherwise set filtered to all
        let result = data;
        if (filters.search) {
          result = result.filter((t: Transaction) => t.description.toLowerCase().includes(filters.search.toLowerCase()) || (t.referenceNumber && t.referenceNumber.toLowerCase().includes(filters.search.toLowerCase())));
        }
        if (filters.type) {
          result = result.filter((t: Transaction) => t.type === filters.type);
        }
        if (filters.status) {
          result = result.filter((t: Transaction) => t.status === filters.status);
        }
        setFilteredTxs(result);
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
        setError("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [activeOrgId]);

  // Apply filters
  useEffect(() => {
    let result = transactions;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((tx) => tx.description.toLowerCase().includes(q));
    }
    if (filters.type)   result = result.filter((tx) => tx.type === filters.type);
    if (filters.status) result = result.filter((tx) => tx.status === filters.status);
    setFilteredTxs(result);
  }, [transactions, filters]);

  const closeModal = () => {
    setShowCreateModal(false);
    setError(null);
    setUploadError(null);
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setExpenseData({ type: "expense", amount: "", description: "", category: "", referenceNumber: "", notes: "", urgency: "normal", isEscrow: false });
    setIncomeData({ type: "income", amount: "", description: "", category: "", referenceNumber: "", notes: "", urgency: "normal", isEscrow: false });
    setActiveTab("expense");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setUploadError("File is too large. Maximum size is 5 MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadedFile(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadedFile(res.data);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || "Upload failed. Please try again.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsUploading(false);
    }
  };

  const handleAttachReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attachingTxId) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File is too large. Maximum size is 5 MB.");
      if (attachFileInputRef.current) attachFileInputRef.current.value = "";
      return;
    }

    setIsAttaching(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await api.post("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      const { documentUrl, documentHash } = uploadRes.data;
      
      // Update transaction
      await api.patch(`/transactions/${attachingTxId}/receipt`, {
        documentUrl,
        documentHash
      });
      
      // Update state
      setTransactions((prev) => 
        prev.map(tx => tx._id === attachingTxId ? { ...tx, documentUrl, documentHash } : tx)
      );
      
    } catch (err: any) {
      console.error("Attach receipt error:", err);
      alert(err.response?.data?.error || "Failed to attach receipt.");
    } finally {
      setIsAttaching(false);
      setAttachingTxId(null);
      if (attachFileInputRef.current) attachFileInputRef.current.value = "";
    }
  };

  const removeUpload = () => {
    setUploadedFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) {
      setError("Please select an Organization from the dropdown on the left before recording a transaction.");
      return;
    }
    const orgId = activeOrgId || "";

    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }
    if (!formData.description.trim()) {
      setError("Description is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/transactions", {
        organizationId: orgId,
        type: formData.type,
        amount: Number(formData.amount),
        description: formData.description.trim(),
        category: formData.category || undefined,
        referenceNumber: formData.referenceNumber || undefined,
        notes: formData.notes || undefined,
        urgency: formData.urgency || "normal",
        isEscrow: formData.isEscrow || false,
        documentUrl: uploadedFile?.documentUrl || undefined,
        documentHash: uploadedFile?.documentHash || undefined,
      });
      setTransactions((prev) => [res.data.transaction, ...prev]);
      closeModal();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to record transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessRequest = async (txId: string, action: "approve" | "reject") => {
    try {
      const res = await api.patch(`/transactions/${txId}/process-request`, { action });
      // Update transaction in state
      setTransactions((prev) => 
        prev.map(tx => tx._id === txId ? { ...tx, ...res.data.transaction } : tx)
      );
    } catch (err: any) {
      console.error("Failed to process request:", err);
      setError(err.response?.data?.error || "Failed to process request");
    }
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <Paperclip className="w-3.5 h-3.5" />;
    if (mimeType.startsWith("image/")) return <Image className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in">
      {/* Hidden file input for attaching receipts to existing txs */}
      <input
        ref={attachFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleAttachReceipt}
      />

      {/* ── Header ── */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Transactions</h1>
          <p className="text-sm text-gray-500">View and manage all organization transactions.</p>
        </div>
        {/* RBAC Fix: Level 1, 2, and 3 can record/request transactions */}
        {(user?.isSuperAdmin || (user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel || 4) <= 3) && (
          <button
            id="record-transaction-btn"
            className="btn-primary py-2"
            onClick={() => setShowCreateModal(true)}
          >
            { (user?.isSuperAdmin || (user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel || 4) <= 2) ? "Record Transaction" : "Submit Request" }
          </button>
        )}
      </header>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transactions..."
            className="input !pl-9"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select
          className="input w-auto min-w-[140px]"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select
          className="input w-auto min-w-[150px]"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending_approval">Pending</option>
          <option value="requested">Requested</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="btn-secondary px-3 py-2"><Filter className="w-4 h-4" /></button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Date</th>
              <th>Status</th>
              <th>Blockchain</th>
              <th>Receipt</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredTxs.length > 0 ? (
              filteredTxs.map((tx) => (
                <React.Fragment key={tx._id}>
                <tr onClick={() => setExpandedTxId(expandedTxId === tx._id ? null : tx._id)} className="cursor-pointer hover:bg-gray-50/50 transition-colors">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === "income" ? "bg-primary/10" : "bg-danger/10"}`}>
                        {tx.type === "income"
                          ? <ArrowUpRight className="w-4 h-4 text-primary" />
                          : <ArrowDownRight className="w-4 h-4 text-danger" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-700 flex items-center gap-2">
                          {tx.description}
                          {tx.urgency === "urgent" && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse">
                              Urgent
                            </span>
                          )}
                        </span>
                        {tx.referenceNumber && (
                          <span className="text-[11px] text-gray-400 mt-0.5">
                            Ref: {tx.referenceNumber}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${expandedTxId === tx._id ? 'rotate-180' : ''}`} />
                    </div>
                  </td>
                  <td>
                    <span className="px-2 py-1 rounded bg-[#F2EEFF] text-xs text-gray-500">
                      {tx.category || "—"}
                    </span>
                  </td>
                  <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex flex-col items-start gap-2">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full border ${
                        tx.status === "approved" ? "badge-approved" : 
                        tx.status === "rejected" ? "badge-rejected" : 
                        tx.status === "requested" ? "bg-orange-100 text-orange-700 border-orange-200" :
                        "badge-pending"
                      }`}>
                        {tx.status === "approved" ? "Approved" : 
                         tx.status === "pending_approval" ? "Pending" : 
                         tx.status === "requested" ? "Requested" : 
                         "Rejected"}
                      </span>
                      {tx.isEscrow && (
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full border ${
                          tx.escrowStatus === "locked" ? "bg-purple-100 text-purple-700 border-purple-200" : 
                          tx.escrowStatus === "released" ? "bg-green-100 text-green-700 border-green-200" : 
                          "bg-gray-100 text-gray-700 border-gray-200"
                        }`}>
                          {tx.escrowStatus === "locked" ? "Escrow Locked" : 
                           tx.escrowStatus === "released" ? "Escrow Released" : 
                           "Escrow Pending"}
                        </span>
                      )}
                      {tx.status === "approved" && tx.type === "expense" && !tx.executed && (
                        <div className="flex gap-1 mt-1">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              // Call contract to execute the transfer
                              const executeTx = async () => {
                                try {
                                  if (!tx.onChainTxId) return alert("No on-chain ID");
                                  const ethereum = (window as any).ethereum;
                                  if (!ethereum) return alert("MetaMask not installed");
                                  const provider = new ethers.BrowserProvider(ethereum);
                                  const signer = await provider.getSigner();
                                  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
                                  const contract = new ethers.Contract(contractAddress, ChainBudgetABI.abi, signer);
                                  const execTx = await contract.executeTransaction(tx.onChainTxId);
                                  alert("Executing transfer on-chain... Please wait.");
                                  await execTx.wait();
                                  await api.patch(`/transactions/${tx._id}/execute`);
                                  
                                  // Update state locally
                                  setTransactions((prev) => 
                                    prev.map(t => t._id === tx._id ? { ...t, executed: true, escrowStatus: t.isEscrow ? "locked" : "none" } : t)
                                  );
                                  
                                  alert("Transfer executed successfully!");
                                } catch (err: any) {
                                  alert("Execution failed: " + err.message);
                                }
                              };
                              executeTx();
                            }}
                            className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 hover:bg-green-600 hover:text-white rounded transition-colors"
                          >
                            Execute Transfer
                          </button>
                        </div>
                      )}
                      {tx.status === "approved" && tx.type === "expense" && tx.executed && tx.isEscrow && tx.escrowStatus === "locked" && (user?.isSuperAdmin || (user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel || 4) <= 2) && (
                        <div className="flex gap-1 mt-1">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              const releaseTx = async () => {
                                try {
                                  alert("Releasing escrow funds... Please wait.");
                                  await api.post(`/transactions/${tx._id}/release-escrow`);
                                  setTransactions((prev) => 
                                    prev.map(t => t._id === tx._id ? { ...t, escrowStatus: "released", payeeApproved: true, payerApproved: true } : t)
                                  );
                                  alert("Escrow released successfully!");
                                } catch (err: any) {
                                  alert("Release failed: " + err.message);
                                }
                              };
                              releaseTx();
                            }}
                            className="px-2 py-1 text-[10px] font-bold bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white rounded transition-colors border border-purple-200"
                          >
                            Release Escrow
                          </button>
                        </div>
                      )}
                      {tx.status === "requested" && (user?.isSuperAdmin || (user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel || 4) <= 2) && (
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleProcessRequest(tx._id, "approve"); }}
                            className="px-2 py-1 text-[10px] font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white rounded transition-colors"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleProcessRequest(tx._id, "reject"); }}
                            className="px-2 py-1 text-[10px] font-bold bg-danger/10 text-danger hover:bg-danger hover:text-white rounded transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {tx.isRecordedOnChain ? (
                      tx.blockchainTxHash ? (
                        <a 
                          href={`https://amoy.polygonscan.com/tx/${tx.blockchainTxHash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="badge badge-onchain hover:opacity-80 transition-opacity inline-flex items-center gap-1 w-fit cursor-pointer" 
                          title="View on Polygonscan"
                        >
                          <span className="chain-dot w-2 h-2" /> Verified
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="badge badge-onchain" title="Recorded on Polygon Amoy">
                          <span className="chain-dot w-2 h-2 mr-1" /> Verified
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td>
                    {tx.documentUrl ? (
                      <a
                        href={tx.documentUrl.startsWith("http") ? tx.documentUrl : `${BACKEND_URL}${tx.documentUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View receipt"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Receipt
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">—</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttachingTxId(tx._id);
                            if (attachFileInputRef.current) attachFileInputRef.current.click();
                          }}
                          disabled={isAttaching && attachingTxId === tx._id}
                          className="text-[10px] bg-gray-100 hover:bg-primary/10 hover:text-primary text-gray-500 px-2 py-1 rounded transition-colors disabled:opacity-50"
                          title="Attach Receipt"
                        >
                          {isAttaching && attachingTxId === tx._id ? "..." : "Upload"}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className={`text-right font-bold ${tx.type === "income" ? "text-primary" : "text-danger"}`}>
                    {tx.type === "income" ? "+" : "-"}&#8369;{Math.round(tx.amount).toLocaleString()}
                  </td>
                </tr>
                {/* ── Request Tracking Timeline ── */}
                {expandedTxId === tx._id && (
                  <tr className="timeline-row">
                    <td colSpan={7} className="!p-0">
                      <div className="bg-gradient-to-r from-gray-50/80 to-white px-8 py-6 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5">Request Tracking Timeline</p>
                        <div className="flex items-start gap-0">
                          {/* Step 1: Submitted */}
                          {(() => {
                            const steps = [
                              {
                                label: "Submitted",
                                detail: tx.submittedBy?.displayName || "Member",
                                date: new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                                icon: <Send className="w-4 h-4" />,
                                done: true,
                                color: "bg-primary",
                              },
                              {
                                label: tx.status === "rejected" ? "Rejected" : "Under Review",
                                detail: tx.status === "rejected" 
                                  ? "Transaction was rejected" 
                                  : tx.isHighValue 
                                    ? `${tx.approvalCount || 0} of ${tx.organization?.requiredApprovals || 2} approvals` 
                                    : "Pending admin review",
                                date: tx.status !== "requested" ? new Date(tx.updatedAt || tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "",
                                icon: tx.status === "rejected" ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />,
                                done: tx.status !== "requested",
                                color: tx.status === "rejected" ? "bg-danger" : "bg-amber-500",
                                isRejected: tx.status === "rejected",
                              },
                              {
                                label: "Approved",
                                detail: tx.status === "approved" ? "Verified by admin(s)" : "Awaiting approval",
                                date: tx.status === "approved" ? new Date(tx.updatedAt || tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "",
                                icon: <ShieldCheck className="w-4 h-4" />,
                                done: tx.status === "approved",
                                color: "bg-green-500",
                              },
                              {
                                label: "On Blockchain",
                                detail: tx.isRecordedOnChain 
                                  ? tx.blockchainTxHash 
                                    ? `TX: ${tx.blockchainTxHash.slice(0, 8)}...${tx.blockchainTxHash.slice(-6)}` 
                                    : "Recorded on chain" 
                                  : "Pending blockchain record",
                                date: tx.isRecordedOnChain ? "✓ Immutable" : "",
                                icon: <Link2 className="w-4 h-4" />,
                                done: tx.isRecordedOnChain,
                                color: "bg-purple-600",
                              },
                            ];

                            // If rejected, only show first 2 steps
                            const visibleSteps = tx.status === "rejected" ? steps.slice(0, 2) : steps;

                            return visibleSteps.map((step, idx) => (
                              <div key={idx} className="flex items-start flex-1">
                                <div className="flex flex-col items-center">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-300 ${
                                    step.done 
                                      ? `${step.color} scale-100` 
                                      : 'bg-gray-300 scale-90'
                                  }`}>
                                    {step.done ? step.icon : <span className="w-2 h-2 bg-white rounded-full" />}
                                  </div>
                                  <p className={`text-xs font-semibold mt-2 ${step.done ? (step.isRejected ? 'text-danger' : 'text-gray-800') : 'text-gray-400'}`}>{step.label}</p>
                                  <p className={`text-[10px] mt-0.5 text-center max-w-[120px] ${step.done ? 'text-gray-500' : 'text-gray-400'}`}>{step.detail}</p>
                                  {step.date && <p className="text-[10px] text-gray-400 mt-0.5">{step.date}</p>}
                                </div>
                                {idx < visibleSteps.length - 1 && (
                                  <div className={`h-[3px] flex-1 mt-[18px] mx-1 rounded-full transition-all duration-300 ${
                                    step.done ? step.color : 'bg-gray-200'
                                  }`} />
                                )}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  {loading ? "Loading transactions..." : "No transactions found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* ── Create Transaction Modal ── */}
      {showCreateModal && (
        <Portal>
        <div
          className="fixed inset-0 z-50"
          style={{ background: "rgba(26,26,46,0.55)", backdropFilter: "blur(4px)" }}
        >
          {/* Scrollable container that fills the backdrop */}
          <div
            className="h-full overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            {/* Flex centering wrapper */}
            <div className="flex min-h-full items-center justify-center p-3 md:p-4 py-6 md:py-8">
              <div className="glass rounded-xl md:rounded-2xl p-5 md:p-8 w-full max-w-lg shadow-2xl animate-fade-in">

            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold">
                { (user?.isSuperAdmin || (user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel || 4) <= 2) ? "Record Transaction" : "Submit Request" }
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-primary/10 text-gray-500 hover:text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm text-danger border border-danger/20 bg-danger/10">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">

              {/* Income / Expense toggle */}
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
                {(["expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTab(t)}
                    className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      background: activeTab === t
                        ? t === "income" ? "rgba(107,85,217,0.1)" : "rgba(224,92,92,0.1)"
                        : "transparent",
                      color: activeTab === t
                        ? t === "income" ? "#6B55D9" : "#E05C5C"
                        : "#9ca3af",
                    }}
                  >
                    {t === "income" ? "+ Income" : "− Expense"}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount (&#8369;)</label>
                <input
                  id="tx-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="input"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  {formData.type === "expense" ? "Description (What is this for?)" : "Description (Where did this come from?)"}
                </label>
                <input
                  id="tx-description"
                  type="text"
                  placeholder={formData.type === "expense" ? "e.g. Venue Rental" : "e.g. Hackathon Sponsorship"}
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              {/* Urgency Toggle (Level 3 specific) */}
              {(user?.memberships?.find((m: any) => m.organization === activeOrgId || m.organization?._id === activeOrgId)?.roleLevel === 3) && formData.type === "expense" && (
                <div className="flex items-center justify-between p-2 md:p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div>
                    <label className="block text-sm font-semibold text-red-700 mb-0 md:mb-0.5">Mark as Urgent?</label>
                    <p className="text-[9px] md:text-[10px] text-red-600 leading-tight">Flags this request for immediate admin attention.</p>
                  </div>
                  <div className="flex bg-white rounded-lg p-1 border border-red-200 shadow-sm shrink-0">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "normal" })}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${formData.urgency === "normal" ? "bg-gray-100 text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "urgent" })}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${formData.urgency === "urgent" ? "bg-red-500 text-white shadow-sm" : "text-red-500 hover:bg-red-50"}`}
                    >
                      URGENT
                    </button>
                  </div>
                </div>
              )}

              {/* Category + Reference */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
                  <input
                    id="tx-category"
                    type="text"
                    placeholder={formData.type === "expense" ? "e.g. Events & Activities" : "e.g. Donations"}
                    className="input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Reference #</label>
                  <input
                    id="tx-reference"
                    type="text"
                    placeholder="OR-001"
                    className="input"
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Notes (optional)</label>
                <textarea
                  id="tx-notes"
                  rows={2}
                  placeholder="Additional details..."
                  className="input resize-none"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* ── Receipt / Attachment Upload ── */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5 md:mb-2">
                  Receipt / Attachment <span className="text-gray-400 font-normal">(optional)</span>
                </label>

                {!uploadedFile ? (
                  <div
                    className="relative border-2 border-dashed rounded-xl p-4 md:p-5 text-center cursor-pointer transition-all duration-200"
                    style={{ borderColor: "var(--color-border)" }}
                    onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "#6B55D9"; }}
                    onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        handleFileChange({ target: { files: [file] } } as any);
                      }
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      id="tx-receipt"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleFileChange}
                    />
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-7 h-7 text-primary animate-spin" />
                        <p className="text-sm text-gray-500">Uploading file...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Upload className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold text-primary">Click to upload</span> or drag & drop
                        </p>
                        <p className="text-xs text-gray-400">JPEG, PNG, WebP, PDF — max 5 MB</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border"
                    style={{ borderColor: "rgba(107,85,217,0.3)", background: "rgba(107,85,217,0.05)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        {getFileIcon(uploadedFile.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{uploadedFile.originalName}</p>
                        <p className="text-xs text-gray-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    </div>
                    <button
                      type="button"
                      onClick={removeUpload}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-danger/10 text-gray-400 hover:text-danger transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {uploadError && (
                  <p className="mt-2 text-xs text-danger">{uploadError}</p>
                )}

                {uploadedFile && (
                  <p className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                    <span className="font-medium">SHA-256:</span>
                    <span className="font-mono truncate">{uploadedFile.documentHash.slice(0, 32)}...</span>
                  </p>
                )}
              </div>

              {activeTab === "expense" && (
                <div className="pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={formData.isEscrow || false}
                        onChange={(e) => setExpenseData({...expenseData, isEscrow: e.target.checked})}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${formData.isEscrow ? 'bg-purple-500' : 'bg-gray-200'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isEscrow ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-800">Use Smart Contract Escrow</span>
                      <span className="text-xs text-gray-500">Lock funds until supplier delivery is confirmed.</span>
                    </div>
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 md:pt-4 mt-1 md:mt-2 flex justify-end gap-2 md:gap-3 border-t border-gray-100">
                <button
                  type="button"
                  className="btn-secondary flex-1 py-2 md:py-2.5 text-sm md:text-base"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  id="tx-submit-btn"
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="btn-primary flex-1 py-2 md:py-2.5 text-sm md:text-base whitespace-nowrap"
                >
                  {isSubmitting ? "Recording..." : "Record Transaction"}
                </button>
              </div>
            </form>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

    </div>
  );
}
