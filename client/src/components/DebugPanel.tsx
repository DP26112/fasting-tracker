// client/src/components/DebugPanel.tsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Accordion, AccordionSummary, AccordionDetails, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getTokenDebugInfo } from '../utils/tokenValidation';

/**
 * Debug panel to help diagnose authentication issues on mobile browsers
 * Shows localStorage health, token status, and system information
 * 
 * To enable: Add ?debug=true to the URL
 */
const DebugPanel: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState(getTokenDebugInfo());
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Check if debug mode is enabled via URL parameter
    const params = new URLSearchParams(window.location.search);
    setShowDebug(params.get('debug') === 'true');

    // Refresh debug info every 2 seconds
    const interval = setInterval(() => {
      setDebugInfo(getTokenDebugInfo());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!showDebug) return null;

  return (
    <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, maxHeight: '40vh', overflow: 'auto' }}>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: 'error.dark' }}>
          <Typography variant="h6">🔧 Debug Panel</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ backgroundColor: 'background.paper' }}>
          <Paper sx={{ p: 2, backgroundColor: 'background.default' }}>
            <Typography variant="subtitle1" gutterBottom>
              <strong>localStorage Status</strong>
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip 
                label={debugInfo.localStorageWorks ? "✅ Working" : "❌ Broken"} 
                color={debugInfo.localStorageWorks ? "success" : "error"}
                size="small"
              />
            </Box>

            <Typography variant="subtitle1" gutterBottom>
              <strong>Token Status</strong>
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip 
                label={debugInfo.exists ? "Token Exists" : "No Token"} 
                color={debugInfo.exists ? "success" : "default"}
                size="small"
              />
              {debugInfo.exists && (
                <>
                  <Chip 
                    label={debugInfo.isValid ? "Valid Format" : "Invalid Format"} 
                    color={debugInfo.isValid ? "success" : "error"}
                    size="small"
                  />
                  <Chip 
                    label={debugInfo.isExpired ? "❌ Expired" : "✅ Active"} 
                    color={debugInfo.isExpired ? "error" : "success"}
                    size="small"
                  />
                  <Chip 
                    label={`Length: ${debugInfo.length}`} 
                    size="small"
                  />
                </>
              )}
            </Box>

            {debugInfo.payload && (
              <>
                <Typography variant="subtitle1" gutterBottom>
                  <strong>Token Details</strong>
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
                  User ID: {debugInfo.payload.id || debugInfo.payload.userId || 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
                  Email: {debugInfo.payload.email || 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
                  Expires: {new Date(debugInfo.payload.exp * 1000).toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
                  Time Until Expiry: {Math.floor((debugInfo.payload.exp * 1000 - Date.now()) / 1000 / 60)} minutes
                </Typography>
              </>
            )}

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              <strong>System Info</strong>
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
              User Agent: {navigator.userAgent.substring(0, 80)}...
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
              Current Time: {new Date().toISOString()}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 1 }}>
              Timezone Offset: {new Date().getTimezoneOffset()} minutes
            </Typography>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              To disable debug mode, remove ?debug=true from the URL
            </Typography>
          </Paper>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default DebugPanel;
