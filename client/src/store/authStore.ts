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
    isAuthenticated: !!localStorage.getItem('token'),
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
      const token = localStorage.getItem('token');
      if (!token) return;

      // Optionally verify token with server; keep it simple for now and mark authenticated
      set({ token, isAuthenticated: true });
    },
  };
});