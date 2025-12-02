'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';
import { Alert, Box, Button, Stack } from '@mui/material';
import { usePathname } from 'next/navigation';

interface WorkspaceSubscriptionGuardProps {
  children: ReactNode;
  description?: string;
}

export default function WorkspaceSubscriptionGuard({ children, description }: WorkspaceSubscriptionGuardProps) {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const pathname = usePathname();
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!workspaceId) {
          if (!cancelled) setSubscriptionRequired(false);
          return;
        }
        // Do not show on subscription management routes
        const onSubscriptionPage = pathname?.startsWith('/dashboard/workspaces/subscription') || pathname?.startsWith('/workspace/subscription');
        if (onSubscriptionPage) {
          if (!cancelled) setSubscriptionRequired(false);
          return;
        }
        await api.get(`/api/workspaces/${workspaceId}/subscription`);
        if (!cancelled) setSubscriptionRequired(false);
      } catch (err: any) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.error || err?.response?.data?.message || '';
        if (!cancelled) {
          if (status === 404 || status === 402 || (typeof msg === 'string' && msg.toLowerCase().includes('subscription'))) {
            setMessage(msg || 'Workspace subscription required');
            setSubscriptionRequired(true);
          } else {
            setSubscriptionRequired(false);
          }
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, pathname]);

  if (subscriptionRequired) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
        <Alert
          severity="warning"
          sx={{ border: '1px solid', borderColor: 'warning.light' }}
          action={
            <Stack direction="row" spacing={1}>
              <Button color="warning" variant="contained" size="small" href="/dashboard/workspaces/subscription">
                Manage Subscription
              </Button>
            </Stack>
          }
        >
          <Box>
            <Box sx={{ fontWeight: 600, mb: 0.5 }}>Workspace subscription required</Box>
            <Box sx={{ color: 'text.secondary' }}>{description || message || 'Your workspace has no active subscription.'}</Box>
            <Box sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', color: 'warning.dark' }}>workspace_subscription_required</Box>
          </Box>
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
}


















































