"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useOrgRegistration } from "@/context/OrgRegistrationContext";
import { useAuth } from "@/context/AuthContext";
import { formatStatusLabel } from "@/lib/orgApplications";

export default function ApplicationStatusPage() {
  const { application, requirements, reload } = useOrgRegistration();
  const { setActiveOrgId, refreshUser } = useAuth();
  const router = useRouter();

  if (!application || !requirements) return null;

  const handleOpenDashboard = async () => {
    if (application.organization) {
      await refreshUser();
      setActiveOrgId(application.organization);
    }
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6">
      {/* Status Banner Card */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                application.status === "approved"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : application.status === "needs_info"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : application.status === "rejected" ||
                    application.status === "revoked"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
              }`}
            >
              {application.status === "approved" ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : application.status === "needs_info" ? (
                <AlertTriangle className="w-6 h-6" />
              ) : application.status === "rejected" ||
                application.status === "revoked" ? (
                <XCircle className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {requirements.label} · Revision v{application.revision}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                {application.basics.displayName || "Organization Application"}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Current Status:{" "}
                <strong className="text-white">
                  {formatStatusLabel(application.status)}
                </strong>
                {application.submittedAt &&
                  ` · Submitted ${new Date(
                    application.submittedAt
                  ).toLocaleString()}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void reload()}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Status
          </button>
        </div>

        {/* Status-Specific Explanation & Call to Action */}
        {(application.status === "submitted" ||
          application.status === "under_review") && (
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-zinc-200 space-y-2 leading-relaxed">
            <div className="font-bold text-indigo-300">
              Your verification dossier is in the review queue
            </div>
            <p className="text-zinc-300">
              A platform verifier will inspect your registration certificates,
              representative ID, and authorization resolution. Once approved,
              your organization workspace will be provisioned automatically and
              anchored on Polygon Amoy.
            </p>
          </div>
        )}

        {application.status === "needs_info" && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="text-xs font-bold text-amber-300">
              Action Required from Reviewer:
            </div>
            <p className="text-xs text-amber-100 leading-relaxed">
              {application.review.applicantMessage ||
                "Please update the highlighted fields or documents and resubmit."}
            </p>
            <Link
              href={`/organizations/new/${application.id}/details`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs transition-colors"
            >
              <span>Edit & Resubmit Application</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {application.status === "approved" && (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-base font-bold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Verified Entity · Legitimacy Confirmed</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Your organization has passed all 3 verification pillars (Institutional Existence, Signatory Authority, KYC). Your workspace has been provisioned and your Soulbound Token (CB-SBT) is active.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenDashboard}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-emerald-500/20 transition-colors"
              >
                <span>Open Organization Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {application.anchor?.txHash && (
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-zinc-400">Polygon Amoy Attestation:</span>
                  <span className="font-mono text-zinc-200 truncate">{application.anchor.txHash}</span>
                </div>
                <a
                  href={`https://amoy.polygonscan.com/tx/${application.anchor.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors shrink-0"
                >
                  <span>View on PolygonScan ↗</span>
                </a>
              </div>
            )}
          </div>
        )}

        {(application.status === "rejected" ||
          application.status === "revoked") && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2 text-xs">
            <div className="font-bold text-rose-300">
              Reviewer Decision Notice:
            </div>
            <p className="text-rose-100/90 leading-relaxed">
              {application.review.applicantMessage ||
                "This application did not pass verification review."}
            </p>
          </div>
        )}
      </div>

      {/* Submitted Dossier Snapshot */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white">
          Submitted Dossier Snapshot
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <div className="text-zinc-500">Legal Name</div>
            <div className="text-white font-medium">
              {application.basics.legalName || "—"}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <div className="text-zinc-500">Registration Number</div>
            <div className="text-white font-mono">
              {application.basics.registrationNumber || "N/A"}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <div className="text-zinc-500">Representative</div>
            <div className="text-white font-medium">
              {application.representative.fullName || "—"} (
              {application.representative.position || "—"})
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <div className="text-zinc-500">Encrypted Evidence Files</div>
            <div className="text-white font-medium">
              {application.documents.length} attached & verified
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
