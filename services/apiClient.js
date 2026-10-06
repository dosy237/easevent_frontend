import axios from 'axios';

import { API_BASE } from '../config';
import { KEYS, getItem, setItem, clearSession } from './storage';

const API_URL = API_BASE;

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ────────────────────
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getItem(KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: auto-refresh on 401 + auto-logout ─────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

// Reference to logout callback — set by AuthContext at startup
let _logoutCallback = null;
export const setLogoutCallback = (fn) => { 
  _logoutCallback = fn; 
};

const triggerLogout = async () => {
  console.warn('[apiClient] Forcing logout due to auth failure');
  delete apiClient.defaults.headers.common.Authorization;
  if (_logoutCallback) {
    await _logoutCallback();
  } else {
    // Fallback: clear stored session if context hasn't registered callback yet
    await clearSession();
    // Note: This won't trigger a React rerender, but next mount will follow suit
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only retry once, and only for 401s
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      // If we already retried and still got 401 → session toast
      console.error('[apiClient] 401 on retried request → session expired');
      await triggerLogout();
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      console.log('[apiClient] Already refreshing, queuing request:', originalRequest.url);
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getItem(KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        console.warn('[apiClient] 401: No refresh token found');
        await triggerLogout();
        return Promise.reject(error);
      }

      console.log('[apiClient] 401: Attempting token refresh...');

      // Call refresh endpoint directly with axios (not apiClient) to avoid interceptor loop
      const { data } = await axios.post(`${API_URL}/api/auth/token/refresh/`, {
        refresh: refreshToken,
      });

      const newAccessToken = data.access;

      // Persist the new tokens (the refresh token rotates on each use)
      await setItem(KEYS.ACCESS_TOKEN, newAccessToken);
      if (data.refresh) await setItem(KEYS.REFRESH_TOKEN, data.refresh);

      // Update the default header for future requests
      apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;

      // Process any queued requests that were waiting for the refresh
      console.log('[apiClient] Refresh successful, retrying queued requests');
      processQueue(null, newAccessToken);

      // Retry the original request with the new token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);

    } catch (refreshError) {
      console.error('[apiClient] Refresh failed:', refreshError.response?.status || refreshError.message);
      // Refresh failed → force logout so the user can re-login
      processQueue(refreshError, null);
      await triggerLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export { apiClient, API_URL };
