"use client";

import dynamic from "next/dynamic";
import { Toaster } from "react-hot-toast";

// Dynamically import the AsgardeoWrapper with SSR disabled
const AuthProvider = dynamic(() => import("@/context/AsgardeoWrapper"), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthProvider>{children}</AuthProvider>
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          className: "text-xs font-semibold", 
          duration: 3500,
          style: {
            background: "rgba(18, 18, 21, 0.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "#FFFFFF",
            border: "1px solid #27272a",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.65)",
            borderRadius: "12px",
            padding: "10px 16px",
          },
          success: {
            iconTheme: {
              primary: "#10B981",
              secondary: "#121215",
            },
            style: {
              border: "1px solid rgba(16, 185, 129, 0.3)",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.65), 0 0 12px rgba(16, 185, 129, 0.08)",
            }
          },
          error: {
            iconTheme: {
              primary: "#F43F5E",
              secondary: "#121215",
            },
            style: {
              border: "1px solid rgba(244, 63, 94, 0.3)",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.65), 0 0 12px rgba(244, 63, 94, 0.08)",
            }
          },
        }} 
      />
    </>
  );
}
