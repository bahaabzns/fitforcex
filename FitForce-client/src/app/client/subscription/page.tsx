'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Container, Alert, CircularProgress } from '@mui/material';
import { SubscriptionManager } from '@/components/payment';
import api from '@/utils/axios';

export default function ClientSubscriptionPage() {
  const params = useMemo(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('')), []);
  const [workspaceId, setWorkspaceId] = useState<string>(params.get('workspaceId') || '');
  const [clientId, setClientId] = useState<string>(params.get('clientId') || '');
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const loadProfileIfNeeded = async () => {
      if (workspaceId && clientId) return;
      try {
        setLoadingProfile(true);
        const res = await api.get('/api/clients/profile');
        const data = res.data as { client?: { id: string }; workspace?: { id: string } };
        if (!workspaceId && data.workspace?.id) setWorkspaceId(data.workspace.id);
        if (!clientId && data.client?.id) setClientId(data.client.id);
      } catch {
        // ignore; page will show warning if still missing
      } finally {
        setLoadingProfile(false);
      }
    };
    void loadProfileIfNeeded();
  }, [workspaceId, clientId]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Client Subscription
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Manage your subscription and billing for this workspace.
        </Typography>

        {loadingProfile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption">Loading your profile...</Typography>
          </Box>
        )}
        {(!workspaceId || !clientId) && !loadingProfile && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Missing workspaceId or clientId. Open this page with ?workspaceId=...&clientId=...
          </Alert>
        )}

        {!!workspaceId && !!clientId && (
          <SubscriptionManager
            workspaceId={workspaceId}
            type="client"
            clientId={clientId}
          />
        )}
      </Box>
    </Container>
  );
}
