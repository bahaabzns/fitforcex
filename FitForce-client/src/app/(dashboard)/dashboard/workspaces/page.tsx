'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { APP_CONFIG } from '@/lib/config';
import api from '@/utils/axios';

interface Workspace {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  updatedAt: string;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch real workspaces data
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        // Add cache-busting parameter to prevent 304 issues
        const response = await api.get('/api/workspaces', {
          params: { _t: Date.now() },
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        console.log('API Response:', response.data);
        // Ensure we have valid data even if response is empty
        if (response.data && response.data.workspaces) {
          setWorkspaces(response.data.workspaces);
        } else {
          console.warn('Empty or invalid response from /api/workspaces');
          setWorkspaces([]);
        }
      } catch (err) {
        console.error('Failed to fetch workspaces:', err);
        setError('Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/workspaces/${id}`);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    } catch {
      setError('Failed to delete workspace');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading workspaces...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h3" gutterBottom>
            Your Workspaces
          </Typography>
          <Typography color="text.secondary">View and manage your workspaces. Open workspaces to access their dashboards.</Typography>
        </Box>
        <Button variant="contained" onClick={() => router.push('/dashboard/workspaces/create')}>
          Create Workspace
        </Button>
      </Stack>

      {workspaces.length === 0 ? (
        <Card sx={{ border: '2px dashed', borderColor: 'divider' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h5" gutterBottom>
              No workspaces yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Create your first workspace to get started.
            </Typography>
            <Button variant="contained" onClick={() => router.push('/dashboard/workspaces/create')}>
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {workspaces.map((workspace) => {
            console.log('Rendering workspace:', workspace);
            return (
              <Grid key={workspace.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card sx={{ height: '100%', '&:hover': { boxShadow: 6 } }}>
                  <CardHeader
                    title={workspace.name || 'No Name'}
                    subheader={`${workspace.subdomain}.${APP_CONFIG.frontendDomain}`}
                    titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
                    subheaderTypographyProps={{ color: 'text.secondary' }}
                  />
                  <CardContent>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          window.location.href = `https://${workspace.subdomain}.${APP_CONFIG.frontendDomain}/dashboard`;
                        }}
                        sx={{ flex: 1 }}
                      >
                        Open
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={() => handleDelete(workspace.id, workspace.name)}
                        disabled={deletingId === workspace.id}
                      >
                        {deletingId === workspace.id ? <CircularProgress size={16} /> : 'Delete'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
