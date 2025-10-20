'use client';

import React from 'react';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency');
  const orderId = searchParams.get('orderId');

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
