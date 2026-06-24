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
      <Toaster position="bottom-right" toastOptions={{ className: "text-sm", duration: 4000 }} />
    </>
  );
}
