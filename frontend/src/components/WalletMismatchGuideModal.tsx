"use client";

import React, { useState } from "react";
import {
  Wallet,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
  Key,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface WalletMismatchGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedAddress: string;
  activeAddress: string;
  onRetry?: () => void;
}

export default function WalletMismatchGuideModal({
  isOpen,
  onClose,
  expectedAddress,
  activeAddress,
  onRetry,
}: WalletMismatchGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"switch" | "import">("switch");
  const [copiedExpected, setCopiedExpected] = useState(false);
  const [copiedActive, setCopiedActive] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string, isExpected: boolean) => {
    navigator.clipboard.writeText(text);
    if (isExpected) {
      setCopiedExpected(true);
      setTimeout(() => setCopiedExpected(false), 2000);
    } else {
      setCopiedActive(true);
      setTimeout(() => setCopiedActive(false), 2000);
    }
    toast.success("Address copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden p-6 md:p-8 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              MetaMask Wallet Mismatch
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Friendly guide to align your signing wallet with ChainBudget.
            </p>
          </div>
        </div>

        {/* Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {/* Expected Wallet */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Logged-in Account
              </span>
              <button
                onClick={() => handleCopy(expectedAddress, true)}
                className="text-slate-400 hover:text-emerald-300"
                title="Copy Address"
              >
                {copiedExpected ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs font-mono font-bold text-white break-all">
              {expectedAddress || "0x..."}
            </p>
            <span className="inline-block text-[10px] text-emerald-300/80 mt-1 font-medium">
              (Required Signer)
            </span>
          </div>

          {/* Active MetaMask Wallet */}
          <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" /> Active in MetaMask
              </span>
              <button
                onClick={() => handleCopy(activeAddress, false)}
                className="text-slate-400 hover:text-rose-300"
                title="Copy Address"
              >
                {copiedActive ? <Check className="w-3.5 h-3.5 text-rose-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs font-mono font-bold text-slate-300 break-all">
              {activeAddress || "0x..."}
            </p>
            <span className="inline-block text-[10px] text-rose-400/90 mt-1 font-medium">
              (Mismatch — Not Authorized)
            </span>
          </div>
        </div>

        {/* Security Info Pill */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-5">
          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-purple-300">Why does this happen?</strong> To prevent unauthorized spending, ChainBudget multi-sig smart contracts require the cryptographic signature to match your logged-in officer account.
          </p>
        </div>

        {/* Method Switcher Tabs */}
        <div className="flex p-1 bg-slate-800/90 border border-slate-700 rounded-xl mb-4">
          <button
            onClick={() => setActiveTab("switch")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "switch"
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Option A: Switch Account (Fastest)
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "import"
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Option B: Import Key to MetaMask
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "switch" ? (
          <div className="space-y-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/40">
                1
              </div>
              <p className="text-xs text-slate-300">
                Open your <strong>MetaMask browser extension</strong> (or click the fox icon at top right).
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/40">
                2
              </div>
              <p className="text-xs text-slate-300">
                Click the <strong>Account Selector</strong> dropdown at the top of MetaMask.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/40">
                3
              </div>
              <p className="text-xs text-slate-300">
                Select your account ending in <strong className="text-emerald-400 font-mono font-bold">{expectedAddress ? `${expectedAddress.slice(0, 6)}...${expectedAddress.slice(-4)}` : ""}</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/40">
                1
              </div>
              <p className="text-xs text-slate-300">
                Go to your <Link href="/dashboard/settings" target="_blank" className="text-purple-400 underline font-semibold hover:text-purple-300">Profile & Settings</Link> page and click <strong>"Reveal Recovery Phrase & Private Key"</strong>.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/40">
                2
              </div>
              <p className="text-xs text-slate-300">
                In MetaMask, click <strong>Add wallet</strong> ➔ <strong>Import account</strong> and paste your Private Key.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/40">
                3
              </div>
              <p className="text-xs text-slate-300">
                Select the newly imported account to sign transactions seamlessly.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 font-bold text-xs transition-colors"
          >
            I'll Switch Later
          </button>

          {onRetry && (
            <button
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Check & Retry Approval
            </button>
          )}

          {activeTab === "import" && (
            <Link
              href="/dashboard/settings"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-800 border border-purple-500/40 text-purple-300 hover:bg-purple-900/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Key className="w-4 h-4" />
              Get Private Key
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
