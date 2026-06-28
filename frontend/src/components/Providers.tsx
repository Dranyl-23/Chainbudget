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
          className: "text-sm font-bold tracking-wide", 
          duration: 4000,
          style: {
            background: "rgba(16, 17, 26, 0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "#FFFFFF",
            border: "1px solid rgba(139, 92, 246, 0.4)",
            boxShadow: "0 10px 30px -10px rgba(139, 92, 246, 0.3), inset 0 0 10px rgba(139, 92, 246, 0.1)",
            borderRadius: "12px",
            padding: "12px 16px",
          },
          success: {
            iconTheme: {
              primary: "#4ADE80",
              secondary: "#10111A",
            },
            style: {
              border: "1px solid rgba(74, 222, 128, 0.4)",
              boxShadow: "0 10px 30px -10px rgba(74, 222, 128, 0.2), inset 0 0 10px rgba(74, 222, 128, 0.1)",
            }
          },
          error: {
            iconTheme: {
              primary: "#F87171",
              secondary: "#10111A",
            },
            style: {
              border: "1px solid rgba(248, 113, 113, 0.4)",
              boxShadow: "0 10px 30px -10px rgba(248, 113, 113, 0.2), inset 0 0 10px rgba(248, 113, 113, 0.1)",
            }
          },
        }} 
      />
    </>
  );
}
