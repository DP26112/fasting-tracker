// client/src/store/useAuthStore.ts

import { create } from 'zustand';
import axios from 'axios';

// 🔑 CRITICAL: Set this once globally to send HTTP-only cookies
axios.defaults.withCredentials = true;

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface AuthState {
    userId: string | null;
    userEmail: string | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    
    // Actions
    login: (id: string, email: string) => void;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    userId: null,
    userEmail: null,
    isLoggedIn: false,
    isLoading: true, // Initially true while checking session

    // 1. Manual Login Action (Called after successful login API call)
    login: (id: string, email: string) => {
        set({
            userId: id,
            userEmail: email,
            isLoggedIn: true,
            isLoading: false,
        });
    },

    // 2. Logout Action
    logout: async () => {
        set({ isLoading: true });
        try {
            // Call the protected backend logout endpoint
            await axios.post(`${API_URL}/logout`);
        } catch (error) {
            console.error('Logout API error, but clearing client state anyway:', error);
        } finally {
            // Clear all user state
            set({
                userId: null,
                userEmail: null,
                isLoggedIn: false,
                isLoading: false,
            });
            
            // ⚠️ IMPORTANT: Clear the ActiveFastStore if a user logs out
            // We'll address this after creating the ActiveFastStore
            // Example: useActiveFastStore.getState().resetFast();
        }
    },

    // 3. Check Auth Status on Component Mount/Refresh
    checkAuth: async () => {
        // Use the new protected endpoint to verify the token and get user data
        set({ isLoading: true });
        try {
            const response = await axios.get(`${API_URL}/user-status`);
            
            // If the call succeeds (200 OK), the token is valid
            get().login(response.data.userId, response.data.email);

        } catch (error) {
            // If the call fails (401 Unauthorized), the token is invalid/missing
            set({ 
                userId: null, 
                userEmail: null, 
                isLoggedIn: false, 
                isLoading: false 
            });
        }
    },
}));

// Initial check on load (can be run in main.tsx or App.tsx)
// To ensure the store checks authentication immediately when the app starts.
// NOTE: We will trigger this check directly in the root App component.