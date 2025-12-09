'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { CheckCircle, Email, Close } from '@mui/icons-material';
import api from '@/utils/axios';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

interface EmailVerificationFlowProps {
  open: boolean;
  email: string;
  onSkip?: () => void;
  onVerified?: () => void;
}

export default function EmailVerificationFlow({
  open,
  email,
  onSkip,
  onVerified,
}: EmailVerificationFlowProps) {
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setCode('');
      setError(null);
      setSuccess(false);
      setResendCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/api/auth/verify-email', { email, code });
      setSuccess(true);
      setTimeout(() => {
        onVerified?.();
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Verification failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    setResending(true);
    setError(null);

    try {
      await api.post('/api/auth/resend-verification-code', { email });
      setCanResend(false);
      setResendCooldown(60); // 60 second cooldown
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to resend code';
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setError(null);
  };

  if (success) {
    return (
      <Dialog open={open} maxWidth="sm" fullWidth>
        <DialogContent>
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main' }} />
            <Typography variant="h5" textAlign="center">
              Email Verified Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Your account has been activated. You can now access all features.
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} maxWidth="sm" fullWidth onClose={onSkip}>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Verify Your Email</Typography>
          {onSkip && (
            <Button onClick={onSkip} size="small" sx={{ minWidth: 'auto', p: 0.5 }}>
              <Close />
            </Button>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Alert severity="info" icon={<Email />}>
            We've sent a 6-digit verification code to <strong>{email}</strong>. Please check your inbox.
          </Alert>

          <TextField
            label="Verification Code"
            value={code}
            onChange={handleCodeChange}
            placeholder="000000"
            inputProps={{
              maxLength: 6,
              style: { textAlign: 'center', fontSize: '24px', letterSpacing: '8px' },
            }}
            fullWidth
            error={!!error}
            helperText={error || 'Enter the 6-digit code from your email'}
            autoFocus
          />

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Didn't receive the code?
            </Typography>
            <Button
              onClick={handleResendCode}
              disabled={!canResend || resending}
              size="small"
              variant="text"
            >
              {resending ? (
                <CircularProgress size={16} />
              ) : resendCooldown > 0 ? (
                `Resend code in ${resendCooldown}s`
              ) : (
                'Resend verification code'
              )}
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Stack direction="row" spacing={2} width="100%">
          {onSkip && (
            <Button onClick={onSkip} variant="outlined" fullWidth>
              Skip for Now
            </Button>
          )}
          <Button
            onClick={handleVerify}
            variant="contained"
            fullWidth
            disabled={loading || code.length !== 6}
          >
            {loading ? <CircularProgress size={24} /> : 'Verify Email'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

