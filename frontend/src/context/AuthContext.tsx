"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { linkWallet, clearSession, getStoredUser, isMetaMaskInstalled } from "@/lib/wallet";
import api from "@/lib/api";

interface User {
  id: string;
  walletAddress: string;
  displayName?: string;
  isSuperAdmin: boolean;
  memberships: any[];
}

interface AuthContextType {
  user: User | null;
  walletAddress: string | null;
  isLoading: boolean;
  isConnected: boolean;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => void;
  error: string | null;
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
  isAsgardeoAuthenticated: boolean;
  linkMetaMask: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cb_token");
}

async function validateTokenWithBackend(): Promise<boolean> {
  try {
    const token = getStoredToken();
    if (!token) return false;
    
    // Simple validation: make a test API call
    await api.get("/auth/validate");
    return true;
  } catch (error) {
    console.warn("Token validation failed:", error);
    return false;
  }
}

export function ChainBudgetAuthProvider({ children, asgardeoAuth }: { children: React.ReactNode, asgardeoAuth: any }) {
  const { state: asgardeoState, signIn, signOut, getAccessToken } = asgardeoAuth || {};
  
  const [user, setUser] = useState<User | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("cb_active_org", id);
    }
  }, []);

  // Restore and validate session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = getStoredUser();
        if (stored) {
          // Validate token is still valid
          const isValid = await validateTokenWithBackend();
          if (isValid) {
            setUser(stored);
            setWalletAddress(stored.walletAddress);
            setIsConnected(true);
            
            // Set active org
            let savedOrg = null;
            if (typeof window !== "undefined") {
              savedOrg = localStorage.getItem("cb_active_org");
            }
            if (savedOrg) {
              setActiveOrgIdState(savedOrg);
            } else if (stored.memberships?.length > 0) {
              const firstOrg = stored.memberships[0].organization;
              const orgId = typeof firstOrg === "string" ? firstOrg : firstOrg?._id || firstOrg?.id;
              setActiveOrgIdState(orgId);
            }
          } else {
            // Token expired, clear session
            clearSession();
            setUser(null);
            setWalletAddress(null);
            setIsConnected(false);
            setActiveOrgIdState(null);
            if (typeof window !== "undefined") localStorage.removeItem("cb_active_org");
          }
        }
      } catch (err) {
        console.error("Session restoration error:", err);
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async () => {
    try {
      await signIn();
    } catch (err) {
      console.error("Asgardeo sign in error:", err);
      console.error("Error stringified:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
  }, [signIn]);

  const register = useCallback(async () => {
    try {
      // In Asgardeo, sign-in also handles registration if configured, 
      // or we can pass a prompt parameter, but standard signIn works for both.
      await signIn();
    } catch (err) {
      console.error("Asgardeo register error:", err);
      console.error("Error stringified:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
  }, [signIn]);

  // Handle successful Asgardeo auth and check/link MetaMask
  useEffect(() => {
    const handleAuth = async () => {
      if (asgardeoState.isAuthenticated) {
        try {
          const token = await getAccessToken();
          console.log("Raw Token from Asgardeo:", token);
          if (token) {
            localStorage.setItem("cb_token", token);
          } else {
            localStorage.removeItem("cb_token");
          }
          
          // Fetch user profile from backend (backend validates Asgardeo token)
          // If the user doesn't have a linked wallet, the backend might return a special status
          const res = await api.get("/auth/me");
          
          if (res.data.user) {
            setUser(res.data.user);
            setWalletAddress(res.data.user.walletAddress);
            setIsConnected(!!res.data.user.walletAddress);
            
            // Set active org
            if (res.data.user.memberships?.length > 0) {
              const firstOrg = res.data.user.memberships[0].organization;
              const orgId = typeof firstOrg === "string" ? firstOrg : firstOrg?._id || firstOrg?.id;
              setActiveOrgIdState(localStorage.getItem("cb_active_org") || orgId);
            }
          }
        } catch (err: any) {
          console.error("Backend sync failed:", err);
          // If 404, user needs to link wallet. We can set isConnected = false but Asgardeo is true.
        } finally {
          setIsLoading(false);
        }
      } else if (!asgardeoState.isLoading) {
        setIsLoading(false);
      }
    };
    
    if (!asgardeoState.isLoading) {
      handleAuth();
    }
  }, [asgardeoState.isAuthenticated, asgardeoState.isLoading, getAccessToken]);

  const linkMetaMask = useCallback(async () => {
    try {
      if (!isMetaMaskInstalled()) throw new Error("MetaMask not installed");
      const { user } = await linkWallet();
      
      setUser(user);
      setWalletAddress(user.walletAddress);
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || "Failed to link MetaMask");
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    signOut();
    clearSession();
    setUser(null);
    setWalletAddress(null);
    setIsConnected(false);
    setActiveOrgIdState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("cb_active_org");
      localStorage.removeItem("cb_token");
    }
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{ 
        user, walletAddress, isLoading: isLoading || (asgardeoState?.isLoading ?? true), 
        isConnected, login, register, logout, error, activeOrgId, setActiveOrgId,
        isAsgardeoAuthenticated: asgardeoState?.isAuthenticated || false, linkMetaMask
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
