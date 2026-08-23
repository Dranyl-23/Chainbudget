import axios from "axios";
import toast from "react-hot-toast";

/**
 * api.ts — CRIT-2 FIX
 *
 * The Asgardeo access token is no longer stored in localStorage.
 * Instead, it lives in an HttpOnly, Secure, SameSite=Strict cookie set by the
 * Next.js API route at /api/auth/session. The browser sends the cookie
 * automatically on every same-origin request — no manual Authorization header
 * injection is needed or safe here.
 *
 * The Next.js rewrite in next.config.ts proxies /api/* → backend, forwarding
 * the cookie as an Authorization header server-side (invisible to the browser).
 */
const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  // Required so cookies are sent on requests that go through Next.js rewrites
  withCredentials: true,
});

// Store CSRF token in memory (never in localStorage)
let csrfToken: string | null = null;

// Fetch CSRF token on app initialization
async function fetchCSRFToken() {
  try {
    const response = await axios.get("/api/auth/csrf-token", {
      withCredentials: true,
    });
    csrfToken = response.data.csrfToken;
  } catch (error) {
    console.warn("Failed to fetch CSRF token:", error);
  }
}

// Initialize CSRF token on app start
if (typeof window !== "undefined") {
  fetchCSRFToken();
}

// Attach CSRF + Idempotency Key for mutating requests.
// NOTE: No Authorization header injection — the HttpOnly session cookie handles auth.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // Attach CSRF token & Idempotency Key for mutating requests
    if (["post", "put", "patch", "delete"].includes(config.method?.toLowerCase() || "")) {
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
      if (!config.headers["X-Idempotency-Key"]) {
        config.headers["X-Idempotency-Key"] = `cb-web-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      }
    }
  }
  return config;
});

// Handle 401 globally — the session cookie expired; dispatch event to trigger logout.
// Handle 403 CSRF expiry — re-fetch token and retry the request.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      // If a critical action is in progress (e.g. MetaMask signing flow),
      // do NOT trigger the session-expired modal — let the caller handle it.
      const actionInProgress = sessionStorage.getItem("cb_action_in_progress");
      if (!actionInProgress) {
        if (!sessionStorage.getItem("session_expired_alert")) {
          sessionStorage.setItem("session_expired_alert", "true");
          setTimeout(() => {
            // Dispatch event; AuthContext listener will call DELETE /api/auth/session
            window.dispatchEvent(new CustomEvent("cb_session_expired"));
          }, 100);
        }
      }
    }

    // Re-fetch CSRF token if it expired (403)
    if (err.response?.status === 403 && err.response?.data?.error?.includes("CSRF")) {
      return fetchCSRFToken().then(() => {
        if (err.config && csrfToken) {
          err.config.headers["X-CSRF-Token"] = csrfToken;
          return axios(err.config);
        }
        return Promise.reject(err);
      });
    }

    return Promise.reject(err);
  }
);

export default api;




