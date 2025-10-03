import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, CircularProgress } from '@mui/material';
// Import the Zustand store
import { useAuthStore } from '../store/authStore'; 

const Login: React.FC = () => {
    // Select the required state and actions from the store
    const { login, authError, isLoading } = useAuthStore();

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
            // 🔑 CALL THE ZUSTAND LOGIN ACTION
            await login(email, password);
            // On success, the store state updates, and FastHistory automatically re-renders
            // You might add a redirect here if you use React Router
        } catch (error) {
            // The store already handles setting authError, but we catch the thrown error here 
            // to prevent the form from submitting a second time on failure.
            console.error('Login failed in component:', error);
        }
    };

    return (
        <Box 
            component="form" 
            onSubmit={handleSubmit} 
            sx={{ maxWidth: 400, mx: 'auto', mt: 8, p: 3, border: '1px solid #444', borderRadius: '8px' }}
        >
            <Typography variant="h5" color="primary" gutterBottom>
                User Login
            </Typography>

            {/* Display errors from the Zustand store or local validation */}
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
        </Box>
    );
};

export default Login;