"use client";

import { useEffect, useState, useRef } from "react";
import Portal from "@/components/Portal";
import { useAuth } from "@/context/AuthContext";
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
} from "lucide-react";
import api from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000";

interface Transaction {
  _id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category?: string;
  createdAt: string;
  status: "approved" | "pending_approval" | "rejected";
  isRecordedOnChain: boolean;
  documentUrl?: string;
  documentHash?: string;
}

interface CreateTxForm {
  type: "income" | "expense";
  amount: string;
  description: string;
  category: string;
  referenceNumber: string;
  notes: string;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTxs, setFilteredTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState({ search: "", type: "", status: "" });
  const [formData, setFormData] = useState<CreateTxForm>({
    type: "expense",
    amount: "",
    description: "",
    category: "",
    referenceNumber: "",
    notes: "",
  });

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        if (!activeOrgId) { setLoading(false); return; }
        const orgId = activeOrgId || "";
        const res = await api.get("/transactions", { params: { orgId, limit: 100 } });
        setTransactions(res.data.transactions || []);
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
    setFormData({ type: "expense", amount: "", description: "", category: "", referenceNumber: "", notes: "" });
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

  const removeUpload = () => {
    setUploadedFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;
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

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <Paperclip className="w-3.5 h-3.5" />;
    if (mimeType.startsWith("image/")) return <Image className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="p-8 pb-20 animate-fade-in">

      {/* ── Header ── */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Transactions</h1>
          <p className="text-sm text-gray-500">View and manage all organization transactions.</p>
        </div>
        <button
          id="record-transaction-btn"
          className="btn-primary py-2"
          onClick={() => setShowCreateModal(true)}
        >
          Record Transaction
        </button>
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
          <option value="rejected">Rejected</option>
        </select>
        <button className="btn-secondary px-3 py-2"><Filter className="w-4 h-4" /></button>
      </div>

      {/* ── Table ── */}
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
                <tr key={tx._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === "income" ? "bg-primary/10" : "bg-danger/10"}`}>
                        {tx.type === "income"
                          ? <ArrowUpRight className="w-4 h-4 text-primary" />
                          : <ArrowDownRight className="w-4 h-4 text-danger" />}
                      </div>
                      <span className="font-medium text-gray-700">{tx.description}</span>
                    </div>
                  </td>
                  <td>
                    <span className="px-2 py-1 rounded bg-[#F2EEFF] text-xs text-gray-500">
                      {tx.category || "—"}
                    </span>
                  </td>
                  <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${tx.status === "approved" ? "badge-approved" : tx.status === "rejected" ? "badge-rejected" : "badge-pending"}`}>
                      {tx.status === "approved" ? "Approved" : tx.status === "pending_approval" ? "Pending" : "Rejected"}
                    </span>
                  </td>
                  <td>
                    {tx.isRecordedOnChain ? (
                      <span className="badge badge-onchain" title="Recorded on Polygon Amoy">
                        <span className="chain-dot w-2 h-2 mr-1" /> Verified
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td>
                    {tx.documentUrl ? (
                      <a
                        href={`${BACKEND_URL}${tx.documentUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View receipt"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Receipt
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className={`text-right font-bold ${tx.type === "income" ? "text-primary" : "text-danger"}`}>
                    {tx.type === "income" ? "+" : "-"}&#8369;{Math.round(tx.amount).toLocaleString()}
                  </td>
                </tr>
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
            <div className="flex min-h-full items-center justify-center p-4 py-8">
              <div className="glass rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-fade-in">

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Record Transaction</h2>
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

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Income / Expense toggle */}
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
                {(["expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      background: formData.type === t
                        ? t === "income" ? "rgba(107,85,217,0.1)" : "rgba(224,92,92,0.1)"
                        : "transparent",
                      color: formData.type === t
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
                <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <input
                  id="tx-description"
                  type="text"
                  placeholder="What is this for?"
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              {/* Category + Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
                  <input
                    id="tx-category"
                    type="text"
                    placeholder="e.g. Events"
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
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Receipt / Attachment <span className="text-gray-400 font-normal">(optional)</span>
                </label>

                {!uploadedFile ? (
                  <div
                    className="relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
                    style={{ borderColor: "var(--color-border)" }}
                    onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "#6B55D9"; }}
                    onDragLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                      const file = e.dataTransfer.files?.[0];
                      // Call handleFileChange directly — React’s onChange is NOT
                      // triggered by native dispatchEvent, so we bypass the input.
                      if (file) {
                        handleFileChange({ target: { files: [file] } } as any);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
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

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary flex-1 py-2.5"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  id="tx-submit-btn"
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="btn-primary flex-1 py-2.5"
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
