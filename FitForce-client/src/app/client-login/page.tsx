'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@mui/material';
import { TextField, Box, Typography, Stack, Button } from '@mui/material';
import api from '@/utils/axios';

export default function SeedClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/clients/login', { email, password });
      router.push('/client/dashboard');
    } catch (err) {
      setError('Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" fontWeight={700} textAlign="center">Client Login</Typography>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
          {error && (
            <Typography color="error" variant="body2" textAlign="center">{error}</Typography>
          )}
          <Button type="submit" variant="contained" color="primary" fullWidth disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}


