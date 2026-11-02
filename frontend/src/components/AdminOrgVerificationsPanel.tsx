"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import {
  formatStatusLabel,
  OrgApplicationDocument,
  OrgApplicationStatus,
  OrgApplicationView,
} from "@/lib/orgApplications";

export interface AdminOrgDocumentView extends OrgApplicationDocument {
  label?: string;
  downloadPath?: string;
}

export interface AdminOrgApplicationView extends Omit<OrgApplicationView, "documents" | "review"> {
  typeLabel?: string;
  applicant?: {
    id: string;
    walletAddress?: string;
    displayName?: string;
    email?: string;
  } | null;
  documents: AdminOrgDocumentView[];
  flags: string[];
  dossierHash?: string | null;
  anchor?: {
    status: string;
    txHash?: string;
    attempts?: number;
  };
  review: {
    reviewer?: string | null;
    decision?: "approve" | "reject" | "needs_info";
    reviewedAt?: string;
    applicantMessage?: string;
    internalNotes?: string;
  };
  history: {
    at: string;
    actor?: string | null;
    action: string;
    note?: string;
  }[];
}

const ORG_TYPE_LABELS: Record<string, string> = {
  student_org: "Student Org",
  barangay: "Barangay",
  homeowners_association: "HOA",
  ngo: "NGO",
  cooperative: "Cooperative",
  church: "Church",
  sports_club: "Sports Club",
  startup: "Startup",
  family: "Family",
  fundraising: "Fundraising",
};

const FLAG_DESCRIPTIONS: Record<string, string> = {
  duplicate_registration_number:
    "Registration number matches another verified organization or active application.",
  duplicate_document_hash:
    "One or more uploaded documents share an identical SHA-256 digest with another application.",
  similar_existing_org_name:
    "Organization name closely matches an existing organization or pending application.",
  email_domain_mismatch:
    "Contact email domain does not match the institutional domain suffix expected for this category.",
};

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getStatusBadgeClass(status: OrgApplicationStatus): string {
  switch (status) {
    case "approved":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    case "submitted":
    case "under_review":
      return "bg-sky-500/10 text-sky-300 border-sky-500/30";
    case "needs_info":
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    case "rejected":
    case "revoked":
      return "bg-rose-500/10 text-rose-300 border-rose-500/30";
    default:
      return "bg-zinc-900 text-zinc-400 border-zinc-800";
  }
}

interface Props {
  onStatsChanged?: () => void;
}

export default function AdminOrgVerificationsPanel({ onStatsChanged }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("queue");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [applications, setApplications] = useState<AdminOrgApplicationView[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected application drawer state
  const [selectedApp, setSelectedApp] = useState<AdminOrgApplicationView | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  // Review decision state
  const [decision, setDecision] = useState<"approve" | "needs_info" | "reject">("approve");
  const [applicantMessage, setApplicantMessage] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [docVerdicts, setDocVerdicts] = useState<
    Record<string, { status: "accepted" | "rejected"; reviewerNote: string }>
  >({});
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/org-applications", {
        params: { status: statusFilter, search, page, limit: 15 },
      });
      setApplications(res.data.applications || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error("Failed to load verification applications");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/admin/org-applications", {
        params: { status: statusFilter, search, page, limit: 15 },
      })
      .then((res) => {
        if (!cancelled) {
          setApplications(res.data.applications || []);
          setTotal(res.data.total || 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Failed to load verification applications");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, search, page]);

  const initVerdictsFromApp = (app: AdminOrgApplicationView) => {
    const map: Record<string, { status: "accepted" | "rejected"; reviewerNote: string }> = {};
    for (const doc of app.documents || []) {
      map[doc.id] = {
        status: doc.status === "rejected" ? "rejected" : "accepted",
        reviewerNote: doc.reviewerNote || "",
      };
    }
    setDocVerdicts(map);
    setDecision("approve");
    setApplicantMessage(app.review?.applicantMessage || "");
    setInternalNotes(app.review?.internalNotes || "");
  };

  const inspectApplication = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/org-applications/${id}`);
      const app: AdminOrgApplicationView = res.data.application;
      setSelectedApp(app);
      initVerdictsFromApp(app);
      setApplications((prev) => prev.map((a) => (a.id === app.id ? app : a)));
    } catch {
      toast.error("Failed to load application dossier");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDocument = async (appId: string, docId: string, filename?: string) => {
    setOpeningDocId(docId);
    try {
      const res = await api.get(
        `/admin/org-applications/${appId}/documents/${docId}/file`,
        { responseType: "blob" }
      );
      const contentType = String(res.headers["content-type"] || "application/octet-stream");
      const blob = new Blob([res.data], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename || "evidence";
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      toast.error("Failed to decrypt or load evidence document");
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedApp) return;

    if ((decision === "needs_info" || decision === "reject") && applicantMessage.trim().length < 10) {
      toast.error("Please provide a clear message to the applicant (at least 10 characters).");
      return;
    }

    const documentVerdictsPayload: Record<string, { status: "accepted" | "rejected"; reviewerNote: string }> = {};
    for (const d of selectedApp.documents || []) {
      documentVerdictsPayload[d.id] = {
        status: docVerdicts[d.id]?.status || "accepted",
        reviewerNote: docVerdicts[d.id]?.reviewerNote || "",
      };
    }

    if (
      decision === "approve" &&
      Object.values(documentVerdictsPayload).some((v) => v.status === "rejected")
    ) {
      toast.error(
        "Cannot approve while a document is marked rejected. Choose 'Request Changes' or accept all required documents."
      );
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await api.post(`/admin/org-applications/${selectedApp.id}/review`, {
        decision,
        applicantMessage: applicantMessage.trim(),
        internalNotes: internalNotes.trim(),
        documentVerdicts: documentVerdictsPayload,
      });

      const updated: AdminOrgApplicationView = res.data.application;
      setSelectedApp(updated);
      toast.success(
        decision === "approve"
          ? `Approved & provisioned "${updated.basics.displayName || "Organization"}"`
          : decision === "needs_info"
          ? "Sent feedback requesting additional information"
          : "Application rejected"
      );
      await loadApplications();
      onStatsChanged?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to submit review decision";
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  const totalPages = Math.ceil(total / 15);
  const canReview =
    selectedApp &&
    ["submitted", "under_review", "needs_info"].includes(selectedApp.status);

  const shortAddr = (addr?: string) =>
    addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";

  return (
    <div className="space-y-4">
      {/* ── Filters & Search ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 overflow-x-auto">
          {[
            { id: "queue", label: "Review Queue" },
            { id: "needs_info", label: "Needs Info" },
            { id: "approved", label: "Approved" },
            { id: "rejected", label: "Rejected" },
            { id: "revoked", label: "Revoked" },
            { id: "all", label: "All" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setStatusFilter(f.id);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === f.id
                  ? "bg-white text-zinc-950 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-52">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="w-full pl-9 pr-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            placeholder="Search by org name, registration #, or representative..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <button
          onClick={loadApplications}
          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>

        <span className="text-xs text-zinc-500 ml-auto">{total} applications</span>
      </div>

      {/* ── Applications Table ───────────────────────────────────────────── */}
      <div className="bg-[#121215] border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0e0e11] border-b border-zinc-800 text-zinc-400 text-[11px] font-medium uppercase tracking-wider">
                <th className="p-3 pl-4">Organization</th>
                <th className="p-3">Category & Tier</th>
                <th className="p-3">Representative</th>
                <th className="p-3">Evidence</th>
                <th className="p-3">Risk Flags</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Status</th>
                <th className="p-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-zinc-500 text-xs">
                    Loading verification applications...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-zinc-500 text-xs">
                    No organization applications match this filter.
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const dateVal = app.submittedAt || app.updatedAt;
                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-zinc-900/50 transition-colors cursor-pointer"
                      onClick={() => inspectApplication(app.id)}
                    >
                      <td className="p-3 pl-4">
                        <p className="font-medium text-white text-xs">
                          {app.basics.displayName || "Untitled Draft"}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate max-w-52">
                          {app.basics.legalName || app.basics.registrationNumber || `ID: ${app.id.slice(-8)}`}
                        </p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 text-[10px] uppercase font-medium">
                            {app.typeLabel || ORG_TYPE_LABELS[app.type] || app.type}
                          </span>
                          <span className="text-[10px] text-zinc-500 uppercase">
                            {app.tier || "standard"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="text-xs text-zinc-200">
                          {app.representative.fullName || app.applicant?.displayName || "—"}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {app.representative.position || shortAddr(app.applicant?.walletAddress)}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-zinc-300">
                          <FileText className="w-3.5 h-3.5 text-zinc-500" />
                          {app.documents?.length || 0} file{(app.documents?.length || 0) === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="p-3">
                        {app.flags && app.flags.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            {app.flags.length} flag{app.flags.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-500">Clean</span>
                        )}
                      </td>
                      <td className="p-3 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                        {dateVal ? new Date(dateVal).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium ${getStatusBadgeClass(
                            app.status
                          )}`}
                        >
                          {formatStatusLabel(app.status)}
                        </span>
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            inspectApplication(app.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-white transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <span className="text-xs text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white disabled:opacity-40 flex items-center gap-1"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Dossier Inspection Modal / Drawer ────────────────────────────── */}
      {(selectedApp || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-[#0e0e11] border-l border-zinc-800 h-full overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0e0e11]/95 backdrop-blur-md border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    {selectedApp?.basics.displayName || "Loading Application..."}
                  </h2>
                  {selectedApp && (
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-medium ${getStatusBadgeClass(
                        selectedApp.status
                      )}`}
                    >
                      {formatStatusLabel(selectedApp.status)}
                    </span>
                  )}
                </div>
                {selectedApp && (
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    Application ID: {selectedApp.id} · Tier: {(selectedApp.tier || "standard").toUpperCase()}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading || !selectedApp ? (
              <div className="flex-1 flex items-center justify-center py-20 text-xs text-zinc-400">
                Loading encrypted dossier...
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Risk / Duplicate Flags Alert */}
                {selectedApp.flags && selectedApp.flags.length > 0 && (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      Automated Risk & Duplicate Signals Detected ({selectedApp.flags.length})
                    </div>
                    <ul className="space-y-1 text-xs text-amber-200/90 pl-6 list-disc">
                      {selectedApp.flags.map((flag) => (
                        <li key={flag}>
                          <span className="font-mono font-semibold">{flag}:</span>{" "}
                          {FLAG_DESCRIPTIONS[flag] || "Requires manual verification."}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Section 1: Organization Basics & Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Organization Profile
                    </h3>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">Display Name:</span>
                        <span className="text-white font-medium text-right">
                          {selectedApp.basics.displayName || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">Legal / Official Name:</span>
                        <span className="text-zinc-200 text-right">
                          {selectedApp.basics.legalName || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">Category:</span>
                        <span className="text-zinc-200">
                          {selectedApp.typeLabel || ORG_TYPE_LABELS[selectedApp.type] || selectedApp.type}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">Registration #:</span>
                        <span className="text-zinc-200 font-mono">
                          {selectedApp.basics.registrationNumber || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">Year Established:</span>
                        <span className="text-zinc-200">
                          {selectedApp.basics.yearEstablished || "—"}
                        </span>
                      </div>
                    </div>
                    {selectedApp.basics.mission && (
                      <div className="pt-2 border-t border-zinc-800/80">
                        <p className="text-[11px] text-zinc-500 mb-0.5">Mission / Description</p>
                        <p className="text-xs text-zinc-300">{selectedApp.basics.mission}</p>
                      </div>
                    )}
                    {selectedApp.basics.intendedUse && (
                      <div className="pt-2 border-t border-zinc-800/80">
                        <p className="text-[11px] text-zinc-500 mb-0.5">Intended Use on ChainBudget</p>
                        <p className="text-xs text-zinc-300">{selectedApp.basics.intendedUse}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> Representative & Contact
                    </h3>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">Full Name:</span>
                        <span className="text-white font-medium">
                          {selectedApp.representative.fullName || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">Role / Title:</span>
                        <span className="text-zinc-200">
                          {selectedApp.representative.position || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">ID Presented:</span>
                        <span className="text-zinc-200 font-mono">
                          {selectedApp.representative.idType || "ID"} (••••
                          {selectedApp.representative.idLast4 || "—"})
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-zinc-500">Applicant Wallet:</span>
                        <span className="text-zinc-300 font-mono">
                          {shortAddr(selectedApp.applicant?.walletAddress)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 items-center">
                        <span className="text-zinc-500">Verified Email:</span>
                        <span className="text-zinc-200 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-emerald-400" />
                          {selectedApp.contact?.email || selectedApp.applicant?.email || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-zinc-800/80 space-y-1 text-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Principal Address
                      </p>
                      <p className="text-zinc-300">
                        {[
                          selectedApp.address.street,
                          selectedApp.address.barangay,
                          selectedApp.address.city,
                          selectedApp.address.province,
                          selectedApp.address.region,
                          selectedApp.address.postalCode,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Governance & Cryptographic Dossier */}
                <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Multi-Sig Governance & Co-Officers
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                        Quorum: <strong>{selectedApp.governance.requiredApprovals || 1}</strong> approver(s)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono">
                        High-Value: ₱{(selectedApp.governance.highValueThreshold || 10000).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {selectedApp.governance.officers && selectedApp.governance.officers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedApp.governance.officers.map((off, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800 text-xs flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium text-white">{off.name}</p>
                            <p className="text-[11px] text-zinc-400">
                              {off.roleLabel || "Officer"} · {off.email}
                            </p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            L{off.roleLevel}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      No additional co-officers listed (single-approver light governance).
                    </p>
                  )}

                  {selectedApp.dossierHash && (
                    <div className="pt-2.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-zinc-400">
                        Dossier Keccak-256:{" "}
                        <code className="text-zinc-200 font-mono">{selectedApp.dossierHash}</code>
                      </span>
                      {selectedApp.anchor?.txHash && (
                        <a
                          href={`https://amoy.polygonscan.com/tx/${selectedApp.anchor.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-mono"
                        >
                          <Link2 className="w-3 h-3" />
                          Anchored ({selectedApp.anchor.txHash.slice(0, 10)}…)
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 3: Encrypted Evidence Vault Documents */}
                <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Private Encrypted Evidence ({selectedApp.documents?.length || 0})
                    </h3>
                    <span className="text-[11px] text-zinc-500">
                      AES-256-GCM Encrypted · Every access is audit-logged
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(selectedApp.documents || []).map((doc) => {
                      const v = docVerdicts[doc.id] || {
                        status: doc.status === "rejected" ? "rejected" : "accepted",
                        reviewerNote: doc.reviewerNote || "",
                      };
                      return (
                        <div
                          key={doc.id}
                          className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-white">
                                {doc.label || doc.kind}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-400 font-mono mt-0.5">
                                <span>{doc.originalName || "evidence"} · {formatBytes(doc.size)} · SHA-256: {doc.sha256.slice(0, 12)}…</span>
                                {doc.ipfsCid && (
                                  <a
                                    href={`https://gateway.pinata.cloud/ipfs/${doc.ipfsCid}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    IPFS ({doc.ipfsCid.slice(0, 8)}…)
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenDocument(selectedApp.id, doc.id, doc.originalName)
                                }
                                disabled={openingDocId === doc.id}
                                className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {openingDocId === doc.id ? "Decrypting..." : "View Document"}
                              </button>

                              {canReview ? (
                                <div className="flex items-center rounded-md border border-zinc-700 overflow-hidden text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDocVerdicts((prev) => ({
                                        ...prev,
                                        [doc.id]: { ...v, status: "accepted" },
                                      }))
                                    }
                                    className={`px-2 py-1 font-medium transition-colors ${
                                      v.status === "accepted"
                                        ? "bg-emerald-500/20 text-emerald-300"
                                        : "bg-zinc-900 text-zinc-400 hover:text-white"
                                    }`}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDocVerdicts((prev) => ({
                                        ...prev,
                                        [doc.id]: { ...v, status: "rejected" },
                                      }));
                                      if (decision === "approve") setDecision("needs_info");
                                    }}
                                    className={`px-2 py-1 font-medium transition-colors ${
                                      v.status === "rejected"
                                        ? "bg-rose-500/20 text-rose-300"
                                        : "bg-zinc-900 text-zinc-400 hover:text-white"
                                    }`}
                                  >
                                    Flag / Reject
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                                    doc.status === "accepted"
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : doc.status === "rejected"
                                      ? "bg-rose-500/15 text-rose-300"
                                      : "bg-zinc-800 text-zinc-400"
                                  }`}
                                >
                                  {doc.status}
                                </span>
                              )}
                            </div>
                          </div>

                          {(canReview && v.status === "rejected") || doc.reviewerNote ? (
                            <div>
                              {canReview ? (
                                <input
                                  type="text"
                                  placeholder="Note for applicant explaining why this document needs replacement..."
                                  value={v.reviewerNote}
                                  onChange={(e) =>
                                    setDocVerdicts((prev) => ({
                                      ...prev,
                                      [doc.id]: { ...v, reviewerNote: e.target.value },
                                    }))
                                  }
                                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-rose-500/40 rounded text-xs text-white placeholder-zinc-500 focus:outline-none"
                                />
                              ) : (
                                <p className="text-[11px] text-rose-300">
                                  Note: {doc.reviewerNote}
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 4: Super-Admin Review Decision Form */}
                {canReview && (
                  <div className="bg-[#121215] border border-zinc-700 rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Verification Decision
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setDecision("approve")}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          decision === "approve"
                            ? "border-emerald-500 bg-emerald-500/10 text-white"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" /> Approve & Provision
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Creates verified Organization, seeds budgets, & anchors dossier hash on-chain.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecision("needs_info")}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          decision === "needs_info"
                            ? "border-orange-500 bg-orange-500/10 text-white"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-400">
                          <Clock className="w-4 h-4" /> Request Changes
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Unlocks application so the applicant can replace flagged documents & resubmit.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecision("reject")}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          decision === "reject"
                            ? "border-rose-500 bg-rose-500/10 text-white"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                          <XCircle className="w-4 h-4" /> Reject Application
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Declines the application and schedules encrypted evidence for retention cleanup.
                        </p>
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Message to Applicant{" "}
                        {decision !== "approve" && <span className="text-rose-400">*</span>}
                      </label>
                      <textarea
                        rows={3}
                        value={applicantMessage}
                        onChange={(e) => setApplicantMessage(e.target.value)}
                        placeholder={
                          decision === "approve"
                            ? "Optional welcome note or verification remarks..."
                            : "Explain clearly what documents or details need correction (min 10 chars)..."
                        }
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Internal Admin Notes (Super-Admin only, never shown to applicant)
                      </label>
                      <textarea
                        rows={2}
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="Internal verification trail notes (e.g., checked SEC CRS / OSAS roster)..."
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedApp(null)}
                        className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={submittingReview}
                        onClick={handleSubmitReview}
                        className={`px-5 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                          decision === "approve"
                            ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                            : decision === "needs_info"
                            ? "bg-orange-500 hover:bg-orange-400 text-zinc-950"
                            : "bg-rose-500 hover:bg-rose-400 text-white"
                        }`}
                      >
                        {submittingReview
                          ? "Processing..."
                          : decision === "approve"
                          ? "Confirm Approval & Provision Org"
                          : decision === "needs_info"
                          ? "Send Change Request"
                          : "Confirm Rejection"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Section 5: Application History Timeline */}
                {selectedApp.history && selectedApp.history.length > 0 && (
                  <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Application Timeline
                    </h3>
                    <div className="space-y-2.5">
                      {selectedApp.history.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-3 py-2 border-b border-zinc-800/70 last:border-b-0 text-xs"
                        >
                          <div>
                            <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                              {item.action}
                            </span>
                            {item.note && (
                              <p className="text-zinc-300 mt-1">{item.note}</p>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap">
                            {new Date(item.at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
