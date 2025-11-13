'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Container, Divider, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import api from '@/utils/axios';
import { APP_CONFIG } from '@/lib/config';

interface PaymobOrderContext {
  type: 'workspace' | 'client';
  merchantOrderId: string;
  workspaceId: string;
  paymentId: string;
  workspace?: {
    id: string;
    name?: string | null;
    subdomain?: string | null;
    customDomain?: string | null;
  } | null;
  client?: {
    id: string;
    fullName?: string | null;
  } | null;
  payment: {
    amountCents: number;
    originalAmountCents: number;
    promoDiscountCents: number;
    commissionCreditCents: number;
    currency: string;
    packageId?: string | null;
    packageName?: string | null;
    subscriptionId?: string | null;
  };
  promoCode?: {
    id: string;
  } | null;
}

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
  const [context, setContext] = useState<PaymobOrderContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!merchantOrderId) return;
    let cancelled = false;
    setContextLoading(true);
    setContextError(null);
    api
      .get<PaymobOrderContext>(`/api/paymob/order/${merchantOrderId}/context`)
      .then(({ data }) => {
        if (!cancelled) {
          setContext(data);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load paymob order context', err);
        const status = err?.response?.status;
        if (status === 401) {
          setContextError('Please sign in again to view subscription details.');
        } else if (status === 404) {
          setContextError('Payment record not found.');
        } else {
          setContextError('Could not load subscription details.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContextLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [merchantOrderId]);

  const formatCurrency = (cents?: number | null, currencyCode?: string | null) => {
    if (typeof cents !== 'number' || Number.isNaN(cents)) return '—';
    const code = (currencyCode || currency || 'EGP').toUpperCase();
    return `${(cents / 100).toFixed(2)} ${code}`;
  };

  const buildWorkspaceUrl = (ctx: PaymobOrderContext) => {
    if (typeof window === 'undefined') return `/dashboard/workspaces/subscription?workspaceId=${ctx.workspaceId}`;
    const protocol = window.location.protocol;
    if (ctx.workspace?.customDomain) {
      return `${protocol}//${ctx.workspace.customDomain}/dashboard/workspaces/subscription?workspaceId=${ctx.workspaceId}`;
    }
    if (ctx.workspace?.subdomain) {
      return `${protocol}//${ctx.workspace.subdomain}.${APP_CONFIG.frontendDomain}/dashboard/workspaces/subscription?workspaceId=${ctx.workspaceId}`;
    }
    return `/dashboard/workspaces/subscription?workspaceId=${ctx.workspaceId}`;
  };

  const buildClientUrl = (ctx: PaymobOrderContext) => {
    if (typeof window === 'undefined') {
      const query = ctx.client?.id ? `?clientId=${ctx.client.id}` : '';
      return `/client/subscription${query}`;
    }
    const protocol = window.location.protocol;
    const queryParts: string[] = [];
    if (ctx.workspaceId) queryParts.push(`workspaceId=${ctx.workspaceId}`);
    if (ctx.client?.id) queryParts.push(`clientId=${ctx.client.id}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';

    if (ctx.workspace?.customDomain) {
      return `${protocol}//${ctx.workspace.customDomain}/client/subscription${query}`;
    }
    if (ctx.workspace?.subdomain) {
      return `${protocol}//${ctx.workspace.subdomain}.${APP_CONFIG.frontendDomain}/client/subscription${query}`;
    }
    return `/client/subscription${query}`;
  };

  const handleGoBack = () => {
    if (context) {
      if (context.type === 'workspace') {
        window.location.replace(buildWorkspaceUrl(context));
        return;
      }
      if (context.type === 'client') {
        window.location.replace(buildClientUrl(context));
        return;
      }
    }
    if (workspaceId) {
      window.location.replace(`/dashboard/workspaces/subscription?workspaceId=${workspaceId}`);
    } else {
      window.location.replace('/dashboard');
    }
  };

  const amountDisplay = formatCurrency(context?.payment?.amountCents ?? (amountCents ? Number(amountCents) : undefined), context?.payment?.currency || (currency || undefined));
  const originalAmountDisplay = formatCurrency(context?.payment?.originalAmountCents, context?.payment?.currency);
  const discountDisplay = formatCurrency(context?.payment?.promoDiscountCents, context?.payment?.currency);
  const creditDisplay = formatCurrency(context?.payment?.commissionCreditCents, context?.payment?.currency);

  const destinationLabel =
    context?.type === 'client'
      ? 'Go to Client Subscription'
      : 'Go to Workspace Subscription';

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
              <Typography variant="body1">
                {success ? 'Amount Charged:' : 'Amount Attempted:'} {amountDisplay}
              </Typography>
              {context?.payment && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Original Amount: {originalAmountDisplay}
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
            {contextLoading ? (
              <Stack spacing={1} alignItems="center" sx={{ width: '100%', py: 2 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary">
                  Loading subscription details…
                </Typography>
              </Stack>
            ) : (
              <>
                {contextError && (
                  <Typography variant="caption" color="error">
                    {contextError}
                  </Typography>
                )}
                {context && (
                  <Box
                    sx={{
                      width: '100%',
                      p: 2,
                      bgcolor: 'grey.50',
                      borderRadius: 2,
                      textAlign: 'left',
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Subscription Type
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {context.type === 'workspace' ? 'Workspace Subscription' : 'Client Subscription'}
                        </Typography>
                      </Box>
                      {context.workspace && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            Workspace
                          </Typography>
                          <Typography variant="body1">
                            {context.workspace.name || context.workspace.id}
                          </Typography>
                        </Box>
                      )}
                      {context.client && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            Client
                          </Typography>
                          <Typography variant="body1">
                            {context.client.fullName || context.client.id}
                          </Typography>
                        </Box>
                      )}
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Breakdown
                        </Typography>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            Original Amount: {originalAmountDisplay}
                          </Typography>
                          {context.payment.promoDiscountCents > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              Promo Discount: -{discountDisplay}
                            </Typography>
                          )}
                          {context.payment.commissionCreditCents > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              Commission Credit: -{creditDisplay}
                            </Typography>
                          )}
                          <Typography variant="body1" fontWeight={600}>
                            Amount Paid: {amountDisplay}
                          </Typography>
                        </Stack>
                      </Box>
                      {context.payment.packageName && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            Package
                          </Typography>
                          <Typography variant="body1">{context.payment.packageName}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                )}
              </>
            )}
            <Button variant="contained" onClick={handleGoBack} sx={{ mt: 1 }}>
              {success ? destinationLabel : 'Back to Billing'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}


