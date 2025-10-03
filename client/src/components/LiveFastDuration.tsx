// client/src/LiveFastDuration.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Typography } from '@mui/material';
import { parseISO } from 'date-fns';

interface LiveFastDurationProps {
    startTime: string | null;
    isFasting: boolean;
}

// Helper function to format seconds into HH:MM:SS string
const formatDuration = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const formatTime = (value: number) => String(value).padStart(2, '0');

    return `${formatTime(h)}:${formatTime(m)}:${formatTime(s)}`;
};

const LiveFastDuration: React.FC<LiveFastDurationProps> = ({ startTime, isFasting }) => {
    // Local state to track the current time, updating every second only here
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    // 1. Core Timer Logic: Updates currentTime every second if fasting
    useEffect(() => {
        if (!isFasting || !startTime) {
            // Ensure the state is synchronized with the actual current time when mounting or starting
            setCurrentTime(new Date());
            return;
        }

        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000); // 🔑 This is the key change: only this component updates on a 1-second interval

        return () => {
            clearInterval(interval);
        };
    }, [isFasting, startTime]); // Re-run only when fasting status or start time changes

    // 2. Calculated Display Value
    const fastStatusText = useMemo(() => {
        if (!startTime) return 'Fast Not Started';
        
        try {
            const start = parseISO(startTime);
            const elapsedMs = currentTime.getTime() - start.getTime();
            const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

            return formatDuration(totalSeconds);
        } catch {
            return 'Error';
        }

    }, [startTime, currentTime]); // Re-calculate ONLY when currentTime or startTime changes

    return (
        <Typography variant="h2" sx={{ my: 1, color: isFasting ? '#03DAC6' : '#FF7043' }}>
            {fastStatusText}
        </Typography>
    );
};

export default LiveFastDuration;