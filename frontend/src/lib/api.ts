import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

// Store CSRF token in memory
let csrfToken: string | null = null;

// Fetch CSRF token on app initialization
async function fetchCSRFToken() {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/auth/csrf-token`
    );
    csrfToken = response.data.csrfToken;
  } catch (error) {
    console.warn("Failed to fetch CSRF token:", error);
  }
}

// Initialize CSRF token on app start
if (typeof window !== "undefined") {
  fetchCSRFToken();
}

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("cb_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Attach CSRF token for POST/PUT/DELETE requests
    if (["post", "put", "delete"].includes(config.method?.toLowerCase() || "")) {
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }
  }
  return config;
});

// Handle 401 globally — clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      // Prevent multiple alerts if multiple concurrent requests fail
      if (!sessionStorage.getItem("session_expired_alert")) {
        sessionStorage.setItem("session_expired_alert", "true");
        
        setTimeout(() => {
          localStorage.removeItem("cb_token");
          localStorage.removeItem("cb_user");
          window.dispatchEvent(new CustomEvent("cb_session_expired"));
        }, 100); // Small delay to let React finish rendering current state
      }
    }

    // Re-fetch CSRF token if it expired (403)
    if (err.response?.status === 403 && err.response?.data?.error?.includes("CSRF")) {
      return fetchCSRFToken().then(() => {
        // Retry the original request with the new token
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
