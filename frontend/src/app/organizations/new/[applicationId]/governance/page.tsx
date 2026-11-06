"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ShieldCheck,
  Users,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useOrgRegistration } from "@/context/OrgRegistrationContext";
import { OrgOfficer } from "@/lib/orgApplications";
import CustomSelect from "@/components/CustomSelect";

export default function GovernanceStepPage() {
  const { application, requirements, saveStep } = useOrgRegistration();
  const router = useRouter();

  const g = application?.governance || {};
  const defaults = requirements?.governance;

  const [requiredApprovals, setRequiredApprovals] = useState<number>(
    g.requiredApprovals ?? defaults?.defaultRequiredApprovals ?? 2
  );
  const [highValueThreshold, setHighValueThreshold] = useState<number>(
    g.highValueThreshold ?? defaults?.defaultHighValueThreshold ?? 10000
  );
  const [isPrivate, setIsPrivate] = useState<boolean>(Boolean(g.isPrivate));
  const [officers, setOfficers] = useState<OrgOfficer[]>(
    g.officers && g.officers.length > 0 ? g.officers : []
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!application || !requirements) return null;

  const isFamily = application.type === "family";
  const minOfficersNeeded = Math.max(0, requiredApprovals - 1);

  const addOfficer = () => {
    if (officers.length >= requirements.governance.maxOfficers) return;
    setOfficers((prev) => [
      ...prev,
      { name: "", email: "", roleLabel: "Treasurer", roleLevel: 2 },
    ]);
  };

  const updateOfficer = (
    idx: number,
    patch: Partial<OrgOfficer>
  ) => {
    setOfficers((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, ...patch } : o))
    );
  };

  const removeOfficer = (idx: number) => {
    setOfficers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const reqApp = Number(requiredApprovals);
    const minApp = requirements.governance.minRequiredApprovals || 1;
    const maxApp = requirements.governance.maxRequiredApprovals || 10;
    if (isNaN(reqApp) || reqApp < minApp || reqApp > maxApp) {
      errors.requiredApprovals = `Required approvals must be between ${minApp} and ${maxApp}.`;
    }

    const thresh = Number(highValueThreshold);
    if (isNaN(thresh) || thresh <= 0) {
      errors.highValueThreshold = "High-value threshold must be a positive number in PHP.";
    }

    // Quorum check: founder (1) + added officers >= required approvals
    if (officers.length + 1 < reqApp) {
      errors.officers = `Quorum requires ${reqApp} total signers. You currently have 1 founder + ${officers.length} officer(s). Add at least ${reqApp - (1 + officers.length)} more officer(s).`;
    }

    // Officer emails uniqueness & validity
    const applicantEmail = application.contact.email?.toLowerCase();
    const seenEmails = new Set<string>();
    if (applicantEmail) seenEmails.add(applicantEmail);

    officers.forEach((o, i) => {
      if (!o.name.trim() || o.name.trim().length < 2) {
        errors[`officers.${i}.name`] = "Officer full name is required (min 2 chars).";
      }
      const emailLower = o.email.trim().toLowerCase();
      if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailLower)) {
        errors[`officers.${i}.email`] = "Enter a valid email address.";
      } else if (seenEmails.has(emailLower)) {
        errors[`officers.${i}.email`] =
          emailLower === applicantEmail
            ? "Officer email cannot be the same as the applicant email."
            : "Duplicate officer email address.";
      } else {
        seenEmails.add(emailLower);
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please resolve governance and officer errors.");
      return;
    }

    setSaving(true);
    setFieldErrors({});

    const res = await saveStep("governance", {
      requiredApprovals: Number(requiredApprovals),
      highValueThreshold: Number(highValueThreshold),
      isPrivate,
      officers,
    });

    setSaving(false);

    if (!res.ok) {
      setFieldErrors(res.fields || {});
      toast.error(res.errorMessage || "Please check the governance fields.");
      return;
    }

    toast.success("Governance configuration saved.");
    router.push(`/organizations/new/${application.id}/review`);
  };

  const err = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-xs text-rose-400 mt-1">{fieldErrors[key]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Multi-Sig Rules Card */}
      <div className="bg-surface border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Step 4 · {isFamily ? "Family Treasury Governance & Multi-Sig Rules" : "Treasury Governance & Multi-Sig Rules"}
            </h2>
            <p className="text-xs text-zinc-400">
              {isFamily
                ? "Configure how many family co-signers must approve household disbursements."
                : "Configure the approval quorum and high-value disbursement threshold."}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Required Approvals (M-of-N Quorum) *
            </label>
            <input
              type="number"
              required
              min={requirements.governance.minRequiredApprovals}
              max={requirements.governance.maxRequiredApprovals}
              value={requiredApprovals}
              onChange={(e) => setRequiredApprovals(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Number of officer sign-offs needed before a transaction is anchored on-chain.
            </p>
            {err("requiredApprovals")}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              High-Value Threshold (₱ PHP) *
            </label>
            <input
              type="number"
              required
              min={1}
              value={highValueThreshold}
              onChange={(e) => setHighValueThreshold(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Disbursements above this amount require full executive quorum and escrow controls.
            </p>
            {err("highValueThreshold")}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-white">
              Private Organization Ledger
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              When enabled, detailed transaction descriptions are visible only to authenticated members.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
              isPrivate ? "bg-indigo-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isPrivate ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Initial Co-Officers Card */}
      <div className="bg-surface border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isFamily ? "Initial Family Approvers & Members" : "Initial Co-Officers & Approvers"}
              </h3>
              <p className="text-xs text-zinc-400">
                You are automatically Approver #1 (Founder).{" "}
                {minOfficersNeeded > 0
                  ? `Add at least ${minOfficersNeeded} additional ${isFamily ? "family co-approver(s)" : "officer(s)"} to satisfy your ${requiredApprovals}-approval quorum.`
                  : isFamily
                  ? "You may optionally list additional family members to invite upon approval."
                  : "You may optionally list additional officers to invite upon approval."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={addOfficer}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {isFamily ? "Add Family Member" : "Add Officer"}
          </button>
        </div>

        {err("officers")}

        {officers.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-900/50 border border-dashed border-zinc-800 text-center text-xs text-zinc-400">
            {isFamily ? "No additional family members listed yet." : "No additional officers listed yet."}{" "}
            {minOfficersNeeded > 0 && (
              <span className="text-amber-300 font-medium">
                Click &ldquo;{isFamily ? "Add Family Member" : "Add Officer"}&rdquo; above to add at least {minOfficersNeeded}{" "}
                co-approver(s).
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {officers.map((officer, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">
                    {isFamily ? `Family Member #${i + 2}` : `Officer #${i + 2}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOfficer(i)}
                    className="text-xs text-zinc-400 hover:text-rose-400 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>

                <div className="grid sm:grid-cols-4 gap-3">
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Full Name *"
                      value={officer.name}
                      onChange={(e) =>
                        updateOfficer(i, { name: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500"
                    />
                    {err(`officers.${i}.name`)}
                  </div>

                  <div>
                    <input
                      type="email"
                      required
                      placeholder="Email Address *"
                      value={officer.email}
                      onChange={(e) =>
                        updateOfficer(i, { email: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500"
                    />
                    {err(`officers.${i}.email`)}
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder={isFamily ? "Role in Family (e.g. Mother, Father, Spouse)" : "Title (e.g. Treasurer)"}
                      value={officer.roleLabel || ""}
                      onChange={(e) =>
                        updateOfficer(i, { roleLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500"
                    />
                    {err(`officers.${i}.roleLabel`)}
                  </div>

                  <div>
                    <CustomSelect
                      size="sm"
                      value={String(officer.roleLevel)}
                      onChange={(val) =>
                        updateOfficer(i, { roleLevel: Number(val) })
                      }
                      options={requirements.governance.officerRoles.map((r) => ({
                        value: String(r.level),
                        label: `Level ${r.level} · ${r.label}`,
                      }))}
                    />
                    {err(`officers.${i}.roleLevel`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            router.push(`/organizations/new/${application.id}/documents`)
          }
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous Step
        </button>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-sm inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span>{saving ? "Saving..." : "Save & Review Application"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
