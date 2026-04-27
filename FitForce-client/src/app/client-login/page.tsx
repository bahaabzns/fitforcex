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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [checkingWorkspace, setCheckingWorkspace] = useState(true);

  // Check if we're on a workspace subdomain and get workspace ID
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
      setCheckingWorkspace(false);
      return;
    }

    // Get workspace ID from cookie (set by middleware)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    // Try to get workspace ID from cookie
    const checkWorkspace = async () => {
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        const wsId = getCookie('ff_workspace_id');
        if (wsId) {
          console.log('✅ Workspace ID found:', wsId);
          setWorkspaceId(wsId);
          setCheckingWorkspace(false);
          return;
        }
        
        // Wait a bit for middleware to set the cookie
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      // If cookie not found, try to resolve workspace manually
      console.log('⚠️ Workspace cookie not found, resolving manually...');
      try {
        const response = await fetch(`${APP_CONFIG.apiUrl}/api/workspaces/resolve?host=${host}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          const wsId = data.workspace?.id;
          console.log('✅ Workspace resolved:', wsId);
          setWorkspaceId(wsId);
        } else {
          setError('Unable to determine workspace. Please try accessing from your workspace subdomain.');
        }
      } catch (err) {
        console.error('Error resolving workspace:', err);
        setError('Unable to determine workspace. Please try again.');
      } finally {
        setCheckingWorkspace(false);
      }
    };

    checkWorkspace();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isWorkspaceSubdomain) {
      setError('Please access this page from your workspace subdomain');
      return;
    }

    if (!workspaceId) {
      setError('Workspace not found. Please reload the page or contact support.');
      return;
    }
    
    setError(null);
    setLoading(true);
    try {
      // Explicitly pass workspace ID in the header as a fallback
      // The axios interceptor should also add it from the cookie, but this ensures it's there
      console.log('🔐 Attempting login with workspace ID:', workspaceId);
      const response = await api.post('/api/clients/login', 
        { email, password },
        {
          headers: {
            'x-workspace-id': workspaceId
          }
        }
      );
      console.log('✅ Login successful');
      router.push('/client/dashboard');
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Invalid credentials';
      console.error('❌ Login error:', message, err?.response?.data);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking workspace
  if (checkingWorkspace) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Card sx={{ p: 4, width: '100%', maxWidth: 420 }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h5" fontWeight={700} textAlign="center">Client Login</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Verifying workspace...
            </Typography>
          </Stack>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" fontWeight={700} textAlign="center">Client Login</Typography>
          
          {workspaceId && (
            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              Logging into workspace
            </Alert>
          )}
          
          <TextField 
            label="Email" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            fullWidth 
            disabled={!workspaceId}
          />
          <TextField 
            label="Password" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            fullWidth 
            disabled={!workspaceId}
          />
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            fullWidth 
            disabled={loading || !workspaceId}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}


