'use client';

import { useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import { APP_CONFIG } from '@/lib/config';

type ResolvedWorkspace = {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  brandingLogoUrl?: string | null;
  landingConfig?: {
    title?: string;
    subtitle?: string;
    heroImage?: string;
    ctaText?: string;
    ctaUrl?: string;
    allowNewSubscriptions?: boolean;
    features?: { icon?: string; title?: string; description?: string }[];
    testimonials?: { author?: string; role?: string; quote?: string }[];
  } | null;
};

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [ws, setWs] = useState<ResolvedWorkspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const host = typeof window !== 'undefined' ? window.location.host : '';
        const url = new URL('/api/workspaces/resolve', APP_CONFIG.apiUrl);
        url.searchParams.set('host', host);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setWs(data.workspace);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspace();
  }, [id]);

  if (loading) {
    return (
      <Container sx={{ py: 6 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading workspace…</Typography>
        </Stack>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 6 }}>
      <Stack sx={{ gap: 6 }}>
        {/* Header / Branding */}
        <Stack sx={{ gap: 2, alignItems: 'center', textAlign: 'center' }}>
          {ws?.brandingLogoUrl && (
            <Box>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ws.brandingLogoUrl} alt={ws?.name || 'Logo'} style={{ maxHeight: 80 }} />
            </Box>
          )}
          <Typography variant="h3">{ws?.landingConfig?.title || ws?.name || 'Welcome'}</Typography>
          {ws?.landingConfig?.subtitle && (
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 900 }}>
              {ws.landingConfig.subtitle}
            </Typography>
          )}
          {ws?.landingConfig?.ctaText && (
            <Button
              variant="contained"
              color="primary"
              href={ws.landingConfig.ctaUrl || '#'}
              target={ws.landingConfig.ctaUrl?.startsWith('http') ? '_blank' : undefined}
            >
              {ws.landingConfig.ctaText}
            </Button>
          )}
        </Stack>

        {/* Hero Image */}
        {ws?.landingConfig?.heroImage && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ws.landingConfig.heroImage} alt={ws?.name || 'Hero'} style={{ width: '100%', maxWidth: 1200, borderRadius: 16 }} />
          </Box>
        )}

        {/* Features */}
        {!!ws?.landingConfig?.features?.length && (
          <Box>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Features
            </Typography>
            <Grid container spacing={3}>
              {ws.landingConfig.features!.map((f, idx) => (
                <Grid key={idx} size={{ xs: 12, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Stack sx={{ gap: 1 }}>
                        <Typography variant="h6">{f.title}</Typography>
                        {f.description && (
                          <Typography variant="body2" color="text.secondary">
                            {f.description}
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Testimonials */}
        {!!ws?.landingConfig?.testimonials?.length && (
          <Box>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Testimonials
            </Typography>
            <Grid container spacing={3}>
              {ws.landingConfig.testimonials!.map((t, idx) => (
                <Grid key={idx} size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Stack sx={{ gap: 1 }}>
                        {t.quote && <Typography variant="body1">"{t.quote}"</Typography>}
                        <Typography variant="body2" color="text.secondary">
                          {t.author}
                          {t.role ? ` — ${t.role}` : ''}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Subscription CTA */}
        {ws?.landingConfig?.allowNewSubscriptions === true && (
          <Stack alignItems="center">
            <Button variant="outlined" color="primary" href="/pricing">
              Subscribe Now
            </Button>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
