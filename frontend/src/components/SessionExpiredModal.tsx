"use client";

import { useEffect, useState } from "react";
import { LogOut, AlertTriangle } from "lucide-react";

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
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 animate-in fade-in zoom-in duration-300">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Session Expired</h3>
          <p className="text-sm text-gray-500">
            Your security token has timed out for your safety. Please log in again to continue using ChainBudget.
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-red-600/30"
          >
            <LogOut className="w-5 h-5" />
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}
