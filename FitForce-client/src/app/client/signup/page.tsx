'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Card, Stack, TextField, Typography, Button as MuiButton } from '@mui/material';
import api from '@/utils/axios';
// Meta Pixel removed
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

export default function SeedClientSignupPage() {
  const router = useRouter();
  
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/api/clients', { fullName, email, phone: phone || undefined });
      const cid = res?.data?.client?.id as string | undefined;
      if (cid) setCreatedClientId(cid);
      if (email && password) {
        try { await api.post('/api/auth/signup', { fullName, email, password }); } catch {}
      }
      
      // No pixel tracking
      
      setSuccess(true);
    } catch (err) {
      setError(t('client.signup.submitError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 520 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" fontWeight={700} textAlign="center">{t('client.signup.title')}</Typography>
          <TextField label={t('full-name')} value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label={t('client.signup.emailOptional')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label={t('client.signup.phoneOptional')} value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
          </Stack>
          <TextField label={t('client.signup.passwordOptional')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
          {error && <Typography color="error" variant="body2" textAlign="center">{error}</Typography>}
          {!success ? (
            <MuiButton type="submit" variant="contained" fullWidth disabled={loading}>
              {loading ? t('submitting') : t('client.signup.submit')}
            </MuiButton>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="success.main" textAlign="center">{t('client.signup.success')}</Typography>
              <MuiButton variant="contained" onClick={() => router.push(`/client/payment/mock${createdClientId ? `?clientId=${createdClientId}` : ''}`)}>
                {t('client.signup.proceedMockPayment')}
              </MuiButton>
              <MuiButton variant="outlined" onClick={() => router.push('/')}>{t('client.signup.backHome')}</MuiButton>
            </Stack>
          )}
        </Stack>
      </Card>
    </Box>
  );
}


