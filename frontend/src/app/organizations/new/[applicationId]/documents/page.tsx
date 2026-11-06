"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  FileCheck2,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowLeft,
  ArrowRight,
  FileText,
} from "lucide-react";
import { useOrgRegistration } from "@/context/OrgRegistrationContext";
import api from "@/lib/api";
import { OrgApplicationView } from "@/lib/orgApplications";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getPillarInfo(group: { id: string; kinds: string[]; label: string }) {
  if (
    group.id.startsWith("rep_") ||
    group.kinds.some((k) => k.includes("id") || k.includes("selfie"))
  ) {
    return {
      pillarNum: 3,
      pillarName: "Pillar 3: Signatory Identity (KYC)",
      pillarTag: "Signatory KYC",
      pillarDesc: "Official identification of authorized signing officers",
      badgeClass: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    };
  }
  if (
    group.id.includes("authorization") ||
    group.id.includes("resolution") ||
    group.id.includes("certification") ||
    group.kinds.some(
      (k) =>
        k.includes("resolution") ||
        k.includes("endorsement") ||
        k.includes("authorization") ||
        k.includes("plan")
    )
  ) {
    return {
      pillarNum: 2,
      pillarName: "Pillar 2: Signatory Authority",
      pillarTag: "Signatory Authority",
      pillarDesc: "Council/Board resolution or adviser appointment letter",
      badgeClass: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    };
  }
  return {
    pillarNum: 1,
    pillarName: "Pillar 1: Institutional Existence",
    pillarTag: "Institutional Existence",
    pillarDesc: "Official government or university accreditation charter",
    badgeClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  };
}

export default function DocumentsStepPage() {
  const { application, requirements, setApplication } = useOrgRegistration();
  const router = useRouter();

  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  if (!application || !requirements) return null;

  const handleUploadFile = async (
    kind: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > requirements.documents.maxFileSizeBytes) {
      toast.error("File exceeds the 5 MB maximum limit.");
      return;
    }

    setUploadingKind(kind);
    try {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("file", file);

      const res = await api.post<OrgApplicationView>(
        `/org-applications/${application.id}/documents`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setApplication(res.data);
      toast.success("Document encrypted and stored in private vault.");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      toast.error(
        apiErr.response?.data?.error || "Failed to upload document."
      );
    } finally {
      setUploadingKind(null);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingDocId(docId);
    try {
      const res = await api.delete<OrgApplicationView>(
        `/org-applications/${application.id}/documents/${docId}`
      );
      setApplication(res.data);
      toast.success("Document removed.");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      toast.error(
        apiErr.response?.data?.error || "Failed to delete document."
      );
    } finally {
      setDeletingDocId(null);
    }
  };

  const checklist = application.documentChecklist || [];
  const allSatisfied =
    checklist.length > 0 && checklist.every((g) => g.satisfied);

  const pillar1Groups = checklist.filter((g) => getPillarInfo(g).pillarNum === 1);
  const pillar2Groups = checklist.filter((g) => getPillarInfo(g).pillarNum === 2);
  const pillar3Groups = checklist.filter((g) => getPillarInfo(g).pillarNum === 3);

  const p1Satisfied = pillar1Groups.length > 0 && pillar1Groups.every((g) => g.satisfied);
  const p2Satisfied = pillar2Groups.length > 0 && pillar2Groups.every((g) => g.satisfied);
  const p3Satisfied = pillar3Groups.length > 0 && pillar3Groups.every((g) => g.satisfied);

  return (
    <div className="space-y-6">
      {/* Header & 3-Pillar Security Notice */}
      <div className="bg-surface border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Step 3 · Verification Evidence Vault
              </h2>
              <p className="text-xs text-zinc-400">
                Upload clear scans or photos for your {requirements.label} under the 3-Pillar Framework.
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full border self-start sm:self-center ${
              allSatisfied
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-300 border-amber-500/20"
            }`}
          >
            {checklist.filter((g) => g.satisfied).length} / {checklist.length} Groups Complete
          </span>
        </div>

        {/* 3 Pillars Status Bar */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className={`p-3 rounded-xl border flex items-center justify-between ${p1Satisfied ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-zinc-900/60 border-zinc-800 text-zinc-400"}`}>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider">Pillar 1: Existence</div>
              <div className="text-xs font-semibold text-white mt-0.5">Charter / Accreditation</div>
            </div>
            {p1Satisfied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
          </div>

          <div className={`p-3 rounded-xl border flex items-center justify-between ${p2Satisfied ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-zinc-900/60 border-zinc-800 text-zinc-400"}`}>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider">Pillar 2: Authority</div>
              <div className="text-xs font-semibold text-white mt-0.5">Resolution / Endorsement</div>
            </div>
            {p2Satisfied ? <CheckCircle2 className="w-4 h-4 text-blue-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
          </div>

          <div className={`p-3 rounded-xl border flex items-center justify-between ${p3Satisfied ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-zinc-900/60 border-zinc-800 text-zinc-400"}`}>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider">Pillar 3: Signatory KYC</div>
              <div className="text-xs font-semibold text-white mt-0.5">Signatory IDs & Selfie</div>
            </div>
            {p3Satisfied ? <CheckCircle2 className="w-4 h-4 text-purple-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-start gap-2.5 text-xs text-zinc-300">
          <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-indigo-400">Hybrid Privacy & IPFS Provenance:</strong>{" "}
            Documents are encrypted at rest with AES-256-GCM and securely pinned to Pinata IPFS. Only verified hashes are anchored to the Polygon Amoy blockchain.
          </div>
        </div>
      </div>

      {/* Document Checklist Groups */}
      <div className="space-y-4">
        {checklist.map((group) => {
          const groupDocs = application.documents.filter((d) =>
            group.kinds.includes(d.kind)
          );
          const pillar = getPillarInfo(group);

          return (
            <div
              key={group.id}
              className={`bg-surface border rounded-2xl p-5 space-y-4 transition-colors ${
                group.satisfied ? "border-emerald-500/30" : "border-zinc-800"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {group.satisfied ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${pillar.badgeClass}`}>
                        {pillar.pillarTag}
                      </span>
                      <h3 className="text-sm font-bold text-white">
                        {group.label}
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {group.kinds.length > 1
                        ? "Upload at least ONE of the accepted document types below."
                        : "Mandatory requirement under Philippine verification standards."}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full self-start ${
                    group.satisfied
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                  }`}
                >
                  {group.satisfied ? "Satisfied" : "Required"}
                </span>
              </div>

              {/* Upload Controls per Kind in Group */}
              <div className="grid sm:grid-cols-2 gap-3">
                {group.kinds.map((kind) => {
                  const spec = requirements.documents.kinds[kind];
                  if (!spec) return null;
                  const existingForKind = application.documents.filter(
                    (d) => d.kind === kind
                  );
                  const canUploadMore =
                    spec.maxPerKind === 1 ||
                    existingForKind.length < spec.maxPerKind;
                  const isUploading = uploadingKind === kind;

                  return (
                    <div
                      key={kind}
                      className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-200 truncate">
                          {kind === "rep_id_front" && application.representative?.idType === "school_id"
                            ? "Institutional / School ID (front)"
                            : spec.label}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {spec.mimes
                            .map((m) => m.split("/")[1].toUpperCase())
                            .join(", ")}{" "}
                          · Max {spec.maxPerKind}{" "}
                          {spec.maxPerKind === 1 ? "file (replaces)" : "files"}
                        </div>
                      </div>

                      {canUploadMore && (
                        <label
                          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isUploading
                              ? "bg-zinc-800 text-zinc-400"
                              : "bg-indigo-600 hover:bg-indigo-500 text-white"
                          }`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {isUploading
                              ? "Encrypting..."
                              : existingForKind.length > 0 &&
                                spec.maxPerKind === 1
                              ? "Replace"
                              : "Upload"}
                          </span>
                          <input
                            type="file"
                            accept={spec.mimes.join(",")}
                            disabled={isUploading}
                            onChange={(e) => handleUploadFile(kind, e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Attached Documents in this Group */}
              {groupDocs.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  {groupDocs.map((doc) => {
                    const spec = requirements.documents.kinds[doc.kind];
                    return (
                      <div
                        key={doc.id}
                        className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {doc.originalName || spec?.label || doc.kind}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono truncate flex items-center gap-2 flex-wrap">
                              <span>{formatBytes(doc.size)} · SHA-256: {doc.sha256.slice(0, 14)}…</span>
                              {doc.ipfsCid && (
                                <a
                                  href={`https://gateway.pinata.cloud/ipfs/${doc.ipfsCid}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono transition-colors"
                                  title="View on Pinata IPFS Gateway"
                                >
                                  <span>CID: {doc.ipfsCid.slice(0, 10)}…</span>
                                </a>
                              )}
                            </div>
                            {doc.reviewerNote && (
                              <div className="text-[11px] text-rose-400 mt-1">
                                Reviewer note: {doc.reviewerNote}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={deletingDocId === doc.id}
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                          title="Remove document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            router.push(
              `/organizations/new/${application.id}/representative`
            )
          }
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous Step
        </button>

        <button
          type="button"
          onClick={() =>
            router.push(`/organizations/new/${application.id}/governance`)
          }
          className="px-6 py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>Continue to Governance</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
