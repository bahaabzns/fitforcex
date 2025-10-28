'use client';

import useSWR from 'swr';
import api from '@/utils/axios';
import useConfig from '@/hooks/useConfig';
import { 
  Box, 
  Card, 
  Stack, 
  Typography, 
  CircularProgress, 
  Grid, 
  Chip, 
  Tabs, 
  Tab, 
  CardContent,
  CardActions,
  Button,
  Avatar,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { 
  FitnessCenter, 
  Restaurant, 
  CalendarToday, 
  TrendingUp,
  CheckCircle,
  Visibility,
  Star
} from '@mui/icons-material';

// translations
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

type NutritionPlan = {
  id: string;
  title: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  items?: any[];
};

type WorkoutPlan = {
  id: string;
  title: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  days?: any[];
};

export default function ClientPlansPage() {
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const isArabic = currentLang === 'ar';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const { data: profile, isLoading: loadingProfile } = useSWR('seed-client-profile', async () => {
    const res = await api.get('/api/clients/profile');
    return res.data as { client: { id: string; fullName: string } };
  });

  const clientId = profile?.client?.id;

  const { data: nutritionData, isLoading: loadingNutrition, error: nutritionError } = useSWR(
    () => (clientId ? `client-nutrition-plans-${clientId}` : null),
    async () => {
      const res = await api.get(`/api/clients/${clientId}/nutrition/plans`);
      return res.data as { plans: NutritionPlan[] };
    }
  );

  const { data: workoutData, isLoading: loadingWorkout, error: workoutError } = useSWR(
    () => (clientId ? `client-workout-plans-${clientId}` : null),
    async () => {
      const res = await api.get(`/api/clients/${clientId}/workout/plans`);
      return res.data as { plans: WorkoutPlan[] };
    }
  );

  const [tab, setTab] = useState(0);

  if (loadingProfile || (!nutritionData && loadingNutrition) || (!workoutData && loadingWorkout)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, minHeight: '60vh' }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} />
          <Typography color="text.secondary" variant="h6">{t('client.plans.loading')}</Typography>
        </Stack>
      </Box>
    );
  }

  const nutritionPlans = nutritionData?.plans || [];
  const workoutPlans = workoutData?.plans || [];

  const activeNutritionPlans = nutritionPlans.filter(p => p.status === 'active');
  const activeWorkoutPlans = workoutPlans.filter(p => p.status === 'active');
  const draftNutritionPlans = nutritionPlans.filter(p => p.status === 'draft' || !p.status);
  const draftWorkoutPlans = workoutPlans.filter(p => p.status === 'draft' || !p.status);

  const totalActivePlans = activeNutritionPlans.length + activeWorkoutPlans.length;

  const PlanCard = ({ plan, type }: { plan: WorkoutPlan | NutritionPlan; type: 'workout' | 'nutrition' }) => {
    const isActive = plan.status === 'active';
    const icon = type === 'workout' ? <FitnessCenter /> : <Restaurant />;
    const color = type === 'workout' ? 'primary' : 'success';
    const href = type === 'workout' 
      ? `/client/plans/workout/${plan.id}` 
      : `/client/plans/nutrition/${plan.id}`;

    return (
      <Card 
        elevation={isActive ? 4 : 1}
        sx={{ 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          transition: 'all 0.3s ease',
          border: isActive ? '2px solid' : '1px solid',
          borderColor: isActive ? `${color}.main` : 'divider',
          position: 'relative',
          overflow: 'visible',
          '&:hover': { 
            transform: 'translateY(-4px)', 
            boxShadow: 8 
          }
        }}
      >
        {isActive && (
          <Chip 
            icon={<Star />}
            label={t('client.plans.active')}
            color={color as any}
            size="small"
            sx={{ 
              position: 'absolute', 
              top: -12, 
              right: 16,
              fontWeight: 700,
              px: 1
            }}
          />
        )}
        <CardContent sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
            <Avatar sx={{ bgcolor: `${color}.main`, width: 48, height: 48 }}>
              {icon}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                {(isArabic && (plan as any).titleArabic) || plan.title}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                <Chip 
                  size="small" 
                  label={(plan.status ? t(`client.plan.status.${plan.status}`) : t('client.plans.draft'))}
                  color={isActive ? color as any : 'default'}
                  variant={isActive ? 'filled' : 'outlined'}
                />
                <Chip 
                  size="small" 
                  icon={<CalendarToday sx={{ fontSize: 14 }} />}
                  label={new Date(plan.createdAt).toLocaleDateString()} 
                  variant="outlined"
                />
              </Stack>
            </Box>
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              <strong>{t('client.plans.created')}:</strong> {new Date(plan.createdAt).toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>{t('client.plans.lastUpdated')}:</strong> {new Date(plan.updatedAt).toLocaleString()}
            </Typography>
            {type === 'workout' && 'days' in plan && (
              <Typography variant="body2" color="text.secondary">
                <strong>{t('client.plans.days')}:</strong> {plan.days?.length || 0}
              </Typography>
            )}
            {type === 'nutrition' && 'items' in plan && (
              <Typography variant="body2" color="text.secondary">
                <strong>{t('client.plans.items')}:</strong> {plan.items?.length || 0}
              </Typography>
            )}
          </Stack>
        </CardContent>
        <CardActions sx={{ p: 2, pt: 0 }}>
          <Button 
            component={Link} 
            href={href}
            variant="contained"
            color={color as any}
            fullWidth
            size="large"
            startIcon={<Visibility />}
          >
            {t('client.plans.viewDetails')}
          </Button>
        </CardActions>
      </Card>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h4" fontWeight={700}>{t('client.plans.title')}</Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
              {t('client.plans.subtitle')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)' }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('client.plans.activePlans')}</Typography>
              <Typography variant="h5" fontWeight={700}>{totalActivePlans}</Typography>
            </Paper>
          </Stack>
        </Stack>
      </Paper>

      {/* Error Messages */}
      {nutritionError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {t('client.plans.nutritionError')}
        </Alert>
      )}
      {workoutError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {t('client.plans.workoutError')}
        </Alert>
      )}

      {/* Plans Tabs */}
      <Card sx={{ borderRadius: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tab} 
            onChange={(_, v) => setTab(v)}
            sx={{ px: 2 }}
          >
            <Tab 
              icon={<Restaurant />} 
              iconPosition="start"
              label={`${t('client.plans.nutritionTab')} (${activeNutritionPlans.length})`}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab 
              icon={<FitnessCenter />} 
              iconPosition="start"
              label={`${t('client.plans.workoutTab')} (${activeWorkoutPlans.length})`}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
          </Tabs>
        </Box>
        <CardContent sx={{ p: 3 }}>
          {tab === 0 && (
            <Grid container spacing={3}>
              {activeNutritionPlans.length === 0 ? (
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Restaurant sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      {t('client.plans.noActiveNutrition')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('client.plans.noActiveNutritionDesc')}
                    </Typography>
                  </Box>
                </Grid>
              ) : (
                activeNutritionPlans.map((plan) => (
                  <Grid key={plan.id} item xs={12} md={6} lg={4}>
                    <PlanCard plan={plan} type="nutrition" />
                  </Grid>
                ))
              )}
            </Grid>
          )}
          {tab === 1 && (
            <Grid container spacing={3}>
              {activeWorkoutPlans.length === 0 ? (
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <FitnessCenter sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      {t('client.plans.noActiveWorkout')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('client.plans.noActiveWorkoutDesc')}
                    </Typography>
                  </Box>
                </Grid>
              ) : (
                activeWorkoutPlans.map((plan) => (
                  <Grid key={plan.id} item xs={12} md={6} lg={4}>
                    <PlanCard plan={plan} type="workout" />
                  </Grid>
                ))
              )}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
