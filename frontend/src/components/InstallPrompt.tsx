"use client";

import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

export default function InstallPrompt() {
  const [isReady, setIsReady] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    
    // Check if dismissed before
    const isDismissed = localStorage.getItem("pwa_prompt_dismissed");
    
    if (isStandalone || isDismissed) {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // iOS doesn't support beforeinstallprompt, just show the custom modal
      setTimeout(() => setShowPrompt(true), 2000);
    } else {
      // Listen for Chrome/Android native install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => setShowPrompt(true), 2000); // Wait 2s before showing
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa_prompt_dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 relative overflow-hidden">
        {/* Decorative background removed per user request */}
        
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 pr-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
            <img src="/icon.png" alt="App Icon" className="w-6 h-6 object-contain" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-sm mb-1">Install ChainBudget</h3>
            
            {isIOS ? (
              <div className="text-xs text-gray-600 mb-3 leading-relaxed">
                Install this app on your iPhone: tap <Share className="w-3 h-3 inline mx-1" /> and select <strong>Add to Home Screen</strong>.
              </div>
            ) : (
              <div className="text-xs text-gray-600 mb-3 leading-relaxed">
                Add to your home screen for quick access, offline mode, and push notifications.
              </div>
            )}
            
            {!isIOS && (
              <div className="flex gap-2">
                <button 
                  onClick={handleDismiss}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors border border-gray-200"
                >
                  Not Now
                </button>
                <button 
                  onClick={handleInstall}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary-dark transition-colors shadow-sm flex items-center justify-center gap-1.5"
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
