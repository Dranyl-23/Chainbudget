/**
 * AuthContext.tsx
 *
 * Provides authentication state and actions for the ChainBudget mobile app.
 *
 * This is a full rewrite from the Asgardeo OIDC implementation.
 * Authentication is now driven by:
 *   - On-device BIP-44 HD wallet (ethers.js)
 *   - expo-secure-store (hardware-backed key storage)
 *   - ECDSA challenge-response → ChainBudget JWT (backend)
 *
 * Asgardeo / OAuth2 / expo-auth-session are no longer used in mobile.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchCurrentUser, loginWithWallet, logout as authLogout, AuthUser } from '../lib/auth';
import { hasWallet, getWalletAddress, clearAll } from '../lib/secureStorage';
import api from '../lib/api';

// ── Context types ──────────────────────────────────────────────────────────────

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;

  /** True if wallet keys exist on this device (user may still need to log in). */
  hasLocalWallet: boolean;

  /**
   * Login with the device's stored wallet.
   * Triggers biometric prompt → signs challenge → gets JWT.
   */
  login: (walletAddress: string) => Promise<void>;

  /** Clear session and navigate to login screen. Keys remain for re-login. */
  logout: () => Promise<void>;

  /** Refresh user profile from backend (e.g. after profile update). */
  refreshUser: () => Promise<void>;

  /** Reset local wallet state (used when the wallet is manually cleared). */
  resetWalletState: () => void;
};

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [hasLocalWallet, setHasLocalWallet] = useState(false);

  // On mount: check for existing session / wallet
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    setIsLoading(true);
    try {
      // Check if wallet keys exist on this device
      const walletExists = await hasWallet();
      setHasLocalWallet(walletExists);

      if (!walletExists) {
        // No wallet — send to register/restore screen
        setUser(null);
        return;
      }

      // Wallet exists — try to restore the session from a stored JWT
      const currentUser = await fetchCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      } else {
        // JWT expired or missing — user needs to re-authenticate
        // Keep hasLocalWallet true so LoginScreen shows "Sign In" not "Register"
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (walletAddress: string) => {
    const loggedInUser = await loginWithWallet(walletAddress);
    setUser(loggedInUser);
  };

  const logout = async () => {
    await authLogout();
    setUser(null);
  };

  const refreshUser = async () => {
    const user = await fetchCurrentUser();
    setUser(user);
  };

  const resetWalletState = () => {
    setHasLocalWallet(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        hasLocalWallet,
        login,
        logout,
        refreshUser,
        resetWalletState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
