// src/store/authStore.ts

import { create } from 'zustand';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api/auth';

// 1. Define the store state and actions
interface AuthState {
    token: string | null;
    isAuthenticated: boolean;
    authError: string | null;
    isLoading: boolean;
    
    // Actions
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    
    // Utility to get the token, useful for request headers
    getToken: () => string | null;
}

// 2. Create the Zustand store
export const useAuthStore = create<AuthState>((set, get) => ({
    // Initial State: Load token from local storage immediately
    token: localStorage.getItem('jwtToken'),
    isAuthenticated: !!localStorage.getItem('jwtToken'),
    authError: null,
    isLoading: false,

    getToken: () => get().token, // Simple getter for convenience

    login: async (email, password) => {
        set({ authError: null, isLoading: true });
        try {
            const response = await axios.post(`${API_URL}/login`, { email, password });
            const newToken = response.data.token;

            // Update store state
            set({ 
                token: newToken, 
                isAuthenticated: true 
            });
            
            // Persist token
            localStorage.setItem('jwtToken', newToken);
        } catch (err: any) {
            console.error('Login failed:', err);
            const message = err.response?.data?.message || 'Login failed. Check credentials.';
            set({ authError: message });
            throw new Error(message); // Throw to let the calling component handle UI feedback
        } finally {
            set({ isLoading: false });
        }
    },

    logout: () => {
        set({ token: null, isAuthenticated: false, authError: null });
        localStorage.removeItem('jwtToken');
    },
}));