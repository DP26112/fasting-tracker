// client/src/components/ErrorBoundary.tsx

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import { Error as ErrorIcon, Refresh } from '@mui/icons-material';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches React errors and displays a friendly fallback UI
 * Prevents the entire app from crashing due to component errors
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render shows the fallback UI
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error details for debugging
        console.error('❌ React Error Boundary caught an error:', error);
        console.error('Error Info:', errorInfo);
        
        this.setState({
            error,
            errorInfo,
        });
    }

    handleReload = (): void => {
        // Clear error state and reload the page
        window.location.reload();
    };

    handleReset = (): void => {
        // Clear error state and try to recover
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <Box
                    sx={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 3,
                        background: (theme) => theme.palette.background.default,
                    }}
                >
                    <Paper
                        elevation={3}
                        sx={{
                            p: 4,
                            maxWidth: '600px',
                            textAlign: 'center',
                        }}
                    >
                        <ErrorIcon
                            sx={{
                                fontSize: 64,
                                color: 'error.main',
                                mb: 2,
                            }}
                        />
                        
                        <Typography variant="h4" color="primary" gutterBottom>
                            Oops! Something went wrong
                        </Typography>
                        
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            The app encountered an unexpected error. Don't worry - your fast data is safe!
                        </Typography>

                        <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                {this.state.error?.message || 'Unknown error'}
                            </Typography>
                        </Alert>

                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={this.handleReload}
                                startIcon={<Refresh />}
                                size="large"
                            >
                                Reload App
                            </Button>
                            
                            <Button
                                variant="outlined"
                                color="secondary"
                                onClick={this.handleReset}
                                size="large"
                            >
                                Try Again
                            </Button>
                        </Box>

                        {import.meta.env.DEV && this.state.errorInfo && (
                            <Box sx={{ mt: 3, textAlign: 'left' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                    Development Info:
                                </Typography>
                                <Alert severity="warning" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxHeight: '200px', overflow: 'auto' }}>
                                    {this.state.errorInfo.componentStack}
                                </Alert>
                            </Box>
                        )}
                    </Paper>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
