// client/src/utils/api.ts

import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';

// Create a configured Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api', // Adjust base URL as needed
  withCredentials: true, // allow sending httpOnly refresh cookies
});

// Interceptor to attach the JWT token to every request
api.interceptors.request.use((config) => {
  // Prefer token from the auth store (keeps runtime in-memory token consistent)
  const token = useAuthStore.getState().token || localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});


// Optional: Interceptor to handle expired/invalid tokens globally
// Response interceptor: if a request fails with 401, attempt a single refresh and retry
let isRefreshing = false;
let failedQueue: Array<{resolve: (val?: any) => void, reject: (err: any) => void}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(p => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (token) originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const resp = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/refresh`, {}, { withCredentials: true });
        const newToken = resp.data && resp.data.accessToken;
        if (newToken) {
          // Update auth store and retry all queued requests
          useAuthStore.getState().loginWithToken(newToken, useAuthStore.getState().user || null);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // For other errors or exhausted retries, log out on 401
    if (error.response && error.response.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);


export default api;