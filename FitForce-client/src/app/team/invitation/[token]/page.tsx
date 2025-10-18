'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/utils/axios';
import { useAppSelector } from '@/store';

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

// Icons
import { TickCircle, CloseCircle, Clock, Shield } from '@wandersonalwes/iconsax-react';

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

export default function TeamInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const userId = useAppSelector((s) => s.auth.user?.id);
  const userEmail = useAppSelector((s) => s.auth.user?.email);
  
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const response = await api.get(`/api/team/invitations/${token}`);
        setInvitation(response.data.invitation);
        setError(null);
      } catch (err: any) {
        const errorMsg = err?.response?.data?.error || 'Failed to load invitation';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!userId) {
      setError('You must be logged in to accept this invitation. Please log in first.');
      return;
    }

    if (!invitation) {
      setError('Invitation data is missing');
      return;
    }

    // Check if logged-in user email matches invitation email
    if (userEmail !== invitation.email) {
      setError(`This invitation was sent to ${invitation.email}. Please log in with that email to accept.`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      await api.post('/api/team/invitations/accept', {
        token,
        userId
      });
      
      setSuccess(true);
      
      // Redirect to workspace after 2 seconds
      setTimeout(() => {
        router.push(`/dashboard`);
      }, 2000);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || 'Failed to accept invitation';
      setError(errorMsg);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    router.push('/');
  };

  if (loading) {
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

            {/* Success State */}
            {success && (
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

            {/* Error State */}
            {error && !success && (
              <Alert 
                severity="error" 
                icon={<CloseCircle variant="Bold" />}
              >
                {error}
              </Alert>
            )}

            {/* Invitation Details */}
            {invitation && !success && (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    Workspace
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {invitation.workspace.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {invitation.workspace.subdomain}.{window.location.hostname.replace('localhost:3000', 'nano.com')}
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

                {/* Authentication Check */}
                {!userId && (
                  <Alert severity="info">
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      You need to be logged in to accept this invitation.
                    </Typography>
                    <Button 
                      variant="contained" 
                      size="small"
                      onClick={() => router.push(`/login?redirect=/team/invitation/${token}`)}
                    >
                      Log In
                    </Button>
                  </Alert>
                )}

                {/* Email Mismatch Check */}
                {userId && userEmail && userEmail !== invitation.email && (
                  <Alert severity="warning">
                    <Typography variant="body2">
                      You are logged in as <strong>{userEmail}</strong>, but this invitation was sent to <strong>{invitation.email}</strong>. 
                      Please log in with the correct email to accept this invitation.
                    </Typography>
                  </Alert>
                )}
              </Stack>
            )}

            {/* Action Buttons */}
            {invitation && !success && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleDecline}
                  disabled={accepting}
                >
                  Decline
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleAccept}
                  disabled={accepting || !userId || (userEmail !== invitation.email)}
                  startIcon={accepting ? <CircularProgress size={20} /> : <TickCircle />}
                >
                  {accepting ? 'Accepting...' : 'Accept Invitation'}
                </Button>
              </Stack>
            )}

            {/* Error State Actions */}
            {error && !invitation && (
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

