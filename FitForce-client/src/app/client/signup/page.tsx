'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Card, Stack, TextField, Typography, Button as MuiButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import api from '@/utils/axios';
import { trackDual } from '@/lib/pixel';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

// Common country codes
const COUNTRY_CODES = [
  { code: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: '+1', name: 'US/CA', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+212', name: 'Morocco', flag: '🇲🇦' },
  { code: '+213', name: 'Algeria', flag: '🇩🇿' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', name: 'Austria', flag: '🇦🇹' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+90', name: 'Turkey', flag: '🇹🇷' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+961', name: 'Lebanon', flag: '🇱🇧' },
  { code: '+962', name: 'Jordan', flag: '🇯🇴' },
  { code: '+964', name: 'Iraq', flag: '🇮🇶' },
  { code: '+965', name: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', name: 'Bahrain', flag: '🇧🇭' },
  { code: '+974', name: 'Qatar', flag: '🇶🇦' },
  { code: '+968', name: 'Oman', flag: '🇴🇲' },
];

export default function SeedClientSignupPage() {
  const router = useRouter();
  
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);
    setPhoneError(null);
    
    // Validate password is required
    if (!password || password.trim().length === 0) {
      setPasswordError('Password is required');
      return;
    }
    
    if (password.trim().length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    // Validate phone if provided
    if (phone.trim()) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        setPhoneError('Phone number must be between 7 and 15 digits');
        return;
      }
    }
    
    setLoading(true);
    try {
      const phoneDigits = phone.trim().replace(/\D/g, '');
      const fullPhone = phoneDigits ? phoneCountryCode + phoneDigits : undefined;
      
      const res = await api.post('/api/clients', { 
        fullName, 
        email, 
        phone: fullPhone,
        phoneCountryCode: phoneDigits ? phoneCountryCode : undefined
      });
      const cid = res?.data?.client?.id as string | undefined;
      if (cid) setCreatedClientId(cid);
      if (email && password) {
        try { await api.post('/api/auth/signup', { fullName, email, password }); } catch {}
      }
      
      // Track CompleteRegistration event on both client and server
      await trackDual(
        'CompleteRegistration',
        { method: 'client_signup', event_id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` },
        {
          user_data: {
            em: email ? [email] : undefined,
            ph: fullPhone ? [fullPhone] : undefined,
            fn: fullName ? [fullName.split(' ')[0]] : undefined,
            ln: fullName ? [fullName.split(' ').slice(1).join(' ')] : undefined,
          },
        }
      ).catch(() => {
        // Silently fail - tracking shouldn't block user experience
      });
      
      setSuccess(true);
    } catch (err) {
      setError(t('client.signup.submitError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 520 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <Typography variant="h5" fontWeight={700} textAlign="center">{t('client.signup.title')}</Typography>
          <TextField label={t('full-name')} value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label={t('client.signup.emailOptional')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Country</InputLabel>
                <Select
                  value={phoneCountryCode}
                  label="Country"
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                >
                  {COUNTRY_CODES.map((country) => (
                    <MenuItem key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField 
                label={t('client.signup.phoneOptional')} 
                value={phone} 
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '');
                  setPhone(digitsOnly);
                  if (digitsOnly && (digitsOnly.length < 7 || digitsOnly.length > 15)) {
                    setPhoneError('Phone number must be between 7 and 15 digits');
                  } else {
                    setPhoneError(null);
                  }
                }}
                error={!!phoneError}
                helperText={phoneError || 'Digits only, 7-15 digits'}
                inputProps={{ maxLength: 15 }}
                fullWidth 
              />
            </Stack>
          </Stack>
          <TextField 
            label={t('client.signup.password') || 'Password'} 
            type="password" 
            value={password} 
            onChange={(e) => {
              setPassword(e.target.value);
              if (!e.target.value || e.target.value.trim().length === 0) {
                setPasswordError('Password is required');
              } else if (e.target.value.trim().length < 6) {
                setPasswordError('Password must be at least 6 characters');
              } else {
                setPasswordError(null);
              }
            }}
            error={!!passwordError}
            helperText={passwordError || 'Minimum 6 characters'}
            required
            fullWidth 
          />
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


