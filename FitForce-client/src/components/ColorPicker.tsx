'use client';

import { TextField } from '@mui/material';

interface ColorPickerProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
}

export function ColorPicker({ label, value, onChange, fullWidth }: ColorPickerProps) {
  return (
    <TextField
      fullWidth={fullWidth}
      label={label}
      type="color"
      value={value || '#000000'}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

