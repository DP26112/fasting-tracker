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
import type { FastRecord, Note } from '../types'; 

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

interface FastingTimerProps {
    onFastLogged: () => void;
    darkTheme: any;
}

const API_URL = 'http://localhost:3001/api';

const FastingTimer: React.FC<FastingTimerProps> = ({ onFastLogged, darkTheme }) => {
    // --- State Variables ---
    const [isFasting, setIsFasting] = useState<boolean>(false);
    const [startTime, setStartTime] = useState<string | null>(localStorage.getItem('fastStartTime') || null);
    // FastType is now imported but used the same way
    const [fastType, setFastType] = useState<FastType>((localStorage.getItem('fastType') as FastType) || 'wet');
    const [notes, setNotes] = useState<Note[]>(JSON.parse(localStorage.getItem('fastNotes') || '[]'));
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

    useEffect(() => {
        if (isFasting && startTime) {
            localStorage.setItem('fastStartTime', startTime);
            localStorage.setItem('fastType', fastType);
            localStorage.setItem('fastNotes', JSON.stringify(notes));
        } else if (!isFasting && !startTime) {
            localStorage.removeItem('fastStartTime');
            localStorage.removeItem('fastType');
            localStorage.removeItem('fastNotes');
        }
    }, [isFasting, startTime, fastType, notes]);

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
        setIsStopConfirmOpen(true);
    };

    // 2. Stop Fast: Confirm Action
    const handleConfirmStopFast = async () => {
        setIsStopConfirmOpen(false);

        const finalHoursFasted = getPreciseHours();
        const endTime = new Date().toISOString();

        try {
            await axios.post(`${API_URL}/save-fast`, {
                startTime,
                endTime,
                durationHours: finalHoursFasted,
                fastType,
                notes: notes.reverse(),
            });

            setIsFasting(false);
            setStartTime(null);
            setNotes([]);
            
            setSnackbarMessage(`✅ Fast successfully stopped and logged to history! Duration: ${finalHoursFasted.toFixed(2)} hours.`);
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            onFastLogged();

        } catch (error) {
            console.error('Failed to save fast:', error);
            
            setSnackbarMessage('⚠️ Failed to save fast to history, but the current fast has ended.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            
            // Still reset state even if save fails (as requested in original code's error block)
            setIsFasting(false);
            setStartTime(null);
            setNotes([]);
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

            await axios.post(`${API_URL}/send-report`, {
                startTime,
                currentHours: currentHours,
                fastType,
                notes: notes.reverse(),
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
                                >
                                    STOP FAST ({hoursFasted.toFixed(2)}h)
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