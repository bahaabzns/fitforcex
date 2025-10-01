'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import api from '@/utils/axios';
import { APP_CONFIG } from '@/lib/config';

export default function PaymentCallbackPage() {
  const params = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams('');
    return new URLSearchParams(window.location.search);
  }, []);

  const success = params.get('success') === 'true';
  const amountCents = params.get('amount_cents');
  const currency = params.get('currency');
  const message = params.get('data.message') || params.get('message');
  const merchantOrderId = params.get('merchant_order_id') || '';
  const transactionId = params.get('id') || '';
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);

  // Try to extract workspaceId from merchant_order_id format: workspace_payment_{workspaceId}_{paymentId}
  const workspaceId = useMemo(() => {
    const parts = merchantOrderId?.split('_') || [];
    return parts.length >= 4 ? parts[2] : '';
  }, [merchantOrderId]);

  // Auto-confirm on success to flip pending -> succeeded if webhook didn't process yet
  useEffect(() => {
    const doConfirm = async () => {
      if (!success || !transactionId || !merchantOrderId) return;
      try {
        setConfirming(true);
        setConfirmError(null);
        await api.post('/api/paymob/confirm', {
          transactionId,
          merchantOrderId
        });
      } catch (e) {
        setConfirmError('Could not auto-confirm payment. Please refresh later.');
      } finally {
        setConfirming(false);
      }
    };
    void doConfirm();
  }, [success, transactionId, merchantOrderId]);

  // Try to resolve subdomain from workspace list so we can redirect to subdomain dashboard
  useEffect(() => {
    const fetchWorkspaceSubdomain = async () => {
      if (!workspaceId) return;
      try {
        const { data } = await api.get('/api/workspaces');
        const ws = Array.isArray(data?.workspaces)
          ? data.workspaces.find((w: any) => w.id === workspaceId)
          : null;
        if (ws?.subdomain) setSubdomain(ws.subdomain);
      } catch {
        // ignore; fallback will be used
      }
    };
    void fetchWorkspaceSubdomain();
  }, [workspaceId]);

  const handleGoBack = () => {
    if (subdomain) {
      const url = `${window.location.protocol}//${subdomain}.${APP_CONFIG.frontendDomain}/dashboard/workspaces/subscription`;
      window.location.replace(url);
      return;
    }
    const dest = workspaceId ? `/workspace/subscription?workspaceId=${workspaceId}` : '/';
    window.location.replace(dest);
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card>
        <CardContent>
          <Stack spacing={2} alignItems="center" textAlign="center">
            {success ? (
              <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
            ) : (
              <ErrorIcon color="error" sx={{ fontSize: 64 }} />
            )}
            <Typography variant="h5" fontWeight={700}>
              {success ? 'Payment Successful' : 'Payment Failed'}
            </Typography>
            <Box>
              {amountCents && currency && (
                <Typography variant="body1">
                  Amount: {(Number(amountCents) / 100).toFixed(2)} {currency}
                </Typography>
              )}
              {message && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {message}
                </Typography>
              )}
            </Box>
            {confirming && (
              <Typography variant="caption" color="text.secondary">
                Confirming your payment...
              </Typography>
            )}
            {confirmError && (
              <Typography variant="caption" color="error">
                {confirmError}
              </Typography>
            )}
            <Button variant="contained" onClick={handleGoBack} sx={{ mt: 1 }}>
              Back to Subscription
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}


