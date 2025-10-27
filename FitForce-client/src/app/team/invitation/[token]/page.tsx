'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/utils/axios';
import { useAppSelector, useAppDispatch } from '@/store';
import { setCredentials } from '@/store/slices/authSlice';

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
import { TickCircle, CloseCircle, Clock, Shield, Profile, Lock } from '@wandersonalwes/iconsax-react';

interface InvitationData {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  role: {
    name: string;
  };
  workspace: {
    name: string;
    subdomain: string;
  };
}

type FlowState = 'loading' | 'needs-signup' | 'needs-login' | 'wrong-user' | 'ready' | 'accepting' | 'success' | 'error';

export default function TeamInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const token = params.token as string;
  const userId = useAppSelector((s) => s.auth.user?.id);
  const userEmail = useAppSelector((s) => s.auth.user?.email);
  
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Signup form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setFlowState('error');
      return;
    }

    fetchInvitationAndDetermineFlow();
  }, [token, userId, userEmail]);

  const fetchInvitationAndDetermineFlow = async () => {
    try {
      const response = await api.get(`/api/team/invitations/${token}`);
      const invData = response.data.invitation;
      setInvitation(invData);
      setLoginEmail(invData.email); // Pre-fill login email
      setError(null);

      // Determine flow based on current state
      if (!userId) {
        // User not logged in - check if they have an account
        try {
          // Try to check if user exists (we'll need a backend endpoint for this)
          // For now, we'll show signup option
          setFlowState('needs-signup');
        } catch {
          setFlowState('needs-signup');
        }
      } else {
        // User is logged in
        if (userEmail === invData.email) {
          // Correct user - ready to accept
          setFlowState('ready');
        } else {
          // Wrong user logged in
          setFlowState('wrong-user');
        }
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to load invitation';
      setError(errorMsg);
      setFlowState('error');
    }
  };

  const handleSignupAndAccept = async () => {
    if (!invitation) return;

    // Validation
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSignupLoading(true);
    setError(null);

    try {
      // 1. Create account - set fullName to firstName
      await api.post('/api/auth/signup', {
        fullName: firstName.trim(), // Set fullName to firstName
        email: invitation.email,
        password,
        lastName: lastName.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined
      });

      // 2. Login automatically
      const loginResponse = await api.post('/api/auth/login', {
        email: invitation.email,
        password
      });

      const user = loginResponse.data.user;
      dispatch(setCredentials({ user }));

      // 3. Accept invitation
      await api.post('/api/team/invitations/accept', {
        token,
        userId: user.id
      });

      setFlowState('success');
      
      // Redirect to workspace dashboard
      setTimeout(() => {
        router.push(`/dashboard`);
      }, 2000);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to create account and accept invitation';
      setError(errorMsg);
    } finally {
      setSignupLoading(false);
    }
  };

  const handleLoginAndAccept = async () => {
    if (!invitation) return;

    if (!loginPassword) {
      setError('Please enter your password');
      return;
    }

    setLoginLoading(true);
    setError(null);

    try {
      // 1. Login
      const loginResponse = await api.post('/api/auth/login', {
        email: loginEmail,
        password: loginPassword
      });

      const user = loginResponse.data.user;
      dispatch(setCredentials({ user }));

      // 2. Accept invitation
      await api.post('/api/team/invitations/accept', {
        token,
        userId: user.id
      });

      setFlowState('success');
      
      // Redirect to workspace dashboard
      setTimeout(() => {
        router.push(`/dashboard`);
      }, 2000);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to login and accept invitation';
      setError(errorMsg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!userId || !invitation) return;

    setFlowState('accepting');
    setError(null);

    try {
      await api.post('/api/team/invitations/accept', {
        token,
        userId
      });
      
      setFlowState('success');
      
      // Redirect to workspace dashboard
      setTimeout(() => {
        router.push(`/dashboard`);
      }, 2000);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to accept invitation';
      setError(errorMsg);
      setFlowState('error');
    }
  };

  const handleSwitchToLogin = () => {
    setFlowState('needs-login');
  };

  const handleSwitchToSignup = () => {
    setFlowState('needs-signup');
  };

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
      dispatch(setCredentials({ user: null as any }));
      // Refresh to show signup/login options
      window.location.reload();
    } catch (err) {
      console.error('Logout failed:', err);
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
              <Shield size={64} variant="Bulk" color="#3366FF" />
              <Typography variant="h3" sx={{ mt: 2, mb: 1 }}>
                Team Invitation
              </Typography>
              <Typography variant="body1" color="text.secondary">
                You've been invited to join a workspace
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
                sx={{ '& .MuiAlert-message': { width: '100%' } }}
              >
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Invitation Accepted!
                </Typography>
                <Typography variant="body2">
                  You are now a member of {invitation?.workspace.name}. Redirecting to dashboard...
                </Typography>
              </Alert>
            )}

            {/* Invitation Details */}
            {invitation && flowState !== 'success' && (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    Workspace
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {invitation.workspace.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {invitation.workspace.subdomain}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    Your Role
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip 
                      label={invitation.role.name} 
                      color="primary" 
                      variant="outlined"
                      sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                    />
                  </Box>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    Email
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {invitation.email}
                  </Typography>
                </Box>

                <Divider />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Clock size={20} color="#F59E0B" />
                  <Typography variant="caption" color="text.secondary">
                    Expires on {new Date(invitation.expiresAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography>
                </Box>
              </Stack>
            )}

            {/* Signup Form (for new users) */}
            {flowState === 'needs-signup' && invitation && (
              <Stack spacing={2}>
                <Alert severity="info">
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Create your account to accept this invitation
                  </Typography>
                </Alert>
                
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="First Name *"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    fullWidth
                    disabled={signupLoading}
                    InputProps={{
                      startAdornment: <Profile size={20} style={{ marginRight: 8, opacity: 0.5 }} />
                    }}
                  />
                  <TextField
                    label="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    fullWidth
                    disabled={signupLoading}
                  />
                </Stack>
                
                <TextField
                  label="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  fullWidth
                  disabled={signupLoading}
                />

                <TextField
                  label="Email"
                  value={invitation.email}
                  fullWidth
                  disabled
                  helperText="Email is pre-filled from invitation"
                />
                
                <TextField
                  label="Password *"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  disabled={signupLoading}
                  helperText="At least 6 characters"
                  InputProps={{
                    startAdornment: <Lock size={20} style={{ marginRight: 8, opacity: 0.5 }} />
                  }}
                />
                
                <TextField
                  label="Confirm Password *"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  disabled={signupLoading}
                  InputProps={{
                    startAdornment: <Lock size={20} style={{ marginRight: 8, opacity: 0.5 }} />
                  }}
                />

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleSignupAndAccept}
                  disabled={signupLoading}
                  startIcon={signupLoading ? <CircularProgress size={20} /> : <TickCircle />}
                >
                  {signupLoading ? 'Creating Account...' : 'Create Account & Accept Invitation'}
                </Button>

                <Divider>
                  <Typography variant="caption" color="text.secondary">OR</Typography>
                </Divider>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleSwitchToLogin}
                  disabled={signupLoading}
                >
                  Already have an account? Log In
                </Button>
              </Stack>
            )}

            {/* Login Form */}
            {flowState === 'needs-login' && invitation && (
              <Stack spacing={2}>
                <Alert severity="info">
                  <Typography variant="body2">
                    Log in with <strong>{invitation.email}</strong> to accept this invitation
                  </Typography>
                </Alert>
                
                <TextField
                  label="Email"
                  value={loginEmail}
                  fullWidth
                  disabled
                  helperText="Email from invitation"
                />
                
                <TextField
                  label="Password *"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  fullWidth
                  disabled={loginLoading}
                  autoFocus
                  InputProps={{
                    startAdornment: <Lock size={20} style={{ marginRight: 8, opacity: 0.5 }} />
                  }}
                />

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleLoginAndAccept}
                  disabled={loginLoading}
                  startIcon={loginLoading ? <CircularProgress size={20} /> : <TickCircle />}
                >
                  {loginLoading ? 'Logging In...' : 'Log In & Accept Invitation'}
                </Button>

                <Divider>
                  <Typography variant="caption" color="text.secondary">OR</Typography>
                </Divider>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleSwitchToSignup}
                  disabled={loginLoading}
                >
                  Don't have an account? Sign Up
                </Button>
              </Stack>
            )}

            {/* Wrong User Logged In */}
            {flowState === 'wrong-user' && invitation && (
              <Stack spacing={2}>
                <Alert severity="warning">
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    You are logged in as <strong>{userEmail}</strong>, but this invitation was sent to <strong>{invitation.email}</strong>.
                  </Typography>
                  <Typography variant="body2">
                    Please log out and log in with the correct email to accept this invitation.
                  </Typography>
                </Alert>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleLogout}
                >
                  Log Out & Switch Account
                </Button>
              </Stack>
            )}

            {/* Ready to Accept (correct user logged in) */}
            {flowState === 'ready' && invitation && (
              <Stack spacing={2}>
                <Alert severity="success">
                  <Typography variant="body2">
                    You're logged in as <strong>{userEmail}</strong>. Ready to accept!
                  </Typography>
                </Alert>

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleAccept}
                  startIcon={<TickCircle />}
                >
                  Accept Invitation
                </Button>
              </Stack>
            )}

            {/* Accepting State */}
            {flowState === 'accepting' && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={60} />
                <Typography variant="body1" sx={{ mt: 2 }}>
                  Accepting invitation...
                </Typography>
              </Box>
            )}

            {/* Error State */}
            {flowState === 'error' && !invitation && (
              <Button
                variant="contained"
                fullWidth
                onClick={() => router.push('/')}
              >
                Go to Home
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
