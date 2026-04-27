'use client';

// material-ui
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

// project-imports
import AnimateButton from 'components/@extended/AnimateButton';

// third-party
import { motion } from 'framer-motion';
import useTranslation from '@/utils/useTranslation';
import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/lib/config';
import useConfig from '@/hooks/useConfig';

// ==============================|| LANDING - PROBLEM SOLUTION ||============================== //

export default function ProblemSolution() {
  const { t } = useTranslation();
  const { i18n } = useConfig();
  const [problem, setProblem] = useState<{ header?: string; subheader?: string; title?: string; pointIntro?: string; points?: string[] } | null>(null);
  const [solution, setSolution] = useState<{ title?: string; subtitle?: string; intro?: string; features?: string[] } | null>(null);

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
        setProblem(sections.problem || null);
        setSolution(sections.solution || null);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [i18n]);
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default', position: 'relative' }}>
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(16, 185, 129, 0.03) 100%)',
          zIndex: 0
        }}
      />
      
      <Container sx={{ position: 'relative', zIndex: 1 }}>
        {/* Section Header */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 2, color: 'text.primary' }}>
              {problem?.header || t('landing.problem.header')}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              {problem?.subheader || t('landing.problem.subheader')}
            </Typography>
          </motion.div>
        </Box>

        <Grid container spacing={6}>
          {/* The Problem Section */}
          <Grid size={{ xs: 12, md: 5 }}>
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Card 
                sx={{ 
                  height: '100%',
                  background: '#121c23',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 3,
                  boxShadow: '0 20px 40px rgba(18, 28, 35, 0.3)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%)',
                    pointerEvents: 'none'
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 100,
                    height: 100,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                  }
                }}
              >
                <CardContent sx={{ p: 5, position: 'relative', zIndex: 1 }}>
                  <Stack spacing={4}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem'
                        }}
                      >
                        💥
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '1.75rem' }}>
                        {problem?.title || t('landing.problem.title')}
                      </Typography>
                    </Box>
                    
                    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: '1.4rem' }}>
                      {problem?.pointIntro || t('landing.problem.pointIntro')}
                    </Typography>
                    
                    <Stack spacing={3}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.8)', mt: 1, flexShrink: 0 }} />
                        <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
                          {(problem?.points && problem.points[0]) || t('landing.problem.point1')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.8)', mt: 1, flexShrink: 0 }} />
                        <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
                          {(problem?.points && problem.points[1]) || t('landing.problem.point2')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.8)', mt: 1, flexShrink: 0 }} />
                        <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.6, fontWeight: 600 }}>
                          {(problem?.points && problem.points[2]) || t('landing.problem.point3')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          {/* The Solution Section */}
          <Grid size={{ xs: 12, md: 7 }}>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card 
                sx={{ 
                  height: '100%',
                  background: '#159bff',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 3,
                  boxShadow: '0 20px 40px rgba(21, 155, 255, 0.3)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 50%)',
                    pointerEvents: 'none'
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: -50,
                    left: -50,
                    width: 100,
                    height: 100,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                    pointerEvents: 'none'
                  }
                }}
              >
                <CardContent sx={{ p: 5, position: 'relative', zIndex: 1 }}>
                  <Stack spacing={4}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem'
                        }}
                      >
                        💡
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '1.75rem' }}>
                        {solution?.title || t('landing.solution.title')}
                      </Typography>
                    </Box>
                    
                    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: '1.4rem' }}>
                      {solution?.subtitle || t('landing.solution.subtitle')}
                    </Typography>
                    
    
                    
                    <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.6, fontWeight: 600, mb: 3 }}>
                      {solution?.intro || t('landing.solution.intro')}
                    </Typography>
                    
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          ✓
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '1rem', lineHeight: 1.5 }}>
                          {(solution?.features && solution.features[0]) || t('landing.solution.feature1')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          ✓
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '1rem', lineHeight: 1.5 }}>
                          {(solution?.features && solution.features[1]) || t('landing.solution.feature2')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          ✓
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '1rem', lineHeight: 1.5 }}>
                          {(solution?.features && solution.features[2]) || t('landing.solution.feature3')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          ✓
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '1rem', lineHeight: 1.5 }}>
                          {(solution?.features && solution.features[3]) || t('landing.solution.feature4')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          ✓
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '1rem', lineHeight: 1.5 }}>
                          {(solution?.features && solution.features[4]) || t('landing.solution.feature5')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        </Grid>
        
        {/* CTA Button Section */}
        <Box sx={{ textAlign: 'center', mt: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <AnimateButton>
              <Button
                component="a"
                href="#book-demo"
                size="large"
                variant="contained"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('book-demo')?.scrollIntoView({ 
                    behavior: 'smooth' 
                  });
                }}
                sx={{
                  bgcolor: '#159bff',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  px: 6,
                  py: 2.5,
                  borderRadius: 3,
                  boxShadow: '0 8px 25px rgba(21, 155, 255, 0.3)',
                  '&:hover': {
                    bgcolor: '#0d7ae8',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 35px rgba(21, 155, 255, 0.4)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                💻 {t('landing.cta.demoBenefit')}
              </Button>
            </AnimateButton>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
}
