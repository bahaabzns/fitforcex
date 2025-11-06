'use client';

// material-ui
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

// project-imports
import Hero from 'sections/landing/Hero';
import ProblemSolution from 'sections/landing/ProblemSolution';
import WhyFitForceWins from 'sections/landing/WhyFitForceWins';
import PricingPlans from 'sections/landing/PricingPlans';
import FinalCTA from 'sections/landing/FinalCTA';
import VideoShowcase from 'sections/landing/VideoShowcase';
import Subscribe from 'sections/landing/Subscribe';
import SimpleLayout from 'layout/SimpleLayout';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useRef } from 'react';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import Loader from 'components/Loader';
import { APP_CONFIG } from '@/lib/config';
import dynamic from 'next/dynamic';
import useConfig from '@/hooks/useConfig';
import { ThemeDirection } from 'config';
import localFont from 'next/font/local';
const alexandria = localFont({
  src: '../../public/assets/fonts/Alexandria,Baloo_Bhaijaan_2,Changa/Alexandria/Alexandria-VariableFont_wght.ttf',
  display: 'swap'
});
import { track } from '@/lib/pixel';

// Using local Alexandria font for Arabic

// Dynamically import WorkspaceLanding to avoid circular dependencies
const WorkspaceLandingContent = dynamic(
  () => import('./landing/workspace/[id]/page').then(mod => mod.WorkspaceLandingContentExport),
  { loading: () => <Loader />, ssr: false }
);

// ==============================|| LANDING PAGE ||============================== //

export default function Landing() {
  const searchParams = useSearchParams();
  const { i18n, onChangeLocalization, onChangeDirection } = useConfig();
  const [showError, setShowError] = useState(false);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [isCheckingWorkspace, setIsCheckingWorkspace] = useState(true);
  const [workspaceData, setWorkspaceData] = useState<{ id: string; subdomain: string } | null>(null);
  // Fetch book-demo and support overrides (must be declared before any early returns)
  const [bookDemo, setBookDemo] = useState<{ title?: string; subtitle?: string } | null>(null);
  const [support, setSupport] = useState<{ title?: string; subtitle?: string } | null>(null);
  const [landingVideoUrl, setLandingVideoUrl] = useState<string | null>(null);
  const landingVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoSectionRef = useRef<HTMLDivElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [inView, setInView] = useState(false);
  const [videoHeight, setVideoHeight] = useState<number | null>(null);

  useEffect(() => {
    // Ensure Arabic is the default for landing and set RTL direction
    if (i18n !== 'ar') {
      onChangeLocalization('ar');
      onChangeDirection(ThemeDirection.RTL);
    } else {
      onChangeDirection(ThemeDirection.RTL);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const checkWorkspace = async () => {
      // Check if we're on a workspace subdomain by reading the cookies set by middleware
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };

      const workspaceId = getCookie('ff_workspace_id');
      const workspaceSubdomain = getCookie('ff_workspace_subdomain');
      
      // Also check the hostname directly as a fallback
      const host = window.location.host;
      const parts = host.split('.');
      const isLocalhost = host.includes('localhost');
      const isMainDomain = isLocalhost 
        ? host === 'localhost:3000' || host === 'localhost'
        : host === APP_CONFIG.frontendDomain || host === `app.${APP_CONFIG.frontendDomain}`;

      console.log('🔍 Main landing page - Workspace check:', { 
        host, 
        parts,
        isMainDomain,
        workspaceId, 
        workspaceSubdomain 
      });

      // Only show workspace landing if we're actually on a workspace subdomain
      // The main domain should NEVER show workspace content, even if cookies exist
      if (workspaceId && workspaceSubdomain && !isMainDomain) {
        console.log('✅ Workspace detected from cookies on subdomain, showing workspace landing page');
        setWorkspaceData({ id: workspaceId, subdomain: workspaceSubdomain });
        setIsCheckingWorkspace(false);
        return;
      }
      
      // If we're on main domain but have workspace cookies, clear them and show main landing
      if (workspaceId && workspaceSubdomain && isMainDomain) {
        console.log('🧹 Main domain detected with stale workspace cookies, clearing them and showing main landing');
        // Clear workspace cookies on main domain
        document.cookie = `ff_workspace_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = `ff_workspace_subdomain=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        
        // Also clear cookies with domain attribute to be extra sure
        if (!isLocalhost) {
          document.cookie = `ff_workspace_id=; path=/; domain=.${APP_CONFIG.frontendDomain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `ff_workspace_subdomain=; path=/; domain=.${APP_CONFIG.frontendDomain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
        
        setIsCheckingWorkspace(false);
        return;
      }
      
      // If we're on a subdomain but no cookies (middleware might have failed), check directly
      if (!isMainDomain) {
        const subdomain = parts[0];
        console.log(`🔍 On subdomain ${subdomain} but no cookies, checking API directly...`);
        
        try {
          const apiUrl = `${APP_CONFIG.apiUrl}/api/workspaces/resolve?host=${host}`;
          console.log(`🔗 Fetching from: ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            cache: 'no-store'
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Workspace found via direct API check:', data.workspace);
            setWorkspaceData({ id: data.workspace.id, subdomain: data.workspace.subdomain });
            setIsCheckingWorkspace(false);
            return;
          } else {
            console.log('❌ Workspace not found, will redirect to main domain');
            // Redirect to main domain with error - use APP_CONFIG
            const protocol = window.location.protocol;
            const mainUrl = `${protocol}//${APP_CONFIG.frontendDomain}`;
            window.location.replace(`${mainUrl}/?error=workspace_not_found&workspace=${subdomain}`);
            return;
          }
        } catch (error) {
          console.error('Error checking workspace:', error);
          // Fall through to show main landing
        }
      }

      // No workspace context, show main landing page
      setIsCheckingWorkspace(false);

      // Check for error messages
      const error = searchParams.get('error');
      const workspace = searchParams.get('workspace');
      
      if (error === 'workspace_not_found' || error === 'workspace_error') {
        setShowError(true);
        setErrorType(error);
        setWorkspaceName(workspace);
        
        // Auto-hide after 10 seconds
        const timer = setTimeout(() => {
          setShowError(false);
        }, 10000);
        
        return () => clearTimeout(timer);
      }
    };

    checkWorkspace();
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const resp = await fetch(`${APP_CONFIG.apiUrl}/api/meta/landing-config`, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        const lang = (i18n as string) || 'en';
        const tr = data?.landing?.translations?.[lang];
        const sections = tr?.sections || {};
        if (!isMounted) return;
        setBookDemo(sections.bookDemo || null);
        setSupport(sections.support || null);
        const candidate = data?.landing?.videoUrl
          || tr?.video?.videoUrl
          || sections?.video?.videoUrl
          || tr?.video?.url
          || sections?.video?.url
          || null;
        setLandingVideoUrl(candidate);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [i18n]);

  useEffect(() => {
    const locale = (i18n as string) || (typeof navigator !== 'undefined' ? navigator.language : 'en');
    const eventId = `pv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    track('PageView', { page_type: 'landing', locale, event_id: eventId });
  }, [i18n]);

  // Autoplay when section is in view (first time), keep playing when out of view
  useEffect(() => {
    const sectionEl = videoSectionRef.current;
    if (!sectionEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting;
          setInView(visible);
          if (visible) {
            setHasStarted(true);
            landingVideoRef.current?.play().catch(() => {});
          }
        });
      },
      { threshold: 0.5 }
    );
    observer.observe(sectionEl);
    return () => observer.disconnect();
  }, []);

  // Measure and preserve section height when mini-player is active
  useEffect(() => {
    const measure = () => {
      const node = videoContainerRef.current;
      if (!node) return;
      const h = node.offsetHeight;
      if (h && h !== videoHeight) setVideoHeight(h);
    };
    measure();
    window.addEventListener('resize', measure);
    const t = setTimeout(measure, 300);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(t);
    };
  }, [videoHeight]);

  // No entrance animation (removed)

  // Show loader while checking workspace context
  if (isCheckingWorkspace) {
    return <Loader />;
  }

  // If we have workspace data, show workspace landing
  if (workspaceData) {
    return (
      <Suspense fallback={<Loader />}>
        <WorkspaceLandingContent params={{ id: workspaceData.id }} />
      </Suspense>
    );
  }

  return (
    <SimpleLayout>
      <Box className={i18n === 'ar' ? alexandria.className : undefined}>
      {/* Error Alert for Non-existent Workspace */}
      {showError && (
        <Box sx={{ position: 'sticky', top: 0, zIndex: 1200, width: '100%' }}>
          <Alert 
            severity="error" 
            onClose={() => setShowError(false)}
            sx={{ 
              borderRadius: 0,
              '& .MuiAlert-message': { width: '100%' }
            }}
          >
            <AlertTitle sx={{ fontWeight: 700 }}>Workspace Not Found</AlertTitle>
            {workspaceName ? (
              <>
                The workspace <strong>"{workspaceName}"</strong> doesn't exist or has been removed.
              </>
            ) : (
              <>
                The workspace you tried to access doesn't exist or has been removed.
              </>
            )}
            {errorType === 'workspace_error' && (
              <> There was also an error connecting to the server.</>
            )}
          </Alert>
        </Box>
      )}
      <Hero />
      {/* Landing video section with mini-player when scrolled away */}
      <Box sx={{ py: { xs: 4, md: 6 } }} ref={videoSectionRef}>
        <Container>
          {/* Wrapper keeps layout height stable when video container becomes fixed */}
          <Box sx={{ height: (hasStarted && !inView && videoHeight) ? `${videoHeight}px` : 'auto' }}>
            <Box
            sx={{
                position: (hasStarted && !inView) ? 'fixed' : 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                right: (hasStarted && !inView) ? 16 : 'auto',
                bottom: (hasStarted && !inView) ? 16 : 'auto',
                zIndex: (hasStarted && !inView) ? 1300 : 'auto',
                width: (hasStarted && !inView) ? { xs: 220, sm: 280, md: 320 } as any : 'auto'
              }}
              ref={videoContainerRef}
              onMouseEnter={() => setIsHoveringVideo(true)}
              onMouseLeave={() => setIsHoveringVideo(false)}
            >
              <video
                ref={landingVideoRef}
                preload="metadata"
                muted
                playsInline
                controls={false}
                controlsList="nodownload noplaybackrate noremoteplayback"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                key={landingVideoUrl || 'fallback-video'}
                src={landingVideoUrl || 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/global/landing/1762436014326-vid.mp4'}
              />

              {/* Hover overlay controls */}
              <Box
                sx={{
                  pointerEvents: isHoveringVideo ? 'auto' : 'none',
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isHoveringVideo ? 'rgba(0,0,0,0.15)' : 'transparent',
                  transition: 'background-color 200ms ease'
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ opacity: isHoveringVideo ? 1 : 0, transition: 'opacity 200ms ease' }}>
                  <IconButton
                    aria-label="Back 10 seconds"
                    onClick={() => {
                      const v = landingVideoRef.current; if (!v) return;
                      v.currentTime = Math.max(0, v.currentTime - 10);
                    }}
                    sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
                  >
                    <Replay10Icon />
                  </IconButton>
                  <IconButton
                    aria-label="Play/Pause"
                    onClick={() => {
                      const v = landingVideoRef.current; if (!v) return;
                      if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
                    }}
                    sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }, width: 64, height: 64 }}
                  >
                    {landingVideoRef.current && !landingVideoRef.current.paused ? <PauseIcon /> : <PlayArrowIcon />}
                  </IconButton>
                  <IconButton
                    aria-label="Forward 10 seconds"
                    onClick={() => {
                      const v = landingVideoRef.current; if (!v) return;
                      v.currentTime = Math.min(v.duration || v.currentTime + 10, v.currentTime + 10);
                    }}
                    sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
                  >
                    <Forward10Icon />
                  </IconButton>
                  {(hasStarted && !inView) && (
                    <IconButton
                      aria-label="Back to section"
                      onClick={() => {
                        videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
                    >
                      <PlayArrowIcon />
                    </IconButton>
                  )}
                </Stack>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
      <VideoShowcase />
      <Box id="problem-solution">
        <ProblemSolution />
      </Box>
      <Box id="why-fitforce">
        <WhyFitForceWins />
      </Box>
      <Box id="pricing">
        <PricingPlans />
      </Box>
      {/* Book Demo Section */}
      <Box id="book-demo" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default' }}>
        <Container>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 2 }}>
              {bookDemo?.title || 'Book Your Demo'}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              {bookDemo?.subtitle || 'See how FitForce can transform your coaching business. Schedule a personalized demo with our team.'}
            </Typography>
          </Box>
          
          {/* Calendly iframe */}
          <Box 
            sx={{ 
              height: 800, 
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}
          >
            <iframe
              src="https://zcal.co/i/JprJ400Q"
              width="100%"
              height="100%"
              frameBorder="0"
              title="Book a Demo - FitForce"
              style={{
                border: 'none',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
              scrolling="no"
            />
          </Box>
        </Container>
      </Box>
      <FinalCTA />
      {/* Support Section override */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default' }}>
        <Container>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 2 }}>
              {support?.title || 'Need Support?'}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
              {support?.subtitle || "Have questions? Our expert support team is ready to help. Submit a ticket, and we'll assist you promptly."}
            </Typography>
          </Box>
        </Container>
      </Box>
      <Subscribe />
      <Divider sx={{ borderColor: 'secondary.light' }} />
      </Box>
    </SimpleLayout>
  );
}