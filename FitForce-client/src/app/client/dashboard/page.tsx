'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Card, Stack, Typography, Button as MuiButton, Grid, Divider, Chip } from '@mui/material';

export default function SeedClientDashboard() {
  const router = useRouter();

  const { data: profile, isLoading: loadingProfile, error: profileError } = useSWR('seed-client-profile', async () => {
    const res = await api.get('/api/clients/profile');
    return res.data as { client: { id: string; fullName: string; email?: string; status: string }; workspace: { id: string; name: string } };
  });

  const { data: overview, isLoading: loadingOverview } = useSWR(
    () => (profile?.client?.id ? `seed-client-overview-${profile.client.id}` : null),
    async () => {
      const res = await api.get(`/api/clients/${profile!.client.id}/overview`);
      return res.data as {
        metrics: {
          totalFormSubmissions: number;
          nutritionPlansCount: number;
          workoutPlansCount: number;
          subscriptionsCount: number;
          pendingFormsCount: number;
        };
        activities: Array<{ id: string; title: string; description?: string; createdAt: string; type: string }>;
      };
    }
  );

  if (loadingProfile) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography>Loading your dashboard...</Typography>
      </Box>
    );
  }

  if (profileError || !profile) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Card sx={{ p: 4, width: '100%', maxWidth: 420 }}>
          <Stack spacing={2}>
            <Typography color="error" variant="h6" textAlign="center">Access Denied</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">Please log in to access your client dashboard.</Typography>
            <MuiButton variant="contained" onClick={() => router.push('/client-login')}>Go to Login</MuiButton>
          </Stack>
        </Card>
      </Box>
    );
  }

  const { client, workspace } = profile;
  const metrics = overview?.metrics;
  const activities = overview?.activities || [];

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Welcome, {client.fullName}
        </Typography>
        <Typography color="text.secondary">{workspace?.name} • Client Dashboard</Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Account Status</Typography>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Chip size="small" label={client.status} color={client.status === 'active' ? 'success' : client.status === 'pending' ? 'warning' : 'default'} />
            </Stack>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Subscriptions</Typography>
            <Typography variant="h5">{metrics?.subscriptionsCount ?? '-'} </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Nutrition Plans</Typography>
            <Typography variant="h5">{metrics?.nutritionPlansCount ?? '-'} </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Workout Plans</Typography>
            <Typography variant="h5">{metrics?.workoutPlansCount ?? '-'} </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Main grid */}
      <Grid container spacing={2}>
        {/* Left column */}
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>Your Status</Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              <Typography variant="body2">Email: {client.email || '—'}</Typography>
              <Typography variant="body2">Forms Submitted: {metrics?.totalFormSubmissions ?? '-'}</Typography>
              <Typography variant="body2">Pending Forms: {metrics?.pendingFormsCount ?? '-'}</Typography>
            </Stack>
          </Card>

          <Card sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={700}>Recent Activity</Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              {loadingOverview && <Typography variant="body2">Loading activity…</Typography>}
              {!loadingOverview && activities.length === 0 && (
                <Typography variant="body2" color="text.secondary">No activity yet.</Typography>
              )}
              {activities.map((a) => (
                <Box key={a.id} sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">{a.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(a.createdAt).toLocaleString()}</Typography>
                  </Stack>
                  {a.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{a.description}</Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>Quick Actions</Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              <MuiButton variant="outlined" onClick={() => router.push('/client/forms')}>View Forms</MuiButton>
              <MuiButton variant="outlined" onClick={() => router.push('/client/dashboard')}>Refresh</MuiButton>
            </Stack>
          </Card>

          <Card sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={700}>Help</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Contact your trainer if you need assistance with your plans.
            </Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}


