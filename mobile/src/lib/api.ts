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

  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  
  // 1. Enforce HTTPS in production
  if (!fullUrl.startsWith('https://')) {
    console.error('[Security] Insecure HTTP transport rejected in production:', fullUrl);
    return false;
  }

  // 2. Validate trusted domain
  if (!fullUrl.includes(TRUSTED_PRODUCTION_HOST)) {
    console.error('[Security] Untrusted host connection rejected in production:', fullUrl);
    return false;
  }

  return true;
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
    csrfToken = res.data.csrfToken ?? null;
    return csrfToken;
  } catch (err) {
    console.warn('[API] Failed to fetch CSRF token:', err);
    return null;
  }
}

// ── Request Interceptor ───────────────────────────────────────────────────────
// Dynamic route timeout tuning + Certificate/Host integrity + Auth token + CSRF injection
api.interceptors.request.use(async (config) => {
  const url = config.url || '';

  // 0. Production Transport & Host Security Check
  if (!validateHostSecurity(url)) {
    return Promise.reject(new Error('Security violation: Untrusted host or insecure connection rejected'));
  }

  // 1. Dynamic Timeout Tuning based on route workload
  if (!config.timeout || config.timeout === 20000) {
    if (url.includes('/ai/') || url.includes('/scan-receipt')) {
      config.timeout = 45000; // AI multimodal operations (Gemini / OCR) take up to 45s
    } else if (
      url.includes('/transactions') ||
      url.includes('/approvals') ||
      url.includes('/dao/') ||
      url.includes('/escrow')
    ) {
      config.timeout = 30000; // Blockchain cryptographic checks / indexing take up to 30s
    } else {
      config.timeout = 20000; // Standard REST endpoints: 20s
    }
  }


  // 2. Attach JWT
  const token = await getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 3. Attach CSRF for mutating requests
  if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
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
    // Emit a global event that AuthContext listens for to clear session + navigate to login.
    // Uses an EventEmitter pattern via a global flag so AuthContext can react.
    if (status === 401) {
      // Signal the AuthContext (via a module-level emitter set by setSessionExpiredHandler)
      if (sessionExpiredHandler) {
        sessionExpiredHandler();
      }
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
