// client/src/components/FastNoteInput.tsx

import React, { useState, useCallback } from 'react';
import { TextField, Button, Box } from '@mui/material';
import { NoteAdd } from '@mui/icons-material';

interface FastNoteInputProps {
    // This prop will replace the old handleAddNote function logic
    onAddNote: (note: string) => void;
    disabled?: boolean;
}

// 🎯 Defining a consistent height variable for perfect alignment
const NOTE_INPUT_HEIGHT = 40; 

/**
 * Component to handle note input, isolated with React.memo to prevent
 * the parent component (FastingTimer) from re-rendering on every keystroke.
 */
const FastNoteInput: React.FC<FastNoteInputProps> = React.memo(({ onAddNote, disabled = false }) => {
    // The note text state is now local and isolated here.
    const [noteText, setNoteText] = useState('');

    // Handle input changes (only re-renders FastNoteInput, which is fast)
    const handleNoteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setNoteText(e.target.value);
    }, []);

    // Handle submission (calls the parent's function once)
    const handleSubmit = useCallback(() => {
        const trimmedText = noteText.trim();
        if (trimmedText) {
            onAddNote(trimmedText); // Call the parent's logic
            setNoteText(''); // Clear the input
        }
    }, [noteText, onAddNote]);

    // Handle Enter key for quick submission
    const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && noteText.trim()) {
            e.preventDefault();
            handleSubmit();
        }
    }, [noteText, handleSubmit]);

    return (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
                fullWidth
                label="Add note"
                variant="outlined"
                // Using 'small' size as a base, but height will be overridden
                size="small" 
                value={noteText}
                onChange={handleNoteChange}
                onKeyPress={handleKeyPress}
                disabled={disabled}
                // 🔑 FIX 1: Set explicit height on the wrapper (FormControl)
                sx={{ 
                    input: { color: 'white', height: '100%' }, 
                    flexGrow: 1,
                    height: `${NOTE_INPUT_HEIGHT}px`, // Sets the total height of the component wrapper
                    '& .MuiInputBase-root': { height: '100%' } // Forces the internal input element to match
                }}
            />
            <Button
                variant="contained"
                color="secondary"
                onClick={handleSubmit}
                disabled={disabled || !noteText.trim()}
                startIcon={<NoteAdd />}
                // Using 'small' size as a base
                size="small" 
                sx={{ 
                    minWidth: '100px', 
                    whiteSpace: 'nowrap',
                    // 🔑 FIX 2: Set explicit height on the Button
                    height: `${NOTE_INPUT_HEIGHT}px`, 
                    // Remove default small padding to center text within the fixed height
                    paddingTop: 0, 
                    paddingBottom: 0,
                }} 
            >
                Log Note
            </Button>
        </Box>
    );
});

export default FastNoteInput;