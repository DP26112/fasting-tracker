import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, TextField, Typography, Alert, CircularProgress, Link, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore'; 

// NOTE: register/login endpoints are available under /api/auth on the server.
// We use the centralized `api` instance for authenticated calls; registration is unauthenticated
// but using `api` keeps base URL consistent with the app's configuration.

// --- Login Form Component ---
const LoginForm: React.FC<{ switchToRegister: () => void }> = ({ switchToRegister }) => {
    const { login, authError, isLoading, loginWithToken } = useAuthStore();
    void loginWithToken;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null); 
        
        if (!email || !password) {
            setLocalError('Please enter both email and password.');
            return;
        }

        try {
            await login(email, password);
        } catch (error) {
            // The store already handles setting authError
            console.error('Login failed in component:', error);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit}>
            <Typography variant="h5" color="secondary" gutterBottom>
                User Login
            </Typography>

            {(authError || localError) && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {authError || localError}
                </Alert>
            )}

            <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                variant="outlined"
                required
            />
            <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                variant="outlined"
                required
            />

            <Button
                type="submit"
                fullWidth
                variant="contained"
                color="secondary"
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
                {isLoading ? 'Logging In...' : 'Login'}
            </Button>
            
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
                Don't have an account?{' '}
                <Link component="button" onClick={switchToRegister} sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                    Register
                </Link>
            </Typography>
        </Box>
    );
};

// ------------------------------------
// --- Register Form Component ---
// ------------------------------------

const RegisterForm: React.FC<{ switchToLogin: () => void }> = ({ switchToLogin }) => {
    const { login, loginWithToken } = useAuthStore();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
    const [pendingToken, setPendingToken] = useState<string | null>(null);
    const [pendingUser, setPendingUser] = useState<any | null>(null);
    const autoCloseRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (autoCloseRef.current) {
                clearTimeout(autoCloseRef.current as unknown as number);
            }
        };
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setIsRegistering(true);

        try {
            // Call the /register endpoint (which returns a JWT token)
            try {
                const response = await api.post('/auth/register', { email, password });
                const newToken = response.data?.token;
                const newUser = response.data?.user || { email };
                if (newToken) {
                    // Save pending token + user and show modal. User must click Continue to login.
                    setPendingToken(newToken);
                    setPendingUser(newUser);
                    setIsSuccessDialogOpen(true);

                    // Auto-close dialog after 10 seconds (but do not auto-login/redirect)
                    if (autoCloseRef.current) clearTimeout(autoCloseRef.current as unknown as number);
                    // Capture newToken/newUser in the closure so we don't rely on React state updates
                    autoCloseRef.current = window.setTimeout(() => {
                        // Use the captured token/user values to perform auto-login
                        if (newToken) {
                            try {
                                loginWithToken(newToken, newUser);
                            } catch (err) {
                                console.error('auto loginWithToken failed:', err);
                            }
                        }
                        setIsSuccessDialogOpen(false);
                        setPendingToken(null);
                        setPendingUser(null);
                        autoCloseRef.current = null;
                    }, 10000);
                } else {
                    // Fallback: attempt to call login with credentials (less ideal)
                    setIsSuccessDialogOpen(true);
                    await login(email, password);
                }
            } catch (err: any) {
                // Surface server-provided error messages when available
                const message = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
                setError(message);
                setIsRegistering(false);
                return;
            }

        } catch (err: any) {
            const message = err.response?.data?.message || 'Registration failed. Please try again.';
            setError(message);
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleRegister}>
            <Typography variant="h5" color="primary" gutterBottom>
                Create Account
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                variant="outlined"
                required
            />
            <TextField
                fullWidth
                label="Password (min 6 chars)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                variant="outlined"
                required
            />
            <TextField
                fullWidth
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                margin="normal"
                variant="outlined"
                required
            />

            <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                sx={{ mt: 3, mb: 2 }}
                disabled={isRegistering}
                startIcon={isRegistering ? <CircularProgress size={20} color="inherit" /> : null}
            >
                {isRegistering ? 'Signing Up...' : 'Register'}
            </Button>
            
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
                Already have an account?{' '}
                <Link component="button" onClick={switchToLogin} sx={{ color: 'secondary.main', fontWeight: 'bold' }}>
                    Login
                </Link>
            </Typography>

            {/* Registration success dialog */}
            <Dialog
                open={isSuccessDialogOpen}
                // prevent closing by backdrop click or escape; require Continue or auto-complete
                onClose={(_e, reason) => {
                    if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
                    setIsSuccessDialogOpen(false);
                }}
                disableEscapeKeyDown
            >
                <DialogTitle>{"Registration Successful"}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You have been registered. Click Continue to sign in and proceed.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={async () => {
                            // User clicked Continue: apply pending token, login, and close dialog
                            if (autoCloseRef.current) {
                                clearTimeout(autoCloseRef.current as unknown as number);
                                autoCloseRef.current = null;
                            }
                            if (pendingToken) {
                                try {
                                    loginWithToken(pendingToken, pendingUser);
                                } catch (err) {
                                    console.error('loginWithToken failed:', err);
                                }
                            }
                            setIsSuccessDialogOpen(false);
                            setPendingToken(null);
                            setPendingUser(null);
                        }}
                        color="primary"
                        variant="contained"
                        autoFocus
                    >
                        Continue
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

// ------------------------------------
// --- AuthContainer Component ---
// ------------------------------------

// Rename to AuthContainer to reflect dual purpose, but keep the export name
// as Login for compatibility with App.tsx
const AuthContainer: React.FC = () => {
    // State to toggle between the 'login' view and the 'register' view
    const [isLoginView, setIsLoginView] = useState(true); 

    const toggleView = () => setIsLoginView(prev => !prev);

    return (
        <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8, p: 3, border: '1px solid #444', borderRadius: '8px', background: 'background.paper' }}>
            {isLoginView ? (
                <LoginForm switchToRegister={toggleView} />
            ) : (
                <RegisterForm switchToLogin={toggleView} />
            )}
        </Box>
    );
};

// We export it as Login for App.tsx compatibility
export default AuthContainer;