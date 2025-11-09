'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Card, Stack, TextField, Typography, Button as MuiButton } from '@mui/material';
import api from '@/utils/axios';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

export default function SeedClientMockPaymentPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/clients/subscription/mock', {});
      router.push('/client/subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={700} textAlign="center">{t('client.payment.title')}</Typography>
            <TextField label={t('client.payment.cardNumber')} value={card} onChange={(e) => setCard(e.target.value)} required />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label={t('client.payment.expiry')} value={expiry} onChange={(e) => setExpiry(e.target.value)} required fullWidth />
              <TextField label={t('client.payment.cvc')} value={cvc} onChange={(e) => setCvc(e.target.value)} required fullWidth />
            </Stack>
            <MuiButton type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? t('processing') : t('client.payment.payNow')}
            </MuiButton>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              {t('client.payment.devOnly')}
            </Typography>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}


