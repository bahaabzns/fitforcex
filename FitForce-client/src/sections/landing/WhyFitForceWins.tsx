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

// ==============================|| LANDING - WHY FITFORCE WINS ||============================== //

export default function WhyFitForceWins() {
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
                    Why FitForce Wins
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                    Not Just Another "Tool" — A Full Coaching Ecosystem.
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
                          Clean, intuitive interface built for coaches
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Designed specifically for fitness professionals, not generic business tools
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
                          Smart automations that replaces repetitive work
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Automate client onboarding, plan distribution, and progress tracking
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
                          Real-time analytics on client performance and business growth
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Track client progress, retention rates, and revenue metrics in real-time
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
                          Customizable for individual coaches or full teams
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                          Scale from solo coaching to multi-trainer gyms with role-based permissions
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
