// client/src/FastingTimer.tsx
// Temporary Cache Buster: Oct 3 2025, 11:35 AM <--- ADD THIS LINE

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Typography, Box, Card, CardContent, Button,
    TextField, ToggleButton, ToggleButtonGroup,
    Grid, Divider, Paper, Collapse,
    Snackbar, Alert,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import { AccessTime, Email, WbSunny, WaterDrop, Notes, Delete as DeleteIcon, Send } from '@mui/icons-material';
import { differenceInHours, format, parseISO, getDate } from 'date-fns';
import axios from 'axios';
import { nanoid } from 'nanoid';

// 🔑 UPDATED IMPORTS: Use centralized types
import type { FastRecord, Note, FastType } from '../types'; 
import { useAuthStore } from '../store/authStore';

import LiveFastDuration from './LiveFastDuration';
import FastNoteInput from './FastNoteInput';

// --- Removed local type definitions ---
/*
interface Note {
    id: string;
    time: string;
    text: string;
    fastHours: number;
    dayOfMonth: number;
}

type FastType = 'wet' | 'dry';
*/
// ----------------------------------------

import api from '../utils/api'; // <--- Import the new secured API instance

// ... component logic ...

// Note: The component-level `handleConfirmStopFast` is defined below and uses `api`.

interface FastingTimerProps {
    onFastLogged: () => void;
    darkTheme: any;
}


const FastingTimer: React.FC<FastingTimerProps> = ({ onFastLogged, darkTheme }) => {
    // --- State Variables ---
    // Use auth info to namespace localStorage keys per-user (prevents the same timer appearing for different users)
    const user = useAuthStore(state => state.user);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    // Prefer a stable per-user id when available. Use 'guest' for unauthenticated sessions.
    const storageId = user?.id ?? 'guest';
    const storageKeyStart = `fastStartTime:${storageId}`;
    const storageKeyType = `fastType:${storageId}`;
    const storageKeyNotes = `fastNotes:${storageId}`;

    const [isFasting, setIsFasting] = useState<boolean>(() => !!localStorage.getItem(storageKeyStart));
    const [startTime, setStartTime] = useState<string | null>(() => localStorage.getItem(storageKeyStart) || null);
    const [fastType, setFastType] = useState<FastType>(() => (localStorage.getItem(storageKeyType) as FastType) || 'wet');
    const [notes, setNotes] = useState<Note[]>(() => JSON.parse(localStorage.getItem(storageKeyNotes) || '[]'));
    const [customTimeInput, setCustomTimeInput] = useState<string>('');
    const [showCustomTime, setShowCustomTime] = useState<boolean>(false);
    
    // 🔑 NEW STATE FOR DIALOGS AND SNACKBARS
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');
    
    // Confirmation Dialog States
    const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
    const [isDeleteNoteConfirmOpen, setIsDeleteNoteConfirmOpen] = useState(false);
    const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null);

    // Email Input Dialog States
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);


    // --- Core Logic: Persistence ---
    useEffect(() => {
        if (startTime) {
            setIsFasting(true);
        }
    }, [isFasting, startTime]);

    // Persist per-user timer state to namespaced localStorage keys
    useEffect(() => {
        if (isFasting && startTime) {
            localStorage.setItem(storageKeyStart, startTime);
            localStorage.setItem(storageKeyType, fastType);
            localStorage.setItem(storageKeyNotes, JSON.stringify(notes));
        } else if (!isFasting && !startTime) {
            localStorage.removeItem(storageKeyStart);
            localStorage.removeItem(storageKeyType);
            localStorage.removeItem(storageKeyNotes);
        }
    }, [isFasting, startTime, fastType, notes, storageKeyStart, storageKeyType, storageKeyNotes]);

    // When the active user/token changes, reload the timer state from that user's storage keys
    useEffect(() => {
        setStartTime(localStorage.getItem(storageKeyStart) || null);
        setFastType((localStorage.getItem(storageKeyType) as FastType) || 'wet');
        try {
            setNotes(JSON.parse(localStorage.getItem(storageKeyNotes) || '[]'));
        } catch {
            setNotes([]);
        }
        setIsFasting(!!localStorage.getItem(storageKeyStart));
    }, [storageKeyStart, storageKeyType, storageKeyNotes]);

    // --- Utility Function ---
    const getPreciseHours = useCallback((): number => {
        if (!startTime) return 0;
        try {
            const start = parseISO(startTime);
            const elapsedMs = new Date().getTime() - start.getTime();
            const preciseHours = elapsedMs / (1000 * 60 * 60);
            return Math.max(0, parseFloat(preciseHours.toFixed(2)));
        } catch {
            return 0;
        }
    }, [startTime]);

    // --- Calculated Values ---
    const hoursFasted = useMemo(() => getPreciseHours(), [getPreciseHours]);

    // --- Action Handlers ---

    const handleStartFast = (time: string) => {
        setStartTime(time);
        setIsFasting(true);
        setNotes([]);
        setCustomTimeInput('');
        // Persist active fast to server if authenticated
        (async () => {
            if (!isAuthenticated) return;
            try {
                await api.post('/active-fast', { startTime: time, fastType, notes: [] });
            } catch (err) {
                console.error('Failed to persist active fast to server:', err);
                // ignore; local storage still keeps the active timer
            }
        })();
    };

    const handleStartNow = () => {
        handleStartFast(new Date().toISOString());
        setShowCustomTime(false);
    };

    const handleSetCustomTime = () => {
        try {
            if (!customTimeInput) {
                setSnackbarMessage('ℹ️ Please enter a custom date/time.');
                setSnackbarSeverity('info');
                setSnackbarOpen(true);
                return;
            }

            const date = new Date(customTimeInput);

            if (isNaN(date.getTime())) {
                setSnackbarMessage('❌ Invalid date/time format. Please check your input.');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
                return;
            }

            if (date.getTime() > new Date().getTime()) {
                setSnackbarMessage('❌ Start time cannot be in the future.');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
                return;
            }

            handleStartFast(date.toISOString());
            setShowCustomTime(false);
        } catch (e) {
            setSnackbarMessage('❌ Error processing custom date/time input.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    // 1. Stop Fast: Open Dialog
    const handleStopFast = () => {
        if (!isFasting || !startTime) return;
        if (!isAuthenticated) {
            setSnackbarMessage('🔒 Please log in to stop and save your fast.');
            setSnackbarSeverity('info');
            setSnackbarOpen(true);
            return;
        }
        setIsStopConfirmOpen(true);
    };

    // 2. Stop Fast: Confirm Action
    const [isSaving, setIsSaving] = useState(false);

    const handleConfirmStopFast = async () => {
        setIsStopConfirmOpen(false);
        setIsSaving(true);

        const finalHoursFasted = getPreciseHours();
        const endTime = new Date().toISOString();

        // Optimistically stop the timer in the UI immediately so the user sees it end
        const prevState = { startTime, notes, isFasting };
        setIsFasting(false);
        setStartTime(null);
        setNotes([]);
        // If the user is not authenticated, roll back and inform them
        if (!isAuthenticated) {
            // rollback
            setIsFasting(!!prevState.startTime);
            setStartTime(prevState.startTime);
            setNotes(prevState.notes);
            setIsSaving(false);
            setSnackbarMessage('🔒 You must be logged in to save your fast.');
            setSnackbarSeverity('info');
            setSnackbarOpen(true);
            return;
        }
        try {
            await api.post('/save-fast', {
                startTime: prevState.startTime,
                endTime,
                durationHours: finalHoursFasted,
                fastType,
                // send a reversed COPY of notes so we don't mutate state via Array.prototype.reverse()
                notes: [...prevState.notes].reverse(),
            });

            // on success, clear any active-fast stored on the server
            try { await api.delete('/active-fast'); } catch (err) { console.error('Failed to clear active fast on server:', err); }

            setSnackbarMessage(`✅ Fast successfully stopped and logged to history! Duration: ${finalHoursFasted.toFixed(2)} hours.`);
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            onFastLogged();

        } catch (error) {
            console.error('Failed to save fast:', error);

            setSnackbarMessage('⚠️ Failed to save fast to history (server error). The timer was stopped locally.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);

            // If save failed due to network, queue the save locally for later sync
            try {
                const pendingKey = `pendingSaves:${storageId}`;
                const existing = JSON.parse(localStorage.getItem(pendingKey) || '[]');
                existing.push({ id: nanoid(8), payload: { startTime: prevState.startTime, endTime, durationHours: finalHoursFasted, fastType, notes: [...prevState.notes].reverse() }, createdAt: new Date().toISOString() });
                localStorage.setItem(pendingKey, JSON.stringify(existing));
                setSnackbarMessage('⚠️ Save queued locally and will sync when online or after login.');
                setSnackbarSeverity('info');
                setSnackbarOpen(true);
            } catch (e) {
                console.error('Failed to queue pending save:', e);
            }

            // Note: we intentionally do NOT automatically restore the prior timer state here to avoid surprising UX.
            // If you prefer rollback on failure, we can restore prevState here instead.
        } finally {
            setIsSaving(false);
        }
    };

    const handleNoteAddition = useCallback((noteText: string) => {
        if (noteText.trim() && isFasting) {
            const currentTimeISO = new Date().toISOString();
            const currentFastDuration = getPreciseHours();

            const newNote: Note = { // Note type is now imported
                id: nanoid(10),
                time: currentTimeISO,
                text: noteText.trim(),
                fastHours: currentFastDuration,
                dayOfMonth: getDate(new Date(currentTimeISO)),
                // 💡 NOTE: The centralized Note interface in types.ts only has 'time', 'text', and 'duration'.
                // The fields 'id', 'fastHours', and 'dayOfMonth' are currently unique to the component state here.
                // We'll keep them here for now, but note that the local object is technically an extended version of the imported type.
                // To fully align, we should update the Note interface in src/types.ts to include 'id', 'fastHours', and 'dayOfMonth'.
                // For now, this is sufficient to resolve the cleanup step.
            };
            setNotes(prev => [newNote, ...prev]);
        }
    }, [isFasting, getPreciseHours]);

    // 1. Delete Note: Open Dialog
    const handleOpenDeleteNoteConfirm = useCallback((noteId: string) => {
        setNoteIdToDelete(noteId);
        setIsDeleteNoteConfirmOpen(true);
    }, []);

    // 2. Delete Note: Confirm Action
    const handleConfirmDeleteNote = () => {
        if (!noteIdToDelete) return;

        setNotes(prevNotes => prevNotes.filter(note => note.id !== noteIdToDelete));
        
        setSnackbarMessage('🗑️ Note deleted.');
        setSnackbarSeverity('info');
        setSnackbarOpen(true);

        setIsDeleteNoteConfirmOpen(false);
        setNoteIdToDelete(null);
    };

    // 1. Email Report: Open Dialog
    const handleOpenEmailDialog = () => {
        if (!isFasting || !startTime) {
            setSnackbarMessage("ℹ️ Cannot send report: Fast is not currently running.");
            setSnackbarSeverity('info');
            setSnackbarOpen(true);
            return;
        }
        setRecipientEmail(''); // Clear previous input
        setIsEmailDialogOpen(true);
    };

    // 2. Email Report: Confirm Action (Replaces prompt and alert logic)
    const handleSendEmail = async () => {
        if (!recipientEmail || !recipientEmail.includes('@') || !recipientEmail.includes('.')) {
            setSnackbarMessage("❌ Invalid email provided. Please try again.");
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        setIsEmailDialogOpen(false); // Close the input dialog
        setIsSendingEmail(true);

        try {
            const currentHours = getPreciseHours();

            await api.post('/send-report', {
                startTime,
                currentHours: currentHours,
                fastType,
                notes: [...notes].reverse(),
                recipientEmail,
            });

            setSnackbarMessage('✅ Fasting report sent successfully!');
            setSnackbarSeverity('success');
        } catch (error) {
            console.error('Error sending email:', error);
            const errorMessage = axios.isAxiosError(error) && error.response
                ? error.response.data.message
                : '❌ Failed to send email. Check console and backend server configuration.';

            setSnackbarMessage(errorMessage);
            setSnackbarSeverity('error');
        } finally {
            setSnackbarOpen(true);
            setIsSendingEmail(false);
        }
    };


    // --- Component JSX ---
    // Sync pending saves when user logs in or when browser regains connectivity
    useEffect(() => {
        let mounted = true;

        const syncPending = async () => {
            if (!isAuthenticated) return;
            const pendingKey = `pendingSaves:${storageId}`;
            const existing = JSON.parse(localStorage.getItem(pendingKey) || '[]');
            if (!existing || existing.length === 0) return;

            for (const item of existing) {
                try {
                    await api.post('/save-fast', item.payload);
                    // on success remove this item
                    const remaining = JSON.parse(localStorage.getItem(pendingKey) || '[]').filter((p: any) => p.id !== item.id);
                    localStorage.setItem(pendingKey, JSON.stringify(remaining));
                } catch (err) {
                    console.error('Sync failed for pending save:', err);
                    // stop retrying this run
                    break;
                }
            }
        };

        // Attempt sync on mount if authenticated
        if (isAuthenticated && mounted) syncPending();

        const onOnline = () => { if (isAuthenticated) syncPending(); };
        window.addEventListener('online', onOnline);

        return () => { mounted = false; window.removeEventListener('online', onOnline); };
    }, [isAuthenticated, storageId]);
    return (
        <Box>
            {/* TOP SECTION: Current Status Card */}
            <Card raised sx={{ mb: 4, background: darkTheme.palette.background.paper, height: '100%' }}>
                <CardContent sx={{ p: 0 }}>
                    <Box sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        minHeight: 250,
                    }}>
                        {/* LEFT COLUMN: Status Display */}
                        <Box sx={{
                            width: { xs: '100%', md: '50%' },
                            minWidth: { md: 250 },
                            p: 3,
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <Typography variant="h6" color="text.secondary">
                                <AccessTime sx={{ verticalAlign: 'middle', mr: 1 }} />
                                Current Fast Duration
                            </Typography>

                            {/* Owner indicator */}
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                                Active for: {user?.email ?? 'Guest'} {isAuthenticated ? '(you)' : '(not logged in)'}
                            </Typography>

                            <LiveFastDuration
                                startTime={startTime}
                                isFasting={isFasting}
                            />

                            {startTime && (
                                <Typography variant="body1" color="text.secondary">
                                    Start: {format(parseISO(startTime), 'MMM d, h:mm a')}
                                </Typography>
                            )}
                        </Box>

                        <Divider
                            orientation="vertical"
                            flexItem
                            sx={{ display: { xs: 'none', md: 'block' }, my: 'auto' }}
                        />
                        <Divider
                            sx={{ display: { xs: 'block', md: 'none' } }}
                        />

                        {/* RIGHT COLUMN: Controls */}
                        <Box sx={{
                            width: { xs: '100%', md: '50%' },
                            minWidth: { md: 250 },
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            p: 3,
                            justifyContent: 'center',
                            alignItems: 'stretch'
                        }}>
                            {/* Dry/Wet Toggle */}
                            <ToggleButtonGroup
                                value={fastType}
                                exclusive
                                onChange={(_, newType) => newType && setFastType(newType)}
                                size="small"
                                fullWidth
                            >
                                <ToggleButton value="wet" disabled={isFasting} sx={{
                                    color: fastType === 'wet' ? darkTheme.palette.secondary.main : undefined
                                }}>
                                    <WaterDrop sx={{ mr: 1 }} /> Wet Fast
                                </ToggleButton>
                                <ToggleButton value="dry" disabled={isFasting} sx={{
                                    color: fastType === 'dry' ? darkTheme.palette.secondary.main : undefined
                                }}>
                                    <WbSunny sx={{ mr: 1 }} /> Dry Fast
                                </ToggleButton>
                            </ToggleButtonGroup>

                            {/* Start/Stop Button */}
                            {isFasting ? (
                                <Button
                                    variant="contained"
                                    color="error"
                                    size="large"
                                    onClick={handleStopFast} 
                                    fullWidth
                                    disabled={isSaving}
                                >
                                    {isSaving ? `STOPPING... (${hoursFasted.toFixed(2)}h)` : `STOP FAST (${hoursFasted.toFixed(2)}h)`}
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="large"
                                    onClick={handleStartNow}
                                    fullWidth
                                >
                                    START NOW
                                </Button>
                            )}

                            {/* Custom Time Toggle Button */}
                            <Button
                                variant="outlined"
                                color="primary"
                                size="small"
                                fullWidth
                                onClick={() => setShowCustomTime(prev => !prev)}
                                disabled={isFasting}
                            >
                                {showCustomTime ? 'CANCEL CUSTOM START' : 'SET CUSTOM START TIME'}
                            </Button>

                            {/* Collapsible Input Box */}
                            <Collapse in={showCustomTime} timeout="auto" unmountOnExit>
                                <Box sx={{ pt: 1 }}>
                                    <TextField
                                        fullWidth
                                        label="Start Date/Time"
                                        type="datetime-local"
                                        value={customTimeInput}
                                        onChange={(e) => setCustomTimeInput(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ mb: 1 }}
                                        disabled={isFasting}
                                    />
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        size="small"
                                        fullWidth
                                        onClick={handleSetCustomTime}
                                        disabled={isFasting || !customTimeInput}
                                    >
                                        CONFIRM START TIME
                                    </Button>
                                </Box>
                            </Collapse>

                            {/* Email Report Button */}
                            <Button
                                variant="outlined"
                                color="secondary"
                                onClick={handleOpenEmailDialog}
                                disabled={!isFasting || isSendingEmail}
                                startIcon={isSendingEmail ? <AccessTime size={20} color="inherit" /> : <Email />}
                                fullWidth
                            >
                                {isSendingEmail ? 'Sending Report...' : 'Email Status Report'}
                            </Button>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* MIDDLE SECTION: Notes */}
            <Paper elevation={3} sx={{
                p: 3,
                background: darkTheme.palette.background.paper,
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}>

                {/* Fast Notes Box */}
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                        <Notes sx={{ verticalAlign: 'middle', mr: 1 }} /> Fast Notes
                    </Typography>

                    {/* Notes Display Box */}
                    <Box sx={{ maxHeight: 150, overflowY: 'auto', mb: 2, p: 1, border: '1px solid #333', borderRadius: 1 }}>
                        {notes.length === 0 && <Typography variant="body2" color="text.secondary">No notes yet. Add one below!</Typography>}
                        {notes.map((note) => (
                            <Box
                                key={note.id} // Note: The key uses the 'id' field which isn't in the imported Note type.
                                sx={{
                                    mb: 1,
                                    pb: 0.5,
                                    borderBottom: '1px solid #222',
                                }}
                            >
                                {/* 1. HEADER ROW (Timestamp + Delete Button) */}
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 0.5
                                }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                                        {format(parseISO(note.time), 'MM/dd/yy')} | {format(parseISO(note.time), 'h:mm a')} @ {(note.fastHours ?? 0).toFixed(1)}h
                                    </Typography>

                                    {/* 2. DELETE BUTTON (Calls open dialog) */}
                                    <Button
                                        onClick={() => handleOpenDeleteNoteConfirm(note.id)}
                                        size="small"
                                        color="error"
                                        sx={{ minWidth: 0, p: 0.5, lineHeight: 1 }}
                                        disabled={!isFasting}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </Button>
                                </Box>

                                {/* 3. NOTE BODY */}
                                <Typography variant="body2">
                                    {note.text}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    {/* FastNoteInput */}
                    <FastNoteInput
                        onAddNote={handleNoteAddition}
                        disabled={!isFasting}
                    />
                </Box>
            </Paper>

            {/* --- MUI DIALOGS --- */}

            {/* 1. Stop Fast Confirmation Dialog */}
            <Dialog
                open={isStopConfirmOpen}
                onClose={() => setIsStopConfirmOpen(false)}
            >
                <DialogTitle>{"Confirm Stop Fast"}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to end your **{hoursFasted.toFixed(2)}** hour fast? This will log the record to your history.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsStopConfirmOpen(false)} color="secondary">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmStopFast} color="error" variant="contained" autoFocus>
                        Stop and Log Fast
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 2. Delete Note Confirmation Dialog */}
            <Dialog
                open={isDeleteNoteConfirmOpen}
                onClose={() => setIsDeleteNoteConfirmOpen(false)}
            >
                <DialogTitle>{"Confirm Note Deletion"}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this note? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDeleteNoteConfirmOpen(false)} color="secondary">
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmDeleteNote} color="error" variant="contained" autoFocus>
                        Delete Note
                    </Button>
                </DialogActions>
            </Dialog>
            
            {/* 3. Email Input Dialog (Replaces window.prompt) */}
            <Dialog
                open={isEmailDialogOpen}
                onClose={() => setIsEmailDialogOpen(false)}
            >
                <DialogTitle>{"Email Current Fast Report"}</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Please enter the email address to send your current fast status report to.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Recipient Email Address"
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSendEmail();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsEmailDialogOpen(false)} color="secondary">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSendEmail} 
                        color="primary" 
                        variant="contained" 
                        disabled={!recipientEmail.includes('@') || !recipientEmail.includes('.')}
                    >
                        Send Report
                    </Button>
                </DialogActions>
            </Dialog>

            {/* --- MUI SNACKBAR --- */}
            {/* Used for Custom Time alerts, Email success/failure, and Stop Fast success/failure */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbarOpen(false)}
                    severity={snackbarSeverity}
                    sx={{ width: '100%' }}
                >
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default FastingTimer;