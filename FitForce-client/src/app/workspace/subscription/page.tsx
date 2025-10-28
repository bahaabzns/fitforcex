'use client';

import React from 'react';
import { Box, Typography, Container } from '@mui/material';
import { useIntl, FormattedMessage } from 'react-intl';
import { SubscriptionManager } from '@/components/payment';

export default function WorkspaceSubscriptionPage() {
  const intl = useIntl();
  // Get workspace ID from URL query params
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const workspaceId = searchParams.get('workspaceId') || '';

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          <FormattedMessage id="wsSub.title" defaultMessage="Workspace Subscription" />
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          <FormattedMessage id="wsSub.subtitle2" defaultMessage="Manage your workspace subscription and billing." />
        </Typography>
        
        <SubscriptionManager
          workspaceId={workspaceId}
          type="workspace"
        />
      </Box>
    </Container>
  );
}
