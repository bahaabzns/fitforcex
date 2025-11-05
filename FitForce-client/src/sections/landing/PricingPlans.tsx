'use client';

// next
import Link from 'next/link';

// material-ui
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';

// project-imports
import AnimateButton from 'components/@extended/AnimateButton';

// third-party
import { motion } from 'framer-motion';
import useTranslation from '@/utils/useTranslation';

// ==============================|| LANDING - PRICING PLANS ||============================== //

export default function PricingPlans() {
  const { t } = useTranslation();
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
          background: 'linear-gradient(135deg, rgba(21, 155, 255, 0.02) 0%, rgba(18, 28, 35, 0.02) 100%)',
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
              💼 {t('landing.pricing.header')}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>
              {t('landing.pricing.subheader')}
            </Typography>
          </motion.div>
        </Box>

        {/* Pricing Cards Container */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Solo Coach Plan */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ flex: '0 0 300px', maxWidth: '300px' }}
          >
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'white',
                border: '2px solid #e0e0e0',
                borderRadius: 3,
                boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
                  borderColor: '#159bff'
                }
              }}
            >
              <CardContent sx={{ p: 3, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Stack spacing={2} sx={{ flexGrow: 1 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                      🧍‍♂️ {t('landing.pricing.solo.title')}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#159bff', mb: 1 }}>
                      {t('landing.pricing.solo.price')}
                    </Typography>
                    <Chip 
                      label={t('landing.pricing.solo.badge')}
                      size="small" 
                      sx={{ 
                        bgcolor: '#e3f2fd', 
                        color: '#159bff',
                        textDecoration: 'line-through',
                        fontSize: '0.75rem'
                      }} 
                    />
                  </Box>
                  
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 2 }}>
                    {t('landing.pricing.solo.desc')}
                  </Typography>
                  
                  {/* Features List */}
                  <Box sx={{ textAlign: 'left', mb: 3, flexGrow: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
                      {t('landing.pricing.includes')}
                    </Typography>
                    <Stack spacing={0.5}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.unlimitedClients')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.unlimitedPlans')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.smartForms')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.paymentTracking')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.analyticsDashboard')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.multiDevice')}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                  
                  <Box sx={{ bgcolor: '#f8f9fa', p: 1.5, borderRadius: 2, mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#159bff', mb: 0.5 }}>
                      🚀 {t('landing.pricing.bestFor')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                      {t('landing.pricing.solo.bestForDesc')}
                    </Typography>
                  </Box>
                  
                  <AnimateButton>
                    <Button
                      component="a"
                      href="#book-demo"
                      variant="outlined"
                      size="large"
                      fullWidth
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById('book-demo')?.scrollIntoView({ 
                          behavior: 'smooth' 
                        });
                      }}
                      sx={{
                        borderColor: '#159bff',
                        color: '#159bff',
                        fontWeight: 600,
                        py: 1.5,
                        '&:hover': {
                          borderColor: '#159bff',
                          backgroundColor: 'rgba(21, 155, 255, 0.1)'
                        }
                      }}
                    >
                      {t('landing.cta.bookDemo')}
                    </Button>
                  </AnimateButton>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>

          {/* Coaching Team Plan */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ flex: '0 0 300px', maxWidth: '300px' }}
          >
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(135deg, #159bff 0%, #0d7ae8 100%)',
                color: 'white',
                borderRadius: 3,
                boxShadow: '0 15px 35px rgba(21, 155, 255, 0.3)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                  pointerEvents: 'none'
                },
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 20px 45px rgba(21, 155, 255, 0.4)'
                }
              }}
            >
              <CardContent sx={{ p: 3, textAlign: 'center', position: 'relative', zIndex: 1, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Stack spacing={2} sx={{ flexGrow: 1 }}>
                  <Box>
                    <Chip 
                      label={t('landing.pricing.team.badge')}
                      size="small" 
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)', 
                        color: 'white',
                        fontWeight: 600,
                        mb: 2
                      }} 
                    />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 1 }}>
                      👥 {t('landing.pricing.team.title')}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>
                      {t('landing.pricing.team.price')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      {t('landing.pricing.team.extra')}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, mb: 2 }}>
                    {t('landing.pricing.team.desc')}
                  </Typography>
                  
                  {/* Features List */}
                  <Box sx={{ textAlign: 'left', mb: 3, flexGrow: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'white', mb: 1 }}>
                      {t('landing.pricing.team.includesMore')}
                    </Typography>
                    <Stack spacing={0.5}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>{t('landing.pricing.features.teamDashboard')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>{t('landing.pricing.features.clientAssignment')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>{t('landing.pricing.features.performanceTracking')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>{t('landing.pricing.features.centralizedComms')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>{t('landing.pricing.features.sharedTemplates')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>{t('landing.pricing.features.multiAdmin')}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                  
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 1.5, borderRadius: 2, mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', mb: 0.5 }}>
                      ⚡ {t('landing.pricing.bestFor')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem' }}>
                      {t('landing.pricing.team.bestForDesc')}
                    </Typography>
                  </Box>
                  
                  <AnimateButton>
                    <Button
                      component="a"
                      href="#book-demo"
                      variant="contained"
                      size="large"
                      fullWidth
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById('book-demo')?.scrollIntoView({ 
                          behavior: 'smooth' 
                        });
                      }}
                      sx={{
                        bgcolor: 'white',
                        color: '#159bff',
                        fontWeight: 600,
                        py: 1.5,
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.9)',
                          transform: 'scale(1.02)'
                        }
                      }}
                    >
                      {t('landing.cta.bookDemo')}
                    </Button>
                  </AnimateButton>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>

          {/* Enterprise Plan */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{ flex: '0 0 300px', maxWidth: '300px' }}
          >
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'white',
                border: '2px solid #e0e0e0',
                borderRadius: 3,
                boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
                  borderColor: '#159bff'
                }
              }}
            >
              <CardContent sx={{ p: 3, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Stack spacing={2} sx={{ flexGrow: 1 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                      🏢 {t('landing.pricing.enterprise.title')}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#159bff', mb: 1 }}>
                      {t('landing.pricing.enterprise.price')}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 2 }}>
                    {t('landing.pricing.enterprise.desc')}
                  </Typography>
                  
                  {/* Features List */}
                  <Box sx={{ textAlign: 'left', mb: 3, flexGrow: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
                      {t('landing.pricing.enterprise.includesMore')}
                    </Typography>
                    <Stack spacing={0.5}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.whiteLabel')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.customIntegrations')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.dedicatedSupport')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.apiAccess')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.unlimitedClients')}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: '#159bff', fontWeight: 600, mt: 0.1, fontSize: '0.8rem' }}>✓</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{t('landing.pricing.features.priorityOnboarding')}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                  
                  <Box sx={{ bgcolor: '#f8f9fa', p: 1.5, borderRadius: 2, mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#159bff', mb: 0.5 }}>
                      💎 Best for:
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                      Brands that want to scale professionally with a private, branded platform.
                    </Typography>
                  </Box>
                  
                  <AnimateButton>
                    <Button
                      variant="outlined"
                      size="large"
                      fullWidth
                      sx={{
                        borderColor: '#159bff',
                        color: '#159bff',
                        fontWeight: 600,
                        py: 1.5,
                        '&:hover': {
                          borderColor: '#159bff',
                          backgroundColor: 'rgba(21, 155, 255, 0.1)'
                        }
                      }}
                    >
                      {t('landing.cta.contactSales')}
                    </Button>
                  </AnimateButton>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Box>
        
        {/* CTA Button Section */}
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
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
                💥 Join Now or Book Your Demo — Transform Your Coaching Workflow
              </Button>
            </AnimateButton>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
}