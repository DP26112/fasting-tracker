import React, { useState } from 'react';
import { 
    Container, Typography, Box, 
    CssBaseline, createTheme, ThemeProvider,
    Button 
} from '@mui/material';

import FastHistory from './components/FastHistory'; 
import FastingTimer from './components/FastingTimer'; 
import Login from './components/Login'; // 🔑 Import the new Login component
import { useAuthStore } from './store/authStore'; // 🔑 Import the authentication store

// --- MUI Dark Theme Setup ---
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#00BCD4',
        },
        secondary: {
            main: '#03DAC6',
        },
        background: {
            default: '#121212', // Dark background color
            paper: '#1E1E1E',   // Darker paper color
        },
        text: {
            primary: '#FFFFFF',
            secondary: '#BDBDBD',
        },
    },
    typography: {
        fontFamily: '"Inter", Arial, sans-serif', 
        h3: {
            fontWeight: 400,
        },
        h2: {
            fontSize: '3.5rem',
            fontWeight: 800,
        }
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    minHeight: '100vh',
                    backgroundColor: '#121212',
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'flex-start',
                    // Reserve vertical scrollbar space to avoid layout shifts when content height changes
                    overflowY: 'scroll',
                    // where supported reserve the scrollbar gutter to avoid jitter
                    scrollbarGutter: 'stable',
                },
                html: {
                    minHeight: '100vh',
                }
            },
        },
    },
});

// --- Main App Component Start ---
const App: React.FC = () => {
    // 🔑 AUTHENTICATION LOGIC
    const { isAuthenticated, logout } = useAuthStore();

    // State to force FastHistory refresh after a fast is logged
    const [historyKey, setHistoryKey] = useState(0); 

    const handleFastLogged = () => {
        setHistoryKey(prevKey => prevKey + 1);
    };
    
    // Header Content (shared between authenticated and unauthenticated views)
    const Header = () => (
        <Box 
            sx={{ 
                textAlign: 'center', 
                mb: 4, 
                p: 2, 
                borderRadius: 2,
                backgroundColor: 'background.paper' 
            }}
        >
            <Typography
                variant="h2"
                sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '0.15em' }}
            >
                <Box component="span" sx={{ color: 'primary.main' }}>
                    FASTING
                </Box>
                {' '}TRACKER
            </Typography>
        </Box>
    );

    // Authenticated Content
    const AuthenticatedContent = () => (
        <>
            <FastingTimer 
                onFastLogged={handleFastLogged} 
                darkTheme={darkTheme} 
            />
            <Box sx={{ mt: 2 }}>
                <FastHistory key={historyKey} /> 
            </Box>
            <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Button 
                    variant="outlined" 
                    color="secondary" 
                    onClick={logout}
                >
                    Logout
                </Button>
            </Box>
        </>
    );

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            
            <Container 
                maxWidth="md" 
                sx={{ 
                    py: 4,
                    mx: 'auto', 
                    display: 'block' 
                }}
            >
                <Header />

                {/* 🔑 CONDITIONAL RENDERING */}
                {isAuthenticated ? (
                    <AuthenticatedContent />
                ) : (
                    <Login />
                )}
                
            </Container>
        </ThemeProvider>
    );
};

export default App;
