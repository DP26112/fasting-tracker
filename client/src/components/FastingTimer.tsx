// client/src/FastingTimer.tsx
// Temporary Cache Buster: Oct 3 2025, 11:35 AM <--- ADD THIS LINE

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Typography, Box, Card, CardContent, Button,
    TextField, ToggleButton, ToggleButtonGroup,
    Divider, Paper, Collapse, Switch, FormControlLabel, Badge,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Snackbar, Alert
} from '@mui/material';
import { AccessTime, Email, WbSunny, WaterDrop, Notes, Delete as DeleteIcon, Person as PersonIcon } from '@mui/icons-material';
import Trophies from './Trophies';
import { format, parseISO, getDate } from 'date-fns';
import { nanoid } from 'nanoid';
import AdditionalEmailInput from './AdditionalEmailInput';
import type { AdditionalEmailInputHandle } from './AdditionalEmailInput';

// 🔑 UPDATED IMPORTS: Use centralized types
import type { Note } from '../types'; 
import { useAuthStore } from '../store/authStore';
import { useActiveFastStore } from '../store/useActiveFastStore'; // 🔥 NEW: Zustand store for persistence

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
    const user = useAuthStore(state => state.user);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    
    // 🔥 NEW: Use Zustand store for fast state instead of local useState + localStorage
    const { 
        isFasting, 
        startTime, 
        fastType: activeFastType, 
        notes,
        startFast: startFastAction,
        stopFast: stopFastAction,
        addNote: addNoteAction,
        deleteNote: deleteNoteAction
    } = useActiveFastStore();
    
    // Local state for UI controls (before starting fast)
    const [selectedFastType, setSelectedFastType] = useState<'wet' | 'dry'>('wet');
    const fastType = isFasting ? activeFastType : selectedFastType; // Use active fast type when fasting, otherwise use selected
    
    const [customTimeInput, setCustomTimeInput] = useState<string>('');
    const [showCustomTime, setShowCustomTime] = useState<boolean>(false);
    
    // Snackbar state for user feedback
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState<string>('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');
    const snackbarDuration = 4000;
    
    // Confirmation Dialog States
    const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
    const [isDeleteNoteConfirmOpen, setIsDeleteNoteConfirmOpen] = useState(false);
    const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null);

    // Email sending state (no modal)
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    // transient success indicator: shows 'Sent!' and success background briefly
    const [sendSuccess, setSendSuccess] = useState(false);
    const sendSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // automation toggle state (initially false)
    const [automationEnabled, setAutomationEnabled] = useState<boolean>(false);
    const [automationPending, setAutomationPending] = useState<boolean>(false);
    // store merged recipients returned from the server when automation is enabled
    const [automationRecipients, setAutomationRecipients] = useState<string[]>([]);
    // additional email input is now uncontrolled for snappy typing
    const additionalEmailRef = useRef<AdditionalEmailInputHandle | null>(null);
    // no local schedule id tracked anymore (modal removed)

    // 🔥 REMOVED: All localStorage persistence - now handled by Zustand store
    // The useActiveFastStore automatically syncs with the server

    // --- Live-updating currentHours for trophy rendering ---
    const [currentHours, setCurrentHours] = useState<number>(0);
    useEffect(() => {
        if (!isFasting || !startTime) {
            setCurrentHours(0);
            return;
        }
        // Update every second
        const update = () => {
            try {
                const start = parseISO(startTime);
                const elapsedMs = new Date().getTime() - start.getTime();
                const preciseHours = elapsedMs / (1000 * 60 * 60);
                setCurrentHours(Math.max(0, preciseHours));
            } catch {
                setCurrentHours(0);
            }
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [isFasting, startTime]);

    // --- Action Handlers ---

    const handleStartFast = async (time: string) => {
        setCustomTimeInput('');
        // 🔥 NEW: Use Zustand store action to persist to server
        if (!isAuthenticated) return;
        try {
            await startFastAction(time, fastType);
            console.log('✅ Fast started successfully');
        } catch (err) {
            console.error('❌ Failed to start fast:', err);
            setSnackbarMessage('Failed to start fast. Please try again.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    const handleStartNow = () => {
        handleStartFast(new Date().toISOString());
        setShowCustomTime(false);
    };

    const handleSetCustomTime = () => {
        try {
            if (!customTimeInput) {
                console.info('ℹ️ Please enter a custom date/time.');
                return;
            }

            const date = new Date(customTimeInput);

            if (isNaN(date.getTime())) {
                console.error('❌ Invalid date/time format. Please check your input.');
                return;
            }

            if (date.getTime() > new Date().getTime()) {
                console.error('❌ Start time cannot be in the future.');
                return;
            }

            handleStartFast(date.toISOString());
            setShowCustomTime(false);
        } catch (e) {
            console.error('❌ Error processing custom date/time input.');
        }
    };

    // 1. Stop Fast: Open Dialog
    const handleStopFast = () => {
        if (!isFasting || !startTime) return;
        if (!isAuthenticated) {
            console.info('🔒 Please log in to stop and save your fast.');
            return;
        }
        setIsStopConfirmOpen(true);
    };

    // 2. Stop Fast: Confirm Action
    const [isSaving, setIsSaving] = useState(false);

    // Snackbars have been removed from this component; console logs are used for important events.

    const handleConfirmStopFast = async () => {
        setIsStopConfirmOpen(false);
        setIsSaving(true);

        const finalHoursFasted = currentHours;
        const endTime = new Date().toISOString();

        if (!isAuthenticated) {
            setIsSaving(false);
            setSnackbarMessage('You must be logged in to save your fast.');
            setSnackbarSeverity('warning');
            setSnackbarOpen(true);
            return;
        }

        // 🔥 NEW: Use Zustand store action to stop fast and save to history
        try {
            const success = await stopFastAction(endTime, finalHoursFasted);
            if (success) {
                console.log(`✅ Fast successfully stopped and logged! Duration: ${finalHoursFasted.toFixed(2)} hours.`);
                onFastLogged();
                setSnackbarMessage('Fast logged successfully!');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);
            } else {
                console.error('⚠️ Failed to save fast to history');
                setSnackbarMessage('Failed to save fast. Please try again.');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            }
        } catch (error) {
            console.error('Failed to stop fast:', error);
            setSnackbarMessage('Error stopping fast. Please try again.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setIsSaving(false);
        }
    };

    const handleNoteAddition = useCallback(async (noteText: string) => {
        if (noteText.trim() && isFasting && isAuthenticated) {
            const currentTimeISO = new Date().toISOString();
            const currentFastDuration = currentHours;

            const newNote: Note = {
                id: nanoid(10),
                time: currentTimeISO,
                text: noteText.trim(),
                fastHours: currentFastDuration,
                dayOfMonth: getDate(new Date(currentTimeISO)),
            };
            
            // � NEW: Use Zustand store action to persist note to server
            try {
                await addNoteAction(newNote);
                console.log('✅ Note added successfully');
            } catch (err) {
                console.error('❌ Failed to add note:', err);
                setSnackbarMessage('Failed to add note. Please try again.');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            }
        }
    }, [isFasting, currentHours, isAuthenticated, addNoteAction, setSnackbarMessage, setSnackbarSeverity, setSnackbarOpen]);

    // 1. Delete Note: Open Dialog
    const handleOpenDeleteNoteConfirm = useCallback((noteId: string) => {
        setNoteIdToDelete(noteId);
        setIsDeleteNoteConfirmOpen(true);
    }, []);

    // 2. Delete Note: Confirm Action
    const handleConfirmDeleteNote = async () => {
        if (!noteIdToDelete || !isAuthenticated) return;

        // 🔥 NEW: Use Zustand store action to delete note from server
        try {
            await deleteNoteAction(noteIdToDelete);
            console.log('🗑️ Note deleted successfully');
            setSnackbarMessage('Note deleted');
            setSnackbarSeverity('info');
            setSnackbarOpen(true);
        } catch (err) {
            console.error('❌ Failed to delete note:', err);
            setSnackbarMessage('Failed to delete note. Please try again.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }

        setIsDeleteNoteConfirmOpen(false);
        setNoteIdToDelete(null);
    };

    // Email modal removed — clicking the Email Status Report button will send directly to the authenticated user's email (if available).
    const handleSendStatusReportToUserEmail = async () => {
        if (!isFasting || !startTime) {
            console.info('ℹ️ Cannot send report: Fast is not currently running.');
            return;
        }

        const userEmail = user?.email;
        if (!userEmail) {
            console.info('No authenticated user email available; report was not sent.');
            return;
        }

        setIsSendingEmail(true);
        try {
            // parse additional emails from uncontrolled input (comma-separated)
            const extrasRaw = additionalEmailRef.current?.getValue() || '';
            const rawExtras = extrasRaw.split(',').map(e => e.trim()).filter(Boolean);
            // simple regex validation (no verification flow) - keep it permissive but catch obvious invalids
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const validExtras: string[] = [];
            const invalidExtras: string[] = [];
            for (const e of rawExtras) {
                if (emailRegex.test(e)) validExtras.push(e);
                else invalidExtras.push(e);
            }

            if (invalidExtras.length > 0) {
                setSnackbarMessage(`Ignored invalid email(s): ${invalidExtras.join(', ')}`);
                setSnackbarSeverity('warning');
                setSnackbarOpen(true);
            }

            const recipients = [userEmail, ...validExtras];

            const payload = {
                startTime,
                currentHours,
                fastType,
                notes: [...notes].reverse(),
                recipientEmail: userEmail,
                recipients: recipients,
                // Explicitly request the server to enable automation when the client automation toggle is on
                autoEnableSchedule: automationEnabled === true
            };
            console.log('Sending status report payload:', payload);
            const resp = await api.post('/send-report', payload);
            
            console.log('Status report sent to user email');
            // show transient success UI
            setSendSuccess(true);
            // clear any existing timer
            if (sendSuccessTimer.current) clearTimeout(sendSuccessTimer.current);
            sendSuccessTimer.current = setTimeout(() => {
                setSendSuccess(false);
                sendSuccessTimer.current = null;
            }, 2000);
                // clear the additional recipients input so user sees a clean state
                try { additionalEmailRef.current?.clear(); } catch { /* ignore */ }
            // If the server returned an authoritative schedule object, use it to immediately update the badge/recipients
            try {
                const sched = resp?.data?.schedule ?? null;
                    if (sched && Array.isArray(sched.recipients)) {
                    setAutomationRecipients(sched.recipients);
                    // if automation was enabled by this action, ensure local toggle reflects it
                    if (sched.enabled) {
                        setAutomationEnabled(true);
                    }
                } else if (automationEnabled && isAuthenticated) {
                    // If no schedule was returned, fetch the authoritative schedule to keep UI in sync.
                    try {
                        const getResp = await api.get('/schedule-status-report', { params: { startTime } });
                        const fetched = getResp?.data?.schedule ?? null;
                        const recs = (fetched && Array.isArray(fetched.recipients)) ? fetched.recipients : [];
                        setAutomationRecipients(recs);
                        if (fetched && fetched.enabled) setAutomationEnabled(true);
                    } catch (err) {
                        console.error('Failed to fetch schedule after send-report', err);
                    }
                }
            } catch (e) {
                // ignore
            }
        } catch (err) {
            console.error('Failed to send status report', err);
        } finally {
            setIsSendingEmail(false);
        }
    };

    // Toggle automation on/off by calling schedule endpoints
    const handleToggleAutomation = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        if (!isAuthenticated || !startTime) {
            console.info('Automation requires an authenticated user and an active fast.');
            return;
        }

        setAutomationPending(true);
            try {
                if (checked) {
                    // enable automation: do not send recipients from client; let server merge defaults
                    const resp = await api.post('/schedule-status-report', { startTime });
                    console.log('Automation enabled', resp?.data);
                    setAutomationEnabled(true);
                    // fetch the saved schedule to get the merged recipients and store locally
                    try {
                        const getResp = await api.get('/schedule-status-report', { params: { startTime } });
                        const sched = getResp?.data?.schedule ?? null;
                        const recs = (sched && Array.isArray(sched.recipients)) ? sched.recipients : [];
                        setAutomationRecipients(recs);
                    } catch (err) {
                        console.error('Failed to fetch merged schedule after enabling automation', err);
                        setAutomationRecipients([]);
                    }
                try {
                    // persist locally so the toggle stays on even after logout
                    if (user?.id) {
                        const key = `automation:${user.id}:${startTime}`;
                        localStorage.setItem(key, '1');
                    }
                } catch (e) {
                    console.error('Failed to persist automation state locally', e);
                }
                } else {
                    // disable automation: optimistic UI update
                    setAutomationEnabled(false);
                    setAutomationRecipients([]);
                    try {
                        // persist disable on server. Use query params because some intermediaries strip bodies for DELETE.
                        await api.delete('/schedule-status-report', { params: { startTime } });
                        console.log('Automation disabled');

                        // After disabling, fetch the authoritative schedule from the server so client reflects canonical state
                        try {
                            const getResp = await api.get('/schedule-status-report', { params: { startTime } });
                            const sched = getResp?.data?.schedule ?? null;
                            const recs = (sched && Array.isArray(sched.recipients)) ? sched.recipients : [];
                            // if server still thinks there are recipients, honor server by updating state (this is rare)
                            setAutomationRecipients(recs);
                        } catch (err) {
                            console.error('Failed to fetch schedule after disabling automation', err);
                            // keep optimistic cleared recipients
                        }
                    } catch (err) {
                        console.error('Failed to persist automation disable', err);
                        // If persistence failed, try to restore by fetching server state
                        try {
                            const getResp = await api.get('/schedule-status-report', { params: { startTime } });
                            const sched = getResp?.data?.schedule ?? null;
                            const recs = (sched && Array.isArray(sched.recipients)) ? sched.recipients : [];
                            setAutomationRecipients(recs);
                            setAutomationEnabled(!!(sched && sched.enabled));
                        } catch (e) {
                            console.error('Failed to recover schedule after failed disable', e);
                        }
                    }
                try {
                    if (user?.id) {
                        const key = `automation:${user.id}:${startTime}`;
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    console.error('Failed to remove local automation persistence', e);
                }
            }
        } catch (err) {
            console.error('Failed to toggle automation', err);
        } finally {
            setAutomationPending(false);
        }
    };

    // Initialize automationEnabled from localStorage and (if authenticated) verify server-side schedule
    useEffect(() => {
        let mounted = true;
        const init = async () => {
            if (!startTime) {
                setAutomationEnabled(false);
                return;
            }

            try {
                // first check local cache keyed by user id and startTime
                const uid = user?.id;
                if (uid) {
                    const key = `automation:${uid}:${startTime}`;
                    const local = localStorage.getItem(key);
                    if (local) {
                        setAutomationEnabled(true);
                    }
                }

                // if authenticated, verify with server to avoid stale local state
                if (isAuthenticated) {
                    try {
                        const resp = await api.get('/schedule-status-report', { params: { startTime } });
                        const sched = resp?.data?.schedule ?? null;
                        if (!mounted) return;
                        if (sched) {
                            // Restore recipients and enabled flag from the authoritative schedule
                            const recs = Array.isArray(sched.recipients) ? sched.recipients : [];
                            setAutomationRecipients(recs);
                            setAutomationEnabled(!!sched.enabled);
                            // persist locally if enabled so UI can be snappier
                            if (sched.enabled && user?.id) {
                                localStorage.setItem(`automation:${user.id}:${startTime}`, '1');
                            } else if (user?.id) {
                                localStorage.removeItem(`automation:${user.id}:${startTime}`);
                            }
                        } else {
                            setAutomationEnabled(false);
                            setAutomationRecipients([]);
                            if (user?.id) {
                                localStorage.removeItem(`automation:${user.id}:${startTime}`);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to verify automation schedule on server', err);
                        // keep local value if present
                    }
                }
            } catch (e) {
                console.error('Failed to initialize automation state', e);
            }
        };

        init();
        return () => { mounted = false; };
    }, [startTime, user?.id, isAuthenticated]);

    // Email sending is handled by the EmailStatusDialog component now.

    // 🔥 REMOVED: Pending saves sync - Zustand store handles all persistence to server
    // --- Component JSX ---

    // cleanup sendSuccess timer on unmount
    useEffect(() => {
        return () => {
            if (sendSuccessTimer.current) clearTimeout(sendSuccessTimer.current);
        };
    }, []);
    return (
        <Box>
            {/* TOP SECTION: Current Status Card */}
            <Card raised sx={{ mb: 4, background: darkTheme.palette.background.paper, height: '100%' }}>
                <CardContent sx={{ p: 0 }}>
                    <Box sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        minHeight: 250,
                        alignItems: 'stretch' // ensure columns have equal height so bottoms align
                    }}>
                        {/* LEFT COLUMN: Status Display */}
                        <Box sx={{
                            width: { xs: '100%', md: '50%' },
                            minWidth: { md: 250 },
                            p: 3,
                            position: 'relative' /* make this a positioning context for the success snackbar */,
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%'
                        }}>
                            <Typography variant="h6" color="text.secondary">
                                <AccessTime sx={{ verticalAlign: 'middle', mr: 1 }} />
                                Current Fast Duration
                            </Typography>

                            {/* Top stack: owner, trophies, timer (equal spacing among these) */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Active for: {user?.email ?? 'Guest'} {isAuthenticated ? '(you)' : '(not logged in)'}
                                </Typography>

                                <Trophies currentHours={currentHours} />

                                <LiveFastDuration
                                    startTime={startTime}
                                    isFasting={isFasting}
                                />
                            </Box>

                            {/* fixed spacer to create symmetric spacing between timer and start time */}
                            <Box sx={{ height: 2 }} />

                            {startTime && (
                                <Typography variant="body1" color="text.secondary">
                                    Start: {format(parseISO(startTime), 'MMM d, h:mm a')}
                                </Typography>
                            )}

                            {/* Inline success alert removed from this component. */}
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
                            justifyContent: 'flex-start',
                            height: '100%',
                            alignItems: 'stretch'
                        }}>
                            {/* Dry/Wet Toggle */}
                            <ToggleButtonGroup
                                value={fastType}
                                exclusive
                                onChange={(_, newType) => newType && !isFasting && setSelectedFastType(newType as 'wet' | 'dry')}
                                size="small"
                                fullWidth
                                sx={{ mb: 0 }}
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

                            {/* Combined Start/Stop + Custom Start control (match Wet/Dry toggle sizing) */}
                            <ToggleButtonGroup
                                value={showCustomTime ? 'custom' : (isFasting ? 'stop' : 'start')}
                                exclusive
                                size="small"
                                fullWidth
                            >
                                <ToggleButton
                                    value={isFasting ? 'stop' : 'start'}
                                    onClick={() => {
                                        if (isFasting) {
                                            handleStopFast();
                                        } else {
                                            handleStartNow();
                                        }
                                    }}
                                    disabled={isSaving}
                                    aria-label={isFasting ? 'Stop fast' : 'Start now'}
                                    fullWidth
                                    sx={{
                                        textTransform: 'none',
                                        // when fasting show error-contained look, otherwise primary-contained
                                        bgcolor: isFasting ? 'error.main' : 'primary.main',
                                        color: 'common.white',
                                        '&:hover': { bgcolor: isFasting ? 'error.dark' : 'primary.dark' },
                                        '&.Mui-selected': {
                                            bgcolor: isFasting ? 'error.main' : 'primary.main',
                                            color: 'common.white'
                                        }
                                    }}
                                >
                                    {isFasting ? (isSaving ? 'STOPPING...' : 'STOP FAST') : 'START NOW'}
                                </ToggleButton>

                                <ToggleButton
                                    value="custom"
                                    onClick={() => setShowCustomTime(prev => !prev)}
                                    disabled={isFasting}
                                    aria-pressed={showCustomTime}
                                    aria-label="Set custom start time"
                                    sx={{
                                        textTransform: 'none',
                                        border: 1,
                                        borderColor: 'primary.main',
                                        color: 'primary.main',
                                        '&.Mui-selected': {
                                            bgcolor: 'primary.main',
                                            color: 'common.white'
                                        }
                                    }}
                                >
                                    {showCustomTime ? 'CANCEL CUSTOM START' : 'SET CUSTOM START TIME'}
                                </ToggleButton>
                            </ToggleButtonGroup>

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

                            {/* Optional Additional Email Input (uncontrolled for snappy typing) */}
                                <AdditionalEmailInput
                                    ref={additionalEmailRef}
                                    // Only disable the input when there is no active fast. Keep it editable while automation is on.
                                    disabled={!isFasting}
                                    placeholder="Additional recipient emails (comma-separated)"
                                />

                            {/* Email Report Button (no spacer) */}
                                <Button
                                    variant={sendSuccess ? 'contained' : 'outlined'}
                                    color={sendSuccess ? undefined : 'secondary'}
                                    onClick={handleSendStatusReportToUserEmail}
                                    disabled={!isFasting || isSendingEmail}
                                    startIcon={isSendingEmail ? <AccessTime fontSize="small" color="inherit" /> : <Email />}
                                    fullWidth
                                    sx={sendSuccess ? { backgroundColor: '#2e7d32', '&:hover': { backgroundColor: '#27632a' } } : undefined}
                                >
                                    {isSendingEmail ? 'Sending Report...' : (sendSuccess ? 'Sent!' : 'Email Status Report')}
                                </Button>

                                {/* Automation toggle (inline, sleek) */}
                                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={automationEnabled}
                                                onChange={handleToggleAutomation}
                                                disabled={!isFasting || !isAuthenticated || automationPending}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                                <Box component="span">Auto-send status reports</Box>
                                                {/* Primary user icon (primary color) - no number */}
                                                <PersonIcon sx={{ color: automationEnabled ? 'primary.main' : 'text.secondary', fontSize: 18, verticalAlign: 'middle' }} />
                                                {/* Additional recipients: show badge only when automation is enabled and additional recipients exist */}
                                                {automationEnabled && automationRecipients && Math.max(0, automationRecipients.length - 1) > 0 ? (
                                                    <Badge
                                                        badgeContent={Math.max(0, automationRecipients.length - 1)}
                                                        color="secondary"
                                                        overlap="rectangular"
                                                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                                                        sx={{ '& .MuiBadge-badge': { transform: 'translate(8px,-8px)', fontSize: '0.55rem', minWidth: 14, height: 14, lineHeight: '14px', padding: '0 4px' } }}
                                                    >
                                                        <PersonIcon sx={{ color: 'text.secondary', fontSize: 14 }} />
                                                    </Badge>
                                                ) : null}
                                            </Box>
                                        }
                                    />
                                </Box>
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
                flexDirection: 'column',
                // allow flex children to shrink so inner scrollbars can appear
                minHeight: 0
            }}>

                {/* Fast Notes Box */}
                {/* ensure flex children can shrink and allow internal scrolling */}
                <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                    <Typography variant="h6" gutterBottom color="primary">
                        <Notes sx={{ verticalAlign: 'middle', mr: 1 }} /> Fast Notes
                    </Typography>

                    {/* Notes Display Box */}
                    <Box sx={{ position: 'relative', maxHeight: { xs: '180px', md: '380px' }, overflowY: 'auto', mb: 2, p: 1, border: '1px solid #333', borderRadius: 1 }}>
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
                        Are you sure you want to end your **{currentHours.toFixed(2)}** hour fast? This will log the record to your history.
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
            
            {/* Email modal removed — sending occurs immediately when the button is clicked. */}

            {/* Snackbar for user feedback (toasts) */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={snackbarDuration}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                onClose={() => setSnackbarOpen(false)}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default FastingTimer;