'use client';

import useSWR from 'swr';
import {
  Alert,
  Box,
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
import { fetcher } from '@/utils/axios';

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

  return (
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Promo Earnings</Typography>
          <Typography color="text.secondary">
            Track your referral code performance, available commission credit, and payouts.
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
          <Alert severity="info">
            You don’t have a promo code assigned yet. Once an admin issues a promo code to you, you’ll see its performance here.
          </Alert>
        )}
      </Stack>
    </Box>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  tone?: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
}

function MetricCard({ title, value, tone }: MetricCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: tone ? `${tone}.50` : 'grey.50',
        borderRadius: 2,
      }}
    >
      <Typography variant="subtitle2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h5" fontWeight={700} color={tone ? `${tone}.main` : 'text.primary'}>
        {value}
      </Typography>
    </Paper>
  );
}

