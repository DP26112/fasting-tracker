import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, TextField, DialogActions, Button, Box, FormControlLabel, Checkbox } from '@mui/material';
import { Email as EmailIcon } from '@mui/icons-material';
import api from '../utils/api';
import type { Note, FastType } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  startTime: string | null;
  currentHours: number;
  fastType: FastType;
  notes: Note[];
  isAuthenticated: boolean;
  existingScheduleId?: string | null;
  onScheduleCreated?: (id: string | null) => void;
}

const EmailStatusDialog: React.FC<Props> = ({ open, onClose, startTime, currentHours, fastType, notes, isAuthenticated, existingScheduleId, onScheduleCreated }) => {
  const recipientRef = useRef<HTMLInputElement | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(!!existingScheduleId);
  const [emailInputName] = useState(() => `email_${Math.random().toString(36).slice(2,9)}`);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setScheduleEnabled(!!existingScheduleId);
  }, [existingScheduleId]);

  useEffect(() => {
    if (open && recipientRef.current) {
      recipientRef.current.value = '';
      recipientRef.current.name = emailInputName;
      recipientRef.current.autocomplete = 'new-password';
    }
  }, [open, emailInputName]);

  const handleSend = useCallback(async () => {
    const recipientEmail = recipientRef.current?.value?.trim() || '';
    if (!recipientEmail) {
      console.error('No recipient provided');
      return;
    }

    setIsSending(true);
    try {
      await api.post('/send-report', {
        startTime,
        currentHours,
        fastType,
        notes: [...notes].reverse(),
        recipientEmail,
      });
      console.log('Report sent');

      if (scheduleEnabled && isAuthenticated) {
        try {
          const resp = await api.post('/schedule-status-report', { startTime, recipients: [recipientEmail] });
          onScheduleCreated?.(resp?.data?.schedule?._id || resp?.data?.id || null);
          console.log('Automation enabled');
        } catch (err) {
          console.error('Failed to enable automation', err);
        }
      } else if (!scheduleEnabled && existingScheduleId && isAuthenticated) {
        try {
          await api.delete('/schedule-status-report', { data: { startTime } });
          onScheduleCreated?.(null);
          console.info('Automation cancelled');
        } catch (err) {
          console.error('Failed to cancel automation', err);
        }
      }
    } finally {
      setIsSending(false);
      onClose();
    }
  }, [startTime, currentHours, fastType, notes, scheduleEnabled, isAuthenticated, existingScheduleId, onScheduleCreated, onClose]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>
        <EmailIcon sx={{ mr: 1 }} /> Email Current Fast Report
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Enter the recipient email to send a snapshot of your current fast status.
        </DialogContentText>
        <TextField
          inputRef={recipientRef}
          autoFocus
          margin="dense"
          label="Recipient Email Address"
          type="email"
          fullWidth
          variant="outlined"
          inputProps={{ autoComplete: 'new-password', name: emailInputName }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
        />
        <DialogContentText variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Comma-separated addresses allowed.
        </DialogContentText>

        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
          <FormControlLabel
            control={<Checkbox checked={scheduleEnabled} onChange={(_, v) => { setScheduleEnabled(v); }} />}
            label="Automatically send this status report every 6 hours (after initial 24h)"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">Cancel</Button>
        <Button onClick={handleSend} color="primary" variant="contained" disabled={isSending}>Send Report</Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(EmailStatusDialog);
