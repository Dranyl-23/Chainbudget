"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Download, X, Share } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const isIOS = typeof window !== "undefined"
    ? /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
    : false;

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already installed
    const nav = window.navigator as NavigatorWithStandalone;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
    
    // Check if dismissed before
    const isDismissed = localStorage.getItem("pwa_prompt_dismissed");
    
    if (isStandalone || isDismissed) {
      return;
    }

    let timerId: NodeJS.Timeout | null = null;

    if (isIOS) {
      // iOS doesn't support beforeinstallprompt, show custom instruction modal
      timerId = setTimeout(() => setShowPrompt(true), 2000);
    } else {
      // Listen for Chrome/Android native install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        deferredPromptRef.current = e as BeforeInstallPromptEvent;
        timerId = setTimeout(() => setShowPrompt(true), 2000);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      return () => {
        if (timerId) clearTimeout(timerId);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isIOS]);

  const handleInstall = async () => {
    const promptEvent = deferredPromptRef.current;
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      deferredPromptRef.current = null;
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("pwa_prompt_dismissed", "true");
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-100 w-[90%] max-w-sm animate-fade-in-up">
      <div className="bg-[#121215] rounded-2xl shadow-2xl border border-zinc-800 p-4 relative overflow-hidden">
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-850"
          aria-label="Dismiss install prompt"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
            <Image src="/icon.png" alt="App Icon" width={24} height={24} className="w-6 h-6 object-contain" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-white text-sm mb-1">Install ChainBudget</h3>
            
            {isIOS ? (
              <div className="text-xs text-zinc-400 mb-3 leading-relaxed">
                Install this app on your iPhone: tap <Share className="w-3 h-3 inline mx-1 text-zinc-300" /> and select <strong className="text-white">Add to Home Screen</strong>.
              </div>
            ) : (
              <div className="text-xs text-zinc-400 mb-3 leading-relaxed">
                Add to your home screen for instant institutional access, offline mode, and push notifications.
              </div>
            )}
            
            {!isIOS && (
              <div className="flex gap-2">
                <button 
                  onClick={handleDismiss}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 transition-colors border border-zinc-800"
                >
                  Not Now
                </button>
                <button 
                  onClick={handleInstall}
                  className="btn-primary flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3 h-3" /> Install
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
