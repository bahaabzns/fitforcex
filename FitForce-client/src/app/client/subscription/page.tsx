'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useWorkspaceBranding } from '@/hooks/useWorkspaceBranding';
import { 
  Box, 
  Typography, 
  Alert, 
  CircularProgress,
  Paper,
  Stack,
  Avatar,
  Card,
  CardContent,
  Grid,
  Divider,
  Chip,
  Button
} from '@mui/material';
import { 
  CreditCard,
  Schedule,
  CheckCircle,
  Warning,
  Refresh
} from '@mui/icons-material';
import { SubscriptionManager } from '@/components/payment';
import api from '@/utils/axios';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

export default function ClientSubscriptionPage() {
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const params = useMemo(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('')), []);
  const { logoUrl, primaryColor, workspaceName } = useWorkspaceBranding();
  const [workspaceId, setWorkspaceId] = useState<string>(params.get('workspaceId') || '');
  const [clientId, setClientId] = useState<string>(params.get('clientId') || '');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfileIfNeeded = async () => {
      try {
        setLoadingProfile(true);
        const res = await api.get('/api/clients/profile');
        const data = res.data as { client?: { id: string; fullName: string; email: string; status: string }; workspace?: { id: string; name: string } };
        setProfile(data);
        
        if (!workspaceId && data.workspace?.id) setWorkspaceId(data.workspace.id);
        if (!clientId && data.client?.id) setClientId(data.client.id);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };
    void loadProfileIfNeeded();
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active':
        return { color: 'success', icon: <CheckCircle />, message: 'Your subscription is active' };
      case 'pending':
        return { color: 'warning', icon: <Schedule />, message: 'Your subscription is pending' };
      case 'pre_start':
        return { color: 'info', icon: <Schedule />, message: 'Your program will start soon' };
      case 'frozen':
        return { color: 'warning', icon: <Warning />, message: 'Your subscription is frozen' };
      case 'expired':
        return { color: 'error', icon: <Warning />, message: 'Your subscription has expired' };
      case 'refunded':
        return { color: 'error', icon: <Warning />, message: 'Your subscription was refunded' };
      default:
        return { color: 'default', icon: <CreditCard />, message: 'No active subscription' };
    }
  };

  if (loadingProfile) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary">{t('client.subscription.loading')}</Typography>
        </Stack>
      </Box>
    );
  }

  const statusInfo = profile?.client?.status ? getStatusInfo(profile.client.status) : null;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}CC 100%)`,
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            {logoUrl ? (
              <Box sx={{ width: 56, height: 56, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={`${workspaceName} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
            ) : (
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
                <CreditCard sx={{ fontSize: 32 }} />
              </Avatar>
            )}
            <Box>
              <Typography variant="h4" fontWeight={700}>
                {t('client.subscription.title')}
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
                {t('client.subscription.subtitle')}
              </Typography>
            </Box>
          </Stack>
          <Button 
            variant="outlined" 
            startIcon={<Refresh />}
            onClick={handleRefresh}
            sx={{ 
              color: 'white', 
              borderColor: 'rgba(255, 255, 255, 0.5)',
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            {t('refresh')}
          </Button>
        </Stack>
      </Paper>

      {/* Profile Summary */}
      {profile && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight={700}>{t('client.subscription.accountStatus')}</Typography>
                  <Divider />
                  {statusInfo && (
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ bgcolor: `${statusInfo.color}.main`, width: 40, height: 40 }}>
                        {statusInfo.icon}
                      </Avatar>
                      <Box flex={1}>
                        <Chip 
                          label={profile.client.status.toUpperCase().replace('_', ' ')} 
                          color={statusInfo.color as any}
                          size="small"
                          sx={{ mb: 0.5 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {t(`client.subscription.status.${profile.client.status}`)}
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight={700}>{t('client.subscription.clientInfo')}</Typography>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {t('full-name').toUpperCase()}
                    </Typography>
                    <Typography variant="body1">{profile.client.fullName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {t('email-address').toUpperCase()}
                    </Typography>
                    <Typography variant="body1">{profile.client.email}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight={700}>{t('client.subscription.workspace')}</Typography>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {t('workspace').toUpperCase()}
                    </Typography>
                    <Typography variant="body1">{profile.workspace.name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {t('workspace-id').toUpperCase()}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {workspaceId}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Status Messages */}
      {(!workspaceId || !clientId) && !loadingProfile && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {t('client.subscription.missingInfo')}
        </Alert>
      )}

      {/* Subscription Manager */}
      {!!workspaceId && !!clientId && (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 0 }}>
            <SubscriptionManager
              workspaceId={workspaceId}
              type="client"
              clientId={clientId}
            />
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card sx={{ borderRadius: 3, mt: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.50', border: '2px solid', borderColor: 'primary.main' }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} color="primary.main" gutterBottom>
            {t('need-help')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('client.subscription.helpText')}
          </Typography>
          <Button 
            variant="contained" 
            sx={{ mt: 2 }}
            href="/client/support"
          >
            {t('get-support')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
