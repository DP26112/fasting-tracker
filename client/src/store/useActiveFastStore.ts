// client/src/store/useActiveFastStore.ts

import { create } from 'zustand';
import axios from 'axios';
import type { Note, FastType } from '../types'; // Import your types

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ActiveFastState {
    isFasting: boolean;
    startTime: string | null;
    fastType: FastType;
    notes: Note[];

    // Actions
    startFast: (startTime: string, fastType: FastType) => Promise<void>;
    stopFast: (endTime: string, durationHours: number) => Promise<boolean>;
    addNote: (note: Note) => Promise<void>;
    deleteNote: (noteId: string) => Promise<void>;
    resetFast: () => void;
    // We'll add a loadFastFromServer action later
}

export const useActiveFastStore = create<ActiveFastState>((set, get) => ({
    // Initial state derived from FastingTimer's original local state/localStorage
    isFasting: false, // Will be set to true on load if a fast is running on the server
    startTime: null,
    fastType: 'wet',
    notes: [],

    // 1. Action to start a new fast (Server-side persistence logic will go here later)
    startFast: async (startTime, fastType) => {
        // ⚠️ Placeholder: We will add the API call to POST /api/active-fast/start here later
        set({ 
            isFasting: true, 
            startTime, 
            fastType, 
            notes: [] // Clear previous notes
        });
    },
    
    // 2. Action to stop a fast and log it (This replaces the handleConfirmStopFast logic)
    stopFast: async (endTime, durationHours) => {
        // Get the current state values before resetting
        const { startTime, fastType, notes } = get();
        
        if (!startTime) return false;

        try {
            await axios.post(`${API_URL}/save-fast`, {
                startTime,
                endTime,
                durationHours,
                fastType,
                notes: notes.reverse(),
            });

            get().resetFast(); // Reset the global state on success
            return true; // Indicate success

        } catch (error) {
            console.error('Failed to save fast:', error);
            // Even if save fails, we should technically reset the live fast state
            get().resetFast();
            return false; // Indicate failure
        }
    },

    // 3. Action to add a note
    addNote: async (note) => {
        // ⚠️ Placeholder: We will add the API call to POST /api/active-fast/note here later
        // For now, we update local state
        set(state => ({
            notes: [note, ...state.notes]
        }));
    },

    // 4. Action to delete a note
    deleteNote: async (noteId) => {
         // ⚠️ Placeholder: We will add the API call to PATCH /api/active-fast/note here later
         // For now, we update local state
        set(state => ({
            notes: state.notes.filter(note => note.id !== noteId)
        }));
    },

    // 5. Action to clear the state entirely
    resetFast: () => {
        set({
            isFasting: false,
            startTime: null,
            fastType: 'wet',
            notes: [],
        });
        // ⚠️ IMPORTANT: When we move the active fast to the server, this will also trigger a DELETE call to the server
    }
})); 