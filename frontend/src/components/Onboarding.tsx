"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Building,
  Users,
  ArrowRight,
  Shield,
  BarChart3,
  Link2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  MyOrgApplicationSummary,
  formatStatusLabel,
  isEditableStatus,
} from "@/lib/orgApplications";

export default function Onboarding() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [myApps, setMyApps] = useState<MyOrgApplicationSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<MyOrgApplicationSummary[]>("/org-applications/mine")
      .then((res) => {
        if (!cancelled) setMyApps(res.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <Image
              src="/images/logo.png"
              alt="ChainBudget logo"
              width={32}
              height={32}
              unoptimized
              className="w-8 h-8 object-contain rounded-lg shadow-sm shrink-0"
            />
            <span className="text-xl font-bold tracking-tight">
              Chain<span className="gradient-text">Budget</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {user?.displayName || "New User"}!
          </h1>
          <p className="text-gray-500 text-sm">
            Let&apos;s get you set up. Choose how you want to get started.
          </p>
        </div>

        {/* Active Applications Banner (if the user already started or submitted one) */}
        {myApps.length > 0 && (
          <div className="glass p-5 rounded-2xl mb-6 border border-indigo-500/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Your Organization Applications ({myApps.length})
              </h2>
              <Link
                href="/organizations/new"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-2.5">
              {myApps.slice(0, 3).map((app) => {
                const editable = isEditableStatus(app.status);
                const href = editable
                  ? `/organizations/new/${app.id}/${app.currentStep || "details"}`
                  : `/organizations/new/${app.id}/status`;
                return (
                  <Link
                    key={app.id}
                    href={href}
                    className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/10 hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {app.displayName || "Untitled Organization Draft"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatStatusLabel(app.status)} · Step{" "}
                        {app.completedSteps.length}/5
                      </div>
                      {app.applicantMessage && (
                        <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{app.applicantMessage}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-primary shrink-0 ml-3 inline-flex items-center gap-1">
                      {editable ? "Resume" : "Status"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Two Options */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* Option 1: Register & Verify Org */}
          <button
            onClick={() => router.push("/organizations/new")}
            disabled={!user?.walletAddress}
            className={`glass p-6 rounded-2xl text-left transition-all group border-2 border-transparent ${
              !user?.walletAddress
                ? "opacity-60 cursor-not-allowed grayscale"
                : "hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 cursor-pointer"
            }`}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary), var(--color-primary-2))",
              }}
            >
              <Building className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              Register Organization
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-3">
              Complete our multi-step legitimacy verification to launch your organization treasury as{" "}
              <strong className="text-primary">Level 1 Founder</strong>.
            </p>
            {!user?.walletAddress ? (
              <p className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-md border border-red-100 inline-block">
                ⚠️ Link your MetaMask wallet first
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  Verified Identity
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  On-Chain Attestation
                </span>
              </div>
            )}
          </button>

          {/* Option 2: I Was Invited */}
          <div className="glass p-6 rounded-2xl text-left border-2 border-transparent">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              I Was Invited
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your admin needs to add your <strong>wallet address</strong> to
              their organization via the Team page.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1 font-medium">
                Share this with your admin:
              </p>
              <p className="text-xs font-mono text-primary break-all select-all">
                {user?.walletAddress || "Link your MetaMask wallet first"}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Once added, refresh this page and your organization will appear
              automatically.
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="glass rounded-2xl p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            What you&apos;ll get
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Shield className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">
                Multi-Sig Approval
              </p>
              <p className="text-xs text-gray-400">2-of-N signing</p>
            </div>
            <div className="text-center">
              <BarChart3 className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">
                Budget Tracking
              </p>
              <p className="text-xs text-gray-400">Real-time reports</p>
            </div>
            <div className="text-center">
              <Link2 className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">
                Blockchain Audit
              </p>
              <p className="text-xs text-gray-400">Immutable records</p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="text-center mt-6">
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-primary transition-colors cursor-pointer"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
