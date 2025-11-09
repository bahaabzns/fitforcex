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
import LanguageSwitcher from '@/components/customization/LanguageSwitcher';
import ThemeToggle from '@/layout/DashboardLayout/Header/HeaderContent/ThemeToggle';
import FullScreen from '@/layout/DashboardLayout/Header/HeaderContent/FullScreen';

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
  const [clientLoggedIn, setClientLoggedIn] = useState(false);
  const [userType, setUserType] = useState<'team_member' | 'client' | null>(null);
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
          const data = await res.json();
          setApiLoggedIn(true);
          
          // Set user type from API response
          if (data.user?.userType) {
            setUserType(data.user.userType);
            console.log('🔍 User type from API:', data.user.userType);
            
            // Set client logged in status based on user type
            if (data.user.userType === 'client') {
              setClientLoggedIn(true);
              console.log('✅ Client authentication confirmed via API');
            }
          }
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
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider', 
        bgcolor: 'background.paper',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {workspace.brandingLogoUrl ? (
                <img src={workspace.brandingLogoUrl} alt={`${workspace.name} logo`} style={{ width: 40, height: 40, borderRadius: 10 }} />
              ) : (
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: primaryColor,
                    boxShadow: `0 4px 12px ${primaryColor}30`
                  }}
                >
                  <Typography sx={{ color: 'white', fontSize: 20 }}>🏋️</Typography>
                </Box>
              )}
              <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
                {workspace.name}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LanguageSwitcher />
              <ThemeToggle />
              <FullScreen />
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
              {/* Debug info */}
              {console.log('🔍 Button render state:', { 
                userRole, 
                apiLoggedIn, 
                clientLoggedIn,
                userType,
                isAuthenticated,
                user: !!user
              })}
              
              {/* Client Dashboard Button - Show if user is a client */}
              {userType === 'client' && (
                <Button variant="contained" size="large" href="/client/dashboard">
                  Go to Client Dashboard
                </Button>
              )}
              {/* Workspace Dashboard Button - Show if user is a team member */}
              {userType === 'team_member' && (userRole === 'owner' || userRole === 'member' || apiLoggedIn) && (
                <Button variant="contained" size="large" href="/dashboard">
                  Go to Dashboard
                </Button>
              )}
              {/* Subscribe Button - Show if guest and subscriptions allowed */}
              {userRole === 'guest' && !apiLoggedIn && allowNewSubscriptions && (
                <Button variant="contained" size="large" href="/client/signup">
                  Subscribe
                </Button>
              )}
              {/* Client Login Button - Show if guest and not logged in */}
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
            <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
              <Typography 
                variant="h2" 
                sx={{ 
                  fontWeight: 900, 
                  mb: 3,
                  fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                  color: 'text.primary'
                }}
              >
                What We Offer
              </Typography>
              <Typography 
                variant="h5" 
                color="text.secondary" 
                sx={{ 
                  maxWidth: 700, 
                  mx: 'auto',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                  lineHeight: 1.6
                }}
              >
                Comprehensive fitness solutions tailored to your goals.
              </Typography>
            </Box>
            <FeaturesWorkspace features={config.features} primaryColor={primaryColor} />
          </Container>
        )}

        {/* Testimonials Section - Only show if workspace has custom landing config */}
        {hasCustomLanding && config.testimonials && config.testimonials.length > 0 && (
          <Container maxWidth="lg">
            <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 10 } }}>
              <Typography 
                variant="h2" 
                sx={{ 
                  fontWeight: 900, 
                  mb: 3,
                  fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                  color: 'text.primary'
                }}
              >
                What Our Clients Say
              </Typography>
              <Typography 
                variant="h5" 
                color="text.secondary" 
                sx={{ 
                  maxWidth: 700, 
                  mx: 'auto',
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                  lineHeight: 1.6
                }}
              >
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

// Export the content component for direct use
export { WorkspaceLandingContent as WorkspaceLandingContentExport };
