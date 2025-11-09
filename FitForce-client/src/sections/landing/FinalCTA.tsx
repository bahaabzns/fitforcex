'use client';

// material-ui
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

// next
import Link from 'next/link';

// project-imports
import AnimateButton from 'components/@extended/AnimateButton';

// third-party
import { motion } from 'framer-motion';
import useTranslation from '@/utils/useTranslation';
import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/lib/config';
import useConfig from '@/hooks/useConfig';

// ==============================|| LANDING - FINAL CTA ||============================== //

export default function FinalCTA() {
  const { t } = useTranslation();
  const { i18n } = useConfig();
  const [finalCta, setFinalCta] = useState<{ header?: string; subheader?: string } | null>(null);

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
        setFinalCta(sections.finalCta || null);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [i18n]);
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#159bff', position: 'relative', overflow: 'hidden' }}>
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 30% 70%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          zIndex: 0
        }}
      />
      
      <Container sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Main Headline */}
            <Typography 
              variant="h2" 
              sx={{ 
                fontWeight: 800, 
                mb: 3, 
                color: 'white',
                fontSize: { xs: '2rem', md: '3rem' },
                lineHeight: 1.2
              }}
            >
              🔥 {finalCta?.header || t('landing.final.header')}
            </Typography>
            
            {/* Subheadline */}
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 400, 
                mb: 6, 
                color: 'rgba(255,255,255,0.9)',
                fontSize: { xs: '1.1rem', md: '1.3rem' },
                lineHeight: 1.5,
                maxWidth: 600,
                mx: 'auto'
              }}
            >
              {finalCta?.subheader || t('landing.final.subheader')}
            </Typography>
            
            {/* CTA Buttons */}
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={3} 
              sx={{ 
                justifyContent: 'center', 
                alignItems: 'center',
                maxWidth: 500,
                mx: 'auto'
              }}
            >
              {/* Book a Demo and Start your Free Trial Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <AnimateButton>
                  <Button
                    component={Link}
                    href="/register"
                    size="large"
                    variant="contained"
                    sx={{
                      bgcolor: 'white',
                      color: '#159bff',
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      px: 4,
                      py: 2,
                      borderRadius: 3,
                      boxShadow: '0 8px 25px rgba(255,255,255,0.3)',
                      '&:hover': {
                        bgcolor: 'white',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 35px rgba(255,255,255,0.4)'
                      },
                      transition: 'all 0.3s ease',
                      minWidth: 200
                    }}
                  >
                    {t('landing.cta.bookDemoAndTrial')}
                  </Button>
                </AnimateButton>
              </motion.div>
              
              {/* Book a Demo Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <AnimateButton>
                  <Button
                    component="a"
                    href="#book-demo"
                    size="large"
                    variant="outlined"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('book-demo')?.scrollIntoView({ 
                        behavior: 'smooth' 
                      });
                    }}
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      px: 4,
                      py: 2,
                      borderRadius: 3,
                      borderWidth: 2,
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(255,255,255,0.2)'
                      },
                      transition: 'all 0.3s ease',
                      minWidth: 200
                    }}
                  >
                    💬 {t('landing.cta.bookDemo')}
                  </Button>
                </AnimateButton>
              </motion.div>
            </Stack>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
}
