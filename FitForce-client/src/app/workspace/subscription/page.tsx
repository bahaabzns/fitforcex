'use client';

import React from 'react';
import { Box, Typography, Container } from '@mui/material';
import { SubscriptionManager } from '@/components/payment';

export default function WorkspaceSubscriptionPage() {
  // Get workspace ID from URL query params
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const workspaceId = searchParams.get('workspaceId') || '';

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Workspace Subscription
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Manage your workspace subscription and billing.
        </Typography>
        
        <SubscriptionManager
          workspaceId={workspaceId}
          type="workspace"
        />
      </Box>
    </Container>
  );
}
