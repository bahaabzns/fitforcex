'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/utils/axios';

// MUI
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';

// Icons
import { TickCircle, CloseCircle, Clock, User, Profile, Lock } from '@wandersonalwes/iconsax-react';

interface ClientInvitationData {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  workspace: {
    name: string;
    subdomain: string;
  };
}

type FlowState = 'loading' | 'needs-signup' | 'ready' | 'accepting' | 'success' | 'error';

export default function ClientInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [invitation, setInvitation] = useState<ClientInvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setFlowState('error');
      return;
    }

    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const response = await api.get(`/api/clients/invite/${token}`);
      const invitationData = response.data.invitation;
      
      setInvitation(invitationData);
      setEmail(invitationData.email || '');
      
      // Check if invitation is expired
      const expiresAt = new Date(invitationData.expiresAt);
      const now = new Date();
      
      if (expiresAt < now) {
        setError('This invitation has expired');
        setFlowState('error');
        return;
      }
      
      // Check if invitation is already accepted
      if (invitationData.status === 'accepted') {
        setError('This invitation has already been accepted');
        setFlowState('error');
        return;
      }
      
      setFlowState('needs-signup');
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Invalid invitation link';
      setError(errorMsg);
      setFlowState('error');
    }
  };

  const handleSignupAndAccept = async () => {
    if (!invitation) return;

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setSignupLoading(true);
    setError(null);

    try {
      // 1. Accept invitation and create client account
      const signupResponse = await api.post('/api/clients/invite/accept', {
        token,
        password,
        fullName: fullName.trim(),
        phone: phoneNumber.trim() || undefined
      });

      setFlowState('success');
      
      // Redirect to client dashboard
      setTimeout(() => {
        router.push('/client/dashboard');
      }, 2000);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to create account and accept invitation';
      setError(errorMsg);
    } finally {
      setSignupLoading(false);
    }
  };

  if (flowState === 'loading') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2
      }}
    >
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            {/* Header */}
            <Box sx={{ textAlign: 'center' }}>
              <User size={64} variant="Bulk" color="#3366FF" />
              <Typography variant="h3" sx={{ mt: 2, mb: 1 }}>
                Client Invitation
              </Typography>
              <Typography variant="body1" color="text.secondary">
                You've been invited to join as a client
              </Typography>
            </Box>

            <Divider />

            {/* Error Alert */}
            {error && flowState !== 'success' && (
              <Alert 
                severity="error" 
                icon={<CloseCircle variant="Bold" />}
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}

            {/* Success State */}
            {flowState === 'success' && (
              <Alert 
                severity="success" 
                icon={<TickCircle variant="Bold" />}
              >
                <Typography variant="h6" gutterBottom>
                  Welcome to {invitation?.workspace.name}!
                </Typography>
                <Typography>
                  Your account has been created successfully. You'll be redirected to your client dashboard shortly.
                </Typography>
              </Alert>
            )}

            {/* Invitation Details */}
            {invitation && flowState !== 'success' && (
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Invitation Details
                  </Typography>
                  <Typography variant="body2">
                    <strong>Workspace:</strong> {invitation.workspace.name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Email:</strong> {invitation.email}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Expires:</strong> {new Date(invitation.expiresAt).toLocaleDateString()}
                  </Typography>
                </Stack>
              </Box>
            )}

            {/* Signup Form */}
            {flowState === 'needs-signup' && (
              <Stack spacing={3}>
                <Typography variant="h6">
                  Create Your Client Account
                </Typography>
                
                <TextField
                  fullWidth
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                
                <TextField
                  fullWidth
                  label="Phone Number (Optional)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                
                <TextField
                  fullWidth
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleSignupAndAccept}
                  disabled={signupLoading}
                  startIcon={signupLoading ? <CircularProgress size={20} /> : <TickCircle />}
                >
                  {signupLoading ? 'Creating Account...' : 'Create Account & Accept Invitation'}
                </Button>
              </Stack>
            )}

            {/* Footer */}
            <Box sx={{ textAlign: 'center', pt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Powered by FitForce - Empowering fitness professionals worldwide
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
