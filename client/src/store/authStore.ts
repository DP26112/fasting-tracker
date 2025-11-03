// client/src/store/authStore.ts

import { create } from 'zustand';
import axios, { AxiosError } from 'axios';
import { isTokenExpired, logTokenDebugInfo } from '../utils/tokenValidation';

// Minimal User type to avoid TS errors (project may define a richer type in ../types)
type User = {
  id?: string;
  email?: string;
};

type AuthStore = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;

  // actions
  login: (email: string, password: string) => Promise<boolean>;
  loginWithToken: (token: string, user?: User | null) => void;
  logout: () => void;
  initializeAuth: () => Promise<void>;
};

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const useAuthStore = create<AuthStore>((set, get) => {
  // call get() once to avoid unused-parameter errors; harmless read
  const _initial = get();
  void _initial;

  return {
    user: null,
    token: null, // Don't read from localStorage here - wait for initializeAuth
    isAuthenticated: false, // Start as false until properly initialized
    isLoading: true, // Start in loading state to block rendering
    authError: null,

    // Login using email + password
    login: async (email: string, password: string) => {
      set({ isLoading: true, authError: null });
      try {
        const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
        const { user, token } = response.data;

        if (!token) {
          set({ authError: 'No token received from server.', isLoading: false });
          return false;
        }

        localStorage.setItem('token', token);
        console.log('✅ Login successful - token saved to localStorage');
        set({ token, user: user || null, isAuthenticated: true, isLoading: false, authError: null });
        return true;
      } catch (err) {
        const errResp: any = (err as AxiosError).response;
        const errorMessage = errResp?.data?.message || 'Login failed: Invalid credentials.';
        set({ authError: errorMessage, isLoading: false });
        console.error('❌ Login failed:', (err as AxiosError).message);
        return false;
      }
    },

    // Use an existing token (e.g. right after registration)
    loginWithToken: (token: string, user: User | null = null) => {
      localStorage.setItem('token', token);
      console.log('✅ Token login - token saved to localStorage');
      set({ token, user, isAuthenticated: true, authError: null, isLoading: false });
    },

    logout: () => {
      localStorage.removeItem('token');
      console.log('🚪 Logout - token removed from localStorage');
      set({ token: null, user: null, isAuthenticated: false });
      
      // Note: Active fast store will be cleared via resetFast() call in App.tsx
      // to avoid circular dependencies between stores
    },

    // CRITICAL: Async initialization that blocks app rendering until complete
    initializeAuth: async () => {
      console.log('🔄 Starting auth initialization...');
      logTokenDebugInfo(); // Log comprehensive token info for debugging
      
      set({ isLoading: true });
      
      // Small delay to ensure localStorage is ready on mobile browsers
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('ℹ️ No token found - user is not authenticated');
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      console.log(`📦 Token found (length: ${token.length})`);

      // Check if token is expired before using it
      if (isTokenExpired(token)) {
        console.warn('⚠️ Token is expired - clearing and logging out');
        localStorage.removeItem('token');
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      console.log('✅ Token is valid and not expired');

      // Verify token with server to ensure it's still valid
      try {
        console.log('🔐 Verifying token with server...');
        
        // Create a one-time axios instance with the token to verify it
        const response = await axios.get(`${API_BASE}/user-status`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const { userId, email } = response.data;
        console.log('✅ Token verified with server - user authenticated:', email);
        
        set({ 
          token, 
          user: { id: userId, email },
          isAuthenticated: true, 
          isLoading: false,
          authError: null 
        });
      } catch (error) {
        console.error('❌ Token verification failed - logging out', error);
        // Token is invalid - clear it
        localStorage.removeItem('token');
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      }
    },
  };
});