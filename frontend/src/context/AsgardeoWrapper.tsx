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
  clientID:
    process.env.NEXT_PUBLIC_ASGARDEO_CLIENT_ID || "3WDw8ZfjPsNGaBKYIjeCwjw3raIa",
  baseUrl:
    process.env.NEXT_PUBLIC_ASGARDEO_BASE_URL || "https://api.asgardeo.io/t/orgs3xfu",
  scope: ["openid", "profile", "email"],
};

console.log("Asgardeo Config:", asgardeoConfig);

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
