"use client";

import { useEffect, useState } from "react";
import { LogOut, AlertTriangle } from "lucide-react";
import Portal from "@/components/Portal";

export default function SessionExpiredModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => {
      setShow(true);
    };

    window.addEventListener("cb_session_expired", handleSessionExpired);
    return () => window.removeEventListener("cb_session_expired", handleSessionExpired);
  }, []);

  if (!show) return null;

  const handleLogin = () => {
    localStorage.removeItem("cb_token");
    localStorage.removeItem("cb_user");
    sessionStorage.removeItem("session_expired_alert");
    window.location.href = "/";
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
        <div className="relative bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
          <div className="mx-auto flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 mb-4 text-zinc-300">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          
          <div className="text-center space-y-1.5 mb-6">
            <h3 className="text-base font-semibold text-white">Session Expired</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your security session has timed out. Please sign in again to continue accessing your organization dashboard.
            </p>
          </div>

          <div>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Return to Login
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
