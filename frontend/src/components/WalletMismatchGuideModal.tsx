"use client";

import React, { useState } from "react";
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  X,
  Key,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Portal from "@/components/Portal";

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
    <Portal>
      <div 
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
      >
        <div className="relative bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 md:p-6 animate-in zoom-in-95 duration-200 my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              MetaMask Wallet Mismatch
            </h3>
            <p className="text-xs text-zinc-400">
              Align your signing wallet with your ChainBudget officer account.
            </p>
          </div>
        </div>

        {/* Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          {/* Expected Wallet */}
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Logged-in Account
              </span>
              <button
                onClick={() => handleCopy(expectedAddress, true)}
                className="text-zinc-500 hover:text-white"
                title="Copy Address"
              >
                {copiedExpected ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-xs font-mono font-medium text-white break-all">
              {expectedAddress || "0x..."}
            </p>
            <span className="inline-block text-[10px] text-zinc-500 mt-0.5">
              (Required Signer)
            </span>
          </div>

          {/* Active MetaMask Wallet */}
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Active in MetaMask
              </span>
              <button
                onClick={() => handleCopy(activeAddress, false)}
                className="text-zinc-500 hover:text-white"
                title="Copy Address"
              >
                {copiedActive ? <Check className="w-3 h-3 text-rose-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-xs font-mono font-medium text-zinc-300 break-all">
              {activeAddress || "0x..."}
            </p>
            <span className="inline-block text-[10px] text-rose-400 mt-0.5">
              (Mismatch — Not Authorized)
            </span>
          </div>
        </div>

        {/* Security Info Pill */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-900 border border-zinc-800 mb-4">
          <ShieldCheck className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            <strong className="text-zinc-200">Why does this happen?</strong> ChainBudget multi-sig contracts require cryptographic signatures to match your registered officer wallet.
          </p>
        </div>

        {/* Method Switcher Tabs */}
        <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-lg mb-4">
          <button
            onClick={() => setActiveTab("switch")}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === "switch"
                ? "bg-white text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Option A: Switch Account (Fastest)
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === "import"
                ? "bg-white text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Option B: Import Key to MetaMask
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "switch" ? (
          <div className="space-y-2.5 bg-zinc-900 p-3.5 rounded-lg border border-zinc-800 mb-5">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-[10px] flex items-center justify-center shrink-0 border border-zinc-700">
                1
              </div>
              <p className="text-xs text-zinc-300">
                Open your <strong>MetaMask browser extension</strong>.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-[10px] flex items-center justify-center shrink-0 border border-zinc-700">
                2
              </div>
              <p className="text-xs text-zinc-300">
                Click the <strong>Account Selector</strong> at the top of MetaMask.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-[10px] flex items-center justify-center shrink-0 border border-zinc-700">
                3
              </div>
              <p className="text-xs text-zinc-300">
                Select your account ending in <strong className="text-emerald-400 font-mono">{expectedAddress ? `${expectedAddress.slice(0, 6)}...${expectedAddress.slice(-4)}` : ""}</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 bg-zinc-900 p-3.5 rounded-lg border border-zinc-800 mb-5">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-[10px] flex items-center justify-center shrink-0 border border-zinc-700">
                1
              </div>
              <p className="text-xs text-zinc-300">
                Go to <Link href="/dashboard/settings" target="_blank" className="text-white underline font-medium hover:text-zinc-300">Profile & Settings</Link> and click <strong>&quot;Reveal Recovery Phrase &amp; Private Key&quot;</strong>.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-[10px] flex items-center justify-center shrink-0 border border-zinc-700">
                2
              </div>
              <p className="text-xs text-zinc-300">
                In MetaMask, click <strong>Add wallet</strong> ➔ <strong>Import account</strong> and paste your Private Key.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-[10px] flex items-center justify-center shrink-0 border border-zinc-700">
                3
              </div>
              <p className="text-xs text-zinc-300">
                Select the imported account to sign transactions seamlessly.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-medium transition-colors"
          >
            I&apos;ll Switch Later
          </button>

          {onRetry && (
            <button
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="flex-1 py-2 px-3 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check & Retry Approval
            </button>
          )}

          {activeTab === "import" && (
            <Link
              href="/dashboard/settings"
              onClick={onClose}
              className="py-2 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              Get Private Key
            </Link>
          )}
        </div>
        </div>
      </div>
    </Portal>
  );
}
