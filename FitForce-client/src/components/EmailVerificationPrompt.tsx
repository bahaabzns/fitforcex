'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Alert,
  IconButton,
  Slide,
  Collapse,
} from '@mui/material';
import { Email, Close, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import api from '@/utils/axios';
import EmailVerificationFlow from './EmailVerificationFlow';

interface EmailVerificationPromptProps {
  email: string;
  emailVerified: boolean;
}

export default function EmailVerificationPrompt({
  email,
  emailVerified,
}: EmailVerificationPromptProps) {
  const router = useRouter();
  const [showVerification, setShowVerification] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('[EmailVerificationPrompt] Component state:', {
      email,
      emailVerified,
      dismissed,
      willShow: !emailVerified && !dismissed
    });
  }, [email, emailVerified, dismissed]);

  // Check localStorage for dismissed state
  useEffect(() => {
    if (typeof window !== 'undefined' && email) {
      const dismissedState = localStorage.getItem(`emailVerificationDismissed_${email}`);
      if (dismissedState === 'true') {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    }
  }, [email]);

  // Don't show if verified or dismissed
  if (emailVerified || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`emailVerificationDismissed_${email}`, 'true');
    }
  };

  const handleVerify = () => {
    setShowVerification(true);
  };

  const handleVerified = () => {
    setShowVerification(false);
    router.refresh(); // Refresh to update verification status
  };

  return (
    <>
      <Slide direction="down" in={!dismissed} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1300,
            pointerEvents: 'none',
          }}
        >
          <Alert
            severity="warning"
            icon={<Email />}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton
                  aria-label="expand"
                  size="small"
                  onClick={() => setExpanded(!expanded)}
                  sx={{ pointerEvents: 'auto' }}
                >
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
                <IconButton
                  aria-label="close"
                  size="small"
                  onClick={handleDismiss}
                  sx={{ pointerEvents: 'auto' }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            }
            sx={{
              borderRadius: 0,
              pointerEvents: 'auto',
              '& .MuiAlert-action': {
                alignItems: 'center',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1 }}>
                <strong>Activate your account now</strong>
                <Collapse in={expanded}>
                  <Box sx={{ mt: 1, fontSize: '0.875rem' }}>
                    Please verify your email address to activate your account and access all features.
                    We sent you a verification code at <strong>{email}</strong>.
                  </Box>
                </Collapse>
              </Box>
              <Button
                variant="contained"
                size="small"
                onClick={handleVerify}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Verify Email
              </Button>
            </Box>
          </Alert>
        </Box>
      </Slide>

      {/* Floating button alternative (shows if top alert is dismissed) */}
      {dismissed && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
          }}
        >
          <Button
            variant="contained"
            color="warning"
            startIcon={<Email />}
            onClick={handleVerify}
            sx={{
              borderRadius: 2,
              boxShadow: 3,
              px: 3,
              py: 1.5,
            }}
          >
            Activate Your Account
          </Button>
        </Box>
      )}

      <EmailVerificationFlow
        open={showVerification}
        email={email}
        onSkip={() => setShowVerification(false)}
        onVerified={handleVerified}
      />
    </>
  );
}

