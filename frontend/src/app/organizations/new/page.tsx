"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  Building2,
  ShieldCheck,
  FileCheck2,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  OrgTypeSummary,
  OrgRequirements,
  MyOrgApplicationSummary,
  OrgApplicationView,
  formatStatusLabel,
  isEditableStatus,
  PHILIPPINE_ORG_CATEGORIES,
} from "@/lib/orgApplications";

interface RequirementsOverviewResponse {
  version: string;
  types: OrgTypeSummary[];
}

export default function NewOrganizationStartPage() {
  const { user, isConnected, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [types, setTypes] = useState<OrgTypeSummary[]>([]);
  const [myApps, setMyApps] = useState<MyOrgApplicationSummary[]>([]);
  const [selectedType, setSelectedType] = useState<string>("student_org");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [previewReq, setPreviewReq] = useState<OrgRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isConnected) {
      router.push("/");
    }
  }, [authLoading, isConnected, router]);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;

    Promise.all([
      api.get<RequirementsOverviewResponse>("/org-applications/requirements"),
      api.get<MyOrgApplicationSummary[]>("/org-applications/mine"),
    ])
      .then(([reqRes, mineRes]) => {
        if (cancelled) return;
        const loadedTypes = reqRes.data.types || [];
        setTypes(loadedTypes);
        setMyApps(mineRes.data || []);
        if (loadedTypes.length > 0) {
          setSelectedType((prev) => prev || loadedTypes[0].type);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load organization requirements:", err);
        toast.error("Failed to load registration requirements.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  useEffect(() => {
    if (!selectedType || !isConnected) return;
    let cancelled = false;
    api
      .get<OrgRequirements>(
        `/org-applications/requirements?type=${encodeURIComponent(selectedType)}`
      )
      .then((res) => {
        if (!cancelled) setPreviewReq(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedType, isConnected]);

  const handleStartApplication = async () => {
    if (!user?.walletAddress) {
      toast.error("Please link your wallet before registering an organization.");
      return;
    }
    setStarting(true);
    try {
      const res = await api.post<OrgApplicationView>("/org-applications", {
        type: selectedType,
      });
      toast.success("Draft application created.");
      router.push(`/organizations/new/${res.data.id}/details`);
    } catch (err: unknown) {
      const apiErr = err as {
        response?: {
          status?: number;
          data?: { error?: string; applicationId?: string };
        };
      };
      if (apiErr.response?.status === 409 && apiErr.response.data?.applicationId) {
        toast("Resuming your existing application for this type.");
        router.push(`/organizations/new/${apiErr.response.data.applicationId}`);
        return;
      }
      toast.error(
        apiErr.response?.data?.error || "Could not start application."
      );
      setStarting(false);
    }
  };

  const handleDiscardDraft = async (id: string) => {
    setDiscardingId(id);
    try {
      await api.delete(`/org-applications/${id}`);
      setMyApps((prev) => prev.filter((a) => a.id !== id));
      toast.success("Draft discarded.");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      toast.error(apiErr.response?.data?.error || "Failed to discard draft.");
    } finally {
      setDiscardingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
          <p className="text-xs text-zinc-400">Loading verification portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      {/* Top Bar */}
      <header className="border-b border-zinc-800/80 bg-[#0c0c0f]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="flex items-center gap-2">
              <Image
                src="/images/logo.png"
                alt="ChainBudget"
                width={24}
                height={24}
                unoptimized
                className="w-6 h-6 rounded-md"
              />
              <span className="text-sm font-semibold text-white">
                Organization Verification & Registration
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5" />
            <span>AES-256-GCM Private Document Vault</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {/* Existing Applications Section */}
        {myApps.length > 0 && (
          <section className="bg-[#121215] border border-zinc-800 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Your Organization Applications
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Resume an in-progress draft or check the verification status of submitted applications.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {myApps.map((app) => {
                const editable = isEditableStatus(app.status);
                const typeLabel =
                  types.find((t) => t.type === app.type)?.label || app.type;
                const targetHref = editable
                  ? `/organizations/new/${app.id}/${app.currentStep || "details"}`
                  : `/organizations/new/${app.id}/status`;

                return (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-medium text-zinc-400">
                          {typeLabel}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            app.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : app.status === "needs_info"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : app.status === "rejected" || app.status === "revoked"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                          }`}
                        >
                          {formatStatusLabel(app.status)}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-white truncate">
                        {app.displayName || "Untitled Organization Draft"}
                      </h3>

                      <p className="text-[11px] text-zinc-500 mt-1">
                        Steps completed: {app.completedSteps.length} / 5 · Revision v{app.revision}
                      </p>

                      {app.applicantMessage && (
                        <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{app.applicantMessage}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                      <Link
                        href={targetHref}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {editable ? "Resume Application" : "View Status"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      {app.status === "draft" && (
                        <button
                          type="button"
                          disabled={discardingId === app.id}
                          onClick={() => handleDiscardDraft(app.id)}
                          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-rose-400 px-2 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {discardingId === app.id ? "Discarding..." : "Discard"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Hero & Category Picker */}
        <section className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left: Organization Type Selection */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Step 0 · Philippine Legitimacy Framework
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Register & Verify Your Organization
              </h1>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                Verification is anchored on three core pillars: <strong>Proof of Institutional Existence</strong>, <strong>Proof of Signatory Authority</strong>, and <strong>Signatory Identity (KYC)</strong>. Select your entity category below to review requirements.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === "all"
                    ? "bg-white text-zinc-950 shadow-md shadow-white/10"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                All Categories (10)
              </button>
              {PHILIPPINE_ORG_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeCategory === cat.key
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  {cat.title}
                </button>
              ))}
            </div>

            {!user?.walletAddress && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  You must link a wallet to your account before creating an organization application.
                </span>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {types
                .filter((t) => {
                  if (activeCategory === "all") return true;
                  const catMatch = PHILIPPINE_ORG_CATEGORIES.find((c) => c.key === activeCategory);
                  return catMatch ? catMatch.types.includes(t.type) : true;
                })
                .map((t) => {
                  const isSelected = selectedType === t.type;
                  return (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setSelectedType(t.type)}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-950/30"
                          : "bg-[#121215] border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                            <Building2
                              className={`w-4 h-4 ${
                                isSelected ? "text-indigo-400" : "text-zinc-400"
                              }`}
                            />
                          </div>
                          <span
                            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                              t.tier === "standard"
                                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                : "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {t.tier === "standard" ? "Standard" : "Light"}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{t.label}</h3>
                        {t.governingBody && (
                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                            {t.governingBody}
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2.5 pt-2 border-t border-zinc-800/60">
                        {t.requiredDocumentCount} required document {t.requiredDocumentCount === 1 ? "group" : "groups"}
                        {t.registrationRequired ? " · Reg. ID required" : ""}
                      </p>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Right: Live Requirements Preview Card */}
          <div className="lg:col-span-5 bg-[#121215] border border-zinc-800 rounded-2xl p-6 sticky top-24 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold">
                  3-Pillar Verification Preview
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {previewReq?.label || "Loading..."}
                </h2>
                {previewReq?.governingBody && (
                  <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                    Governing Body: <span className="text-zinc-300">{previewReq.governingBody}</span>
                  </p>
                )}
              </div>
              <ShieldCheck className="w-7 h-7 text-indigo-400 shrink-0" />
            </div>

            {previewReq && (
              <>
                <div className="space-y-3 text-xs">
                  {/* Pillar 1 & Legal Registration */}
                  <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1.5">
                    <div className="font-semibold text-zinc-200 flex items-center justify-between">
                      <span>Pillar 1: Institutional Existence</span>
                      <span className="text-[10px] text-zinc-400 font-normal uppercase">Accreditation</span>
                    </div>
                    <p className="text-zinc-400">
                      {previewReq.details.registrationRequired ? (
                        <>
                          Mandatory:{" "}
                          <strong className="text-white">
                            {previewReq.details.registrationLabel}
                          </strong>
                        </>
                      ) : (
                        <>
                          Reference:{" "}
                          <span className="text-zinc-300">
                            {previewReq.details.registrationLabel}
                          </span>
                        </>
                      )}
                    </p>
                    {previewReq.representative.emailDomainSuffixes.length > 0 && (
                      <p className="text-amber-300 pt-1">
                        Official email must end with{" "}
                        <strong>
                          {previewReq.representative.emailDomainSuffixes.join(
                            " or "
                          )}
                        </strong>
                      </p>
                    )}
                  </div>

                  {/* Pillars 2 & 3: Evidence Checklist */}
                  <div>
                    <div className="font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-indigo-400" />
                      Required Verification Dossier ({previewReq.documents.groups.length} groups)
                    </div>
                    <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {previewReq.documents.groups.map((g) => (
                        <li
                          key={g.id}
                          className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/60"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-zinc-200 font-medium">
                              {g.label}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {g.kinds.length > 1
                                ? "Accepted official certificates or resolutions"
                                : "Mandatory upload (PDF, PNG, JPEG, WebP · max 5 MB)"}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-[11px] text-zinc-300 leading-relaxed space-y-1">
                  <div className="text-indigo-400 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>IPFS Provenance & Soulbound Token (SBT)</span>
                  </div>
                  <p>
                    Evidence is encrypted at rest in your private vault and pinned to Pinata IPFS for immutable provenance. Approved organizations earn the <strong>✓ Verified Entity</strong> badge, on-chain <strong>OrgRegistry</strong> attestation, and a non-transferable <strong>Soulbound Token (SBT)</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleStartApplication}
                  disabled={starting || !user?.walletAddress}
                  className="w-full py-3 px-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {starting ? (
                    "Creating Draft..."
                  ) : (
                    <>
                      <span>Continue with {previewReq.label}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
