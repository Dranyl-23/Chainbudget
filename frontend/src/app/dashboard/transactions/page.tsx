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
  Plus,
} from "lucide-react";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import api from "@/lib/api";
import TableSkeleton from "@/components/TableSkeleton";
import TxExplorerModal from "@/components/TxExplorerModal";
import TransactionFilterBar from "@/components/TransactionFilterBar";
import CustomSelect from "@/components/CustomSelect";
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
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("cb_cache_transactions");
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState<{ search: string; type: string; status: string; range: string }>({
    search: "",
    type: "",
    status: "",
    range: "all",
  });
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
          api.get<TransactionsResponse>("/transactions", {
            params: {
              orgId,
              limit: 100,
              range: filters.range !== "all" ? filters.range : undefined,
            },
          }),
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
  }, [activeOrgId, filters.range]);

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
    if (filters.range && filters.range !== "all") {
      const now = new Date();
      const since = new Date();
      if (filters.range === "24h") since.setDate(now.getDate() - 1);
      else if (filters.range === "7d") since.setDate(now.getDate() - 7);
      else if (filters.range === "30d") since.setDate(now.getDate() - 30);
      else if (filters.range === "90d") since.setDate(now.getDate() - 90);
      else if (filters.range === "1year") since.setFullYear(now.getFullYear() - 1);
      result = result.filter((tx) => new Date(tx.createdAt) >= since);
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
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Ledger &amp; Transactions</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
              Audit Ledger
            </span>
          </div>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">Cryptographically verified organizational ledger and cash flows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export Buttons */}
          {canExport && (
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <button
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 disabled:opacity-40"
                onClick={() => handleExport("csv")}
                disabled={isExporting || filteredTxs.length === 0}
                title="Export Filtered CSV"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>CSV</span>
              </button>
              <button
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 disabled:opacity-40"
                onClick={() => handleExport("pdf")}
                disabled={isExporting || filteredTxs.length === 0}
                title="Export Filtered PDF"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>PDF</span>
              </button>
            </div>
          )}
          {/* RBAC: Level 1, 2, and 3 can record/request transactions */}
          {canRecordOrRequest && (
            <button
              id="record-transaction-btn"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" />
              <span>{canDirectRecord ? "Record Expense" : "Submit Request"}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Filters ── */}
      <TransactionFilterBar filters={filters} onFilterChange={setFilters} />

      {/* ── Table (Studio Admin Style) ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
      <div className="rounded-xl overflow-hidden border border-zinc-800 bg-[#121215] shadow-xs w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px] font-semibold">
            <tr>
              <th className="p-4">Description</th>
              <th className="p-4">Category</th>
              <th className="p-4">Date</th>
              <th className="p-4">Status</th>
              <th className="p-4">Blockchain</th>
              <th className="p-4">Receipt</th>
              <th className="p-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-sm">
            {filteredTxs.length > 0 ? (
              filteredTxs.map((tx) => (
                <React.Fragment key={tx._id}>
                <tr onClick={() => setExpandedTxId(expandedTxId === tx._id ? null : tx._id)} className="cursor-pointer hover:bg-zinc-800/40 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-zinc-800 bg-zinc-900 text-zinc-300">
                        {tx.type === "income"
                          ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          : <ArrowDownRight className="w-4 h-4 text-zinc-400" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-white flex items-center gap-2">
                          {tx.description}
                          {tx.urgency === "urgent" && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-rose-500/10 border border-rose-500/30 text-rose-400">
                              Urgent
                            </span>
                          )}
                        </span>
                        {tx.referenceNumber && (
                          <span className="text-[10px] text-zinc-400 mt-0.5 font-medium tracking-wide">
                            Ref: {tx.referenceNumber}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 group-hover:text-zinc-300 ${expandedTxId === tx._id ? "rotate-180" : ""}`} />
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800/80 border border-zinc-700/80 text-zinc-300">
                      {tx.category || "—"}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-400 font-medium text-xs">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`whitespace-nowrap px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                        tx.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                        tx.status === "rejected" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : 
                        tx.status === "requested" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : 
                        "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {tx.status === "approved" ? "Approved" : 
                         tx.status === "pending_approval" ? "Pending" : 
                         tx.status === "requested" ? "Requested" : 
                         "Rejected"}
                      </span>
                      {tx.isEscrow && (
                        <span className={`whitespace-nowrap px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                          tx.escrowStatus === "locked" ? "bg-zinc-800 text-zinc-200 border-zinc-700" : 
                          tx.escrowStatus === "released" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                          "bg-zinc-800 text-zinc-400 border-zinc-700"
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
                          className="whitespace-nowrap px-2 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 rounded-md transition-colors"
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
                          className="whitespace-nowrap px-2 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 rounded-md transition-colors"
                        >
                          Release Escrow
                        </button>
                      )}
                      {tx.status === "requested" && canDirectRecord && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleProcessRequest(tx._id, "approve"); }}
                            className="whitespace-nowrap px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-md transition-colors"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleProcessRequest(tx._id, "reject"); }}
                            className="whitespace-nowrap px-2 py-0.5 text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-md transition-colors"
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
                          className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-medium hover:bg-zinc-700 transition-colors inline-flex items-center gap-1.5 w-fit cursor-pointer" 
                          title="View in Explorer"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Verified
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-medium inline-flex items-center gap-1.5" title="Recorded on Polygon">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Verified
                        </span>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 font-medium">—</span>
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
                            className="text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-md transition-colors"
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
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded-md border border-zinc-700 transition-colors"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                        Receipt
                        <ExternalLink className="w-3 h-3 text-zinc-500" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 font-medium">—</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttachingTxId(tx._id);
                            if (attachFileInputRef.current) attachFileInputRef.current.click();
                          }}
                          disabled={isAttaching && attachingTxId === tx._id}
                          className="text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-md transition-colors disabled:opacity-50"
                          title="Attach Receipt"
                        >
                          {isAttaching && attachingTxId === tx._id ? "..." : "Upload"}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className={`p-4 text-right font-semibold font-mono text-sm whitespace-nowrap ${tx.type === "income" ? "text-emerald-400" : "text-zinc-200"}`}>
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
                                icon: <Link2 className="w-4 h-4 text-zinc-950" />,
                                done: tx.isRecordedOnChain,
                                color: "bg-white text-zinc-950",
                              },
                            ];

                            const visibleSteps = tx.status === "rejected" ? steps.slice(0, 2) : steps;

                            return visibleSteps.map((step, idx) => (
                              <div key={idx} className={`flex items-start ${idx < visibleSteps.length - 1 ? "flex-1" : "w-32"}`}>
                                <div className="flex flex-col items-center w-32 shrink-0">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-all duration-300 ${
                                    step.done 
                                      ? `${step.color} scale-100` 
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
          style={{ background: "rgba(9, 9, 11, 0.8)", backdropFilter: "blur(6px)" }}
        >
          {/* Scrollable container that fills the backdrop */}
          <div
            className="h-full overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            {/* Flex centering wrapper */}
            <div className="flex min-h-full items-center justify-center p-3 md:p-4 py-6 md:py-8">
              <div className="bg-[#121215] rounded-2xl p-5 md:p-6 w-full max-w-lg shadow-2xl animate-modal-pop border border-zinc-800">

            <div className="flex items-center justify-between mb-4 md:mb-5">
              <h2 className="text-base md:text-lg font-bold text-white">
                { canDirectRecord ? "Record Transaction" : "Submit Request" }
              </h2>
              <button
                onClick={closeModal}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-lg text-xs text-rose-300 border border-rose-500/30 bg-rose-500/10">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">

              {/* Income / Expense toggle */}
              <div className="flex rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 p-1 gap-1">
                {(["expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTab(t)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      activeTab === t
                        ? "bg-zinc-800 text-white shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {t === "income" ? "+ Income" : "− Expense"}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Amount (&#8369;)</label>
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
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
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
                <div className="flex items-center justify-between p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-200 mb-0.5">Mark as Urgent?</label>
                    <p className="text-[10px] text-zinc-400 leading-tight">Flags this request for immediate admin attention.</p>
                  </div>
                  <div className="flex bg-zinc-800/80 rounded-lg p-1 border border-zinc-700/60 shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "normal" })}
                      className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-colors ${formData.urgency === "normal" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency: "urgent" })}
                      className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-colors ${formData.urgency === "urgent" ? "bg-rose-600 text-white" : "text-rose-400 hover:bg-rose-500/20"}`}
                    >
                      URGENT
                    </button>
                  </div>
                </div>
              )}

              {/* Category + Reference */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Category</label>
                  {formData.type === "expense" ? (
                    <CustomSelect
                      id="tx-category"
                      placeholder="Select Budget Category"
                      value={formData.category}
                      onChange={(val) => setFormData({ ...formData, category: val })}
                      options={budgets.map((b) => {
                        const remaining = b.allocated - b.spent;
                        const isExhausted = remaining <= 0;
                        return {
                          value: b.name,
                          label: b.name,
                          hint: `Remaining: ₱${remaining.toLocaleString()}`,
                          disabled: isExhausted,
                        };
                      })}
                    />
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
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Reference #</label>
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
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Notes (optional)</label>
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
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Receipt / Attachment <span className="text-zinc-500 font-normal">(optional)</span>
                </label>

                {!uploadedFile ? (
                  <div
                    className="relative border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-500"
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
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
                      <div className="flex flex-col items-center gap-1.5">
                        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                        <p className="text-xs font-semibold text-white">Uploading file...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                          <Upload className="w-4 h-4 text-zinc-300" />
                        </div>
                        <p className="text-xs text-zinc-300">
                          <span className="font-semibold text-white">Click to upload</span> or drag &amp; drop
                        </p>
                        <p className="text-[11px] text-zinc-500 font-medium">JPEG, PNG, WebP, PDF — max 5 MB</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 text-zinc-300">
                        {getFileIcon(uploadedFile.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{uploadedFile.originalName}</p>
                        <p className="text-[10px] text-zinc-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAiAutoFill}
                        disabled={isAiScanning}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                          aiScanSuccess 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700"
                        }`}
                      >
                        {isAiScanning ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Scanning...</>
                        ) : aiScanSuccess ? (
                          <><CheckCircle2 className="w-3 h-3" /> Scanned!</>
                        ) : (
                          <><Sparkles className="w-3 h-3 text-zinc-300" /> AI Auto-fill</>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removeUpload();
                          setRawFile(null);
                          setAiScanSuccess(false);
                        }}
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <p className="mt-1.5 text-xs text-rose-400">{uploadError}</p>
                )}

                {uploadedFile && (
                  <p className="mt-1 text-[11px] text-zinc-500 flex items-center gap-1">
                    <span className="font-medium">SHA-256:</span>
                    <span className="font-mono truncate">{uploadedFile.documentHash.slice(0, 32)}...</span>
                  </p>
                )}
              </div>

              {activeTab === "expense" && (
                <div className="pt-2 border-t border-zinc-800">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={formData.isEscrow || false}
                        onChange={(e) => setExpenseData({ ...expenseData, isEscrow: e.target.checked })}
                      />
                      <div className={`block w-9 h-5 rounded-full transition-colors ${formData.isEscrow ? "bg-white" : "bg-zinc-800 border border-zinc-700"}`}></div>
                      <div className={`dot absolute left-0.5 top-0.5 w-4 h-4 rounded-full transition-transform ${formData.isEscrow ? "bg-zinc-950 transform translate-x-4" : "bg-zinc-400"}`}></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white">Use Smart Contract Escrow</span>
                      <span className="text-[11px] text-zinc-400">Lock funds until supplier delivery is confirmed.</span>
                    </div>
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 mt-1 flex justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors flex-1"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  id="tx-submit-btn"
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="btn-primary px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex-1 whitespace-nowrap disabled:opacity-50"
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
          <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
            <div className="relative bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-modal-pop">
              
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-zinc-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      {previewReceipt.title}
                    </h3>
                    <p className="text-[11px] text-zinc-400">Transaction Attached Receipt</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAttachingTxId(previewReceipt.txId);
                      if (attachFileInputRef.current) attachFileInputRef.current.click();
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors flex items-center gap-1.5"
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
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
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
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content Preview */}
              <div className="flex-1 overflow-auto p-5 flex flex-col items-center justify-center min-h-75 bg-zinc-950/60">
                {receiptLoadError ? (
                  <div className="text-center p-6 max-w-md">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1.5">Receipt File Expired or Missing</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                      This receipt was stored in temporary cloud storage that was cleared during a server restart. You can easily re-upload the receipt image below to permanently attach it to this transaction.
                    </p>
                    <button
                      onClick={() => {
                        setAttachingTxId(previewReceipt.txId);
                        if (attachFileInputRef.current) attachFileInputRef.current.click();
                      }}
                      disabled={isAttaching}
                      className="btn-primary py-2 px-4 text-xs font-semibold inline-flex items-center gap-2"
                    >
                      {isAttaching ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
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
                      className="max-h-[60vh] max-w-full rounded-lg object-contain border border-zinc-800"
                    />
                  </div>
                )}
              </div>

              {/* Footer with Document Hash */}
              {previewReceipt.documentHash && (
                <div className="px-5 py-2.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                    IPFS Hash: {previewReceipt.documentHash.slice(0, 16)}...
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">On-Chain Verified</span>
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
