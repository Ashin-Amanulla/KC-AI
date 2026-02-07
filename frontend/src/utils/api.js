import axios from 'axios';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT tokens
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only clear token for actual authentication failures, not ShiftCare API errors
    if (error.response?.status === 401) {
      const isShiftCareError = error.response?.data?.shiftcareApiError;
      const isAuthEndpoint = error.config?.url?.includes('/api/auth/');
      const errMsg = typeof error.response?.data?.error === 'string'
        ? error.response.data.error
        : error.response?.data?.error?.message || '';
      const isTokenError = errMsg.toLowerCase().includes('token');

      // Only clear token if it's an auth endpoint failure or token-related error
      // Don't clear for ShiftCare API errors (which now return 502)
      if (!isShiftCareError && (isAuthEndpoint || isTokenError)) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        console.error('Authentication failed - token cleared');
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extract user-friendly error message from API error response.
 * Handles both { error: "string" } and { error: { message: "string" } } formats.
 */
export const getErrorMessage = (err) => {
  const e = err?.response?.data?.error;
  if (typeof e === 'string') return e;
  if (e?.message) return e.message;
  return err?.message || 'An error occurred';
};

export default api;
