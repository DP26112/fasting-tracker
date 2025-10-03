import React, { useState, useEffect } from 'react';
import {
    Typography, Box, Card, CircularProgress, Alert,
    Accordion, AccordionSummary, AccordionDetails, List, ListItem,
    ListItemText, Grid, Divider, Button, TextField, Snackbar,
    Collapse,
    // ADDED DIALOG IMPORTS
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight'; // CORRECTED IMPORT PATH
import { AccessTime, Event, Notes, WaterDrop, WbSunny, Send } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import { format, parseISO } from 'date-fns';
import axios from 'axios';
import type { FastRecord, Note } from '../types';


const API_URL = 'http://localhost:3001/api';

const FastHistory: React.FC = () => {
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

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await axios.get<FastRecord[]>(`${API_URL}/fast-history`);
                setHistory(response.data);
            } catch (err) {
                setError('Failed to load fast history. Ensure your Node.js backend server is running.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const handleEmailHistory = async () => {
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
            const response = await axios.post(`${API_URL}/email-history`, { email });

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
    const handleOpenDeleteConfirm = (event: React.MouseEvent, fastId: string) => {
        event.stopPropagation();
        setFastToDeleteId(fastId);
        setIsConfirmDialogOpen(true);
    };
    
    // 2. Function to EXECUTE the Delete after Confirmation
    const handleConfirmDelete = async () => {
        setIsConfirmDialogOpen(false); // Close dialog immediately
        if (!fastToDeleteId) return;

        try {
            setLoading(true);
            await axios.delete(`${API_URL}/fast-history/${fastToDeleteId}`);

            setHistory(prevHistory => prevHistory.filter(fast => fast._id !== fastToDeleteId));

            setSnackbarMessage('✅ Fast record deleted successfully!');
            setSnackbarOpen(true);
        } catch (err) {
            console.error('Failed to delete fast:', err);
            setSnackbarMessage('❌ Failed to delete fast record. Check server logs.');
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
    if (error) {
        return <Alert severity="error" sx={{ mt: 5 }}>{error}</Alert>;
    }

    return (
        <Box sx={{ mt: 5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" color="primary" sx={{ borderBottom: '2px solid', borderColor: 'secondary.main', pb: 1, pr: 2 }}>
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
                        <Alert severity="info" sx={{ mt: 2 }}>No completed fasts found yet. Stop your current fast to log your first entry!</Alert>
                    ) : (
                        <List>
                            {history.map((fast) => (
                                <Card key={fast._id} raised sx={{ mb: 2, background: 'background.paper' }}>
                                    <Accordion disableGutters sx={{ background: 'transparent' }}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ '& .MuiAccordionSummary-content': { margin: '12px 0' } }}>
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid item xs={12} sm={4}>
                                                    <Typography variant="h6" color="secondary.main">
                                                        {fast.durationHours.toFixed(2)} Hrs
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={5}>
                                                    <Typography variant="body1" color="text.secondary">
                                                        {format(parseISO(fast.endTime), 'MMM d, yyyy')}
                                                    </Typography>
                                                </Grid>

                                                <Grid item xs={12} sm={3} sx={{ textAlign: 'right' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                                        <Typography variant="body2" sx={{ color: fast.fastType === 'dry' ? 'error.main' : 'info.main', whiteSpace: 'nowrap' }}>
                                                            {fast.fastType.toUpperCase()}
                                                            {fast.fastType === 'wet' ? <WaterDrop sx={{ fontSize: 16, ml: 0.5 }} /> : <WbSunny sx={{ fontSize: 16, ml: 0.5 }} />}
                                                        </Typography>

                                                        {/* UPDATED: Calls the dialog open function */}
                                                        <Button
                                                            onClick={(event) => handleOpenDeleteConfirm(event, fast._id)}
                                                            variant="outlined"
                                                            color="error"
                                                            size="small"
                                                            sx={{ minWidth: '32px', padding: '4px', border: 'none' }}
                                                        >
                                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                                        </Button>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </AccordionSummary>

                                        <AccordionDetails sx={{ pt: 0, borderTop: '1px solid #333' }}>
                                            <Box sx={{ p: 2 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    <Event sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} /> Started: {format(parseISO(fast.startTime), 'MMM d, yyyy h:mm a')}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                    <AccessTime sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} /> Ended: {format(parseISO(fast.endTime), 'MMM d, yyyy h:mm a')}
                                                </Typography>

                                                {fast.notes && fast.notes.length > 0 && (
                                                    <>
                                                        <Divider sx={{ my: 1 }} />
                                                        <Typography variant="subtitle2" color="primary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                            <Notes sx={{ fontSize: 18, mr: 0.5 }} /> Logged Notes:
                                                        </Typography>
                                                        <List dense disablePadding>
                                                            {fast.notes.map((note, index) => (
                                                                <ListItem key={index} disableGutters sx={{ py: 0 }}>
                                                                    <ListItemText
                                                                        primary={`${format(parseISO(note.time), 'h:mm a')}: ${note.text}`}
                                                                        primaryTypographyProps={{ variant: 'caption', color: 'text.primary' }}
                                                                    />
                                                                </ListItem>
                                                            ))}
                                                        </List>
                                                    </>
                                                )}
                                            </Box>
                                        </AccordionDetails>
                                    </Accordion>
                                </Card>
                            ))}
                        </List>
                    )}
                </Box>
            </Collapse>

            <Box sx={{ mt: 4, mb: 3, p: 2, border: '1px solid #444', borderRadius: '5px' }}>
                <Typography variant="h6" gutterBottom color="secondary.main">
                    Email Full History
                </Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={8}>
                        <TextField
                            fullWidth
                            label="Email Address"
                            type="email"
                            variant="outlined"
                            size="small"
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
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            onClick={handleEmailHistory}
                            disabled={history.length === 0 || !email || sendingEmail}
                            startIcon={sendingEmail ? <CircularProgress size={20} color="inherit" /> : <Send />}
                        >
                            {sendingEmail ? 'Sending...' : 'Email All Fasts'}
                        </Button>
                    </Grid>
                </Grid>
                {(history.length === 0 || !email) && !sendingEmail && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        * {history.length === 0 ? 'Log a completed fast' : 'Enter an email address'} to enable the email feature.
                    </Typography>
                )}
            </Box>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                message={snackbarMessage}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
            
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