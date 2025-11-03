// client/src/utils/api.ts

import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import { isTokenExpired } from './tokenValidation';

// Create a configured Axios instance
// NOTE: For production deployments we hardcode the official API domain to
// avoid any mismatch with proxying or environment loading.
const api = axios.create({
  baseURL: 'https://fasting.davorinpiljic.com/api',
});

// Interceptor to attach the JWT token to every request
// CRITICAL: Always read from localStorage on each request to avoid stale tokens
api.interceptors.request.use((config) => {
  // Always fetch the token fresh from localStorage for each request
  // This prevents race conditions where a token is set but not yet in memory
  const token = localStorage.getItem('token');
  
  if (token) {
    // Check if token is expired before sending the request
    if (isTokenExpired(token)) {
      console.warn('⚠️ API request blocked - token is expired');
      localStorage.removeItem('token');
      useAuthStore.getState().logout();
      return Promise.reject(new Error('Token expired'));
    }
    
    // Standard format for JWT: Authorization: Bearer <token>
    config.headers.Authorization = `Bearer ${token}`;
    console.log(`🔐 API ${config.method?.toUpperCase()} ${config.url} - token attached`);
  } else {
    console.log(`📡 API ${config.method?.toUpperCase()} ${config.url} - no token (unauthenticated request)`);
  }
  
  return config;
}, (error) => {
  console.error('❌ Request interceptor error:', error);
  return Promise.reject(error);
});


// Optional: Interceptor to handle expired/invalid tokens globally
api.interceptors.response.use(
    (response) => {
      console.log(`✅ API ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
      return response;
    },
    (error: AxiosError) => {
        // If the request fails with 401 Unauthorized, force a logout
        if (error.response && error.response.status === 401) {
            console.error('❌ API call failed with 401 Unauthorized. Forcing logout.');
            console.error('   Request:', error.config?.method?.toUpperCase(), error.config?.url);
            console.error('   Response:', error.response.data);
            
            // This ensures the user state is reset if their token is rejected
            localStorage.removeItem('token');
            useAuthStore.getState().logout();
        } else if (error.response) {
          console.error(`❌ API ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response.status}`);
        } else {
          console.error('❌ API request failed:', error.message);
        }
        
        return Promise.reject(error);
    }
);


export default api;