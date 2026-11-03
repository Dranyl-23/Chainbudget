"use client";

import React, { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  Lock,
  ShieldAlert,
} from "lucide-react";
import {
  OrgRegistrationProvider,
  useOrgRegistration,
} from "@/context/OrgRegistrationContext";
import { useAuth } from "@/context/AuthContext";
import {
  formatStatusLabel,
  isEditableStatus,
  StepKey,
} from "@/lib/orgApplications";

const STEP_DISPLAY: Record<string, { label: string; subtitle: string }> = {
  details: {
    label: "Organization details",
    subtitle: "Legal identity, location and purpose",
  },
  representative: {
    label: "Your identity",
    subtitle: "Who is registering this organization",
  },
  documents: {
    label: "Documents",
    subtitle: "Upload the evidence for your organization type",
  },
  governance: {
    label: "Governance",
    subtitle: "Approval rules and initial officers",
  },
  review: {
    label: "Review & submit",
    subtitle: "Confirm everything and send for verification",
  },
};

function RegistrationShell({ children }: { children: React.ReactNode }) {
  const { application, requirements, loading, error } = useOrgRegistration();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isStatusPage = pathname.endsWith("/status");

  useEffect(() => {
    if (!loading && application) {
      // If application is locked (submitted / under_review / approved / rejected / revoked),
      // redirect any step route to the read-only /status timeline page.
      if (!isEditableStatus(application.status) && !isStatusPage) {
        router.replace(`/organizations/new/${application.id}/status`);
      }
    }
  }, [loading, application, isStatusPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
          <p className="text-xs text-zinc-400">Loading your application...</p>
        </div>
      </div>
    );
  }

  if (error || !application || !requirements) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#121215] border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Application Not Found</h2>
          <p className="text-xs text-zinc-400">
            {error || "We could not load this organization verification draft."}
          </p>
          <Link
            href="/organizations/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Applications
          </Link>
        </div>
      </div>
    );
  }

  const editable = isEditableStatus(application.status);
  const steps = requirements.steps;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Sticky Top Header */}
      <header className="border-b border-zinc-800/80 bg-[#0c0c0f]/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.memberships && user.memberships.length > 0 && (
              <>
                <Link
                  href="/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 shrink-0 transition-colors"
                >
                  Dashboard
                </Link>
                <div className="hidden sm:block h-4 w-px bg-zinc-800 shrink-0" />
              </>
            )}
            <Link
              href="/organizations/new"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 shrink-0 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Applications
            </Link>
            <div className="h-4 w-px bg-zinc-800 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <Image
                src="/3D-Chainbudget.png"
                alt="ChainBudget"
                width={22}
                height={22}
                unoptimized
                className="w-5 h-5 rounded shrink-0 object-contain"
              />
              <span className="text-sm font-semibold text-white truncate">
                {application.basics.displayName || requirements.label}
              </span>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 shrink-0">
                {requirements.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                application.status === "approved"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : application.status === "needs_info"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : application.status === "rejected" || application.status === "revoked"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
              }`}
            >
              {formatStatusLabel(application.status)} · v{application.revision}
            </span>
          </div>
        </div>

        {/* Multi-Step Progress Navigation Bar */}
        {editable && (
          <nav aria-label="Registration Progress" className="border-t border-zinc-800/70 bg-[#09090c]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
              <ol className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
                {steps.map((step, idx) => {
                  const stepHref = `/organizations/new/${application.id}/${step.key}`;
                  const isActive = pathname.endsWith(`/${step.key}`);
                  const isDone = application.completedSteps.includes(step.key as StepKey);
                  const display = STEP_DISPLAY[step.key] || {
                    label: step.title,
                    subtitle: step.description,
                  };

                  return (
                    <li key={step.key} className="shrink-0 min-w-max">
                      <Link
                        href={stepHref}
                        className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${
                          isActive
                            ? "border-indigo-500/80 bg-[#16152a] text-white shadow-sm shadow-indigo-500/10"
                            : "border-transparent hover:border-zinc-800/80 hover:bg-zinc-900/40 text-zinc-400"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                            isDone
                              ? "bg-emerald-500 text-zinc-950"
                              : isActive
                              ? "bg-[#524bf2] text-white shadow-sm"
                              : "bg-[#1e2029] text-zinc-400"
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : idx + 1}
                        </div>
                        <div className="min-w-0 text-left">
                          <div
                            className={`text-sm font-semibold tracking-tight leading-tight ${
                              isActive ? "text-white" : isDone ? "text-zinc-200" : "text-zinc-300"
                            }`}
                          >
                            {display.label}
                          </div>
                          <div
                            className={`text-[11px] leading-tight mt-0.5 ${
                              isActive ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            {display.subtitle}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </nav>
        )}
      </header>

      {/* Reviewer Action-Required Banner */}
      {application.status === "needs_info" && application.review.applicantMessage && (
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-amber-300">
                Reviewer Requested Additional Information (Revision v{application.revision})
              </div>
              <p className="text-amber-100/90 leading-relaxed">
                {application.review.applicantMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Step Content */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-4 px-6 text-center text-[11px] text-zinc-500 flex items-center justify-center gap-2">
        <Lock className="w-3 h-3 text-emerald-400" />
        <span>
          Draft progress is saved automatically per step on the server. You can safely continue on Web or Mobile.
        </span>
      </footer>
    </div>
  );
}

export default function OrgApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ applicationId: string }>();
  const applicationId = params?.applicationId || "";

  return (
    <OrgRegistrationProvider applicationId={applicationId}>
      <RegistrationShell>{children}</RegistrationShell>
    </OrgRegistrationProvider>
  );
}
