import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSessionToken } from './secureStorage';

// Production cloud backend by default; overridable via EXPO_PUBLIC_API_URL, extra.apiUrl, or devHost
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  (devHost ? `http://${devHost}:5001/api` : 'https://chainbudget-api.fly.dev/api');

const TRUSTED_PRODUCTION_HOST = 'chainbudget-api.fly.dev';

/**
 * Validates HTTPS transport security and trusted host integrity in production builds.
 */
export function validateHostSecurity(url: string): boolean {
  if (__DEV__) return true; // Bypass in local development / Expo Go

  try {
    const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    const parsed = new URL(fullUrl);
    
    // 1. Enforce HTTPS in production
    if (parsed.protocol !== 'https:') {
      console.error('[Security] Insecure HTTP transport rejected in production:', fullUrl);
      return false;
    }

    // 2. Validate exact trusted host or subdomain
    if (parsed.hostname !== TRUSTED_PRODUCTION_HOST && !parsed.hostname.endsWith(`.${TRUSTED_PRODUCTION_HOST}`)) {
      console.error('[Security] Untrusted host connection rejected in production:', parsed.hostname);
      return false;
    }

    return true;
  } catch {
    console.error('[Security] Invalid URL format rejected:', url);
    return false;
  }
}

function generateSecureIdempotencyKey(): string {
  try {
    const bytes = new Uint8Array(8);
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(bytes);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `cb-mob-${Date.now()}-${hex}`;
    }
  } catch {}
  return `cb-mob-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000, // Global default 20s
});

// ── Module-level CSRF token ───────────────────────────────────────────────────
// Cached after first fetch. Cleared automatically when a 403 indicates expiry.
let csrfToken: string | null = null;

/** Fetch a fresh CSRF token from the backend and cache it. */
async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await axios.get(`${API_URL}/auth/csrf-token`);
    csrfToken = res.data?.csrfToken || null;
    return csrfToken;
  } catch (err: any) {
    console.warn('[api] Failed to fetch CSRF token:', err.message);
    return null;
  }
}

// ── Request Interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  // 0. Host transport security validation in production
  const requestUrl = config.url || '';
  if (!validateHostSecurity(requestUrl)) {
    return Promise.reject(new Error(`[Security] Connection to untrusted host rejected in production build.`));
  }

  // 1. Dynamic Timeout Tuning: give complex AI / IPFS uploads more headroom
  const isAiUpload = requestUrl.includes('/ai/') || requestUrl.includes('/receipt') || requestUrl.includes('/ipfs');
  config.timeout = isAiUpload ? 45000 : 20000;

  // 2. Attach JWT Session Token from hardware SecureStore
  const token = await getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 3. Attach CSRF token & Idempotency Key for all state-mutating requests
  const method = (config.method || '').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isMutating) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    // Enterprise Idempotency: Protect against duplicate submissions & double-spending
    if (!config.headers['X-Idempotency-Key']) {
      config.headers['X-Idempotency-Key'] = generateSecureIdempotencyKey();
    }
  }

  return config;
});


// ── Response Interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;

    // ── 403: CSRF token expired ──────────────────────────────────────────────
    // The backend security.js sets CSRF token expiry to 1 hour.
    // When it expires, clear the cached token, fetch a fresh one, and retry once.
    if (status === 403 && err.response?.data?.error?.toLowerCase().includes('csrf')) {
      csrfToken = null; // Force re-fetch
      const freshToken = await fetchCsrfToken();
      if (freshToken && err.config) {
        err.config.headers['X-CSRF-Token'] = freshToken;
        // Retry the original request with the fresh CSRF token
        return axios(err.config);
      }
    }

    // ── 401: Session expired ─────────────────────────────────────────────────
    // Only trigger session logout if the 401 is an authentic token failure,
    // not a business logic / signature error.
    if (status === 401) {
      const errorMsg = String(err.response?.data?.error || '').toLowerCase();
      const isSignatureError = errorMsg.includes('signature') || errorMsg.includes('mismatch') || errorMsg.includes('wallet');
      if (!isSignatureError && sessionExpiredHandler) {
        sessionExpiredHandler();
      }
    }

    // ── Network / Offline Error Handling (M-4) ───────────────────────────────
    if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      err.userFriendlyMessage = 'You are currently offline. Please check your internet connection and try again.';
    }

    return Promise.reject(err);
  }
);

// ── Session Expired Callback ──────────────────────────────────────────────────
// AuthContext registers its logout function here so the interceptor can
// trigger logout without importing AuthContext (which would create a circular dep).
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
}

export default api;
