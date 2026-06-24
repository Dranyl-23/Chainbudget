"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { walletLogin, connectWallet, clearSession, getStoredUser, isMetaMaskInstalled } from "@/lib/wallet";
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
  logout: () => void;
  error: string | null;
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

  const isExecutingRef = useRef(false);

  const login = useCallback(async () => {
    if (isExecutingRef.current) return; // Prevent double-clicks!
    isExecutingRef.current = true;
    
    setIsLoading(true);
    setError(null);
    try {
      if (!isMetaMaskInstalled()) {
        throw new Error("MetaMask is not installed. Please install it from metamask.io");
      }
      const { user: loggedInUser } = await walletLogin();
      setUser(loggedInUser);
      setWalletAddress(loggedInUser.walletAddress);
      setIsConnected(true);
      
      // Set active org
      if (loggedInUser.memberships?.length > 0) {
        const firstOrg = loggedInUser.memberships[0].organization;
        const orgId = typeof firstOrg === "string" ? firstOrg : firstOrg?._id || firstOrg?.id;
        setActiveOrgId(orgId);
      }
      // Redirect handled by the landing page useEffect (isConnected + user watch)
    } catch (err: any) {
      console.error("Login Error Detailed:", err);
      const msg = err.response?.data?.error || err.message || "Login failed";
      setError(msg);
    } finally {
      setIsLoading(false);
      isExecutingRef.current = false;
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setWalletAddress(null);
    setIsConnected(false);
    setActiveOrgIdState(null);
    if (typeof window !== "undefined") localStorage.removeItem("cb_active_org");
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, walletAddress, isLoading, isConnected, login, logout, error, activeOrgId, setActiveOrgId }}
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
