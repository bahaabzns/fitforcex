'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { APP_CONFIG } from '@/lib/config';
import api from '@/utils/axios';

const PACKAGES = [
  { id: 'basic', name: 'Basic', price: 9 },
  { id: 'pro', name: 'Pro', price: 19 },
  { id: 'enterprise', name: 'Enterprise', price: 49 }
];

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string>('pro');
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const suggestedSubdomain = toSlug(name);

  const startPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/workspaces', {
        name,
        subdomain: subdomain || suggestedSubdomain
      });
      router.replace('/pricing');
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(errorMessage || 'Failed to start payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth="md" mx="auto">
      <Stack spacing={4}>
        <Box textAlign="center">
          <Typography variant="h3" gutterBottom>
            Create Workspace
          </Typography>
          <Typography color="text.secondary">Set up your fitness business workspace and choose a plan.</Typography>
        </Box>

        <Card>
          <CardHeader>
            <Typography variant="h5">Workspace Details</Typography>
            <Typography color="text.secondary">Configure your workspace name and subdomain.</Typography>
          </CardHeader>
          <CardContent>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Workspace Name"
                placeholder="My Fitness Studio"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <Box>
                <TextField
                  fullWidth
                  label="Subdomain"
                  placeholder={suggestedSubdomain || 'your-gym'}
                  value={subdomain}
                  onChange={(e) => setSubdomain(toSlug(e.target.value))}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {subdomain || suggestedSubdomain}.{APP_CONFIG.frontendDomain}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Only letters, numbers and hyphens. Must be unique.
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Typography variant="h5">Choose Your Plan</Typography>
            <Typography color="text.secondary">Select the plan that best fits your business needs.</Typography>
          </CardHeader>
          <CardContent>
            <Grid container spacing={2}>
              {PACKAGES.map((p) => (
                <Grid key={p.id} size={{ xs: 12, sm: 4 }}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: selected === p.id ? 2 : 1,
                      borderColor: selected === p.id ? 'primary.main' : 'divider',
                      '&:hover': { boxShadow: 4 }
                    }}
                    onClick={() => setSelected(p.id)}
                  >
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" gutterBottom>
                        {p.name}
                      </Typography>
                      <Typography variant="h4" color="primary">
                        ${p.price}
                        <Typography component="span" variant="body2" color="text.secondary">
                          /mo
                        </Typography>
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {error && <Alert severity="error">{error}</Alert>}

        <Box textAlign="center">
          <Button
            variant="contained"
            size="large"
            onClick={startPayment}
            disabled={!name || !(subdomain || suggestedSubdomain) || loading}
            sx={{ px: 4, py: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Continue to Payment'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            You&apos;ll be redirected to complete your payment after creating the workspace.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
