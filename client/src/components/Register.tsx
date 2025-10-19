import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useAuthStore } from '../store/authStore'; 

const API_URL = (import.meta.env.VITE_API_URL || '/api') + '/auth';

interface RegisterProps {
    onSuccess: () => void; // Callback to switch back to login/authenticated view
}

const Register: React.FC<RegisterProps> = ({ onSuccess }) => {
    const { loginWithToken } = useAuthStore();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsRegistering(true);

        // 1. Local Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            setIsRegistering(false);
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            setIsRegistering(false);
            return;
        }

        // 2. API Call
        try {
            const response = await axios.post(`${API_URL}/register`, { email, password });
            
            // 3. Auto-Login using the token returned by the server
            const newToken = response.data.token;
            const newUser = response.data.user || { email };

            if (newToken) {
                // Persist token and update store in a single action
                loginWithToken(newToken, newUser);
                // Notify parent that registration succeeded (optional)
                onSuccess();
            } else {
                // Fallback: call onSuccess to show the login form
                onSuccess();
            }

        } catch (err: any) {
            const message = err.response?.data?.message || 'Registration failed. Please try again.';
            setError(message);
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <Box 
            component="form" 
            onSubmit={handleRegister} 
            sx={{ maxWidth: 400, mx: 'auto', mt: 8, p: 3, border: '1px solid #444', borderRadius: '8px' }}
        >
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
            
            <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
                Already have an account? <Button onClick={onSuccess} size="small">Login</Button>
            </Typography>
        </Box>
    );
};

export default Register;