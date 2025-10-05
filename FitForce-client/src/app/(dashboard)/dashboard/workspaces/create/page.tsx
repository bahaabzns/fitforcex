'use client';

import { useEffect, useState } from 'react';
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

type WorkspacePkg = {
  id: string;
  name: string;
  description?: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
};

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<WorkspacePkg[]>([]);
  const [freeTrialId, setFreeTrialId] = useState<string>('');

  const toSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const suggestedSubdomain = toSlug(name);

  useEffect(() => {
    const loadPackages = async () => {
      try {
        const { data } = await api.get('/api/workspace-packages');
        const list: WorkspacePkg[] = data?.packages || [];
        setPackages(list);
        const trial = list.find((p) => p.name?.toLowerCase() === 'free trial' && p.durationMonths === 0 && p.priceCents === 0);
        if (trial) {
          setFreeTrialId(trial.id);
          setSelectedPackageId(trial.id);
        }
      } catch {
        // ignore
      }
    };
    loadPackages();
  }, []);

  const startPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      // Prevent using the reserved management subdomain on the client
      const chosen = (subdomain || suggestedSubdomain).toLowerCase();
      if (chosen === APP_CONFIG.managementSubdomain.toLowerCase()) {
        throw new Error('This subdomain is reserved and cannot be used');
      }
      const { data } = await api.post('/api/workspaces', {
        name,
        subdomain: chosen
      });
      const newWorkspaceId = (data && (data.workspace?.id || data.id)) || '';
      // If a non-trial package is selected, go to subscription; otherwise, free trial auto-issues and we go back to list
      if (selectedPackageId && selectedPackageId !== freeTrialId) {
        router.replace(`/workspace/subscription?workspaceId=${newWorkspaceId}&packageId=${selectedPackageId}`);
      } else {
        router.replace('/dashboard/workspaces');
      }
    } catch (e: unknown) {
      const errorMessage =
        e && typeof e === 'object' && 'response' in e
          ? ((e as any).response?.data?.message || (e as any).response?.data?.error)
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
            <Typography color="text.secondary">Pick a paid plan or continue with Free Trial.</Typography>
          </CardHeader>
          <CardContent>
            {packages.length === 0 ? (
              <Typography color="text.secondary">Free Trial will be issued automatically.</Typography>
            ) : (
              <Grid container spacing={2}>
                {packages.map((p) => (
                  <Grid key={p.id} size={{ xs: 12, sm: 4 }}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: selectedPackageId === p.id ? 2 : 1,
                        borderColor: selectedPackageId === p.id ? 'primary.main' : 'divider',
                        '&:hover': { boxShadow: 4 }
                      }}
                      onClick={() => setSelectedPackageId(p.id)}
                    >
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" gutterBottom>
                          {p.name}
                        </Typography>
                        <Typography variant="h4" color="primary">
                          {(p.priceCents / 100).toFixed(2)} {p.currency}
                          <Typography component="span" variant="body2" color="text.secondary">
                            {p.durationMonths === 0 ? ' / trial' : ' / ' + p.durationMonths + ' mo'}
                          </Typography>
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
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
            {loading ? <CircularProgress size={24} /> : (selectedPackageId && selectedPackageId !== freeTrialId ? 'Continue to Payment' : 'Create Workspace')}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            You&apos;ll be redirected to complete your payment after creating the workspace.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
