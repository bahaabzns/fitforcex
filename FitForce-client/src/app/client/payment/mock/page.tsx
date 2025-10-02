'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Card, Stack, TextField, Typography, Button as MuiButton } from '@mui/material';
import api from '@/utils/axios';

export default function SeedClientMockPaymentPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/clients/subscription/mock', {});
      router.push('/client/subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={700} textAlign="center">Client Mock Payment</Typography>
            <TextField label="Card Number" value={card} onChange={(e) => setCard(e.target.value)} required />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Expiry (MM/YY)" value={expiry} onChange={(e) => setExpiry(e.target.value)} required fullWidth />
              <TextField label="CVC" value={cvc} onChange={(e) => setCvc(e.target.value)} required fullWidth />
            </Stack>
            <MuiButton type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? 'Processing...' : 'Pay Now'}
            </MuiButton>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              This simulates a payment for development only.
            </Typography>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}


