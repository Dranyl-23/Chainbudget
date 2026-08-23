"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { linkWallet, clearSession, isMetaMaskInstalled } from "@/lib/wallet";
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

interface AuthContextType {
  user: User | null;
  walletAddress: string | null;
  isLoading: boolean;
  isConnected: boolean;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
  isAsgardeoAuthenticated: boolean;
  linkMetaMask: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Fetches a fresh Asgardeo access token and re-establishes the HttpOnly cookie session. */
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * CRIT-2 FIX: Restore session by calling the Next.js HttpOnly cookie proxy.
 * No localStorage access. The cookie is sent automatically by the browser.
 */
async function restoreSessionFromCookie(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json() as { user?: User };
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * CRIT-2 FIX: Establish session by posting the Asgardeo token to the proxy.
 * The proxy validates the token and sets the HttpOnly cookie.
 */
async function establishCookieSession(token: string): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { user?: User };
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * CRIT-2 FIX: Destroy session by calling DELETE on the proxy — clears the HttpOnly cookie.
 */
async function destroyCookieSession(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
  } catch {
    // Best-effort: always proceed with local state cleanup
  }
}

function getValidOrgId(user: User, preferredOrgId?: string | null): string | null {
  if (!user.memberships || user.memberships.length === 0) return null;
  const activeMemberships = user.memberships.filter((m) => m.isActive !== false);
  if (activeMemberships.length === 0) return null;

  if (preferredOrgId) {
    const match = activeMemberships.find((m) => {
      const org = m.organization;
      const id = typeof org === "string" ? org : org?._id || org?.id;
      return id === preferredOrgId;
    });
    if (match) return preferredOrgId;
  }

  // Fallback to first active membership
  const firstOrg = activeMemberships[0].organization;
  return typeof firstOrg === "string" ? firstOrg : firstOrg?._id || firstOrg?.id || null;
}

export function ChainBudgetAuthProvider({ children, asgardeoAuth }: { children: React.ReactNode; asgardeoAuth?: AsgardeoAuthContext | null }) {
  const { state: asgardeoState, signIn, signOut, getAccessToken } = asgardeoAuth || {};

  const [user, setUser] = useState<User | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);

  // activeOrgId: only the org ID is stored — no sensitive data
  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("cb_active_org", id);
    }
  }, []);

  /**
   * CRIT-2 FIX: Session restoration reads exclusively from the HttpOnly cookie via the
   * Next.js proxy route. No localStorage.getItem("cb_token") calls.
   */
  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      try {
        // Clear any legacy localStorage tokens from previous app versions
        clearSession();

        // Restore session from the server-side HttpOnly cookie
        const restoredUser = await restoreSessionFromCookie();

        if (restoredUser && !isCancelled) {
          setUser(restoredUser);
          setWalletAddress(restoredUser.walletAddress);
          setIsConnected(Boolean(restoredUser.walletAddress));

          // F-8 FIX: Validate active org against user memberships
          const savedOrg = typeof window !== "undefined" ? localStorage.getItem("cb_active_org") : null;
          const validOrgId = getValidOrgId(restoredUser, savedOrg);
          setActiveOrgIdState(validOrgId);
          if (typeof window !== "undefined" && validOrgId) {
            localStorage.setItem("cb_active_org", validOrgId);
          }
        }
      } catch (err: unknown) {
        console.error("Session restoration error:", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void restoreSession();
    return () => { isCancelled = true; };
  }, []);

  /**
   * CRIT-2 FIX: When Asgardeo authenticates, we immediately POST the Asgardeo token to
   * the server-side session proxy. The proxy validates it, stores it in an HttpOnly cookie,
   * and returns the user profile. No localStorage involvement.
   */
  useEffect(() => {
    let isCancelled = false;

    const handleAuth = async () => {
      if (asgardeoState?.isAuthenticated) {
        try {
          const token = getAccessToken ? await getAccessToken() : null;
          if (!token) {
            if (!isCancelled) setIsLoading(false);
            return;
          }

          // Establish server-side HttpOnly cookie session
          const sessionUser = await establishCookieSession(token);

          if (!isCancelled && sessionUser) {
            setUser(sessionUser);
            setWalletAddress(sessionUser.walletAddress);
            setIsConnected(Boolean(sessionUser.walletAddress));

            // F-8 FIX: Validate active org against user memberships
            const savedOrg = typeof window !== "undefined" ? localStorage.getItem("cb_active_org") : null;
            const validOrgId = getValidOrgId(sessionUser, savedOrg);
            setActiveOrgIdState(validOrgId);
            if (typeof window !== "undefined" && validOrgId) {
              localStorage.setItem("cb_active_org", validOrgId);
            }
          }
        } catch (err: unknown) {
          console.error("Backend sync failed:", err);
        } finally {
          if (!isCancelled) setIsLoading(false);
        }
      } else if (!asgardeoState?.isLoading && !isCancelled) {
        setIsLoading(false);
      }
    };

    if (!asgardeoState?.isLoading) {
      void handleAuth();
    }

    return () => { isCancelled = true; };
  }, [asgardeoState?.isAuthenticated, asgardeoState?.isLoading, getAccessToken]);

  const performLogout = useCallback(async () => {
    // CRIT-2: DELETE the server-side HttpOnly cookie via the proxy route
    await destroyCookieSession();
    // Clear legacy localStorage keys (safety net for old sessions)
    clearSession();
    if (signOut) void signOut();
    setUser(null);
    setWalletAddress(null);
    setIsConnected(false);
    setActiveOrgIdState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("cb_active_org");
    }
  }, [signOut]);

  // Session expired handler: listen for the event dispatched by api.ts interceptor
  useEffect(() => {
    const handler = async () => {
      await performLogout();
      sessionStorage.removeItem("session_expired_alert");
    };
    window.addEventListener("cb_session_expired", handler);
    return () => window.removeEventListener("cb_session_expired", handler);
  }, [performLogout]);

  const login = useCallback(async () => {
    try {
      if (signIn) await signIn();
    } catch (err: unknown) {
      console.error("Asgardeo sign in error:", err);
    }
  }, [signIn]);

  const register = useCallback(async () => {
    try {
      if (signIn) await signIn();
    } catch (err: unknown) {
      console.error("Asgardeo register error:", err);
    }
  }, [signIn]);

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

  const logout = useCallback(async () => {
    await performLogout();
  }, [performLogout]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<{ user?: User } | User>("/users/me");
      const data = res.data;
      const userData = "user" in data && data.user ? data.user : (data as User);
      if (userData) {
        setUser(userData);
        setWalletAddress(userData.walletAddress);
      }
    } catch (err: unknown) {
      console.error("Failed to refresh user:", err);
    }
  }, []);

  /**
   * CRIT-2 FIX: Re-authenticate with Asgardeo to get a fresh token, then
   * re-establish the HttpOnly cookie session via the proxy route.
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      if (!getAccessToken) return null;
      const freshToken = await getAccessToken();
      if (freshToken) {
        await establishCookieSession(freshToken);
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
