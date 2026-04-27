'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';

import Loader from 'components/Loader';
import MainCard from 'components/MainCard';
import { fetcher } from '@/utils/axios';

interface WorkspaceSubscriptionInfo {
  workspaceId: string;
  workspaceName: string;
  status: string;
  packageName: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface ProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
  subscription: {
    status: 'not_subscribed' | 'active' | 'pending';
    workspaces: WorkspaceSubscriptionInfo[];
  };
}

const statusColorMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary'> = {
  active: 'success',
  pending: 'warning',
  pre_active: 'warning',
  pre_start: 'warning',
  not_subscribed: 'default',
  expired: 'default',
  cancelled: 'error',
};

export default function ProfileOverview() {
  const { data, error } = useSWR<ProfileResponse>('/api/profile', fetcher, { revalidateOnFocus: false });
  const loading = !data && !error;

  const subscriptionChipColor = useMemo(() => {
    if (!data) return 'default';
    if (data.subscription.status === 'active') return 'success';
    if (data.subscription.status === 'pending') return 'warning';
    return 'default';
  }, [data]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Typography color="error">Failed to load profile data.</Typography>
      </Box>
    );
  }

  const hasWorkspaces = data.subscription.workspaces.length > 0;

  return (
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h4" fontWeight={800}>Profile</Typography>
            <Typography color="text.secondary">
              Manage your FitForce account, subscription, and workspaces.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Chip
              label={data.subscription.status === 'not_subscribed' ? 'No Active Subscription' : `Subscription: ${data.subscription.status}`}
              color={subscriptionChipColor}
              variant={subscriptionChipColor === 'default' ? 'outlined' : 'filled'}
            />
            <Button
              component={Link}
              href="/dashboard/workspaces"
              variant="contained"
              size="large"
              sx={{ px: 3 }}
            >
              Go to Workspaces
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <MainCard title="Account Overview" contentSX={{ p: 3 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                  <Typography variant="body1" fontWeight={600}>{data.user.name || 'User'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                  <Typography variant="body1">{data.user.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Member Since</Typography>
                  <Typography variant="body2">{format(new Date(data.user.createdAt), 'PPP')}</Typography>
                </Box>
              </Stack>
            </MainCard>
          </Grid>

          <Grid item xs={12} md={8}>
            <MainCard title="Subscription Summary" contentSX={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="body1">
                  Your subscription status determines access to admin features and workspace tools. Keep at least one active workspace plan to retain full access.
                </Typography>
                <Divider />
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Current Status</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                      {data.subscription.status.replace('_', ' ')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Workspaces</Typography>
                    <Typography variant="h6" fontWeight={700}>{data.subscription.workspaces.length}</Typography>
                  </Box>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    component={Link}
                    href="/dashboard/subscriptions"
                    variant="outlined"
                    size="large"
                  >
                    Manage Subscriptions
                  </Button>
                  <Button
                    component={Link}
                    href="/dashboard/workspaces/create"
                    variant="contained"
                    size="large"
                  >
                    Create Workspace
                  </Button>
                </Stack>
              </Stack>
            </MainCard>
          </Grid>
        </Grid>

        <MainCard
          title="Your Workspaces"
          contentSX={{ p: 0 }}
        >
          {hasWorkspaces ? (
            <List disablePadding>
              {data.subscription.workspaces.map((workspace, index) => (
                <Box key={workspace.workspaceId}>
                  {index !== 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <Button
                        component={Link}
                        href={`/dashboard/workspaces/${workspace.workspaceId}`}
                        variant="outlined"
                        size="small"
                      >
                        Open
                      </Button>
                    }
                    sx={{
                      alignItems: 'flex-start',
                      py: 2,
                      px: { xs: 2, md: 3 }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                          <Typography variant="h6" fontWeight={700}>{workspace.workspaceName}</Typography>
                          <Chip
                            label={workspace.status}
                            color={statusColorMap[workspace.status] ?? 'default'}
                            size="small"
                            variant="outlined"
                          />
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.5} mt={1}>
                          {workspace.packageName && (
                            <Typography variant="body2" color="text.secondary">
                              Plan: {workspace.packageName}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary">
                            Start: {workspace.startDate ? format(new Date(workspace.startDate), 'PP') : '—'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            End: {workspace.endDate ? format(new Date(workspace.endDate), 'PP') : '—'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          ) : (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                You haven’t created any workspaces yet.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  component={Link}
                  href="/dashboard/workspaces/create"
                  variant="contained"
                  size="large"
                >
                  Create Your First Workspace
                </Button>
                <Button
                  component={Link}
                  href="/dashboard/workspaces"
                  variant="outlined"
                  size="large"
                >
                  Browse Workspaces
                </Button>
              </Stack>
            </Box>
          )}
        </MainCard>
      </Stack>
    </Box>
  );
}

