// client/src/FastingTimer.tsx
// Temporary Cache Buster: Oct 3 2025, 11:35 AM <--- ADD THIS LINE

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Typography, Box, Card, CardContent, Button,
    TextField, ToggleButton, ToggleButtonGroup,
    Divider, Paper, Collapse, Switch, FormControlLabel,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import { AccessTime, Email, WbSunny, WaterDrop, Notes, Delete as DeleteIcon } from '@mui/icons-material';
import Trophies from './Trophies';
import { format, parseISO, getDate } from 'date-fns';
import { nanoid } from 'nanoid';
import AdditionalEmailInput from './AdditionalEmailInput';
import type { AdditionalEmailInputHandle } from './AdditionalEmailInput';

// 🔑 UPDATED IMPORTS: Use centralized types
import type { Note, FastType } from '../types'; 
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
    
    // Snackbar removed from this component; provide default values and no-op setters so existing call sites remain safe.
    const snackbarOpen: boolean = false;
    const snackbarMessage: string = '';
    const snackbarSeverity: 'success' | 'error' | 'info' = 'info';
    const snackbarDuration: number = 6000;
    const setSnackbarMessage = (_: string) => {};
    const setSnackbarSeverity = (_: 'success' | 'error' | 'info') => {};
    const setSnackbarOpen = (_: boolean) => {};
    const setSnackbarDuration = (_: number) => {};
    void snackbarOpen; void snackbarMessage; void snackbarSeverity; void snackbarDuration; void setSnackbarMessage; void setSnackbarSeverity; void setSnackbarOpen; void setSnackbarDuration;
    
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
    // additional email input is now uncontrolled for snappy typing
    const additionalEmailRef = useRef<AdditionalEmailInputHandle | null>(null);
    // no local schedule id tracked anymore (modal removed)


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

    // Start a fast and persist it to server when authenticated.
    // Returns true on success (or when running locally for unauthenticated users), false on failure.
    const handleStartFast = async (time: string): Promise<boolean> => {
        setCustomTimeInput('');
        // Debugging: log authentication state and requested start time
        console.log('handleStartFast called', { isAuthenticated, time, userId: user?.id, token: localStorage.getItem('token') });

        // If user is authenticated, persist to server first and only update UI on success
        if (isAuthenticated) {
            try {
                const tokenToSend = localStorage.getItem('token');
                console.log('handleStartFast: sending token (length):', tokenToSend ? tokenToSend.length : null);
                // Explicitly include Authorization header to avoid relying solely on interceptor
                await api.post(
                    '/active-fast',
                    { startTime: time, fastType, notes: [] },
                    { headers: { Authorization: tokenToSend ? `Bearer ${tokenToSend}` : undefined } }
                );
                // server responded OK — update client state
                setStartTime(time);
                setIsFasting(true);
                setNotes([]);
                return true;
            } catch (err) {
                console.error('Failed to persist active fast to server:', err);
                // do not update UI state so user sees the failure; fall back to local-only behavior if desired
                return false;
            }
        }

        // Unauthenticated users: persist only locally
        setStartTime(time);
        setIsFasting(true);
        setNotes([]);
        return true;
    };

    const handleStartNow = async () => {
        const ok = await handleStartFast(new Date().toISOString());
        if (ok) setShowCustomTime(false);
        else {
            // optionally notify the user; currently we log to console
            console.error('Start fast failed — please try again or check your network/credentials.');
        }
    };

    const handleSetCustomTime = async () => {
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

            const ok = await handleStartFast(date.toISOString());
            if (ok) setShowCustomTime(false);
            else console.error('Failed to set custom start time on server.');
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
            console.info('🔒 You must be logged in to save your fast.');
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

            console.log(`✅ Fast successfully stopped and logged to history! Duration: ${finalHoursFasted.toFixed(2)} hours.`);
            onFastLogged();

        } catch (error) {
            console.error('Failed to save fast:', error);

            console.error('⚠️ Failed to save fast to history (server error). The timer was stopped locally.');

            // If save failed due to network, queue the save locally for later sync
            try {
                const pendingKey = `pendingSaves:${storageId}`;
                const existing = JSON.parse(localStorage.getItem(pendingKey) || '[]');
                existing.push({ id: nanoid(8), payload: { startTime: prevState.startTime, endTime, durationHours: finalHoursFasted, fastType, notes: [...prevState.notes].reverse() }, createdAt: new Date().toISOString() });
                localStorage.setItem(pendingKey, JSON.stringify(existing));
                console.info('⚠️ Save queued locally and will sync when online or after login.');
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
            const currentFastDuration = currentHours;

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
    }, [isFasting, currentHours]);

    // 1. Delete Note: Open Dialog
    const handleOpenDeleteNoteConfirm = useCallback((noteId: string) => {
        setNoteIdToDelete(noteId);
        setIsDeleteNoteConfirmOpen(true);
    }, []);

    // 2. Delete Note: Confirm Action
    const handleConfirmDeleteNote = () => {
        if (!noteIdToDelete) return;

        setNotes(prevNotes => prevNotes.filter(note => note.id !== noteIdToDelete));
        
        // Show a slightly longer confirmation so users notice it if they don't click the close 'x'
    console.log('🗑️ Note deleted.');

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
            const extras = extrasRaw.split(',').map(e => e.trim()).filter(Boolean);
            const recipients = [userEmail, ...extras];

            const payload = {
                startTime,
                currentHours,
                fastType,
                notes: [...notes].reverse(),
                recipientEmail: userEmail,
                recipients: recipients,
            };
            console.log('Sending status report payload:', payload);
            await api.post('/send-report', payload);
            
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
            // only clear when automation is NOT enabled (user may want to keep list when automation is on)
            try { if (!automationEnabled) additionalEmailRef.current?.clear(); } catch { /* ignore */ }
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
                // enable automation: send recipients as user's email if available
                const recipient = user?.email ? [user.email] : [];
                const resp = await api.post('/schedule-status-report', { startTime, recipients: recipient });
                console.log('Automation enabled', resp?.data);
                setAutomationEnabled(true);
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
                // disable automation
                await api.delete('/schedule-status-report', { data: { startTime } });
                console.log('Automation disabled');
                setAutomationEnabled(false);
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
                        // expect resp.data.exists or a non-empty array of schedules depending on API
                        const exists = resp?.data?.exists ?? (Array.isArray(resp?.data) ? resp.data.length > 0 : false);
                        if (!mounted) return;
                        if (exists) {
                            setAutomationEnabled(true);
                            // persist local copy as truth
                            if (user?.id) {
                                localStorage.setItem(`automation:${user.id}:${startTime}`, '1');
                            }
                        } else {
                            setAutomationEnabled(false);
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
                                onChange={(_, newType) => newType && setFastType(newType)}
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
                                    disabled={!isFasting || automationEnabled}
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
                                        label="Auto-send status reports"
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

            {/* Snackbars removed from this component; important events are logged to the console. */}
        </Box>
    );
};

export default FastingTimer;