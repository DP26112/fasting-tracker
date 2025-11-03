// client/src/store/useActiveFastStore.ts

import { create } from 'zustand';
import api from '../utils/api'; // Use the configured axios instance with auth interceptor
import type { Note, FastType } from '../types'; // Import your types

interface ActiveFastState {
    isFasting: boolean;
    startTime: string | null;
    fastType: FastType;
    notes: Note[];
    isLoading: boolean;

    // Actions
    startFast: (startTime: string, fastType: FastType) => Promise<void>;
    stopFast: (endTime: string, durationHours: number) => Promise<boolean>;
    addNote: (note: Note) => Promise<void>;
    deleteNote: (noteId: string) => Promise<void>;
    resetFast: () => Promise<void>;
    loadActiveFast: () => Promise<void>;
}

export const useActiveFastStore = create<ActiveFastState>((set, get) => ({
    // Initial state - will be populated by loadActiveFast on app start
    isFasting: false,
    startTime: null,
    fastType: 'wet',
    notes: [],
    isLoading: false,

    // Load active fast from server (call this on app initialization)
    loadActiveFast: async () => {
        set({ isLoading: true });
        try {
            const response = await api.get('/active-fast');
            const { active } = response.data;
            if (active) {
                set({
                    isFasting: true,
                    startTime: active.startTime,
                    fastType: active.fastType,
                    notes: active.notes || [],
                    isLoading: false,
                });
            } else {
                set({ isLoading: false });
            }
        } catch (error: any) {
            // 404 means no active fast - this is normal
            if (error.response?.status === 404) {
                set({
                    isFasting: false,
                    startTime: null,
                    fastType: 'wet',
                    notes: [],
                    isLoading: false,
                });
            } else {
                console.error('Failed to load active fast:', error);
                set({ isLoading: false });
            }
        }
    },

    // 1. Action to start a new fast - persists to server
    startFast: async (startTime, fastType) => {
        try {
            await api.post('/active-fast', {
                startTime,
                fastType,
                notes: []
            });
            
            set({ 
                isFasting: true, 
                startTime, 
                fastType, 
                notes: []
            });
        } catch (error) {
            console.error('Failed to start fast on server:', error);
            throw error;
        }
    },
    
    // 2. Action to stop a fast and log it
    stopFast: async (endTime, durationHours) => {
        const { startTime, fastType, notes } = get();
        
        if (!startTime) return false;

        try {
            // Save the completed fast
            await api.post('/save-fast', {
                startTime,
                endTime,
                durationHours,
                fastType,
                notes: notes.reverse(),
            });

            // Clear the active fast on the server
            await get().resetFast();
            return true;

        } catch (error) {
            console.error('Failed to save fast:', error);
            // Even if save fails, clear the active fast
            await get().resetFast();
            return false;
        }
    },

    // 3. Action to add a note - updates server
    addNote: async (note) => {
        const currentNotes = get().notes;
        const updatedNotes = [note, ...currentNotes];
        
        try {
            // Update the active fast on the server with new notes
            await api.post('/active-fast', {
                startTime: get().startTime,
                fastType: get().fastType,
                notes: updatedNotes
            });
            
            set({ notes: updatedNotes });
        } catch (error) {
            console.error('Failed to add note:', error);
            throw error;
        }
    },

    // 4. Action to delete a note - updates server
    deleteNote: async (noteId) => {
        const updatedNotes = get().notes.filter(note => note.id !== noteId);
        
        try {
            // Update the active fast on the server with filtered notes
            await api.post('/active-fast', {
                startTime: get().startTime,
                fastType: get().fastType,
                notes: updatedNotes
            });
            
            set({ notes: updatedNotes });
        } catch (error) {
            console.error('Failed to delete note:', error);
            throw error;
        }
    },

    // 5. Action to clear the state and delete from server
    resetFast: async () => {
        try {
            await api.delete('/active-fast');
        } catch (error) {
            console.error('Failed to clear active fast on server:', error);
        }
        
        set({
            isFasting: false,
            startTime: null,
            fastType: 'wet',
            notes: [],
        });
    }
})); 