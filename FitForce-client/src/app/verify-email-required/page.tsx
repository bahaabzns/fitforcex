'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import { Email, ArrowBack } from '@mui/icons-material';
import api from '@/utils/axios';
import EmailVerificationFlow from '@/components/EmailVerificationFlow';

export default function VerifyEmailRequiredPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/api/auth/me');
        if (response.data?.user) {
          setUserEmail(response.data.user.email);
          // If already verified, redirect to dashboard
          if (response.data.user.emailVerified) {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        // If not authenticated, redirect to login
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} alignItems="center">
            <Email sx={{ fontSize: 64, color: 'warning.main' }} />
            
            <Typography variant="h4" align="center" gutterBottom>
              Email Verification Required
            </Typography>

            <Alert severity="warning" sx={{ width: '100%' }}>
              You must verify your email address before accessing the dashboard.
            </Alert>

            {userEmail && (
              <Typography variant="body1" color="text.secondary" align="center">
                A verification code has been sent to <strong>{userEmail}</strong>
              </Typography>
            )}

            <Button
              variant="contained"
              size="large"
              startIcon={<Email />}
              onClick={() => setShowVerification(true)}
              sx={{ mt: 2 }}
            >
              Verify Email Now
            </Button>

            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => router.push('/login')}
            >
              Back to Login
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {userEmail && (
        <EmailVerificationFlow
          open={showVerification}
          email={userEmail}
          onSkip={() => setShowVerification(false)}
          onVerified={() => {
            setShowVerification(false);
            router.push('/dashboard');
          }}
        />
      )}
    </Container>
  );
}

