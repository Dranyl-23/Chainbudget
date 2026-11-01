"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";

export default function CookiePrivacyBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("chainbudget_privacy_consent_v1");
      if (!consent) {
        // Show after a brief delay for smooth appearance
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("chainbudget_privacy_consent_v1", JSON.stringify({
        acceptedAt: new Date().toISOString(),
        version: "2.0-RA10173",
      }));
    } catch {
      // Ignore
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Privacy and Cookie Notice"
      className="fixed bottom-4 left-4 right-4 md:left-8 md:right-auto md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 shadow-2xl text-white">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4 text-zinc-300" />
          </div>
          <div className="flex-1 text-xs leading-relaxed text-zinc-400">
            <div className="font-semibold text-white text-xs mb-1">Data Privacy & Security Notice</div>
            We process minimal data strictly necessary for Web3 authentication and multi-signature budget management in compliance with the{" "}
            <Link href="/privacy" className="text-zinc-200 font-medium underline hover:text-white">
              Philippine Data Privacy Act (RA 10173)
            </Link>{" "}
            and{" "}
            <Link href="/help" className="text-zinc-200 font-medium underline hover:text-white">
              RA 10175
            </Link>
            . No private keys are ever stored.
          </div>
          <button
            onClick={() => setIsVisible(false)}
            aria-label="Dismiss notice"
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
          <Link
            href="/privacy"
            className="text-[11px] text-zinc-400 hover:text-white transition-colors underline"
          >
            Read Privacy Notice
          </Link>
          <button
            onClick={handleAccept}
            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-colors"
          >
            Acknowledge & Accept
          </button>
        </div>
      </div>
    </aside>
  );
}
