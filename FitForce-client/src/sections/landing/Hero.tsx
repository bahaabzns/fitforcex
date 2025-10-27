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

// ==============================|| LANDING - HERO PAGE ||============================== //

export default function HeroPage() {

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        position: 'relative', 
        pb: 12.5, 
        pt: 10, 
        display: 'flex', 
        alignItems: 'center',
        backgroundImage: 'url(/assets/hero.png)',
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
        <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', pt: { md: 0, xs: 10 }, pb: { md: 0, xs: 22 } }}>
          <Grid size={{ xs: 12, md: 9 }}>
            <Grid container spacing={3} sx={{ textAlign: 'center' }}>
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
                  <Typography
                    variant="h1"
                    sx={{
                      fontSize: { xs: '1.825rem', sm: '2rem', md: '3.4375rem' },
                      fontWeight: 700,
                      lineHeight: 1.2,
                      color: 'white'
                    }}
                  >
                    One System to Run Your{' '}
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
                      Coaching Business
                    </Typography>{' '}
                    — From First Message to Final Plan.
                  </Typography>
                </motion.div>
              </Grid>
              <Grid container size={12} sx={{ justifyContent: 'center' }}>
                <Grid size={8}>
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
                      FitForce is your all-in-one platform built for fitness coaches. Manage clients, plans, forms, payments, and progress — all from one clean dashboard.
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
                  <Grid container spacing={2} sx={{ justifyContent: 'center' }}>
                    <Grid>
                      <AnimateButton>
                        <Button
                          component="a"
                          href="#book-demo"
                          size="large"
                          color="secondary"
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
                            '&:hover': {
                              borderColor: 'white',
                              backgroundColor: 'rgba(255,255,255,0.1)'
                            }
                          }}
                        >
                          Book a Demo and Start your Free Trial
                        </Button>
                      </AnimateButton>
                    </Grid>
                    <Grid>
                      <AnimateButton>
                        <Button
                          component="a"
                          href="#book-demo"
                          size="large"
                          color="primary"
                          variant="contained"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById('book-demo')?.scrollIntoView({ 
                              behavior: 'smooth' 
                            });
                          }}
                        >
                          Book a Demo
                        </Button>
                      </AnimateButton>
                    </Grid>
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
