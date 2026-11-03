"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building,
  Users,
  ArrowRight,
  Clock,
  AlertTriangle,
  Globe,
  Copy,
  LogOut,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
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
  const [copied, setCopied] = useState(false);

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

  const copyWallet = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      toast.success("Wallet address copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#09090b] text-white select-none">
      <div className="w-full max-w-2xl py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/3D-Chainbudget.png"
              alt="ChainBudget logo"
              className="w-9 h-9 object-contain shrink-0 drop-shadow"
            />
            <span className="text-xl font-bold tracking-tight text-white">
              CHAIN<span className="text-zinc-400">BUDGET</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
            Welcome, {user?.displayName || "New User"}
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            You don&apos;t have an active organization yet. Choose how you want to get started with ChainBudget.
          </p>
        </div>

        {/* Active Applications Banner (if the user already started or submitted one) */}
        {myApps.length > 0 && (
          <div className="bg-surface border border-indigo-500/30 rounded-2xl p-5 mb-6 shadow-xl shadow-indigo-950/20">
            <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
              <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Your Verification Applications ({myApps.length})</span>
              </h2>
              <Link
                href="/organizations/new"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Manage All →
              </Link>
            </div>
            <div className="space-y-2.5">
              {myApps.map((app) => {
                const editable = isEditableStatus(app.status);
                const href = editable
                  ? `/organizations/new/${app.id}/${app.currentStep || "details"}`
                  : `/organizations/new/${app.id}/status`;
                return (
                  <Link
                    key={app.id}
                    href={href}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all group"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                        {app.displayName || "Untitled Organization Draft"}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span className="font-medium text-zinc-300">
                          {formatStatusLabel(app.status)}
                        </span>
                        <span>•</span>
                        <span>Step {app.completedSteps.length}/5 Completed</span>
                      </div>
                      {app.applicantMessage && (
                        <div className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{app.applicantMessage}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white bg-zinc-800 group-hover:bg-indigo-600 px-3 py-1.5 rounded-lg shrink-0 inline-flex items-center gap-1 transition-all">
                      {editable ? "Resume Draft" : "View Status"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Two Options */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Option 1: Register & Verify Org */}
          <button
            onClick={() => router.push("/organizations/new")}
            disabled={!user?.walletAddress}
            className={`p-5 sm:p-6 rounded-2xl text-left transition-all group border bg-surface border-zinc-800 ${
              !user?.walletAddress
                ? "opacity-60 cursor-not-allowed"
                : "hover:border-zinc-600 hover:bg-zinc-900/60 cursor-pointer shadow-lg hover:-translate-y-0.5"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white text-zinc-950 flex items-center justify-center mb-3.5 shadow-sm">
              <Building className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
              <span>Register Organization</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Submit Philippine 3-Pillar verification (Existence, Signatory Authority, KYC) to establish your on-chain treasury as{" "}
              <strong className="text-white">Level 1 Founder</strong>.
            </p>
            {!user?.walletAddress ? (
              <p className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 inline-block">
                ⚠️ Link your MetaMask wallet first
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  10 Philippine Categories
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Soulbound Token (SBT)
                </span>
              </div>
            )}
          </button>

          {/* Option 2: I Was Invited */}
          <div className="p-5 sm:p-6 rounded-2xl text-left border bg-surface border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center mb-3.5 border border-zinc-700">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">
              I Was Invited
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your organization admin can add your wallet address directly to their team roster.
            </p>
            <div className="mt-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                <span>Your Connected Wallet Address:</span>
                <button
                  type="button"
                  onClick={copyWallet}
                  className="text-zinc-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <p className="text-xs font-mono text-zinc-200 break-all select-all">
                {user?.walletAddress || "No wallet linked"}
              </p>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2.5 leading-relaxed">
              Once added by your admin, refresh this page to access your organization dashboard.
            </p>
          </div>
        </div>

        {/* Public Explorer & Transparency Quick Links */}
        <div className="bg-surface border border-zinc-800 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-white">Want to explore transparent organizations first?</p>
              <p className="text-zinc-500 text-[11px]">Browse public budgets, verified transactions, and open ledgers.</p>
            </div>
          </div>
          <Link
            href="/explorer"
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shrink-0"
          >
            <span>Public Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Sign Out */}
        <div className="text-center">
          <button
            onClick={logout}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out and connect a different wallet</span>
          </button>
        </div>
      </div>
    </div>
  );
}
