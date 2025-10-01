'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
  Alert,
  Chip,
  Divider,
  IconButton,
  Switch
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '@/utils/axios';

type ClientPackage = {
  id: string;
  name: string;
  description?: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
};

export default function WorkspaceClientPackagesPage() {
  const params = useMemo(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('')), []);
  const workspaceId = params.get('workspaceId') || '';
  const getPersistedWorkspaceId = () => {
    try {
      if (typeof window === 'undefined') return '';
      const raw = localStorage.getItem('workspace');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.id || '';
    } catch {
      return '';
    }
  };
  const effectiveWorkspaceId = workspaceId || getPersistedWorkspaceId();

  const [packages, setPackages] = useState<ClientPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [priceEgp, setPriceEgp] = useState<number>(100);
  const [currency, setCurrency] = useState('EGP');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPackages = async () => {
    try {
      setError(null);
      const { data } = await api.get(`/api/workspaces/${effectiveWorkspaceId}/client-packages`);
      setPackages(data.packages || []);
    } catch (e) {
      setError('Failed to fetch client packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveWorkspaceId) return;
    fetchPackages();
  }, [effectiveWorkspaceId]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      if (!name.trim()) {
        setError('Name is required');
        return;
      }
      if (durationMonths < 1) {
        setError('Duration must be at least 1 month');
        return;
      }
      if (priceEgp < 1) {
        setError('Price must be at least 1 EGP');
        return;
      }
      const priceCents = Math.round(Number(priceEgp) * 100);
      await api.post(`/api/workspaces/${effectiveWorkspaceId}/client-packages`, {
        name,
        description: description || undefined,
        durationMonths: Number(durationMonths),
        priceCents: Number(priceCents),
        currency,
        features: {}
      });
      setName('');
      setDescription('');
      setDurationMonths(1);
      setPriceEgp(100);
      await fetchPackages();
      setSuccessMsg('Package created');
    } catch (e) {
      setError('Failed to create package');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (pkg: ClientPackage) => {
    try {
      setError(null);
      await api.put(`/api/workspaces/${effectiveWorkspaceId}/client-packages/${pkg.id}`, {
        isActive: !pkg.isActive
      });
      await fetchPackages();
    } catch (e) {
      setError('Failed to update package');
    }
  };

  const deletePackage = async (pkg: ClientPackage) => {
    try {
      setError(null);
      await api.delete(`/api/workspaces/${effectiveWorkspaceId}/client-packages/${pkg.id}`);
      await fetchPackages();
    } catch (e) {
      setError('Failed to delete package');
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Client Packages
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Create and manage packages that clients can subscribe to for this workspace.
        </Typography>

        {(!effectiveWorkspaceId) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Missing workspaceId. Open this page with ?workspaceId=... or select a workspace first.
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchPackages} disabled={loading}>
            Refresh
          </Button>
        </Stack>

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
            {successMsg}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Create Package
            </Typography>
            <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-end' }}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
              <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
              <TextField
                label="Duration (months)"
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                inputProps={{ min: 1, max: 120 }}
              />
              <TextField
                label="Price (EGP)"
                type="number"
                value={priceEgp}
                onChange={(e) => setPriceEgp(Number(e.target.value))}
                inputProps={{ min: 1, step: 1 }}
              />
              <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} sx={{ width: 120 }} />
              <Button variant="contained" onClick={handleCreate} disabled={saving || !name}>
                {saving ? 'Saving...' : 'Create'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          {packages.map((pkg) => (
            <Grid item xs={12} md={6} lg={4} key={pkg.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{pkg.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pkg.description}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <Chip size="small" label={`Duration: ${pkg.durationMonths} mo`} />
                    <Chip size="small" color="primary" label={`Price: ${(pkg.priceCents / 100).toFixed(2)} ${pkg.currency}`} />
                    <Chip size="small" color={pkg.isActive ? 'success' : 'default'} label={pkg.isActive ? 'Active' : 'Inactive'} />
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Switch
                        checked={pkg.isActive}
                        onChange={() => toggleActive(pkg)}
                        inputProps={{ 'aria-label': 'toggle active' }}
                      />
                      <Typography variant="body2">Active</Typography>
                    </Stack>
                    <IconButton aria-label="delete" color="error" onClick={() => deletePackage(pkg)}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
}


