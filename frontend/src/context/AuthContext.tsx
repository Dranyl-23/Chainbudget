"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { linkWallet, clearSession, getStoredUser, isMetaMaskInstalled } from "@/lib/wallet";
import api from "@/lib/api";

export interface UserOrgRef {
  _id?: string;
  id?: string;
  name?: string;
  logoUrl?: string;
}

export interface UserMembership {
  organization?: string | UserOrgRef;
  roleLevel: number;
  roleLabel?: string;
  isActive?: boolean;
  hasSBT?: boolean;
  sbtTokenId?: string;
}

export interface User {
  id: string;
  walletAddress: string;
  displayName?: string;
  avatarUrl?: string;
  linkedWallets?: string[];
  isSuperAdmin: boolean;
  memberships: UserMembership[];
}

export interface AsgardeoAuthState {
  isAuthenticated?: boolean;
  isLoading?: boolean;
}

export interface AsgardeoAuthContext {
  state?: AsgardeoAuthState;
  signIn: () => Promise<unknown>;
  signOut: () => Promise<unknown>;
  getAccessToken: () => Promise<string | null>;
}

interface AuthMeResponse {
  user?: User;
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
  refreshUser: () => Promise<void>;
  /** Fetches a fresh Asgardeo access token and stores it in localStorage.
   *  Returns the new token, or null if the session cannot be refreshed. */
  refreshToken: () => Promise<string | null>;
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

export function ChainBudgetAuthProvider({ children, asgardeoAuth }: { children: React.ReactNode; asgardeoAuth?: AsgardeoAuthContext | null }) {
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
    let isCancelled = false;

    const restoreSession = async () => {
      try {
        const stored = getStoredUser();
        if (stored) {
          // Validate token is still valid
          const isValid = await validateTokenWithBackend();
          if (isValid && !isCancelled) {
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
              if (orgId) {
                setActiveOrgIdState(orgId);
              }
            }

            // Sync latest user details (avatar, name, roles) directly from DB
            try {
              const res = await api.get<{ user?: User } | User>("/users/me");
              const data = res.data;
              const userData = "user" in data && data.user ? data.user : (data as User);
              if (userData && !isCancelled) {
                setUser(userData);
                setWalletAddress(userData.walletAddress);
                if (typeof window !== "undefined") {
                  localStorage.setItem("cb_user", JSON.stringify(userData));
                }
              }
            } catch (syncErr) {
              console.warn("Could not sync fresh profile:", syncErr);
            }
          } else if (!isCancelled) {
            // Token expired, clear session
            clearSession();
            setUser(null);
            setWalletAddress(null);
            setIsConnected(false);
            setActiveOrgIdState(null);
            if (typeof window !== "undefined") localStorage.removeItem("cb_active_org");
          }
        }
      } catch (err: unknown) {
        console.error("Session restoration error:", err);
        clearSession();
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    try {
      if (signIn) {
        await signIn();
      }
    } catch (err: unknown) {
      console.error("Asgardeo sign in error:", err);
    }
  }, [signIn]);

  const register = useCallback(async () => {
    try {
      if (signIn) {
        await signIn();
      }
    } catch (err: unknown) {
      console.error("Asgardeo register error:", err);
    }
  }, [signIn]);

  // Handle successful Asgardeo auth and check/link MetaMask
  useEffect(() => {
    let isCancelled = false;

    const handleAuth = async () => {
      if (asgardeoState?.isAuthenticated) {
        try {
          const token = getAccessToken ? await getAccessToken() : null;
          if (token) {
            localStorage.setItem("cb_token", token);
          } else {
            localStorage.removeItem("cb_token");
          }
          
          // Fetch user profile from backend (backend validates Asgardeo token)
          const res = await api.get<AuthMeResponse>("/auth/me", {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          });
          
          if (!isCancelled && res.data.user) {
            const authUser = res.data.user;
            setUser(authUser);
            setWalletAddress(authUser.walletAddress);
            setIsConnected(Boolean(authUser.walletAddress));
            
            // Set active org
            if (authUser.memberships?.length > 0) {
              const firstOrg = authUser.memberships[0].organization;
              const orgId = typeof firstOrg === "string" ? firstOrg : firstOrg?._id || firstOrg?.id;
              setActiveOrgIdState(localStorage.getItem("cb_active_org") || orgId || null);
            }
          }
        } catch (err: unknown) {
          console.error("Backend sync failed:", err);
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      } else if (!asgardeoState?.isLoading && !isCancelled) {
        setIsLoading(false);
      }
    };
    
    if (!asgardeoState?.isLoading) {
      void handleAuth();
    }

    return () => {
      isCancelled = true;
    };
  }, [asgardeoState?.isAuthenticated, asgardeoState?.isLoading, getAccessToken]);

  const linkMetaMask = useCallback(async () => {
    try {
      if (!isMetaMaskInstalled()) throw new Error("MetaMask not installed");
      const { user: linkedUser } = await linkWallet();
      
      setUser(linkedUser);
      setWalletAddress(linkedUser.walletAddress);
      setIsConnected(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to link MetaMask";
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    if (signOut) {
      void signOut();
    }
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

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<{ user?: User } | User>("/users/me");
      const data = res.data;
      const userData = "user" in data && data.user ? data.user : (data as User);
      if (userData) {
        setUser(userData);
        if (typeof window !== "undefined") {
          localStorage.setItem("cb_user", JSON.stringify(userData));
        }
      }
    } catch (err: unknown) {
      console.error("Failed to refresh user:", err);
    }
  }, []);

  /**
   * Proactively fetch a fresh Asgardeo access token and write it to localStorage
   * so subsequent api.ts calls send a valid Bearer token.
   * Returns the fresh token string, or null when the session cannot be renewed.
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      if (!getAccessToken) return null;
      const freshToken = await getAccessToken();
      if (freshToken) {
        if (typeof window !== "undefined") {
          localStorage.setItem("cb_token", freshToken);
        }
        return freshToken;
      }
      return null;
    } catch (err: unknown) {
      console.warn("Failed to refresh Asgardeo token:", err);
      return null;
    }
  }, [getAccessToken]);

  return (
    <AuthContext.Provider
      value={{ 
        user, walletAddress, isLoading: isLoading || (asgardeoState?.isLoading ?? true), 
        isConnected, login, register, logout, error, activeOrgId, setActiveOrgId,
        isAsgardeoAuthenticated: asgardeoState?.isAuthenticated || false, linkMetaMask, refreshUser,
        refreshToken
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
