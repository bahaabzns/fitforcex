'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// material-ui
import { Box, Card, Stack, TextField, Typography, Button as MuiButton, CircularProgress, InputAdornment } from '@mui/material';
import { CheckCircleOutline, ErrorOutline } from '@mui/icons-material';

// project-imports
import api from '@/utils/axios';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';
import { trackDual } from '@/lib/pixel';
import { APP_CONFIG } from '@/lib/config';

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
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [promoValidation, setPromoValidation] = useState<{ discount: number; commission: number; ownerName?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authBackgroundImage, setAuthBackgroundImage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const resp = await fetch(`${APP_CONFIG.apiUrl}/api/meta/landing-config`, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        const landing = data?.landing;
        if (!landing || !isMounted) return;
        setAuthBackgroundImage(landing.authBackgroundImage || null);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, []);


  useEffect(() => {
    const trimmed = promoCode.trim();
    if (!trimmed) {
      setPromoStatus('idle');
      setPromoValidation(null);
      return;
    }

    let isActive = true;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setPromoStatus('loading');
        const { data } = await api.get('/api/promo/validate', {
          params: { code: trimmed },
          signal: controller.signal
        });
        if (!isActive) return;

        if (data?.valid) {
          const ownerName = data?.promoCode?.owner?.fullName || data?.promoCode?.owner?.email || undefined;
          setPromoValidation({
            discount: data?.promoCode?.discountPercentage ?? 0,
            commission: data?.promoCode?.commissionPercentage ?? 0,
            ownerName
          });
          setPromoStatus('valid');
        } else {
          setPromoValidation(null);
          setPromoStatus('invalid');
        }
      } catch (err: any) {
        if (!isActive || controller.signal.aborted) return;
        setPromoValidation(null);
        setPromoStatus('invalid');
      }
    }, 300);

    return () => {
      isActive = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [promoCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!firstName || !email || !password) {
        throw new Error(t('email-is-required'));
      }

      const normalizedPromo = promoCode.trim().toUpperCase();
      if (normalizedPromo && promoStatus === 'invalid') {
        throw new Error('Invalid promo code');
      }

      await api.post('/api/auth/signup', {
        fullName: firstName,
        lastName: lastName || undefined,
        phoneNumber: phoneNumber || undefined,
        email,
        password,
        promoCode: normalizedPromo || undefined
      });

      // Track CompleteRegistration on both client and server
      const eventId = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await trackDual(
        'CompleteRegistration',
        { method: 'email', event_id: eventId },
        {
          user_data: {
            // Note: In production, emails should be hashed (SHA256) before sending
            // For now, sending plain email - backend should hash it if needed
            em: email ? [email] : undefined,
            ph: phoneNumber ? [phoneNumber] : undefined,
            fn: firstName ? [firstName] : undefined,
            ln: lastName ? [lastName] : undefined,
          },
        }
      );

      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        p: 2,
        position: 'relative',
        ...(authBackgroundImage && {
          backgroundImage: `url(${authBackgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 0
          }
        })
      }}
    >
      <Card sx={{ p: 4, width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" fontWeight={700} textAlign="center">{t('register')}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label={t('first-name') || 'First Name'} value={firstName} onChange={(e) => setFirstName(e.target.value)} required fullWidth />
            <TextField label={t('last-name') || 'Last Name'} value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth />
          </Stack>
          <TextField label={t('phone-number')} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} fullWidth />
          <TextField label={t('email-address')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField label={t('password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
          <TextField
            label="Promo Code (Optional)"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            fullWidth
            inputProps={{ maxLength: 32 }}
            error={promoStatus === 'invalid'}
            helperText={
              promoStatus === 'valid'
                ? `Promo applied — ${promoValidation?.discount ?? 0}% discount${promoValidation?.ownerName ? ` referred by ${promoValidation.ownerName}` : ''}.`
                : promoStatus === 'invalid'
                  ? 'Promo code not found or inactive.'
                  : 'Optional: enter a referral promo code.'
            }
            InputProps={{
              endAdornment: promoStatus === 'idle' ? undefined : (
                <InputAdornment position="end">
                  {promoStatus === 'loading' && <CircularProgress size={18} />}
                  {promoStatus === 'valid' && <CheckCircleOutline color="success" fontSize="small" />}
                  {promoStatus === 'invalid' && <ErrorOutline color="error" fontSize="small" />}
                </InputAdornment>
              )
            }}
          />
          {error && <Typography color="error" variant="body2" textAlign="center">{error}</Typography>}
          <MuiButton type="submit" variant="contained" fullWidth disabled={loading}>
            {loading ? t('processing') : t('register')}
          </MuiButton>
          <Typography variant="caption" color="textSecondary" textAlign="center">
            By creating an account, you agree to our{' '}
            <Link href="/terms">Terms of Service</Link>,{' '}
            <Link href="/privacy">Privacy Policy</Link> and{' '}
            <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
          </Typography>
          <Typography variant="body2" textAlign="center">
            {t('login')}? <Link href="/login">{t('go-to-login') || 'Go to Login'}</Link>
          </Typography>
        </Stack>
      </Card>
    </Box>
  );
}
