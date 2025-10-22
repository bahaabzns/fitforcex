'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Card, Stack, TextField, Typography, Button as MuiButton } from '@mui/material';
import api from '@/utils/axios';
import { useMetaPixel } from '@/hooks/useMetaPixel';

export default function SeedClientSignupPage() {
  const router = useRouter();
  const { trackLead } = useMetaPixel();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/api/clients', { fullName, email, phone: phone || undefined });
      const cid = res?.data?.client?.id as string | undefined;
      if (cid) setCreatedClientId(cid);
      if (email && password) {
        try { await api.post('/api/auth/signup', { fullName, email, password }); } catch {}
      }
      
      // Track Lead event on successful client registration
      trackLead(undefined, 'EGP'); // No specific value, just track the lead
      
      setSuccess(true);
    } catch (err) {
      setError('Failed to submit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 520 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" fontWeight={700} textAlign="center">Become a Client</Typography>
          <TextField label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
          </Stack>
          <TextField label="Password (optional)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
          {error && <Typography color="error" variant="body2" textAlign="center">{error}</Typography>}
          {!success ? (
            <MuiButton type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </MuiButton>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="success.main" textAlign="center">Request submitted successfully.</Typography>
              <MuiButton variant="contained" onClick={() => router.push(`/client/payment/mock${createdClientId ? `?clientId=${createdClientId}` : ''}`)}>
                Proceed to Mock Payment
              </MuiButton>
              <MuiButton variant="outlined" onClick={() => router.push('/')}>Back to Home</MuiButton>
            </Stack>
          )}
        </Stack>
      </Card>
    </Box>
  );
}


