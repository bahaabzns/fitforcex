'use client';

// material-ui
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import BarChartIcon from '@mui/icons-material/BarChart';
import GroupIcon from '@mui/icons-material/Group';

// third-party
import { motion } from 'framer-motion';
import useTranslation from '@/utils/useTranslation';
import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/lib/config';
import useConfig from '@/hooks/useConfig';

// ==============================|| LANDING - WHY FITFORCE WINS ||============================== //

export default function WhyFitForceWins() {
  const { t } = useTranslation();
  const { i18n } = useConfig();
  const [why, setWhy] = useState<{ header?: string; subheader?: string; points?: { title: string; desc: string }[] } | null>(null);

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
        setWhy(sections.why || null);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [i18n]);
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#159bff', position: 'relative' }}>
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(21, 155, 255, 0.02) 0%, rgba(18, 28, 35, 0.02) 100%)',
          zIndex: 0
        }}
      />
      
      <Container sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={6} sx={{ alignItems: 'center' }}>
          {/* Left Side - Image */}
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
                <Box
                  sx={{
                    height: 500,
                    backgroundImage: 'url(/assets/why.png)',
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(21, 155, 255, 0.3)',
                  }}
                >
                  {/* Remove the emoji placeholder */}
                </Box>
            </motion.div>
          </Grid>

          {/* Right Side - Points */}
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Stack spacing={4}>
                {/* Header */}
                <Box>
                  <Typography variant="h2" sx={{ fontWeight: 800, mb: 2, color: '#121c23' }}>
                    {why?.header || t('landing.why.header')}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                    {why?.subheader || t('landing.why.subheader')}
                  </Typography>
                </Box>

                {/* Points */}
                <Stack spacing={3}>
                  {/* Point 1 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <Box
                        sx={{
                          width: 50,
                          height: 50,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                          boxShadow: '0 4px 15px rgba(255,255,255,0.2)'
                        }}
                      >
                        <CheckCircleIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
                          {(why?.points && why.points[0]?.title) || t('landing.why.point1.title')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {(why?.points && why.points[0]?.desc) || t('landing.why.point1.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </motion.div>

                  {/* Point 2 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <Box
                        sx={{
                          width: 50,
                          height: 50,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                          boxShadow: '0 4px 15px rgba(255,255,255,0.2)'
                        }}
                      >
                        <SpeedIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
                          {(why?.points && why.points[1]?.title) || t('landing.why.point2.title')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {(why?.points && why.points[1]?.desc) || t('landing.why.point2.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </motion.div>

                  {/* Point 3 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <Box
                        sx={{
                          width: 50,
                          height: 50,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                          boxShadow: '0 4px 15px rgba(255,255,255,0.2)'
                        }}
                      >
                        <BarChartIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
                          {(why?.points && why.points[2]?.title) || t('landing.why.point3.title')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {(why?.points && why.points[2]?.desc) || t('landing.why.point3.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </motion.div>

                  {/* Point 4 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <Box
                        sx={{
                          width: 50,
                          height: 50,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                          boxShadow: '0 4px 15px rgba(255,255,255,0.2)'
                        }}
                      >
                        <GroupIcon sx={{ color: 'white', fontSize: '1.5rem' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
                          {(why?.points && why.points[3]?.title) || t('landing.why.point4.title')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          {(why?.points && why.points[3]?.desc) || t('landing.why.point4.desc')}
                        </Typography>
                      </Box>
                    </Box>
                  </motion.div>
                </Stack>
              </Stack>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
