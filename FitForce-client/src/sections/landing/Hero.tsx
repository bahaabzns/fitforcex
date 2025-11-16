'use client';

// next
import Link from 'next/link';

// material-ui
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project-imports
import AnimateButton from 'components/@extended/AnimateButton';

// third-party
import { motion } from 'framer-motion';
import useTranslation from '@/utils/useTranslation';
import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/lib/config';
import useConfig from '@/hooks/useConfig';

// ==============================|| LANDING - HERO PAGE ||============================== //

export default function HeroPage() {
  const { t } = useTranslation();
  const { i18n } = useConfig();
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [ctaText, setCtaText] = useState<string | null>(null);
  const [ctaUrl, setCtaUrl] = useState<string | null>(null);
  const [bookDemoText, setBookDemoText] = useState<string | null>(null);
  const [bookDemoUrl, setBookDemoUrl] = useState<string | null>(null);
  const [heroCtaEnabled, setHeroCtaEnabled] = useState<boolean>(true);
  const [heroBookDemoEnabled, setHeroBookDemoEnabled] = useState<boolean>(true);
  const [heroAlignment, setHeroAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [heroSideImage, setHeroSideImage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const resp = await fetch(`${APP_CONFIG.apiUrl}/api/meta/landing-config`, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        const landing = data?.landing;
        if (!landing) return;
        if (!isMounted) return;
        setHeroImage(landing.heroImage || null);
        const lang = (i18n as string) || 'en';
        const content = landing.translations?.[lang] || {};
        setTitle(content.title || null);
        setSubtitle(content.subtitle || null);
        setCtaText(content.ctaText || null);
        setCtaUrl(content.ctaUrl || null);
        setBookDemoText(content.bookDemoText || null);
        setBookDemoUrl(content.bookDemoUrl || null);
        setHeroCtaEnabled(content.heroCtaEnabled !== false);
        setHeroBookDemoEnabled(content.heroBookDemoEnabled !== false);
        setHeroAlignment(content.heroAlignment || 'center');
        setHeroSideImage(content.heroSideImage || null);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [i18n]);

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        position: 'relative', 
        pb: 12.5, 
        pt: 10, 
        display: 'flex', 
        alignItems: 'center',
        backgroundImage: `url(${heroImage || '/assets/hero.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 1
        }
      }}
    >
      <Container sx={{ position: 'relative', zIndex: 2 }}>
        <Grid container spacing={4} sx={{ alignItems: 'center', pt: { md: 0, xs: 10 }, pb: { md: 0, xs: 22 } }}>
          {/* Hero Side Image - Show on right when alignment is left, on left when alignment is right */}
          {heroSideImage && heroAlignment !== 'center' && (
            <Grid size={{ xs: 12, md: 5 }} sx={{ order: { xs: 2, md: heroAlignment === 'left' ? 2 : 1 } }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: heroAlignment === 'left' ? 'flex-start' : 'flex-end',
                  alignItems: 'center',
                  height: '100%'
                }}
              >
                <Box
                  component="img"
                  src={heroSideImage}
                  alt="Hero"
                  sx={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: 2,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                  }}
                />
              </Box>
            </Grid>
          )}
          
          {/* Hero Content */}
          <Grid size={{ xs: 12, md: heroSideImage && heroAlignment !== 'center' ? 7 : (heroAlignment === 'center' ? 9 : 12) }} sx={{ order: { xs: 1, md: heroAlignment === 'left' ? 1 : 2 } }}>
            <Grid container spacing={3} sx={{ textAlign: heroAlignment === 'center' ? 'center' : heroAlignment === 'left' ? 'left' : 'right' }}>
              <Grid size={12}>
                <motion.div
                  initial={{ opacity: 0, y: 550 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 150,
                    damping: 30
                  }}
                >
                  {title ? (
                    <Typography
                      variant="h1"
                      sx={{
                        fontSize: { xs: '1.825rem', sm: '2rem', md: '3.4375rem' },
                        fontWeight: 700,
                        lineHeight: 1.2,
                        color: 'white'
                      }}
                    >
                      {title}
                    </Typography>
                  ) : (
                  <Typography
                    variant="h1"
                    sx={{
                      fontSize: { xs: '1.825rem', sm: '2rem', md: '3.4375rem' },
                      fontWeight: 700,
                      lineHeight: 1.2,
                      color: 'white'
                    }}
                  >
                    {t('landing.hero.title.part1')}{' '}
                    <Typography
                      variant="h1"
                      component="span"
                      sx={{
                        fontSize: 'inherit',
                        background: 'linear-gradient(90deg, rgb(37, 161, 244), rgb(249, 31, 169), rgb(37, 161, 244)) 0 0 / 400% 100%',
                        color: 'transparent',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        animation: 'move-bg 24s infinite linear',
                        '@keyframes move-bg': { '100%': { backgroundPosition: '400% 0' } }
                      }}
                    >
                      {t('landing.hero.title.highlight')}
                    </Typography>{' '}
                    {t('landing.hero.title.part2')}
                  </Typography>
                  )}
                </motion.div>
              </Grid>
              <Grid container size={12} sx={{ justifyContent: heroAlignment === 'center' ? 'center' : heroAlignment === 'left' ? 'flex-start' : 'flex-end' }}>
                <Grid size={heroAlignment === 'center' ? 8 : 12}>
                  <motion.div
                    initial={{ opacity: 0, y: 550 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 150,
                      damping: 30,
                      delay: 0.2
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{
                        fontSize: { xs: '0.875rem', md: '1rem' },
                        fontWeight: 400,
                        lineHeight: { xs: 1.4, md: 1.4 },
                        color: 'white'
                      }}
                    >
                      {subtitle || t('landing.hero.subtitle')}
                    </Typography>
                  </motion.div>
                </Grid>
              </Grid>
              <Grid size={12}>
                <motion.div
                  initial={{ opacity: 0, y: 550 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 150,
                    damping: 30,
                    delay: 0.4
                  }}
                >
                  <Grid container spacing={2} sx={{ justifyContent: heroAlignment === 'center' ? 'center' : heroAlignment === 'left' ? 'flex-start' : 'flex-end' }}>
                    {heroCtaEnabled && (
                    <Grid>
                      <AnimateButton>
                        <Button
                          component={Link}
                          href={ctaUrl || '/register'}
                          size="large"
                          color="secondary"
                          variant="outlined"
                          sx={{
                            borderColor: 'white',
                            color: 'white',
                            borderWidth: 2,
                            fontWeight: 600,
                            px: 4,
                            py: 1.5,
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: '-100%',
                              width: '100%',
                              height: '100%',
                              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                              transition: 'left 0.5s ease'
                            },
                            '&:hover': {
                              borderColor: 'white',
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              transform: 'translateY(-3px) scale(1.05)',
                              boxShadow: '0 10px 30px rgba(255,255,255,0.3), 0 0 20px rgba(255,255,255,0.2)',
                              '&::before': {
                                left: '100%'
                              }
                            },
                            '&:active': {
                              transform: 'translateY(-1px) scale(1.02)'
                            }
                          }}
                        >
                          {ctaText || t('landing.cta.bookDemoAndTrial')}
                        </Button>
                      </AnimateButton>
                    </Grid>
                    )}
                    {heroBookDemoEnabled && (
                    <Grid>
                      <AnimateButton>
                        <Button
                            component={bookDemoUrl ? Link : "a"}
                            href={bookDemoUrl || "#book-demo"}
                          size="large"
                          color="primary"
                          variant="contained"
                            onClick={!bookDemoUrl ? (e) => {
                            e.preventDefault();
                            document.getElementById('book-demo')?.scrollIntoView({ 
                              behavior: 'smooth' 
                            });
                            } : undefined}
                        >
                            {bookDemoText || t('landing.cta.bookDemo')}
                        </Button>
                      </AnimateButton>
                    </Grid>
                    )}
                  </Grid>
                </motion.div>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
