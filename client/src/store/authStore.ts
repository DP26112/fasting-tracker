// client/src/store/authStore.ts

import { create } from 'zustand';
import axios, { AxiosError } from 'axios';

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
  initializeAuth: () => Promise<void> | void;
};

const API_BASE = 'http://localhost:3001/api';

export const useAuthStore = create<AuthStore>((set, get) => {
  // call get() once to avoid unused-parameter errors; harmless read
  const _initial = get();
  void _initial;

  return {
    user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false, // will be set after initializeAuth verifies or refreshes
    isLoading: false,
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
        set({ token, user: user || null, isAuthenticated: true, isLoading: false, authError: null });
        return true;
      } catch (err) {
        const errResp: any = (err as AxiosError).response;
        const errorMessage = errResp?.data?.message || 'Login failed: Invalid credentials.';
        set({ authError: errorMessage, isLoading: false });
        console.error('Login failed:', (err as AxiosError).message);
        return false;
      }
    },

    // Use an existing token (e.g. right after registration)
    loginWithToken: (token: string, user: User | null = null) => {
      localStorage.setItem('token', token);
      set({ token, user, isAuthenticated: true, authError: null, isLoading: false });
    },

    logout: () => {
      localStorage.removeItem('token');
      set({ token: null, user: null, isAuthenticated: false });
    },

    // Optional: initialize on app start (can be called from App or main)
    initializeAuth: async () => {
      // Attempt to obtain an access token using httpOnly refresh cookie via /auth/refresh
      try {
        const resp = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const accessToken = resp.data?.accessToken || null;
        if (accessToken) {
          // Optionally we can fetch /auth/me for user info
          try {
            const me = await axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
            const user = me.data?.user ?? null;
            set({ token: accessToken, user, isAuthenticated: true });
            return;
          } catch (meErr) {
            // If /auth/me fails, still set token so subsequent calls can use it
            set({ token: accessToken, isAuthenticated: true });
            return;
          }
        }
      } catch (err) {
        // No refresh cookie or refresh failed
        console.warn('initializeAuth: refresh failed or not present; remaining logged out');
      }
      set({ token: null, user: null, isAuthenticated: false });
    },
  };
});