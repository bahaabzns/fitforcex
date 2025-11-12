'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import { ContentCopy, Check } from '@mui/icons-material';
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

interface PromoSummaryResponse {
  promoCode: {
    id: string;
    code: string;
    discountPercentage: number;
    commissionPercentage: number;
    allowDiscount: boolean;
    allowCommission: boolean;
    isActive: boolean;
    maxRedemptions?: number | null;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  summary: {
    usageCount: number;
    totalDiscount: number;
    totalCommission: number;
    unpaidCommission: number;
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

export default function ProfilePage() {
  const { data, error } = useSWR<ProfileResponse>('/api/profile', fetcher, { revalidateOnFocus: false });
  const { data: promoData } = useSWR<PromoSummaryResponse>('/api/promo', fetcher, { revalidateOnFocus: false });
  const loading = !data && !error;
  const [copied, setCopied] = useState(false);

  const handleCopyPromoCode = async () => {
    if (promoData?.promoCode?.code) {
      try {
        await navigator.clipboard.writeText(promoData.promoCode.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

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
  const promoSummary = promoData?.promoCode ? promoData : null;

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

        {promoSummary?.promoCode ? (
          <MainCard title="My Promo Code" contentSX={{ p: 3 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Your Promo Code
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h4" fontWeight={800} color="primary" sx={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                    {promoSummary.promoCode.code}
                  </Typography>
                  <Tooltip title={copied ? 'Copied!' : 'Copy promo code'}>
                    <IconButton
                      onClick={handleCopyPromoCode}
                      color={copied ? 'success' : 'primary'}
                      size="small"
                      sx={{ 
                        border: 1, 
                        borderColor: 'divider',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        }
                      }}
                    >
                      {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Share this code with others to earn commissions on their subscriptions
                </Typography>
              </Box>
              
              <Divider />
              
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>Code Settings</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap">
                  <Chip
                    label={promoSummary.promoCode.isActive ? 'Active' : 'Inactive'}
                    color={promoSummary.promoCode.isActive ? 'success' : 'default'}
                    variant={promoSummary.promoCode.isActive ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={`${promoSummary.promoCode.discountPercentage}% Discount`}
                    color={promoSummary.promoCode.allowDiscount ? 'primary' : 'default'}
                    variant={promoSummary.promoCode.allowDiscount ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={`${promoSummary.promoCode.commissionPercentage}% Commission`}
                    color={promoSummary.promoCode.allowCommission ? 'secondary' : 'default'}
                    variant={promoSummary.promoCode.allowCommission ? 'filled' : 'outlined'}
                  />
                  {promoSummary.promoCode.maxRedemptions && (
                    <Chip
                      label={`Max: ${promoSummary.promoCode.maxRedemptions} uses`}
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {promoSummary.promoCode.expiresAt && (
                    <Chip
                      label={`Expires: ${format(new Date(promoSummary.promoCode.expiresAt), 'PP')}`}
                      variant="outlined"
                      size="small"
                      color={new Date(promoSummary.promoCode.expiresAt) < new Date() ? 'error' : 'default'}
                    />
                  )}
                </Stack>
              </Stack>
              
              <Divider />
              
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>Performance Statistics</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">Total Uses</Typography>
                      <Typography variant="h5" fontWeight={700}>{promoSummary.summary.usageCount}</Typography>
                      <Typography variant="caption" color="text.secondary">People who used your code</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">Discount Given</Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EGP' }).format(promoSummary.summary.totalDiscount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Total discounts provided</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">Total Commission</Typography>
                      <Typography variant="h5" fontWeight={700} color="success.main">
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EGP' }).format(promoSummary.summary.totalCommission)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">All-time earnings</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, bgcolor: promoSummary.summary.unpaidCommission > 0 ? 'warning.50' : 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary">Unpaid Commission</Typography>
                      <Typography variant="h5" fontWeight={700} color={promoSummary.summary.unpaidCommission > 0 ? 'warning.main' : 'inherit'}>
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EGP' }).format(promoSummary.summary.unpaidCommission)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Pending payout</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Stack>
              
              <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Note:</strong> When someone uses your promo code during registration, they'll receive a {promoSummary.promoCode.discountPercentage}% discount on all their subscriptions, and you'll earn {promoSummary.promoCode.commissionPercentage}% commission on each subscription payment.
                </Typography>
              </Box>
            </Stack>
          </MainCard>
        ) : (
          <MainCard title="My Promo Code" contentSX={{ p: 3 }}>
            <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
              <Typography variant="h6" color="text.secondary" align="center">
                You don't have a promo code yet
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 500 }}>
                To get a promo code assigned to your account, go to the admin panel and create one with yourself as the owner. Once assigned, you'll be able to share it with others and earn commissions on their subscriptions.
              </Typography>
            
            </Stack>
          </MainCard>
        )}
      </Stack>
    </Box>
  );
}

