'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';

import Loader from 'components/Loader';
import MainCard from 'components/MainCard';
import AppliedPromoCard from 'components/promo/AppliedPromoCard';
import api, { fetcher } from '@/utils/axios';
import { openSnackbar } from '@/api/snackbar';
import { FormattedMessage } from 'react-intl';

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
    paidCommission: number;
    creditedCommission: number;
  };
  commissionCredit: {
    availableCents: number;
    currency: string | null;
    breakdown: Array<{
      commissionId: string;
      total: number;
      used: number;
      available: number;
      currency: string;
    }>;
  };
}

const formatCurrency = (cents: number, currency = 'EGP') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);

export default function OwnedPromoPage() {
  const { data, error, isLoading, mutate } = useSWR<PromoSummaryResponse>('/api/promo', fetcher, {
    revalidateOnFocus: false,
  });
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Alert severity="error">Failed to load promotion data.</Alert>
      </Box>
    );
  }

  const promo = data?.promoCode ?? null;
  const summary = data?.summary;
  const commissionCredit = data?.commissionCredit;

  const handleCreatePromo = async () => {
    if (creatingPromo) return;

    setCreatingPromo(true);
    setCreateError(null);
    try {
      await api.post('/api/promo');
      openSnackbar({
        open: true,
        message: 'Promo code generated successfully',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' }
      });
      await mutate();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to create promo code';
      setCreateError(message);
      openSnackbar({
        open: true,
        message,
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      });
    } finally {
      setCreatingPromo(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            <FormattedMessage id="promo.title" defaultMessage="Promo Earnings" />
          </Typography>
          <Typography color="text.secondary">
            <FormattedMessage id="promo.subtitle" defaultMessage="View statistics and earnings from your promo codes" />
          </Typography>
        </Box>

        <AppliedPromoCard onPromoUpdated={mutate} />

        {promo ? (
          <>
            <MainCard title="Promo Details" contentSX={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                  <Typography variant="h4" fontWeight={800} color="primary" sx={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                    {promo.code}
                  </Typography>
                  <Chip
                    label={promo.isActive ? 'Active' : 'Inactive'}
                    color={promo.isActive ? 'success' : 'default'}
                    variant={promo.isActive ? 'filled' : 'outlined'}
                  />
                </Stack>

                <Divider />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                      title="Total Commission Earned"
                      value={formatCurrency(Math.round((summary?.totalCommission ?? 0) * 100))}
                      tone="success"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                      title="Commission Paid Out"
                      value={formatCurrency(Math.round((summary?.paidCommission ?? 0) * 100))}
                      tone="primary"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                      title="Commission Used as Credit"
                      value={formatCurrency(Math.round((summary?.creditedCommission ?? 0) * 100))}
                      tone="info"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                      title="Commission Pending"
                      value={formatCurrency(Math.round((summary?.unpaidCommission ?? 0) * 100))}
                      tone="warning"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                      title="Available Credit"
                      value={formatCurrency(commissionCredit?.availableCents ?? 0, commissionCredit?.currency || 'EGP')}
                      tone="secondary"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                      title="Total Discount Given"
                      value={formatCurrency(Math.round((summary?.totalDiscount ?? 0) * 100))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                      title="Total Code Uses"
                      value={summary?.usageCount.toLocaleString() ?? '0'}
                    />
                  </Grid>
                </Grid>

                <Divider />

                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="text.secondary">Promo Settings</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                    <Chip label={`${promo.discountPercentage}% Discount`} color={promo.allowDiscount ? 'primary' : 'default'} variant={promo.allowDiscount ? 'filled' : 'outlined'} />
                    <Chip label={`${promo.commissionPercentage}% Commission`} color={promo.allowCommission ? 'secondary' : 'default'} variant={promo.allowCommission ? 'filled' : 'outlined'} />
                    {promo.maxRedemptions && <Chip label={`Max ${promo.maxRedemptions} uses`} variant="outlined" />}
                    {promo.expiresAt && (
                      <Chip
                        label={`Expires: ${format(new Date(promo.expiresAt), 'PP')}`}
                        variant="outlined"
                        color={new Date(promo.expiresAt) < new Date() ? 'error' : 'default'}
                      />
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </MainCard>

            {commissionCredit && commissionCredit.breakdown.length > 0 && (
              <MainCard title="Commission Credit Breakdown" contentSX={{ p: 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Commission</TableCell>
                      <TableCell align="right">Earned</TableCell>
                      <TableCell align="right">Used as Credit</TableCell>
                      <TableCell align="right">Remaining</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {commissionCredit.breakdown.map((entry) => (
                      <TableRow key={entry.commissionId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {entry.commissionId.slice(0, 8)}…
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(entry.total * 100), entry.currency)}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(entry.used * 100), entry.currency)}</TableCell>
                        <TableCell align="right">{formatCurrency(Math.round(entry.available * 100), entry.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </MainCard>
            )}
          </>
        ) : (
          <MainCard title="Create Your Workspace Promo Code" contentSX={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography color="text.secondary">
                Generate a unique promo code for this workspace. Each code grants <strong>10% discount</strong> to your referrals and earns you a <strong>10% commission</strong> on their payments.
              </Typography>
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Highlights
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2">• Automatic tracking of referrals and payouts.</Typography>
                  <Typography variant="body2">• Works instantly across onboarding and subscription flows.</Typography>
                  <Typography variant="body2">• You can apply earned commission as workspace credit.</Typography>
                </Stack>
              </Stack>
              {createError && <Alert severity="error">{createError}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCreatePromo}
                  disabled={creatingPromo}
                  sx={{ minWidth: 220 }}
                >
                  {creatingPromo ? 'Generating Promo Code…' : 'Generate Promo Code'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Only one promo code can exist per workspace owner.
                </Typography>
              </Stack>
            </Stack>
          </MainCard>
        )}
      </Stack>
    </Box>
  );
}

type MetricTone = 'primary' | 'secondary' | 'success' | 'warning' | 'info';

interface MetricCardProps {
  title: string;
  value: string;
  tone?: MetricTone;
}

const getMetricColors = (theme: any, tone?: MetricTone) => {
  const isDark = theme.palette.mode === 'dark';

  if (!tone) {
    return {
      background: isDark ? theme.palette.background.paper : theme.palette.grey[50],
      value: theme.palette.text.primary
    };
  }

  const paletteTone = theme.palette[tone] || theme.palette.primary;

  return {
    background: isDark
      ? paletteTone.dark || paletteTone.main
      : paletteTone.lighter || paletteTone.light || paletteTone.main,
    value: isDark
      ? paletteTone.contrastText || theme.palette.common.white
      : paletteTone.main
  };
};

function MetricCard({ title, value, tone }: MetricCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: (theme) => getMetricColors(theme, tone).background,
        color: (theme) =>
          tone && theme.palette.mode === 'dark'
            ? getMetricColors(theme, tone).value
            : 'inherit',
        borderRadius: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        color={(theme) =>
          theme.palette.mode === 'dark'
            ? theme.palette.text.secondary
            : 'text.secondary'
        }
      >
        {title}
      </Typography>
      <Typography
        variant="h5"
        fontWeight={700}
        color={(theme) => getMetricColors(theme, tone).value}
      >
        {value}
      </Typography>
    </Paper>
  );
}

