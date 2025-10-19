// client/src/utils/api.ts

import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';

// Create a configured Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api', // Use relative path for production
  // Note: Your error logs suggest the base path is /api/ which is handled below.
});

// Interceptor to attach the JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Standard format for JWT: Authorization: Bearer <token>
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});


// Optional: Interceptor to handle expired/invalid tokens globally
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        // If the request fails with 401 Unauthorized, force a logout
        if (error.response && error.response.status === 401) {
            console.error('API call failed with 401 Unauthorized. Forcing logout.');
            // This ensures the user state is reset if their token is rejected
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);


export default api;