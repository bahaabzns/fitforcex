// App public landing page (themed)
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import StarIcon from '@mui/icons-material/StarOutline';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import GroupsIcon from '@mui/icons-material/Groups';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/lib/config';
import useUser from '@/hooks/useUser';
import { useAppSelector } from '@/store';

type AdminWorkspacePackage = {
  id: string;
  name: string;
  description?: string | null;
  durationMonths: number;
  priceCents: number;
  currency: string;
  features?: Record<string, unknown> | null;
  isActive: boolean;
};

export default function Landing() {
  const [packages, setPackages] = useState<AdminWorkspacePackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const user = useUser();
  const reduxIsAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const [apiLoggedIn, setApiLoggedIn] = useState(false);
  const [clientLoggedIn, setClientLoggedIn] = useState(false);
  const [userType, setUserType] = useState<'team_member' | 'client' | null>(null);

  useEffect(() => {
    const loadPackages = async () => {
      try {
        setLoadingPackages(true);
        const url = `${APP_CONFIG.apiUrl}/api/workspace-packages`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const active = (data.packages || []).filter((p: AdminWorkspacePackage) => p.isActive);
        setPackages(active);
      } catch {
        // ignore
      } finally {
        setLoadingPackages(false);
      }
    };
    loadPackages();
  }, []);

  // Verify authentication via API (cross-domain). Treat 200 or 304 as authenticated.
  useEffect(() => {
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
            console.log('🔍 Main landing - User type from API:', data.user.userType);
            
            // Set client logged in status based on user type
            if (data.user.userType === 'client') {
              setClientLoggedIn(true);
              console.log('✅ Main landing - Client authentication confirmed via API');
            }
          }
        }
      } catch {
        // ignore
      }
    };
    verifyLogin();
  }, []);

  return (
    <>
      {/* Hero */}
      <Container sx={{ py: { xs: 8, md: 12 } }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Stack sx={{ gap: 2 }}>
              <Typography variant="overline" color="primary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
                All-in-one fitness platform
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                Grow your coaching business with FitForce
              </Typography>
              <Typography variant="h6" color="text.secondary">
                Manage clients, programs, workouts and nutrition in one modern, customizable workspace.
        </Typography>
              <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
              {/* Client Dashboard Button - Show if user is a client */}
              {userType === 'client' ? (
                <Button component={Link} href="/client/dashboard" size="large" variant="contained">
                  Go to Client Dashboard
                </Button>
              ) : /* Workspace Dashboard Button - Show if user is a team member */
              (user || reduxIsAuthenticated || apiLoggedIn) ? (
                <Button component={Link} href="/dashboard" size="large" variant="contained">
                  Go to Dashboard
                </Button>
              ) : /* Sign up/Login buttons - Show if not logged in */
              (
                <>
                  <Button component={Link} href="/register" size="large" variant="contained">
                    Get Started
                  </Button>
                  <Button component={Link} href="/login" size="large" variant="outlined">
                    Sign In
                  </Button>
                </>
              )}
              </Stack>
              <Stack direction="row" spacing={2} sx={{ pt: 2, color: 'text.secondary' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckIcon fontSize="small" color="success" />
                  <Typography variant="body2">No credit card required</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StarIcon fontSize="small" color="warning" />
                  <Typography variant="body2">Free tier available</Typography>
                </Stack>
              </Stack>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="FitForce preview"
                src="/assets/images/landing/dashboard-preview.png"
                style={{ width: '100%', borderRadius: 12 }}
              />
            </Paper>
          </Grid>
        </Grid>
      </Container>

      <Divider sx={{ borderColor: 'secondary.light' }} />

      {/* Features */}
      <Container sx={{ py: { xs: 8, md: 10 } }}>
        <Stack sx={{ gap: 2, textAlign: 'center', mb: 6 }}>
          <Typography variant="overline" color="primary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
            What you get
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>Powerful features for coaches</Typography>
          <Typography variant="h6" color="text.secondary">Everything you need to deliver results and scale your business.</Typography>
        </Stack>
        <Grid container spacing={3}>
          {[{
            icon: <FitnessCenterIcon color="primary" />, title: 'Workout Builder', desc: 'Create, schedule and track workouts with progress and media.'
          },{
            icon: <RestaurantIcon color="primary" />, title: 'Nutrition Plans', desc: 'Plan meals and macros with templates and client feedback.'
          },{
            icon: <GroupsIcon color="primary" />, title: 'Client Management', desc: 'Manage onboarding, messaging and packages in one place.'
          }].map((f, i) => (
            <Grid item xs={12} md={4} key={i}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3 }}>
                <Stack sx={{ gap: 1.5 }}>
                  <Box sx={{ fontSize: 0 }}>{f.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{f.title}</Typography>
                  <Typography color="text.secondary">{f.desc}</Typography>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Divider sx={{ borderColor: 'secondary.light' }} />

      {/* Pricing / Packages */}
      <Container sx={{ py: { xs: 8, md: 10 } }}>
        <Stack sx={{ gap: 2, textAlign: 'center', mb: 6 }}>
          <Typography variant="overline" color="primary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
            Pricing
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>Plans for every stage</Typography>
          <Typography variant="h6" color="text.secondary">Choose a plan to manage your workspace. Billed per workspace.</Typography>
        </Stack>

        {loadingPackages && (
          <Typography align="center" color="text.secondary">Loading packages…</Typography>
        )}

        {!loadingPackages && packages.length === 0 && (
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack sx={{ gap: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>Simple pricing that grows with you</Typography>
                <Typography variant="h6" color="text.secondary">
                  Start for free, upgrade when you are ready. Cancel anytime.
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Stack sx={{ gap: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>Pro</Typography>
                    <Typography variant="h3" color="primary" sx={{ fontWeight: 800 }}>$29<span style={{ fontSize: 16 }}>/mo</span></Typography>
                  </Stack>
                  <Stack sx={{ gap: 1, color: 'text.secondary' }}>
                    <Typography variant="body2">Unlimited clients</Typography>
                    <Typography variant="body2">Custom branding</Typography>
                    <Typography variant="body2">Priority support</Typography>
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <Button component={Link} href="/pricing" variant="outlined" color="primary">View Pricing</Button>
                    <Button component={Link} href="/register" variant="contained" color="primary">Start Free</Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        )}

        {!loadingPackages && packages.length > 0 && (
          <Grid container spacing={3}>
            {packages.map((pkg) => {
              const price = (pkg.priceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
              return (
                <Grid item xs={12} md={4} key={pkg.id}>
                  <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                    <Stack sx={{ gap: 2, height: '100%' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>{pkg.name}</Typography>
                        <Typography variant="h4" color="primary" sx={{ fontWeight: 800 }}>
                          {price} <span style={{ fontSize: 14 }}>{pkg.currency}</span>
                        </Typography>
                      </Stack>
                      {pkg.description && (
                        <Typography color="text.secondary">{pkg.description}</Typography>
                      )}
                      <Box sx={{ flexGrow: 1 }} />
                      <Button component={Link} href="/register" variant="contained" color="primary">Choose Plan</Button>
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>

      <Divider sx={{ borderColor: 'secondary.light' }} />

      {/* Testimonials */}
      <Container sx={{ py: { xs: 8, md: 10 } }}>
        <Stack sx={{ gap: 2, textAlign: 'center', mb: 6 }}>
          <Typography variant="overline" color="primary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
            Loved by coaches
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>What our users say</Typography>
      </Stack>
        <Grid container spacing={3}>
          {[
            { quote: 'FitForce streamlined my entire workflow and boosted client retention.', author: 'Jordan, Online Coach' },
            { quote: 'Creating programs is fast and my clients love the experience.', author: 'Avery, Trainer' },
            { quote: 'The best platform I have used to manage clients and plans.', author: 'Kai, Nutritionist' }
          ].map((t, i) => (
            <Grid item xs={12} md={4} key={i}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3 }}>
                <Typography variant="body1" sx={{ mb: 1 }}>“{t.quote}”</Typography>
                <Typography variant="body2" color="text.secondary">{t.author}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
    </Container>
    </>
  );
}
