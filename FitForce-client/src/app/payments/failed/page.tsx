'use client';

import React from 'react';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PaymentFailedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency');
  const orderId = searchParams.get('orderId');
  const error = searchParams.get('error');

  const handleGoBack = () => {
    router.push('/client/subscription');
  };

  const handleRetry = () => {
    router.push('/client/subscription');
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card>
        <CardContent>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <ErrorIcon color="error" sx={{ fontSize: 64 }} />
            <Typography variant="h5" fontWeight={700}>
              Payment Failed
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
              {error && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  Error: {error}
                </Typography>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Your payment could not be processed. Please try again or contact support.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={handleGoBack}>
                Back to Dashboard
              </Button>
              <Button variant="contained" onClick={handleRetry}>
                Try Again
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
