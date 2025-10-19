'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { 
  Box, 
  Card, 
  Stack, 
  Typography, 
  Button as MuiButton, 
  Grid, 
  Divider, 
  Chip,
  Avatar,
  LinearProgress,
  CardContent,
  CardActions,
  IconButton,
  Alert,
  Paper
} from '@mui/material';
import { 
  FitnessCenter, 
  Restaurant, 
  Assignment, 
  TrendingUp,
  Refresh,
  ArrowForward,
  CheckCircle,
  Schedule,
  Person,
  Email
} from '@mui/icons-material';

export default function SeedClientDashboard() {
  const router = useRouter();

  const { data: profile, isLoading: loadingProfile, error: profileError, mutate: mutateProfile } = useSWR('seed-client-profile', async () => {
    const res = await api.get('/api/clients/profile');
    return res.data as { client: { id: string; fullName: string; email?: string; status: string }; workspace: { id: string; name: string } };
  });

  const { data: overview, isLoading: loadingOverview, mutate: mutateOverview } = useSWR(
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

  const handleRefresh = () => {
    mutateProfile();
    mutateOverview();
  };

  if (loadingProfile) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack alignItems="center" spacing={2}>
          <LinearProgress sx={{ width: 200 }} />
          <Typography color="text.secondary">Loading your dashboard...</Typography>
        </Stack>
      </Box>
    );
  }

  if (profileError || !profile) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Card sx={{ p: 4, width: '100%', maxWidth: 420 }}>
          <Stack spacing={2}>
            <Typography color="error" variant="h6" textAlign="center">Access Denied</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Please log in to access your client dashboard.
            </Typography>
            <MuiButton variant="contained" onClick={() => router.push('/client-login')}>Go to Login</MuiButton>
          </Stack>
        </Card>
      </Box>
    );
  }

  const { client, workspace } = profile;
  const metrics = overview?.metrics;
  const activities = overview?.activities || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pre_start': case 'pending': case 'frozen': return 'warning';
      case 'expired': case 'refunded': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle />;
      case 'pending': return <Schedule />;
      default: return null;
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255, 255, 255, 0.2)', fontSize: '1.5rem' }}>
              {client.fullName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                Welcome, {client.fullName}!
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                {workspace?.name} • Client Portal
              </Typography>
            </Box>
          </Stack>
          <IconButton 
            onClick={handleRefresh} 
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.2)', 
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' },
              color: 'white'
            }}
          >
            <Refresh />
          </IconButton>
        </Stack>
      </Paper>

      {/* Account Status Banner */}
      <Alert 
        icon={getStatusIcon(client.status) || undefined}
        severity={getStatusColor(client.status) as any}
        sx={{ mb: 3, borderRadius: 2 }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Account Status: <Chip 
                size="small" 
                label={client.status.replace('_', ' ').toUpperCase()} 
                color={getStatusColor(client.status) as any}
                sx={{ ml: 1 }}
              />
            </Typography>
            <Typography variant="body2">
              {client.status === 'active' && 'Your account is active and ready to go!'}
              {client.status === 'pending' && 'Your account setup is pending. Please complete your onboarding.'}
              {client.status === 'pre_start' && 'Your program will start soon. Get ready!'}
              {client.status === 'frozen' && 'Your account is currently frozen.'}
              {(client.status === 'expired' || client.status === 'refunded') && 'Your subscription has ended. Please renew to continue.'}
            </Typography>
          </Box>
          {(client.status === 'expired' || client.status === 'refunded') && (
            <MuiButton 
              variant="contained" 
              size="small" 
              onClick={() => router.push('/client/subscription')}
              sx={{ mt: { xs: 1, sm: 0 } }}
            >
              Renew Now
            </MuiButton>
          )}
        </Stack>
      </Alert>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card 
            sx={{ 
              p: 2.5, 
              height: '100%',
              borderRadius: 3,
              transition: 'all 0.3s ease',
              '&:hover': { 
                transform: 'translateY(-4px)', 
                boxShadow: 6 
              }
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                <FitnessCenter />
              </Avatar>
              <Box flex={1}>
                <Typography variant="overline" color="text.secondary" fontWeight={600}>
                  Workout Plans
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                  {metrics?.workoutPlansCount ?? '0'}
                </Typography>
              </Box>
            </Stack>
            <MuiButton 
              size="small" 
              endIcon={<ArrowForward />} 
              onClick={() => router.push('/client/plans')}
              sx={{ mt: 2 }}
            >
              View Plans
            </MuiButton>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            sx={{ 
              p: 2.5, 
              height: '100%',
              borderRadius: 3,
              transition: 'all 0.3s ease',
              '&:hover': { 
                transform: 'translateY(-4px)', 
                boxShadow: 6 
              }
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'success.main', width: 48, height: 48 }}>
                <Restaurant />
              </Avatar>
              <Box flex={1}>
                <Typography variant="overline" color="text.secondary" fontWeight={600}>
                  Nutrition Plans
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                  {metrics?.nutritionPlansCount ?? '0'}
                </Typography>
              </Box>
            </Stack>
            <MuiButton 
              size="small" 
              endIcon={<ArrowForward />} 
              onClick={() => router.push('/client/plans')}
              sx={{ mt: 2 }}
            >
              View Plans
            </MuiButton>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            sx={{ 
              p: 2.5, 
              height: '100%',
              borderRadius: 3,
              transition: 'all 0.3s ease',
              '&:hover': { 
                transform: 'translateY(-4px)', 
                boxShadow: 6 
              }
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'warning.main', width: 48, height: 48 }}>
                <Assignment />
              </Avatar>
              <Box flex={1}>
                <Typography variant="overline" color="text.secondary" fontWeight={600}>
                  Pending Forms
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                  {metrics?.pendingFormsCount ?? '0'}
                </Typography>
              </Box>
            </Stack>
            <MuiButton 
              size="small" 
              endIcon={<ArrowForward />} 
              onClick={() => router.push('/client/forms')}
              sx={{ mt: 2 }}
              color="warning"
            >
              Fill Forms
            </MuiButton>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card 
            sx={{ 
              p: 2.5, 
              height: '100%',
              borderRadius: 3,
              transition: 'all 0.3s ease',
              '&:hover': { 
                transform: 'translateY(-4px)', 
                boxShadow: 6 
              }
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'info.main', width: 48, height: 48 }}>
                <TrendingUp />
              </Avatar>
              <Box flex={1}>
                <Typography variant="overline" color="text.secondary" fontWeight={600}>
                  Total Submissions
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                  {metrics?.totalFormSubmissions ?? '0'}
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Left Column - Activity Feed */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <TrendingUp color="primary" />
                <Typography variant="h6" fontWeight={700}>Recent Activity</Typography>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              {loadingOverview && (
                <Stack alignItems="center" py={4}>
                  <LinearProgress sx={{ width: '50%' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Loading activity…
                  </Typography>
                </Stack>
              )}
              {!loadingOverview && activities.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body1" color="text.secondary">
                    No activity yet. Start by viewing your plans or filling out forms!
                  </Typography>
                  <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3 }}>
                    <MuiButton 
                      variant="outlined" 
                      startIcon={<FitnessCenter />}
                      onClick={() => router.push('/client/plans')}
                    >
                      View Plans
                    </MuiButton>
                    <MuiButton 
                      variant="outlined" 
                      startIcon={<Assignment />}
                      onClick={() => router.push('/client/forms')}
                    >
                      View Forms
                    </MuiButton>
                  </Stack>
                </Box>
              )}
              <Stack spacing={2}>
                {activities.slice(0, 5).map((a) => (
                  <Paper
                    key={a.id}
                    elevation={0}
                    sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'primary.50'
                      }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1}>
                        <Typography variant="subtitle1" fontWeight={600}>{a.title}</Typography>
                        {a.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {a.description}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', ml: 2 }}>
                        {new Date(a.createdAt).toLocaleDateString()}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Profile & Quick Actions */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Profile Card */}
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Person color="primary" />
                  <Typography variant="h6" fontWeight={700}>Your Profile</Typography>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      FULL NAME
                    </Typography>
                    <Typography variant="body1">{client.fullName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      EMAIL
                    </Typography>
                    <Typography variant="body1">{client.email || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      WORKSPACE
                    </Typography>
                    <Typography variant="body1">{workspace?.name || '—'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      FORMS COMPLETED
                    </Typography>
                    <Typography variant="body1">{metrics?.totalFormSubmissions ?? 0}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Quick Actions
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={1.5}>
                  <MuiButton 
                    variant="contained" 
                    fullWidth 
                    startIcon={<FitnessCenter />}
                    onClick={() => router.push('/client/plans')}
                    size="large"
                  >
                    My Plans
                  </MuiButton>
                  <MuiButton 
                    variant="outlined" 
                    fullWidth 
                    startIcon={<Assignment />}
                    onClick={() => router.push('/client/forms')}
                    size="large"
                    color="warning"
                  >
                    Forms {metrics?.pendingFormsCount ? `(${metrics.pendingFormsCount})` : ''}
                  </MuiButton>
                  <MuiButton 
                    variant="outlined" 
                    fullWidth 
                    startIcon={<Email />}
                    onClick={() => router.push('/client/support')}
                    size="large"
                  >
                    Contact Support
                  </MuiButton>
                </Stack>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card sx={{ borderRadius: 3, bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.main' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
                  Need Help?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Contact your trainer if you need assistance with your plans or have any questions about your program.
                </Typography>
                <MuiButton 
                  variant="contained" 
                  fullWidth 
                  sx={{ mt: 2 }}
                  onClick={() => router.push('/client/support')}
                >
                  Get Support
                </MuiButton>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
