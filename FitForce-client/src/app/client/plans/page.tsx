'use client';

import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Card, Stack, Typography, CircularProgress, Grid, Chip, Tabs, Tab, CardContent } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';

type NutritionPlan = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  items?: any[];
};

type WorkoutPlan = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  days?: any[];
};

export default function ClientPlansPage() {
  const { data: profile, isLoading: loadingProfile } = useSWR('seed-client-profile', async () => {
    const res = await api.get('/api/clients/profile');
    return res.data as { client: { id: string; fullName: string } };
  });

  const clientId = profile?.client?.id;

  const { data: nutritionData, isLoading: loadingNutrition } = useSWR(
    () => (clientId ? `client-nutrition-plans-${clientId}` : null),
    async () => {
      const res = await api.get(`/api/clients/${clientId}/nutrition/plans`);
      return res.data as { plans: NutritionPlan[] };
    }
  );

  const { data: workoutData, isLoading: loadingWorkout } = useSWR(
    () => (clientId ? `client-workout-plans-${clientId}` : null),
    async () => {
      const res = await api.get(`/api/clients/${clientId}/workout/plans`);
      return res.data as { plans: WorkoutPlan[] };
    }
  );

  const [tab, setTab] = useState(0);

  if (loadingProfile || (!nutritionData && loadingNutrition) || (!workoutData && loadingWorkout)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading plans…</Typography>
        </Stack>
      </Box>
    );
  }

  const nutritionPlans = nutritionData?.plans || [];
  const workoutPlans = workoutData?.plans || [];

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" fontWeight={700}>Your Plans</Typography>
        <Chip color="info" label={`Total ${nutritionPlans.length + workoutPlans.length}`} />
      </Stack>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={`Nutrition (${nutritionPlans.length})`} />
            <Tab label={`Workout (${workoutPlans.length})`} />
          </Tabs>
        </Box>
        <CardContent>
          {tab === 0 && (
            <Grid container spacing={2}>
              {nutritionPlans.map((p) => (
                <Grid key={p.id} item xs={12} md={6} lg={4}>
                  <Card variant="outlined" component={Link} href={`/client/plans/nutrition/${p.id}`} style={{ textDecoration: 'none' }}>
                    <CardContent>
                      <Typography variant="h6">{p.title}</Typography>
                      <Typography variant="caption" color="text.secondary">Created {new Date(p.createdAt).toLocaleString()}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {nutritionPlans.length === 0 && (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center">No nutrition plans yet.</Typography>
                </Grid>
              )}
            </Grid>
          )}
          {tab === 1 && (
            <Grid container spacing={2}>
              {workoutPlans.map((p) => (
                <Grid key={p.id} item xs={12} md={6} lg={4}>
                  <Card variant="outlined" component={Link} href={`/client/plans/workout/${p.id}`} style={{ textDecoration: 'none' }}>
                    <CardContent>
                      <Typography variant="h6">{p.title}</Typography>
                      <Typography variant="caption" color="text.secondary">Created {new Date(p.createdAt).toLocaleString()}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {workoutPlans.length === 0 && (
                <Grid item xs={12}>
                  <Typography color="text.secondary" align="center">No workout plans yet.</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}


