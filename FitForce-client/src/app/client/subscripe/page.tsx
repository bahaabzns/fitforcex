'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Card, Stack, Typography, Button as MuiButton, Grid, Divider, Chip, Alert } from '@mui/material';
import { openSnackbar } from '@/api/snackbar';
import { useState } from 'react';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

export default function ClientSubscripePage() {
  const router = useRouter();
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;

  const { data: profile } = useSWR('seed-client-profile', async () => {
    const res = await api.get('/api/clients/profile');
    return res.data as { client: { id: string; fullName: string; email?: string; status: string }; workspace: { id: string; name: string } };
  });

  const { data: overview } = useSWR(
    () => (profile?.client?.id ? `seed-client-overview-${profile.client.id}` : null),
    async () => {
      const res = await api.get(`/api/clients/${profile!.client.id}/overview`);
      return res.data as {
        metrics: {
          subscriptionsCount: number;
        };
        activities: Array<{ id: string; title: string; description?: string; createdAt: string; type: string }>;
      };
    }
  );

  const subscriptionsCount = overview?.metrics?.subscriptionsCount ?? 0;
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRenew = async () => {
    setRenewing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post('/api/clients/subscription/mock', {});
      setSuccess('Subscription renewed successfully');
      openSnackbar({ open: true, message: 'Subscription renewed', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
      // Refresh overview data
      await Promise.all([
        (async () => {})()
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to renew';
      setError(msg);
      openSnackbar({ open: true, message: msg, variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
    } finally {
      setRenewing(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {t('client.subscripe.title')}
        </Typography>
        <Typography color="text.secondary">{t('client.subscripe.subtitle')}</Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>{t('client.subscripe.current')}</Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              <Typography variant="body2">{t('status')}: <Chip size="small" label={subscriptionsCount > 0 ? t('active') : t('none')} color={subscriptionsCount > 0 ? 'success' : 'default'} /></Typography>
              <Typography variant="body2">{t('client.subscripe.total')}: {subscriptionsCount}</Typography>
            </Stack>
          </Card>

          <Card sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={700}>{t('client.subscripe.renewal')}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('client.subscripe.renewDesc')}
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            <MuiButton variant="contained" onClick={handleRenew} disabled={renewing}>
              {renewing ? t('client.subscripe.renewing') : t('renew-now')}
            </MuiButton>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}


