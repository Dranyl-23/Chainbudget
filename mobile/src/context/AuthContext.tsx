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

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { fetchCurrentUser, loginWithWallet, logout as authLogout, AuthUser } from '../lib/auth';
import { hasWallet, getWalletAddress, clearAll } from '../lib/secureStorage';
import api, { setSessionExpiredHandler } from '../lib/api';
import { registerForPushNotifications } from '../lib/notifications';

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

  // Track whether the user is actively logged in so AppState handler skips
  // unnecessary revalidation during initial load or when already logged out.
  const isLoggedInRef = useRef(false);

  // On mount: check for existing session / wallet
  useEffect(() => {
    initSession();
  }, []);

  // ── AppState: Revalidate JWT when app returns to foreground ────────────────
  // If the JWT expired while the app was backgrounded (e.g. left open overnight),
  // the next API call would fail silently with 401. We proactively check on resume
  // and log the user out gracefully if the token is no longer valid.
  useEffect(() => {
    let cancelled = false;
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active' && isLoggedInRef.current) {
        try {
          const currentUser = await fetchCurrentUser();
          if (cancelled) return;
          if (!currentUser) {
            // JWT expired while backgrounded — log out cleanly
            console.log('[AuthContext] JWT expired in background — logging out');
            await performLogout();
          } else {
            // Refresh user data in case org memberships or profile changed
            setUser(currentUser);
          }
        } catch {
          // Network error on resume — don't log out, let the next action surface the error
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  // ── 401 Interceptor Registration ───────────────────────────────────────────
  // Register our logout function with the api.ts response interceptor so any
  // 401 from any API call (even deep in a screen) triggers a clean session expiry.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (isLoggedInRef.current) {
        console.log('[AuthContext] 401 received — session expired, logging out');
        performLogout();
      }
    });
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
        isLoggedInRef.current = true;
        registerForPushNotifications().catch(() => {});
      } else {
        // JWT expired or missing — user needs to re-authenticate
        // Keep hasLocalWallet true so LoginScreen shows "Sign In" not "Register"
        setUser(null);
        isLoggedInRef.current = false;
      }
    } catch (err) {
      setUser(null);
      isLoggedInRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  const performLogout = async () => {
    await authLogout();
    setUser(null);
    isLoggedInRef.current = false;
  };

  const login = async (walletAddress: string) => {
    const loggedInUser = await loginWithWallet(walletAddress);
    setUser(loggedInUser);
    isLoggedInRef.current = true;
    registerForPushNotifications().catch(() => {});
  };

  const logout = async () => {
    await performLogout();
  };

  const refreshUser = async () => {
    const updatedUser = await fetchCurrentUser();
    setUser(updatedUser);
  };

  const resetWalletState = () => {
    setHasLocalWallet(false);
    setUser(null);
    isLoggedInRef.current = false;
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

