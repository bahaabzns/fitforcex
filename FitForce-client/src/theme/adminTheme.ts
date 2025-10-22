'use client';

import { createTheme } from '@mui/material/styles';

const adminTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1e88e5'
    },
    secondary: {
      main: '#00bfa5'
    },
    background: {
      default: '#f7f9fc',
      paper: '#ffffff'
    }
  },
  shape: {
    borderRadius: 10
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    h4: { fontWeight: 800 },
    h6: { fontWeight: 700 }
  },
  components: {
    MuiCard: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiButton: { defaultProps: { size: 'small' } },
    MuiChip: { defaultProps: { size: 'small', color: 'default' } }
  }
});

export default adminTheme;


