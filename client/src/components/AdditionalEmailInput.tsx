import { forwardRef, useImperativeHandle, useRef } from 'react';
import { TextField } from '@mui/material';
import { nanoid } from 'nanoid';

export type AdditionalEmailInputHandle = {
  getValue: () => string;
  clear: () => void;
};

type Props = {
  disabled?: boolean;
  placeholder?: string;
};

// Uncontrolled input for maximum typing responsiveness. Parent can call .getValue() when needed.
const AdditionalEmailInput = forwardRef<AdditionalEmailInputHandle, Props>(({ disabled, placeholder }, ref) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<string>(`addl-email-${nanoid(6)}`);

  useImperativeHandle(ref, () => ({
    getValue: () => inputRef.current?.value.trim() || '',
    clear: () => { if (inputRef.current) inputRef.current.value = ''; }
  }), []);

  return (
    <TextField
      inputRef={inputRef}
      name={nameRef.current}
      placeholder={placeholder || 'Additional recipient emails (comma-separated)'}
      size="small"
      fullWidth
      disabled={!!disabled}
      inputProps={{ autoComplete: 'new-password', style: { fontSize: '0.85rem' } }}
      sx={{ mb: 0 }}
    />
  );
});

export default AdditionalEmailInput;
