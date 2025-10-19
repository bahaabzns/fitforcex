'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Alert } from '@mui/material';
import { TextField, Box, Typography, Stack, Button } from '@mui/material';
import api from '@/utils/axios';
import { APP_CONFIG } from '@/lib/config';

export default function SeedClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWorkspaceSubdomain, setIsWorkspaceSubdomain] = useState(true);

  // Check if we're on a workspace subdomain
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const host = window.location.host;
    const isMainDomain = host === APP_CONFIG.frontendDomain || 
                        host === `app.${APP_CONFIG.frontendDomain}` ||
                        host === 'localhost:3000' || 
                        host === 'localhost';
    
    setIsWorkspaceSubdomain(!isMainDomain);
    
    if (isMainDomain) {
      setError('Client login must be accessed from your workspace subdomain (e.g., yourworkspace.fitforce.io)');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isWorkspaceSubdomain) {
      setError('Please access this page from your workspace subdomain');
      return;
    }
    
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/clients/login', { email, password });
      router.push('/client/dashboard');
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Invalid credentials';
      setError(message);
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


