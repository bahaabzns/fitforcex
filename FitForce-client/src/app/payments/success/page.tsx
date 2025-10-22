'use client';

import React, { useEffect } from 'react';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMetaPixel } from '@/hooks/useMetaPixel';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trackPurchase } = useMetaPixel();
  
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency');
  const orderId = searchParams.get('orderId');
  const packageId = searchParams.get('packageId');

  // Track Purchase event when page loads
  useEffect(() => {
    if (amount && currency) {
      const purchaseAmount = parseFloat(amount);
      trackPurchase(
        purchaseAmount,
        currency,
        packageId ? [{ id: packageId, quantity: 1 }] : undefined
      );
    }
  }, [amount, currency, packageId, trackPurchase]);

  const handleGoBack = () => {
    router.push('/client/subscription');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card>
        <CardContent>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
            <Typography variant="h5" fontWeight={700}>
              Payment Successful!
            </Typography>
            <Box>
              {amount && currency && (
                <Typography variant="body1">
                  Amount: {amount} {currency}
                </Typography>
              )}
              {orderId && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Order ID: {orderId}
                </Typography>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Your subscription has been activated. You can now access all features.
            </Typography>
            <Button variant="contained" onClick={handleGoBack} sx={{ mt: 1 }}>
              Back to Dashboard
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
