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
      <div className="bg-[#12072B]/95 border border-purple-500/30 rounded-2xl p-4 md:p-5 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-xl text-white">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4 text-purple-300" />
          </div>
          <div className="flex-1 text-xs leading-relaxed text-white/80">
            <div className="font-bold text-white text-sm mb-1">Data Privacy & Security Notice</div>
            We process minimal data strictly necessary for Web3 authentication and multi-signature budget management in compliance with the{" "}
            <Link href="/privacy" className="text-fuchsia-400 font-semibold hover:underline">
              Philippine Data Privacy Act (RA 10173)
            </Link>{" "}
            and{" "}
            <Link href="/help" className="text-cyan-400 font-semibold hover:underline">
              RA 10175
            </Link>
            . No private keys are ever stored.
          </div>
          <button
            onClick={() => setIsVisible(false)}
            aria-label="Dismiss notice"
            className="text-white/40 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <Link
            href="/privacy"
            className="text-[11px] text-white/60 hover:text-white transition-colors underline"
          >
            Read Privacy Notice
          </Link>
          <button
            onClick={handleAccept}
            className="px-4 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs transition-all shadow-md"
          >
            Acknowledge & Accept
          </button>
        </div>
      </div>
    </aside>
  );
}
