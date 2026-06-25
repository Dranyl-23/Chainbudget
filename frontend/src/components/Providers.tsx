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
          className: "text-sm font-medium", 
          duration: 4000,
          style: {
            background: "var(--color-bg)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)",
            borderRadius: "12px",
            padding: "12px 16px",
          },
          success: {
            iconTheme: {
              primary: "#34d399",
              secondary: "var(--color-bg)",
            },
          },
          error: {
            iconTheme: {
              primary: "#f87171",
              secondary: "var(--color-bg)",
            },
          },
        }} 
      />
    </>
  );
}
