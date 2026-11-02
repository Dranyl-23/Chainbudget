"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowLeft,
  Send,
  Edit3,
} from "lucide-react";
import { useOrgRegistration } from "@/context/OrgRegistrationContext";
import api from "@/lib/api";
import { OrgApplicationView } from "@/lib/orgApplications";

export default function ReviewAndSubmitStepPage() {
  const { application, requirements, saveStep, setApplication } =
    useOrgRegistration();
  const router = useRouter();

  const [acceptTerms, setAcceptTerms] = useState(
    Boolean(application?.consentsAccepted)
  );
  const [acceptPrivacy, setAcceptPrivacy] = useState(
    Boolean(application?.consentsAccepted)
  );
  const [acceptAccuracy, setAcceptAccuracy] = useState(
    Boolean(application?.consentsAccepted)
  );

  const [submitting, setSubmitting] = useState(false);
  const [missingItems, setMissingItems] = useState<
    Array<{ step: string; message: string }>
  >([]);

  if (!application || !requirements) return null;

  const docsDone = application.documentChecklist.every((g) => g.satisfied);
  const emailDone = application.contact.emailVerified;
  const stepsDone = ["details", "representative", "governance"].every((s) =>
    application.completedSteps.includes(s as never)
  );

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms || !acceptPrivacy || !acceptAccuracy) {
      toast.error("Please accept all three declarations before submitting.");
      return;
    }

    setSubmitting(true);
    setMissingItems([]);

    // 1. Save the review consents step
    const stepRes = await saveStep("review", {
      acceptTerms,
      acceptPrivacy,
      acceptAccuracy,
    });

    if (!stepRes.ok) {
      setSubmitting(false);
      toast.error(
        stepRes.errorMessage || "Please confirm the required declarations."
      );
      return;
    }

    // 2. Submit the application for review
    try {
      const res = await api.post<OrgApplicationView>(
        `/org-applications/${application.id}/submit`
      );
      setApplication(res.data);
      toast.success("Application submitted for verification!");
      router.push(`/organizations/new/${application.id}/status`);
    } catch (err: unknown) {
      const apiErr = err as {
        response?: {
          data?: {
            error?: string;
            missing?: Array<{ step: string; message: string }>;
          };
        };
      };
      if (apiErr.response?.data?.missing) {
        setMissingItems(apiErr.response.data.missing);
      }
      toast.error(
        apiErr.response?.data?.error || "Application is not yet complete."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmitApplication} className="space-y-6">
      {/* Readiness Alert if anything is missing */}
      {(!stepsDone || !docsDone || !emailDone || missingItems.length > 0) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Complete these items before submitting:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-100/90 space-y-1">
            {!application.completedSteps.includes("details") && (
              <li>
                Save Step 1 (
                <Link
                  href={`/organizations/new/${application.id}/details`}
                  className="underline font-semibold"
                >
                  Organization details
                </Link>
                )
              </li>
            )}
            {!application.completedSteps.includes("representative") && (
              <li>
                Save Step 2 (
                <Link
                  href={`/organizations/new/${application.id}/representative`}
                  className="underline font-semibold"
                >
                  Representative identity
                </Link>
                )
              </li>
            )}
            {!emailDone && (
              <li>
                Verify your official contact email via 6-digit OTP in{" "}
                <Link
                  href={`/organizations/new/${application.id}/representative`}
                  className="underline font-semibold"
                >
                  Step 2
                </Link>
              </li>
            )}
            {!docsDone && (
              <li>
                Upload all required document groups in{" "}
                <Link
                  href={`/organizations/new/${application.id}/documents`}
                  className="underline font-semibold"
                >
                  Step 3
                </Link>
              </li>
            )}
            {!application.completedSteps.includes("governance") && (
              <li>
                Save Step 4 (
                <Link
                  href={`/organizations/new/${application.id}/governance`}
                  className="underline font-semibold"
                >
                  Governance rules
                </Link>
                )
              </li>
            )}
            {missingItems.map((m, i) => (
              <li key={i}>{m.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Cards */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Step 5 · Review Verification Dossier
            </h2>
            <p className="text-xs text-zinc-400">
              Confirm your organization details before generating the cryptographic dossier commitment.
            </p>
          </div>
        </div>

        {/* Section 1: Details */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              1. Organization Details & Affiliation
            </h3>
            <Link
              href={`/organizations/new/${application.id}/details`}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-zinc-500">Display Name:</span>{" "}
              <span className="text-white font-medium">
                {application.basics.displayName || "—"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Legal Name:</span>{" "}
              <span className="text-white font-medium">
                {application.basics.legalName || "—"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Registration No.:</span>{" "}
              <span className="text-white font-mono">
                {application.basics.registrationNumber || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Location:</span>{" "}
              <span className="text-white">
                {[
                  application.address.barangay,
                  application.address.city,
                  application.address.province,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </span>
            </div>
          </div>

          {/* Captured Affiliation Metadata */}
          {application.basics.extras && Object.keys(application.basics.extras).length > 0 && (
            <div className="pt-2 border-t border-zinc-800/80">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Institutional Affiliation Metadata
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(application.basics.extras).map(([k, val]) => (
                  <div key={k} className="truncate">
                    <span className="text-zinc-500 capitalize">{k.replace(/([A-Z])/g, " $1")}:</span>{" "}
                    <span className="text-indigo-300 font-medium">{String(val) || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Representative */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              2. Representative & Contact
            </h3>
            <Link
              href={`/organizations/new/${application.id}/representative`}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-zinc-500">Representative:</span>{" "}
              <span className="text-white font-medium">
                {application.representative.fullName || "—"} (
                {application.representative.position || "—"})
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Government ID:</span>{" "}
              <span className="text-white font-mono">
                {application.representative.idType || "—"} · ••••
                {application.representative.idLast4 || "—"}
              </span>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <span className="text-zinc-500">Official Email:</span>{" "}
              <span className="text-white">
                {application.contact.email || "—"}
              </span>
              {application.contact.emailVerified ? (
                <span className="text-[11px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> OTP Verified
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 font-semibold">
                  Not Verified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Documents with IPFS CIDs */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              3. Verification Dossier ({application.documents.length} files attached)
            </h3>
            <Link
              href={`/organizations/new/${application.id}/documents`}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </Link>
          </div>
          <ul className="space-y-2 text-xs">
            {application.documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-zinc-300 p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-medium text-white truncate">
                    {requirements.documents.kinds[d.kind]?.label || d.kind}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  {d.ipfsCid ? (
                    <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      IPFS: {d.ipfsCid.slice(0, 10)}…
                    </span>
                  ) : (
                    <span>sha256:{d.sha256.slice(0, 10)}…</span>
                  )}
                  <span className="text-emerald-400 text-[10px]">🔒 Vault Encrypted</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Section 4: Governance */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              4. Governance & Officers
            </h3>
            <Link
              href={`/organizations/new/${application.id}/governance`}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-zinc-500">Quorum:</span>{" "}
              <span className="text-white font-semibold">
                {application.governance.requiredApprovals || 2} approvals
              </span>
            </div>
            <div>
              <span className="text-zinc-500">High-Value Threshold:</span>{" "}
              <span className="text-white font-semibold">
                ₱
                {(
                  application.governance.highValueThreshold || 10000
                ).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Co-Officers Listed:</span>{" "}
              <span className="text-white font-semibold">
                {application.governance.officers?.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Soulbound Token & Amoy Anchoring Banner */}
        <div className="p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 leading-relaxed">
            <strong className="text-white">Dual On-Chain Attestation:</strong> Upon approval by SuperAdmin review, an immutable record will be anchored on <span className="text-indigo-400 font-mono font-semibold">OrgRegistry.sol (Polygon Amoy)</span> and a non-transferable Soulbound Token (<span className="text-indigo-400 font-mono font-semibold">CB-SBT</span>) will be minted to certify your institutional officer standing.
          </div>
        </div>
      </div>

      {/* Consents & Declarations Card */}
      <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">
          Mandatory Legal & Data Privacy Declarations
        </h3>

        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptAccuracy}
            onChange={(e) => setAcceptAccuracy(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs text-zinc-300 leading-relaxed">
            <strong>Declaration of Authenticity:</strong> I certify under penalty
            of perjury and platform revocation that all submitted registration
            certificates, government IDs, and officer authorizations are true,
            valid, and unaltered.
          </span>
        </label>

        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs text-zinc-300 leading-relaxed">
            <strong>Data Privacy Consent (RA 10173):</strong> I consent to the
            encrypted processing and verification review of the uploaded
            evidence in accordance with the Philippine Data Privacy Act of 2012.
            I understand that only a salted cryptographic hash (`dossierHash`)
            will be recorded on the Polygon blockchain.
          </span>
        </label>

        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs text-zinc-300 leading-relaxed">
            <strong>Terms of Governance:</strong> I agree to the ChainBudget
            Institutional Treasury Terms and multi-signature accountability rules.
          </span>
        </label>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            router.push(`/organizations/new/${application.id}/governance`)
          }
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous Step
        </button>

        <button
          type="submit"
          disabled={
            submitting || !acceptTerms || !acceptPrivacy || !acceptAccuracy
          }
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>
            {submitting
              ? "Submitting Dossier..."
              : application.status === "needs_info"
              ? "Resubmit Updated Application"
              : "Submit for Verification"}
          </span>
        </button>
      </div>
    </form>
  );
}
