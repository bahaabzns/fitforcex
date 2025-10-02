'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { setWorkspace as setWorkspaceStore } from '@/store/slices/workspaceSlice';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import HeroWorkspace from '@/sections/landing/HeroWorkspace';
import FeaturesWorkspace from '@/sections/landing/FeaturesWorkspace';
import TestimonialsWorkspace from '@/sections/landing/TestimonialsWorkspace';
import { APP_CONFIG } from '@/lib/config';
import Loader from 'components/Loader';
import api from '@/utils/axios';

interface WorkspaceData {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  landingConfig?: {
    title?: string;
    subtitle?: string;
    heroImage?: string;
    ctaText?: string;
    ctaUrl?: string;
    allowNewSubscriptions?: boolean;
    features?: Array<{
      title: string;
      description: string;
      icon?: string;
    }>;
    testimonials?: Array<{
      quote: string;
      author: string;
      role: string;
    }>;
  } | null;
  brandingLogoUrl?: string | null;
  brandingPrimaryHex?: string | null;
}

interface WorkspaceLandingProps {
  params: {
    id: string;
  };
}

function WorkspaceLandingContent({ params }: WorkspaceLandingProps) {
  const searchParams = useSearchParams();
  const user = useAppSelector((s) => s.auth.user);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  const workspaceId = params.id; // Get from URL params
  const subdomain = searchParams.get('subdomain');
  const customDomain = searchParams.get('customDomain');

  console.log(`🔍 URL Parameters:`, { workspaceId, subdomain, customDomain });

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'member' | 'guest' | null>(null);
  const [apiLoggedIn, setApiLoggedIn] = useState(false);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!workspaceId) {
      setError('Workspace ID not found');
      setLoading(false);
      return;
    }

    // Fetch the actual workspace data to get the real workspace name and config
    const fetchWorkspaceData = async () => {
      try {
        // Try to get workspace data from the resolve API (no auth required)
        // Use direct fetch to avoid CORS issues with custom headers
        const resolveResponse = await fetch(`${APP_CONFIG.apiUrl}/api/workspaces/resolve?host=${window.location.host}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!resolveResponse.ok) {
          throw new Error(`HTTP error! status: ${resolveResponse.status}`);
        }

        const resolveData = await resolveResponse.json();
        const workspaceData: WorkspaceData = resolveData.workspace;
        console.log(`🔍 Fetched workspace data from resolve API:`, workspaceData);
        console.log(`🔍 Current host: ${window.location.host}`);
        console.log(`🔍 Workspace ID from URL: ${workspaceId}`);
        console.log(`🔍 Workspace ID from API: ${workspaceData.id}`);
        setWorkspace(workspaceData);
        // Persist workspace in store so headers include x-workspace-id for guest flows
        try {
          dispatch(setWorkspaceStore({ id: workspaceData.id, subdomain: workspaceData.subdomain }));
        } catch {}

        // Check user role after workspace data is loaded
        await checkUserRole(workspaceData.subdomain);
      } catch {
        console.log('Could not fetch workspace data, using fallback');
        // Fallback: construct workspace data from URL parameters
        const workspaceData: WorkspaceData = {
          id: workspaceId,
          name: subdomain || 'Workspace',
          subdomain: subdomain || '',
          customDomain: customDomain || undefined,
          landingConfig: null,
          brandingLogoUrl: null,
          brandingPrimaryHex: null
        };
        console.log(`🔍 Using fallback workspace data:`, workspaceData);
        setWorkspace(workspaceData);
        try {
          dispatch(setWorkspaceStore({ id: workspaceData.id, subdomain: workspaceData.subdomain }));
        } catch {}

        // Check user role with fallback data
        await checkUserRole(workspaceData.subdomain);
      }
    };

    fetchWorkspaceData();

    // Verify global auth via API (handles cross-domain session). Treat 200/304 as logged-in
    const verifyLogin = async () => {
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store'
        });
        if (res.status === 200 || res.status === 304) {
          setApiLoggedIn(true);
        }
      } catch {}
    };
    void verifyLogin();

    // Check user role if logged in (this will be called after workspace data is loaded)
    const checkUserRole = async (workspaceSubdomain: string) => {
      if (isAuthenticated && user) {
        try {
          const roleResponse = await api.get(`/api/workspaces/by-subdomain/${workspaceSubdomain}`);
          if (roleResponse.data.isOwner) {
            setUserRole('owner');
          } else {
            setUserRole('member');
          }
        } catch {
          console.log('Could not determine user role (user might not be a member), defaulting to guest');
          setUserRole('guest');
        }
      } else {
        console.log('User not logged in, defaulting to guest');
        setUserRole('guest');
      }
      setLoading(false);
    };

    // We'll call checkUserRole after workspace data is loaded
  }, [workspaceId, subdomain, customDomain, isAuthenticated, user]);

  if (loading) {
    return <Loader />;
  }

  if (error || !workspace) {
    return (
      <Container sx={{ py: 6, textAlign: 'center' }}>
        <Card sx={{ maxWidth: 400, mx: 'auto' }}>
          <CardHeader>
            <Typography variant="h5" color="error">
              Workspace Not Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The workspace you're looking for doesn't exist or has been removed.
            </Typography>
          </CardHeader>
          <CardContent>
            <Button variant="contained" href="/">
              Go to FitForce
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const config = workspace.landingConfig || {};
  const primaryColor = workspace.brandingPrimaryHex || '#3b82f6';
  const hasCustomLanding = config.title || config.subtitle || config.features || config.testimonials;
  const allowNewSubscriptions = config.allowNewSubscriptions !== false; // default true

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {workspace.brandingLogoUrl ? (
                <img src={workspace.brandingLogoUrl} alt={`${workspace.name} logo`} style={{ width: 32, height: 32, borderRadius: 8 }} />
              ) : (
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: primaryColor
                  }}
                >
                  <Typography sx={{ color: 'white', fontSize: 16 }}>🏋️</Typography>
                </Box>
              )}
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {workspace.name}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {apiLoggedIn ? (
                <Button variant="outlined" size="small" href="/dashboard">
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  {userRole === 'owner' && (
                    <Button variant="outlined" size="small" href="/dashboard/workspace">
                      Dashboard
                    </Button>
                  )}
                  {userRole === 'member' && (
                    <Button variant="outlined" size="small" href="/dashboard">
                      Go to Workspace
                    </Button>
                  )}
                  {userRole === 'guest' && (
                    <Button variant="outlined" size="small" href="/login">
                      Sign In
                    </Button>
                  )}
                </>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      <Box sx={{ flex: 1 }}>
        <HeroWorkspace
          title={config.title || workspace.name}
          subtitle={config.subtitle || 'Welcome to our fitness community. Join us on your fitness journey!'}
          primaryColor={primaryColor}
          ctaText={config.ctaText}
          ctaUrl={config.ctaUrl}
          heroImage={config.heroImage}
          roleButtons={
            <>
              {(userRole === 'owner' || userRole === 'member' || apiLoggedIn) && (
                <Button variant="contained" size="large" href="/dashboard">
                  Go to Dashboard
                </Button>
              )}
              {userRole === 'guest' && !apiLoggedIn && allowNewSubscriptions && (
                <Button variant="contained" size="large" href="/client/signup">
                  Subscribe
                </Button>
              )}
              {userRole === 'guest' && !apiLoggedIn && (
                <Button variant="outlined" size="large" href="/client-login">
                  Client Sign In
                </Button>
              )}
            </>
          }
        />

        {/* Features Section - Only show if workspace has custom landing config */}
        {hasCustomLanding && config.features && config.features.length > 0 && (
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2 }}>
                What We Offer
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
                Comprehensive fitness solutions tailored to your goals.
              </Typography>
            </Box>
            <FeaturesWorkspace features={config.features} primaryColor={primaryColor} />
          </Container>
        )}

        {/* Testimonials Section - Only show if workspace has custom landing config */}
        {hasCustomLanding && config.testimonials && config.testimonials.length > 0 && (
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2 }}>
                What Our Clients Say
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
                Real stories from real people achieving their fitness goals.
              </Typography>
            </Box>
            <TestimonialsWorkspace testimonials={config.testimonials} primaryColor={primaryColor} />
          </Container>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', py: 4 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 2 }}>
              {workspace.brandingLogoUrl ? (
                <img src={workspace.brandingLogoUrl} alt={`${workspace.name} logo`} style={{ width: 32, height: 32, borderRadius: 8 }} />
              ) : (
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: primaryColor
                  }}
                >
                  <Typography sx={{ color: 'white', fontSize: 16 }}>🏋️</Typography>
                </Box>
              )}
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {workspace.name}
              </Typography>
            </Box>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Powered by FitForce - Empowering fitness professionals worldwide.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} {workspace.name}. All rights reserved.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

export default function WorkspaceLanding({ params }: WorkspaceLandingProps) {
  return (
    <Suspense fallback={<Loader />}>
      <WorkspaceLandingContent params={params} />
    </Suspense>
  );
}
