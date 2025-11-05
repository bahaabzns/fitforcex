'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// material-ui
import { Box, Card, Stack, TextField, Typography, Button as MuiButton } from '@mui/material';

// project-imports
import api from '@/utils/axios';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

// ================================|| REGISTER ||================================ //

const translations: Record<string, Record<string, string>> = { ar, en };

export default function RegisterPage() {
  const router = useRouter();
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!firstName || !email || !password) {
        throw new Error(t('email-is-required'));
      }
      await api.post('/api/auth/signup', {
        fullName: firstName,
        lastName: lastName || undefined,
        phoneNumber: phoneNumber || undefined,
        email,
        password
      });
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 520 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" fontWeight={700} textAlign="center">{t('register')}</Typography>
          <TextField label={t('first-name') || 'First Name'} value={firstName} onChange={(e) => setFirstName(e.target.value)} required fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label={t('last-name') || 'Last Name'} value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth />
            <TextField label={t('phone-number')} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} fullWidth />
          </Stack>
          <TextField label={t('email-address')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField label={t('password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
          {error && <Typography color="error" variant="body2" textAlign="center">{error}</Typography>}
          <MuiButton type="submit" variant="contained" fullWidth disabled={loading}>
            {loading ? t('processing') : t('register')}
          </MuiButton>
          <Typography variant="body2" textAlign="center">
            {t('login')}? <Link href="/login">{t('go-to-login') || 'Go to Login'}</Link>
          </Typography>
        </Stack>
      </Card>
    </Box>
  );
}
