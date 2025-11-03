// src/components/FastHistory.tsx

import React, { useState, useEffect } from 'react';
import {
    Typography, Box, CircularProgress, Alert,
    List, Button, TextField, Snackbar,
    Collapse, Paper,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Event, Send } from '@mui/icons-material';
import FastHistoryItem from './FastHistoryItem';
import api from '../utils/api';
import type { FastRecord } from '../types';

// 🔑 ZUSTAND CHANGE: Import the custom authentication store
import { useAuthStore } from '../store/authStore'; 

// 🔑 ZUSTAND CHANGE: Remove the prop interface as we are using the store directly
// interface FastHistoryProps {
//     token: string | null;
// }

// 🔑 ZUSTAND CHANGE: Component no longer accepts token as a prop
const FastHistory: React.FC = () => {
    
    // 🔑 ZUSTAND CHANGE: Get token and authentication status directly from the store
    const token = useAuthStore((state) => state.token);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    const [history, setHistory] = useState<FastRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [isHistoryVisible, setIsHistoryVisible] = useState(true);
    const [sendingEmail, setSendingEmail] = useState<boolean>(false);
    
    // NEW STATE FOR DIALOG CONFIRMATION
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [fastToDeleteId, setFastToDeleteId] = useState<string | null>(null);

    // 🔑 AUTH CHANGE: Helper function to get Authorization Headers (uses state variable 'token')
    const getAuthHeaders = () => ({
        headers: {
            // Include the token in the 'Authorization' header in 'Bearer <token>' format
            'Authorization': `Bearer ${token}`, 
        },
    });

    useEffect(() => {
        const fetchHistory = async () => {
            // 🔑 AUTH CHANGE: Check for token before fetching protected data
            if (!token) {
                setLoading(false);
                setError('You must be logged in to view your fast history.');
                return;
            }

            try {
                // 🔑 AUTH CHANGE: Pass the Authorization header to the request
                const response = await api.get<FastRecord[]>('/fast-history', getAuthHeaders());
                setHistory(response.data);
                setError(null); // Clear any previous auth error
            } catch (err: any) {
                // Handle 401 Unauthorized errors from the server
                if (err.response && err.response.status === 401) {
                    setError('Session expired or unauthorized. Please log in again.');
                } else {
                    setError('Failed to load fast history. Ensure your Node.js backend server is running.');
                }
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [token]); // 🔑 AUTH CHANGE: Re-run effect when the token changes

    const handleEmailHistory = async () => {
        // NOTE: This route is UNPROTECTED on the server side, so it remains unchanged.
        if (!email || !email.includes('@')) {
            setSnackbarMessage('❌ Please enter a valid email address.');
            setSnackbarOpen(true);
            return;
        }

        if (history.length === 0) {
            setSnackbarMessage('ℹ️ Cannot email history: no fasts logged.');
            setSnackbarOpen(true);
            return;
        }

        setSendingEmail(true);
        try {
            const response = await api.post('/email-history', { recipientEmail: email });

            setSnackbarMessage(response.data.message || '✅ Fast history email request sent successfully!');
            setSnackbarOpen(true);
        } catch (err: any) {
            console.error('Failed to send email:', err);
            const errorMessage = err.response?.data?.message || '❌ Failed to send email. Check server and email configuration.';
            setSnackbarMessage(errorMessage);
            setSnackbarOpen(true);
        } finally {
            setSendingEmail(false);
        }
    };
    
    // 1. Function to OPEN the Confirmation Dialog
    const handleOpenDeleteConfirm = React.useCallback((event: React.MouseEvent, fastId: string) => {
        event.stopPropagation();
        setFastToDeleteId(fastId);
        setIsConfirmDialogOpen(true);
    }, []);
    
    // 2. Function to EXECUTE the Delete after Confirmation (PROTECTED)
    const handleConfirmDelete = async () => {
        setIsConfirmDialogOpen(false); // Close dialog immediately
        // 🔑 ADDED: Check for token
        if (!fastToDeleteId || !token) return; 

        try {
            setLoading(true);
            // 🔑 AUTH CHANGE: Pass the Authorization header to the request
            await api.delete(`/fast-history/${fastToDeleteId}`, getAuthHeaders());

            setHistory(prevHistory => prevHistory.filter(fast => fast._id !== fastToDeleteId));

            setSnackbarMessage('✅ Fast record deleted successfully!');
            setSnackbarOpen(true);
        } catch (err: any) {
            console.error('Failed to delete fast:', err);
            
            const errorMessage = err.response?.data?.message || '❌ Failed to delete fast record. Check server logs.';
            
            // 🔑 ADDED: Check for unauthorized deletion
            if (err.response && err.response.status === 404) {
                 setSnackbarMessage('❌ Record not found or you are not authorized to delete it.');
            } else {
                setSnackbarMessage(errorMessage);
            }
            setSnackbarOpen(true);
        } finally {
            setLoading(false);
            setFastToDeleteId(null); // Clear the ID
        }
    };

    const handleCancelDelete = () => {
        setIsConfirmDialogOpen(false);
        setFastToDeleteId(null);
    };

    const handleToggleHistory = () => {
        setIsHistoryVisible(prev => !prev);
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress color="secondary" /></Box>;
    }
    
    // 🔑 ZUSTAND CHANGE: Display a distinct message if not authenticated
    if (!isAuthenticated) {
        return <Alert severity="warning" sx={{ mt: 5 }}>Please log in to view your fasting history.</Alert>;
    }
    
    // Check for other errors only if authenticated
    if (error) {
        return <Alert severity="error" sx={{ mt: 5 }}>{error}</Alert>;
    }

    return (
        <Box sx={{ mt: 5 }}>
            {/* 🎨 Unified Paper container matching Fast Notes styling */}
            <Paper elevation={3} sx={{ p: 3, background: (theme) => theme.palette.background.paper }}>
                {/* Header with title and controls */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Event sx={{ verticalAlign: 'middle', mr: 1 }} /> Fasting History
                    </Typography>

                    <Button
                        variant="outlined"
                        onClick={handleToggleHistory}
                        startIcon={isHistoryVisible ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                        size="small"
                        color="secondary"
                    >
                        {isHistoryVisible ? 'Collapse' : 'Expand'} History
                    </Button>
                </Box>

                <Collapse in={isHistoryVisible}>
                    <Box>
                        {history.length === 0 ? (
                            <Alert severity="info" sx={{ mb: 3 }}>No completed fasts found yet. Stop your current fast to log your first entry!</Alert>
                        ) : (
                            <List sx={{ mb: 3 }}>
                                {history.map((fast) => (
                                    <FastHistoryItem key={fast._id} fast={fast} onDelete={handleOpenDeleteConfirm} />
                                ))}
                            </List>
                        )}

                        {/* 🎨 NEW: Email section moved inside Paper */}
                        <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="h6" gutterBottom color="secondary.main" sx={{ mb: 2 }}>
                                <Send sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} />
                                Email Full History
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center' }}>
                                <Box sx={{ flex: '1 1 60%' }}>
                                    <TextField
                                        fullWidth
                                        label="Email Address"
                                        name="emailHistoryRecipient"
                                        type="email"
                                        variant="outlined"
                                        size="small"
                                        inputProps={{ autoComplete: 'new-password' }}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                                                '&:hover fieldset': { borderColor: 'secondary.main' },
                                                '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                                            },
                                            '& .MuiInputLabel-root': { color: 'text.secondary' },
                                            '& .MuiInputBase-input': { color: 'white' }
                                        }}
                                    />
                                </Box>
                                <Box sx={{ flex: '0 0 160px' }}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        color="primary"
                                        onClick={handleEmailHistory}
                                        disabled={history.length === 0 || !email || sendingEmail}
                                        startIcon={sendingEmail ? <CircularProgress size={20} color="inherit" /> : <Send />}
                                    >
                                        {sendingEmail ? 'Sending...' : 'Email All'}
                                    </Button>
                                </Box>
                            </Box>
                            {(history.length === 0 || !email) && !sendingEmail && (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    * {history.length === 0 ? 'Log a completed fast' : 'Enter an email address'} to enable the email feature.
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </Collapse>
            </Paper>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
            
            {/* NEW CONFIRMATION DIALOG COMPONENT */}
            <Dialog
                open={isConfirmDialogOpen}
                onClose={handleCancelDelete}
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-description"
            >
                <DialogTitle id="delete-dialog-title">{"Confirm Deletion"}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-dialog-description">
                        Are you sure you want to delete this fast record? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} color="secondary">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleConfirmDelete} 
                        color="error" 
                        variant="contained" 
                        autoFocus
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FastHistory;