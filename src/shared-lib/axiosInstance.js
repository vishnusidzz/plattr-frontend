import axios from "axios";

/**
 * API BASE
 * - Dev  → http://localhost:8000
 * - Prod → /api  (Caddy handles it)
 */
const baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? ""
    : "http://localhost:8000");

const axiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Public endpoints (NO auth header)
const PUBLIC_ENDPOINTS = [
  "/auth/send-otp/",
  "/auth/verify-otp/",
  "/auth/signup/",
  "/auth/token/",
  "/auth/token/refresh/",
];

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");

    // IMPORTANT: DO NOT touch config.url
    const isPublic = PUBLIC_ENDPOINTS.some((p) =>
      config.url?.startsWith(p)
    );

    if (token && !isPublic) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;