"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Portal from "@/components/Portal";
import { useAuth } from "@/context/AuthContext";
import { ethers } from "ethers";
import ChainBudgetABI from "@/lib/ChainBudget.json";
import {
  ArrowUpRight,
  ArrowDownRight,
  X,
  Paperclip,
  Upload,
  FileText,
  Receipt,
  Image as ImageIcon,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Clock,
  ChevronDown,
  Send,
  ShieldCheck,
  Link2,
  XCircle,
  Download,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import api from "@/lib/api";
import TableSkeleton from "@/components/TableSkeleton";
import TxExplorerModal from "@/components/TxExplorerModal";
import TransactionFilterBar from "@/components/TransactionFilterBar";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { BACKEND_URL } from "@/lib/config";
import { getErrorMessage } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
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

interface SubmittedByUser {
  _id?: string;
  displayName?: string;
  walletAddress?: string;
}

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
  submittedBy?: SubmittedByUser;
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

interface TransactionsResponse {
  transactions?: Transaction[];
  total?: number;
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

interface BudgetItem {
  _id: string;
  name: string;
  allocated: number;
  spent: number;
  color?: string;
}

interface AiScanReceiptResponse {
  totalAmount?: number | string;
  merchant?: string;
  suggestedCategory?: string;
}

interface ProcessRequestResponse {
  transaction: Transaction;
  message?: string;
}



function getOrgId(org?: string | UserOrgRef): string | undefined {
  if (!org) return undefined;
  return typeof org === "string" ? org : org._id;
}

export default function TransactionsPage() {
  const { user, activeOrgId } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("cb_cache_transactions");
      if (cached) {
        try {
          return JSON.parse(cached) as Transaction[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState({ search: "", type: "", status: "" });
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [selectedExplorerHash, setSelectedExplorerHash] = useState<string | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [expenseData, setExpenseData] = useState<CreateTxForm>({
    type: "expense", amount: "", description: "", category: "", referenceNumber: "", notes: "", urgency: "normal",
  });
  const [incomeData, setIncomeData] = useState<CreateTxForm>({
    type: "income", amount: "", description: "", category: "", referenceNumber: "", notes: "", urgency: "normal",
  });

  const formData = activeTab === "expense" ? expenseData : incomeData;
  const setFormData = activeTab === "expense" ? setExpenseData : setIncomeData;

  const [budgets, setBudgets] = useState<BudgetItem[]>([]);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // AI Scan State
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiScanSuccess, setAiScanSuccess] = useState(false);

  // Attach receipt later state
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const [attachingTxId, setAttachingTxId] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);

  // Receipt Preview Modal state
  const [previewReceipt, setPreviewReceipt] = useState<{
    url: string;
    title: string;
    txId: string;
    documentHash?: string;
  } | null>(null);
  const [receiptLoadError, setReceiptLoadError] = useState(false);

  // ── RBAC Calculations ─────────────────────────────────────────────────────
  const memberships = (user?.memberships || []) as UserMembership[];
  const userMembership = memberships.find((m) => getOrgId(m.organization) === activeOrgId);
  const userRoleLevel = user?.isSuperAdmin ? 1 : (userMembership?.roleLevel || 4);
  const canExport = userRoleLevel <= 2;
  const canRecordOrRequest = userRoleLevel <= 3;
  const canDirectRecord = userRoleLevel <= 2;

  // ── Single Asynchronous Effect with Cancellation Guard ────────────────────
  useEffect(() => {
    if (!activeOrgId) return;

    let isCancelled = false;
    const orgId = activeOrgId;

    const fetchTransactions = async () => {
      try {
        const [txRes, budgetRes] = await Promise.all([
          api.get<TransactionsResponse>("/transactions", { params: { orgId, limit: 100 } }),
          api.get<BudgetItem[]>("/budget", { params: { orgId } }),
        ]);

        if (!isCancelled) {
          const data = txRes.data.transactions || [];
          setTransactions(data);
          sessionStorage.setItem("cb_cache_transactions", JSON.stringify(data));
          setBudgets(budgetRes.data || []);
        }
      } catch (err: unknown) {
        console.error("Failed to fetch transactions:", err);
        if (!isCancelled) {
          setError("Failed to load transactions");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchTransactions();

    return () => {
      isCancelled = true;
    };
  }, [activeOrgId]);

  // ── Derived Filtered Transactions (Pure useMemo Computation) ──────────────
  const filteredTxs = useMemo(() => {
    let result = transactions;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.description.toLowerCase().includes(q) ||
          (tx.referenceNumber && tx.referenceNumber.toLowerCase().includes(q))
      );
    }
    if (filters.type) {
      result = result.filter((tx) => tx.type === filters.type);
    }
    if (filters.status) {
      result = result.filter((tx) => tx.status === filters.status);
    }
    return result;
  }, [transactions, filters]);

  const closeModal = () => {
    setShowCreateModal(false);
    setError(null);
    setUploadError(null);
    setUploadedFile(null);
    setRawFile(null);
    setAiScanSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setExpenseData({ type: "expense", amount: "", description: "", category: "", referenceNumber: "", notes: "", urgency: "normal", isEscrow: false });
    setIncomeData({ type: "income", amount: "", description: "", category: "", referenceNumber: "", notes: "", urgency: "normal", isEscrow: false });
    setActiveTab("expense");
  };

  const handleExport = async (format: "pdf" | "csv") => {
    setIsExporting(true);
    try {
      const headers = ["Date", "Description", "Type", "Amount", "Status", "Category"];
      const rows = filteredTxs.map((t) => [
        new Date(t.createdAt).toLocaleDateString(),
        t.description,
        t.type,
        t.amount.toString(),
        t.status,
        t.category || "—",
      ]);

      if (format === "pdf") {
        const title = `Transactions Report - ${new Date().toLocaleDateString()}`;
        exportToPDF(headers, rows, title, "Transactions_Report");
        toast.success("Exported to PDF successfully");
      } else {
        exportToCSV(headers, rows, "Transactions_Report");
        toast.success("Exported to CSV successfully");
      }
    } catch {
      toast.error(`Failed to export to ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };

  const processUploadedFile = async (file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setUploadError("File is too large. Maximum size is 5 MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadedFile(null);
    setRawFile(file);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<UploadedFile>("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadedFile(res.data);
    } catch (err: unknown) {
      setUploadError(getErrorMessage(err, "Upload failed. Please try again."));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleAiAutoFill = async () => {
    if (!rawFile) return;
    setIsAiScanning(true);
    try {
      const fd = new FormData();
      fd.append("receipt", rawFile);
      const res = await api.post<AiScanReceiptResponse>("/ai/scan-receipt", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      setFormData((prev: CreateTxForm) => ({
        ...prev,
        amount: data.totalAmount?.toString() || prev.amount,
        description: data.merchant || prev.description,
        category: data.suggestedCategory || prev.category,
      }));
      setAiScanSuccess(true);
      setTimeout(() => setAiScanSuccess(false), 3000);
      toast.success("AI successfully extracted details!");
    } catch (err: unknown) {
      console.error("AI scan failed:", err);
      const axiosErr = err as { response?: { data?: { error?: string } } };
      toast.error(axiosErr.response?.data?.error || "Failed to scan receipt with AI");
    } finally {
      setIsAiScanning(false);
    }
  };

  const handleAttachReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attachingTxId) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size is 5 MB.");
      if (attachFileInputRef.current) attachFileInputRef.current.value = "";
      return;
    }

    setIsAttaching(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await api.post<UploadedFile>("/upload", fd, {
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
        prev.map((tx) => (tx._id === attachingTxId ? { ...tx, documentUrl, documentHash } : tx))
      );
      setPreviewReceipt((prev) => prev && prev.txId === attachingTxId ? { ...prev, url: documentUrl, documentHash } : prev);
      setReceiptLoadError(false);
      toast.success("Receipt attached successfully!");
    } catch (err: unknown) {
      console.error("Attach receipt error:", err);
      toast.error(getErrorMessage(err, "Failed to attach receipt."));
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeOrgId) {
      setError("Please select an Organization from the dropdown on the left before recording a transaction.");
      return;
    }
    const orgId = activeOrgId;

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
      const res = await api.post<{ transaction: Transaction }>("/transactions", {
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
      toast.success(res.data.transaction.status === "requested" ? "Request submitted!" : "Transaction recorded!");
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#6B55D9", "#7DBD9B", "#4F46E5", "#10B981"]
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to record transaction."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessRequest = async (txId: string, action: "approve" | "reject") => {
    try {
      const res = await api.patch<ProcessRequestResponse>(`/transactions/${txId}/process-request`, { action });
      setTransactions((prev) => 
        prev.map((tx) => (tx._id === txId ? { ...tx, ...res.data.transaction } : tx))
      );
    } catch (err: unknown) {
      console.error("Failed to process request:", err);
      setError(getErrorMessage(err, "Failed to process request"));
    }
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <Paperclip className="w-3.5 h-3.5" />;
    if (mimeType.startsWith("image/")) return <ImageIcon className="w-3.5 h-3.5" />;
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
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Export Buttons */}
          {canExport && (
            <div className="flex items-center gap-2 mr-2">
              <button
                className="btn-secondary py-2 px-3 text-xs flex items-center gap-2"
                onClick={() => handleExport("csv")}
                disabled={isExporting || filteredTxs.length === 0}
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                className="btn-secondary py-2 px-3 text-xs flex items-center gap-2"
                onClick={() => handleExport("pdf")}
                disabled={isExporting || filteredTxs.length === 0}
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          )}
          {/* RBAC Fix: Level 1, 2, and 3 can record/request transactions */}
          {canRecordOrRequest && (
            <button
              id="record-transaction-btn"
              className="btn-primary py-2"
              onClick={() => setShowCreateModal(true)}
            >
              {canDirectRecord ? "Record Transaction" : "Submit Request"}
            </button>
          )}
        </div>
      </header>

      {/* ── Filters ── */}
      <TransactionFilterBar filters={filters} onFilterChange={setFilters} />

      {/* ── Table ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
      <div className="glass rounded-xl overflow-hidden border border-purple-500/30 shadow-[0_0_20px_rgba(139,92,246,0.1)] w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/5 border-b border-purple-500/30 text-white/60 uppercase tracking-widest text-[10px]">
            <tr>
              <th className="p-4 font-bold">Description</th>
              <th className="p-4 font-bold">Category</th>
              <th className="p-4 font-bold">Date</th>
              <th className="p-4 font-bold">Status</th>
              <th className="p-4 font-bold">Blockchain</th>
              <th className="p-4 font-bold">Receipt</th>
              <th className="p-4 font-bold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {filteredTxs.length > 0 ? (
              filteredTxs.map((tx) => (
                <React.Fragment key={tx._id}>
                <tr onClick={() => setExpandedTxId(expandedTxId === tx._id ? null : tx._id)} className="cursor-pointer hover:bg-white/10 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${tx.type === "income" ? "bg-cyan-500/10 border-cyan-400/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]" : "bg-red-500/10 border-red-400/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]"}`}>
                        {tx.type === "income"
                          ? <ArrowUpRight className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                          : <ArrowDownRight className="w-5 h-5 text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white drop-shadow-sm flex items-center gap-2">
                          {tx.description}
                          {tx.urgency === "urgent" && (
                            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-red-500/20 border border-red-500/40 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse">
                              Urgent
                            </span>
                          )}
                        </span>
                        {tx.referenceNumber && (
                          <span className="text-[10px] text-white/50 mt-0.5 font-medium tracking-wide">
                            Ref: {tx.referenceNumber}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform duration-200 group-hover:text-white/70 ${expandedTxId === tx._id ? "rotate-180" : ""}`} />
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-block whitespace-nowrap px-2 py-1 rounded-sm bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest font-bold text-white/70">
                      {tx.category || "—"}
                    </span>
                  </td>
                  <td className="p-4 text-white/60 font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`whitespace-nowrap px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm border ${
                        tx.status === "approved" ? "bg-green-500/20 text-green-300 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : 
                        tx.status === "rejected" ? "bg-red-500/20 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : 
                        tx.status === "requested" ? "bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]" :
                        "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      }`}>
                        {tx.status === "approved" ? "Approved" : 
                         tx.status === "pending_approval" ? "Pending" : 
                         tx.status === "requested" ? "Requested" : 
                         "Rejected"}
                      </span>
                      {tx.isEscrow && (
                        <span className={`whitespace-nowrap px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm border ${
                          tx.escrowStatus === "locked" ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30 shadow-[0_0_10px_rgba(217,70,239,0.2)]" : 
                          tx.escrowStatus === "released" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]" : 
                          "bg-white/10 text-white/50 border-white/20"
                        }`}>
                          {tx.escrowStatus === "locked" ? "Escrow Locked" : 
                           tx.escrowStatus === "released" ? "Escrow Released" : 
                           "Escrow Pending"}
                        </span>
                      )}
                      {tx.status === "approved" && tx.type === "expense" && !tx.executed && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const executeTx = async () => {
                              try {
                                if (!tx.onChainTxId) return toast.error("No on-chain ID");
                                if (typeof window === "undefined" || !window.ethereum) return toast.error("MetaMask not installed");
                                const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
                                const signer = await provider.getSigner();
                                const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
                                const contract = new ethers.Contract(contractAddress, ChainBudgetABI.abi, signer);
                                toast.loading("Executing transfer on-chain...", { id: "execToast" });
                                const execTx = await contract.executeTransaction(tx.onChainTxId);
                                await execTx.wait();
                                await api.patch(`/transactions/${tx._id}/execute`);
                                
                                setTransactions((prev) => 
                                  prev.map((t) => (t._id === tx._id ? { ...t, executed: true, escrowStatus: t.isEscrow ? "locked" : "none" } : t))
                                );
                                toast.success("Transfer executed successfully!", { id: "execToast" });
                              } catch (err: unknown) {
                                toast.error(getErrorMessage(err, "Execution failed"), { id: "execToast" });
                              }
                            };
                            executeTx();
                          }}
                          className="whitespace-nowrap px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/40 rounded-sm transition-colors shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                        >
                          Execute Transfer
                        </button>
                      )}
                      {tx.status === "approved" && tx.type === "expense" && tx.executed && tx.isEscrow && tx.escrowStatus === "locked" && (
                        user?.isSuperAdmin || 
                        userRoleLevel <= 2 ||
                        user?.id === tx.submittedBy?._id ||
                        (user?.walletAddress && tx.submittedBy?.walletAddress && user.walletAddress.toLowerCase() === tx.submittedBy.walletAddress.toLowerCase())
                      ) && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const releaseTx = async () => {
                              try {
                                toast.loading("Releasing escrow funds...", { id: "escrowToast" });
                                await api.post(`/transactions/${tx._id}/release-escrow`);
                                setTransactions((prev) => 
                                  prev.map((t) => (t._id === tx._id ? { ...t, escrowStatus: "released", payeeApproved: true, payerApproved: true } : t))
                                );
                                toast.success("Escrow released successfully!", { id: "escrowToast" });
                              } catch (err: unknown) {
                                toast.error(getErrorMessage(err, "Release failed"), { id: "escrowToast" });
                              }
                            };
                            releaseTx();
                          }}
                          className="whitespace-nowrap px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/40 rounded-sm transition-colors shadow-[0_0_10px_rgba(217,70,239,0.2)]"
                        >
                          Release Escrow
                        </button>
                      )}
                      {tx.status === "requested" && canDirectRecord && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleProcessRequest(tx._id, "approve"); }}
                            className="whitespace-nowrap px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/40 rounded-sm transition-colors shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleProcessRequest(tx._id, "reject"); }}
                            className="whitespace-nowrap px-2 py-1 text-[9px] font-bold uppercase tracking-widest bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/40 rounded-sm transition-colors shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {tx.isRecordedOnChain ? (
                      tx.blockchainTxHash ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExplorerHash(tx.blockchainTxHash || "");
                          }}
                          className="px-2 py-1 rounded-sm bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-[10px] uppercase tracking-widest font-bold hover:bg-fuchsia-500/20 transition-colors inline-flex items-center gap-1 w-fit cursor-pointer shadow-[0_0_10px_rgba(217,70,239,0.1)]" 
                          title="View in Explorer"
                        >
                          <span className="chain-dot w-2 h-2 shadow-[0_0_8px_rgba(217,70,239,0.8)]" /> Verified
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="px-2 py-1 rounded-sm bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-[10px] uppercase tracking-widest font-bold shadow-[0_0_10px_rgba(217,70,239,0.1)]" title="Recorded on Polygon">
                          <span className="chain-dot w-2 h-2 mr-1 shadow-[0_0_8px_rgba(217,70,239,0.8)]" /> Verified
                        </span>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/30 font-medium">—</span>
                        {tx.status === "approved" && canDirectRecord && (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                toast.loading("Retrying blockchain sync on Polygon Amoy network...", { id: "syncToast" });
                                const res = await api.post<{ transaction: Transaction }>(`/transactions/${tx._id}/retry-sync`);
                                setTransactions((prev) => prev.map((t) => (t._id === tx._id ? { ...t, ...res.data.transaction } : t)));
                                toast.success("Successfully synced to blockchain!", { id: "syncToast" });
                              } catch (err: unknown) {
                                toast.error(getErrorMessage(err, "Failed to sync to blockchain."), { id: "syncToast" });
                              }
                            }}
                            className="text-[9px] font-bold uppercase tracking-widest bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 px-2 py-1 rounded-sm transition-colors shadow-[0_0_10px_rgba(217,70,239,0.1)]"
                            title="Retry sync to blockchain"
                          >
                            Retry Sync
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {tx.documentUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!tx.documentUrl) return;
                          setReceiptLoadError(false);
                          const docUrl = tx.documentUrl;
                          const cleanUrl = docUrl.startsWith("http") || docUrl.startsWith("data:")
                            ? docUrl
                            : `${BACKEND_URL}${docUrl}`;
                          setPreviewReceipt({
                            url: cleanUrl,
                            title: tx.description || "Receipt",
                            txId: tx._id,
                            documentHash: tx.documentHash,
                          });
                        }}
                        title="View receipt"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 rounded-md border border-cyan-500/20 transition-colors"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Receipt
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/30 font-medium">—</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttachingTxId(tx._id);
                            if (attachFileInputRef.current) attachFileInputRef.current.click();
                          }}
                          disabled={isAttaching && attachingTxId === tx._id}
                          className="text-[10px] font-bold uppercase tracking-widest bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 text-white/50 border border-white/10 px-2 py-1 rounded-sm transition-colors disabled:opacity-50"
                          title="Attach Receipt"
                        >
                          {isAttaching && attachingTxId === tx._id ? "..." : "Upload"}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className={`p-4 text-right font-black tracking-tight text-lg drop-shadow-md whitespace-nowrap ${tx.type === "income" ? "text-cyan-400" : "text-red-400"}`}>
                    {tx.type === "income" ? "+" : "-"}&#8369;{Math.round(tx.amount).toLocaleString()}
                  </td>
                </tr>
                {/* ── Request Tracking Timeline ── */}
                {expandedTxId === tx._id && (
                  <tr className="timeline-row">
                    <td colSpan={7} className="p-0!">
                      <div className="bg-black/40 px-8 py-6 border-t border-white/5 shadow-inner">
                        <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-5">Request Tracking Timeline</p>
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

                            const visibleSteps = tx.status === "rejected" ? steps.slice(0, 2) : steps;

                            return visibleSteps.map((step, idx) => (
                              <div key={idx} className={`flex items-start ${idx < visibleSteps.length - 1 ? "flex-1" : "w-32"}`}>
                                <div className="flex flex-col items-center w-32 shrink-0">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-300 ${
                                    step.done 
                                      ? `${step.color} scale-100 shadow-[0_0_15px_rgba(var(--${step.color.replace("bg-", "")}),0.4)]` 
                                      : "bg-white/10 border border-white/20 scale-90"
                                  }`}>
                                    {step.done ? step.icon : <span className="w-2 h-2 bg-white/20 rounded-full" />}
                                  </div>
                                  <p className={`text-xs font-semibold mt-2 ${step.done ? (step.isRejected ? "text-red-400" : "text-white/90") : "text-white/40"}`}>{step.label}</p>
                                  <p className={`text-[10px] mt-0.5 text-center max-w-30 ${step.done ? "text-white/60" : "text-white/30"}`}>{step.detail}</p>
                                  {step.date && <p className="text-[10px] text-white/40 mt-0.5">{step.date}</p>}
                                </div>
                                {idx < visibleSteps.length - 1 && (
                                  <div className={`h-0.75 flex-1 mt-4.5 mx-1 rounded-full transition-all duration-300 ${
                                    step.done ? step.color : "bg-white/10"
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
                <td colSpan={7} className="py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                      <Receipt className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700 mb-1">No transactions found</h3>
                    <p className="text-sm text-gray-500 max-w-sm">
                      {loading ? "Loading your financial records..." : "There are no transactions matching your current filters or organization."}
                    </p>
                  </div>
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
          style={{ background: "rgba(11, 12, 16, 0.75)", backdropFilter: "blur(8px)" }}
        >
          {/* Scrollable container that fills the backdrop */}
          <div
            className="h-full overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            {/* Flex centering wrapper */}
            <div className="flex min-h-full items-center justify-center p-3 md:p-4 py-6 md:py-8">
              <div className="glass rounded-xl md:rounded-2xl p-5 md:p-8 w-full max-w-lg shadow-[0_0_30px_rgba(139,92,246,0.15)] animate-fade-in border border-purple-500/30">

            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold text-white drop-shadow-sm">
                { canDirectRecord ? "Record Transaction" : "Submit Request" }
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-300 border border-red-500/30 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">

              {/* Income / Expense toggle */}
              <div className="flex rounded-lg overflow-hidden border border-white/10 bg-black/20 p-1 gap-1">
                {(["expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTab(t)}
                    className="flex-1 py-2 text-sm font-bold uppercase tracking-widest rounded-md transition-all duration-300"
                    style={{
                      background: activeTab === t
                        ? t === "income" ? "rgba(34, 211, 238, 0.15)" : "rgba(239, 68, 68, 0.15)"
                        : "transparent",
                      color: activeTab === t
                        ? t === "income" ? "#22d3ee" : "#ef4444"
                        : "rgba(255, 255, 255, 0.4)",
                      boxShadow: activeTab === t 
                        ? t === "income" ? "inset 0 0 10px rgba(34, 211, 238, 0.1), 0 0 10px rgba(34, 211, 238, 0.2)" : "inset 0 0 10px rgba(239, 68, 68, 0.1), 0 0 10px rgba(239, 68, 68, 0.2)"
                        : "none",
                      border: activeTab === t
                        ? t === "income" ? "1px solid rgba(34, 211, 238, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)"
                        : "1px solid transparent"
                    }}
                  >
                    {t === "income" ? "+ Income" : "− Expense"}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-bold text-white/70 mb-1 drop-shadow-sm">Amount (&#8369;)</label>
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
                <label className="block text-sm font-bold text-white/70 mb-1 drop-shadow-sm">
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
              {userRoleLevel === 3 && formData.type === "expense" && (
                <div className="flex items-center justify-between p-2 md:p-3 bg-red-500/10 border border-red-500/30 rounded-lg shadow-[inset_0_0_15px_rgba(239,68,68,0.05)]">
                  <div>
                    <label className="block text-sm font-bold text-red-400 mb-0 md:mb-0.5 drop-shadow-sm">Mark as Urgent?</label>
                    <p className="text-[9px] md:text-[10px] text-red-300/70 leading-tight">Flags this request for immediate admin attention.</p>
                  </div>
                  <div className="flex bg-black/40 rounded-lg p-1 border border-red-500/20 shadow-sm shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "normal" })}
                      className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all duration-300 ${formData.urgency === "normal" ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-white/40 hover:text-white/70"}`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "urgent" })}
                      className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all duration-300 ${formData.urgency === "urgent" ? "bg-red-500/80 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] border border-red-400" : "text-red-500/50 hover:bg-red-500/20 hover:text-red-300"}`}
                    >
                      URGENT
                    </button>
                  </div>
                </div>
              )}

              {/* Category + Reference */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="block text-sm font-bold text-white/70 mb-1 drop-shadow-sm">Category (Budget Allocation)</label>
                  {formData.type === "expense" ? (
                    <select
                      id="tx-category"
                      className="input appearance-none bg-[#160B2E] text-white"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      <option value="" disabled className="bg-[#160B2E] text-white/50">Select Budget Category</option>
                      {budgets.map((b) => {
                        const remaining = b.allocated - b.spent;
                        const isExhausted = remaining <= 0;
                        return (
                          <option key={b._id} value={b.name} disabled={isExhausted} className="bg-[#160B2E] text-white disabled:text-white/30">
                            {b.name} (Remaining: ₱{remaining.toLocaleString()})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      id="tx-category"
                      type="text"
                      placeholder="e.g. Donations"
                      className="input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/70 mb-1 drop-shadow-sm">Reference #</label>
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
                <label className="block text-sm font-bold text-white/70 mb-1 drop-shadow-sm">Notes (optional)</label>
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
                <label className="block text-sm font-bold text-white/70 mb-1.5 md:mb-2 drop-shadow-sm">
                  Receipt / Attachment <span className="text-white/40 font-medium">(optional)</span>
                </label>

                {!uploadedFile ? (
                  <div
                    className="relative border-2 border-dashed rounded-xl p-4 md:p-5 text-center cursor-pointer transition-all duration-300 border-white/20 hover:border-cyan-400/50 hover:bg-cyan-400/5"
                    onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "#22D3EE"; }}
                    onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        processUploadedFile(file);
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
                        <Loader2 className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)] animate-spin" />
                        <p className="text-sm font-bold text-white drop-shadow-sm">Uploading file...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)] flex items-center justify-center">
                          <Upload className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                        </div>
                        <p className="text-sm text-white/70">
                          <span className="font-bold text-cyan-400">Click to upload</span> or drag & drop
                        </p>
                        <p className="text-xs text-white/40 font-medium tracking-wide">JPEG, PNG, WebP, PDF — max 5 MB</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 shadow-[inset_0_0_10px_rgba(34,211,238,0.05)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)]">
                        {getFileIcon(uploadedFile.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white drop-shadow-sm truncate">{uploadedFile.originalName}</p>
                        <p className="text-xs text-cyan-300/70 font-medium tracking-wide">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAiAutoFill}
                        disabled={isAiScanning}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all ${
                          aiScanSuccess 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "bg-linear-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-400/50"
                        }`}
                      >
                        {isAiScanning ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
                        ) : aiScanSuccess ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Scanned!</>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5" /> AI Auto-fill</>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removeUpload();
                          setRawFile(null);
                          setAiScanSuccess(false);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-danger/10 text-gray-400 hover:text-danger transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
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
                <div className="pt-2 border-t border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={formData.isEscrow || false}
                        onChange={(e) => setExpenseData({ ...expenseData, isEscrow: e.target.checked })}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${formData.isEscrow ? "bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]" : "bg-white/10 border border-white/20"}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${formData.isEscrow ? "transform translate-x-4" : ""}`}></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white drop-shadow-sm">Use Smart Contract Escrow</span>
                      <span className="text-xs text-white/50">Lock funds until supplier delivery is confirmed.</span>
                    </div>
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 md:pt-4 mt-1 md:mt-2 flex justify-end gap-2 md:gap-3 border-t border-white/10">
                <button
                  type="button"
                  className="px-4 py-2 md:py-2.5 text-sm md:text-base font-bold text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex-1"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  id="tx-submit-btn"
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="px-4 py-2 md:py-2.5 text-sm md:text-base font-bold text-white bg-cyan-500/20 border border-cyan-400 hover:bg-cyan-500/40 rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all flex-1 whitespace-nowrap disabled:opacity-50"
                >
                  {isSubmitting ? "Recording..." : canDirectRecord ? "Record Transaction" : "Submit Request"}
                </button>
              </div>
            </form>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* ── Receipt Viewer & In-App Lightbox Modal ── */}
      {previewReceipt && (
        <Portal>
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative bg-[#13121d] border border-white/15 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-modal-pop">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {previewReceipt.title}
                    </h3>
                    <p className="text-xs text-white/50">Transaction Attached Receipt</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAttachingTxId(previewReceipt.txId);
                      if (attachFileInputRef.current) attachFileInputRef.current.click();
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                    title="Replace or re-upload receipt"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Replace
                  </button>
                  
                  {!receiptLoadError && (
                    <a
                      href={previewReceipt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={() => {
                      setPreviewReceipt(null);
                      setReceiptLoadError(false);
                    }}
                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content Preview */}
              <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center min-h-75 bg-black/40">
                {receiptLoadError ? (
                  <div className="text-center p-8 max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-white mb-2">Receipt File Expired or Missing</h4>
                    <p className="text-xs text-white/50 leading-relaxed mb-6">
                      This receipt was stored in temporary cloud storage that was cleared during a server restart. You can easily re-upload the receipt image below to permanently attach it to this transaction.
                    </p>
                    <button
                      onClick={() => {
                        setAttachingTxId(previewReceipt.txId);
                        if (attachFileInputRef.current) attachFileInputRef.current.click();
                      }}
                      disabled={isAttaching}
                      className="btn-primary py-2.5 px-6 text-xs font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(107,85,217,0.4)]"
                    >
                      {isAttaching ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Re-upload Receipt Image
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="relative max-w-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewReceipt.url}
                      alt="Receipt Document"
                      onError={() => setReceiptLoadError(true)}
                      className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
                    />
                  </div>
                )}
              </div>

              {/* Footer with Document Hash */}
              {previewReceipt.documentHash && (
                <div className="px-6 py-3 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-white/50">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-cyan-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    IPFS Hash: {previewReceipt.documentHash.slice(0, 16)}...
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">On-Chain Verified</span>
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}

      <TxExplorerModal 
        isOpen={Boolean(selectedExplorerHash)} 
        onClose={() => setSelectedExplorerHash(null)} 
        txHash={selectedExplorerHash || ""} 
      />
    </div>
  );
}
