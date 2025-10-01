'use client';

import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { SubscriptionManager } from '@/components/payment';

export default function DashboardWorkspaceSubscriptionPage() {
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const workspaceId = searchParams.get('workspaceId') || '';

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Workspace Subscription
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          View your current subscription, renewal date, and manage billing.
        </Typography>

        <SubscriptionManager workspaceId={workspaceId} type="workspace" />
      </Box>
    </Container>
  );
}


