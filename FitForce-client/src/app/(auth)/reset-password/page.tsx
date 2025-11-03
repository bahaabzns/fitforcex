'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/utils/axios';
import { Box, Card, CardContent, Typography, TextField, Button, Alert } from '@mui/material';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      setError('Missing token');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await api.post('/api/auth/password/reset', { token, newPassword: password });
      setSuccess('Password reset successfully. You can now log in.');
      setTimeout(() => router.push('/login'), 1500);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', px: 2 }}>
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            Reset Password
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button variant="contained" fullWidth disabled={loading} onClick={handleSubmit}>
            {loading ? 'Saving…' : 'Reset Password'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}


