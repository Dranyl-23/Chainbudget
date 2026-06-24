"use client";

import React from "react";
import { AuthProvider as AsgardeoAuthProvider, useAuthContext } from "@asgardeo/auth-react";
import { ChainBudgetAuthProvider } from "./AuthContext";

const asgardeoConfig = {
  signInRedirectURL: process.env.NEXT_PUBLIC_ASGARDEO_REDIRECT_URL || "http://localhost:3000",
  signOutRedirectURL: process.env.NEXT_PUBLIC_ASGARDEO_REDIRECT_URL || "http://localhost:3000",
  clientID: process.env.NEXT_PUBLIC_ASGARDEO_CLIENT_ID || "",
  baseUrl: process.env.NEXT_PUBLIC_ASGARDEO_BASE_URL || "",
  scope: ["openid", "profile", "email"]
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
