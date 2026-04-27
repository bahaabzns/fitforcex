'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { format } from 'date-fns';

import api, { fetcher } from '@/utils/axios';
import MainCard from 'components/MainCard';

interface AppliedPromoResponse {
  appliedPromo: {
    id: string;
    code: string;
    discountPercentage: number;
    commissionPercentage: number;
    allowDiscount: boolean;
    allowCommission: boolean;
    isActive: boolean;
    expiresAt?: string | null;
    maxRedemptions?: number | null;
    usageCount: number;
    owner: {
      id: string;
      fullName: string;
      email: string;
    };
  } | null;
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
  message?: string;
}

interface AppliedPromoCardProps {
  title?: string;
  onPromoUpdated?: () => void;
}

const formatCurrency = (cents: number, currency = 'EGP') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);

export default function AppliedPromoCard({ title = 'Applied Promo Code', onPromoUpdated }: AppliedPromoCardProps) {
  const { data, mutate } = useSWR<AppliedPromoResponse>('/api/promo/applied', fetcher, {
    revalidateOnFocus: false,
  });

  const [promoInput, setPromoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const appliedPromo = data?.appliedPromo ?? null;
  const commissionCredit = data?.commissionCredit;
  const commissionCreditCents = commissionCredit?.availableCents ?? 0;
  const commissionCreditCurrency = commissionCredit?.currency || 'EGP';

  const applyPromo = async (code: string | null) => {
    setLoading(true);
    try {
      const response = await api.post<AppliedPromoResponse>('/api/promo/applied', { code });
      setFeedback({
        type: 'success',
        message: response.data.message || (code ? 'Promo code applied successfully' : 'Promo code removed'),
      });
      setPromoInput('');
      await mutate();
      await onPromoUpdated?.();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Unable to update promo code';
      setFeedback({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainCard contentSX={{ p: 0 }}>
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>

        {feedback && (
          <Alert severity={feedback.type} onClose={() => setFeedback(null)}>
            {feedback.message}
          </Alert>
        )}

        {appliedPromo ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h4" fontWeight={800} color="primary" sx={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                {appliedPromo.code}
              </Typography>
              <Chip
                label={appliedPromo.isActive ? 'Active' : 'Inactive'}
                color={appliedPromo.isActive ? 'success' : 'default'}
                variant={appliedPromo.isActive ? 'filled' : 'outlined'}
                size="small"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Owner: {appliedPromo.owner.fullName} ({appliedPromo.owner.email})
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
              <Chip
                label={`${appliedPromo.discountPercentage}% Discount`}
                color={appliedPromo.allowDiscount ? 'primary' : 'default'}
                variant={appliedPromo.allowDiscount ? 'filled' : 'outlined'}
                size="small"
              />
              <Chip
                label={`${appliedPromo.commissionPercentage}% Commission`}
                color={appliedPromo.allowCommission ? 'secondary' : 'default'}
                variant={appliedPromo.allowCommission ? 'filled' : 'outlined'}
                size="small"
              />
              {appliedPromo.maxRedemptions && (
                <Chip label={`Max ${appliedPromo.maxRedemptions} uses`} variant="outlined" size="small" />
              )}
              {appliedPromo.expiresAt && (
                <Chip
                  label={`Expires: ${format(new Date(appliedPromo.expiresAt), 'PP')}`}
                  variant="outlined"
                  size="small"
                  color={new Date(appliedPromo.expiresAt) < new Date() ? 'error' : 'default'}
                />
              )}
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            You haven’t applied a promo code yet. Enter one below to unlock discounts or use commission credit on your subscriptions.
          </Typography>
        )}

        <Divider />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            label="Promo Code"
            placeholder="Enter promo code"
            value={promoInput}
            onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
            sx={{ maxWidth: 240 }}
            inputProps={{ style: { textTransform: 'uppercase' } }}
          />
          <LoadingButton
            variant="contained"
            onClick={() => applyPromo(promoInput.trim() || null)}
            loading={loading}
            disabled={!promoInput.trim()}
          >
            Apply Promo
          </LoadingButton>
          {appliedPromo && (
            <Button variant="text" color="secondary" onClick={() => applyPromo(null)} disabled={loading}>
              Remove Promo
            </Button>
          )}
        </Stack>

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Available Commission Credit
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {formatCurrency(commissionCreditCents, commissionCreditCurrency)}
            </Typography>
            {commissionCreditCents > 0 ? (
              <Typography variant="caption" color="text.secondary">
                This credit will automatically reduce your next workspace subscription payment.
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Commission credit accumulates when others use your promo code.
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
    </MainCard>
  );
}

