"use client";

import React from "react";
import { AuthProvider as AsgardeoAuthProvider, useAuthContext } from "@asgardeo/auth-react";
import { ChainBudgetAuthProvider } from "./AuthContext";

const asgardeoConfig = {
  signInRedirectURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_ASGARDEO_REDIRECT_URL || "https://chainbudget.vercel.app",
  signOutRedirectURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_ASGARDEO_REDIRECT_URL || "https://chainbudget.vercel.app",
  clientID: (() => {
    const id = process.env.NEXT_PUBLIC_ASGARDEO_CLIENT_ID;
    if (!id) throw new Error("Missing NEXT_PUBLIC_ASGARDEO_CLIENT_ID environment variable");
    return id;
  })(),
  baseUrl: (() => {
    const url = process.env.NEXT_PUBLIC_ASGARDEO_BASE_URL;
    if (!url) throw new Error("Missing NEXT_PUBLIC_ASGARDEO_BASE_URL environment variable");
    return url;
  })(),
  scope: ["openid", "profile", "email"],
};

function InnerWrapper({ children }: { children: React.ReactNode }) {
  const asgardeoAuth = useAuthContext();
  return (
    <ChainBudgetAuthProvider asgardeoAuth={asgardeoAuth}>
      {children}
    </ChainBudgetAuthProvider>
  );
}

export default function AsgardeoWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AsgardeoAuthProvider config={asgardeoConfig}>
      <InnerWrapper>{children}</InnerWrapper>
    </AsgardeoAuthProvider>
  );
}
