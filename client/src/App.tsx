// client/src/App.tsx (Final Version: Centered & Dark Theme)

import React, { useState } from 'react';
import { 
    Container, Typography, Box, 
    CssBaseline, createTheme, ThemeProvider, Grid
} from '@mui/material';

import FastHistory from './components/FastHistory'; 
import FastingTimer from './components/FastingTimer'; 

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
        // 💡 CHANGE THIS LINE to use the Inter font
        fontFamily: '"Inter", Arial, sans-serif', 
        h3: {
            fontWeight: 400, // A slightly heavier weight looks better with Inter
        },
        h2: {
            fontSize: '3.5rem',
            fontWeight: 800, // Make the timer duration really stand out
        }
    },
    // 💡 Centering Fix + Background Restore
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    minHeight: '100vh',
                    // 🌟 FIX: Explicitly set the background color from the theme
                    backgroundColor: '#121212', // Directly use the default color
                    
                    // Centering using Flexbox (kept from the previous successful step)
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'flex-start',
                },
                html: {
                    minHeight: '100vh',
                }
            },
        },
    },
});

// --- Main App Component Start ---
const FastingTracker: React.FC = () => {
    const [historyKey, setHistoryKey] = useState(0); 

    const handleFastLogged = () => {
        setHistoryKey(prevKey => prevKey + 1);
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            
            {/* The Container is now centered thanks to the body Flexbox styles */}
            <Container 
                maxWidth="md" 
                sx={{ 
                    py: 4,
                    mx: 'auto', 
                    display: 'block' 
                }}
            >
                
                {/* Main Title - Centered */}
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
    variant="h2" // Use a large, bold variant from your theme
    sx={{ 
        fontWeight: 800, // Matches the bold look of your h2/timer style
        color: 'text.primary', 
        letterSpacing: '0.15em' 
    }}
>
    <Box component="span" sx={{ color: 'primary.main' }}>
        FASTING
    </Box>
    {' '}TRACKER
</Typography>
                </Box>

                <FastingTimer 
                    onFastLogged={handleFastLogged} 
                    darkTheme={darkTheme} 
                />

                <Box sx={{ mt: 2 }}>
                    <FastHistory key={historyKey} /> 
                </Box>
                
            </Container>
        </ThemeProvider>
    );
};

export default FastingTracker;