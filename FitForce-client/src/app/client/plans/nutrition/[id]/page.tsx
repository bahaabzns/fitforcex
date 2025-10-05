'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Card, CardContent, Typography, Stack, CircularProgress, Divider, Grid } from '@mui/material';

export default function ClientNutritionPlanDetail() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading, error } = useSWR(() => (id ? `client-nutrition-plan-${id}` : null), async () => {
    // Get plan with days/items
    // Fetch workspace id from local storage set by app axios interceptor
    const wsRes = await api.get('/api/clients/profile');
    const workspaceId = wsRes.data?.workspace?.id;
    const res = await api.get(`/api/clients/nutrition-plans/${id}`, { headers: workspaceId ? { 'x-workspace-id': workspaceId } : {} });
    const nutritionPlan = (res.data as any)?.nutritionPlan;
    return { plan: nutritionPlan } as { plan: { id: string; title: string; days: Array<{ dayIndex: number; label?: string; items: Array<{ meal?: string; servings: number; foodItem?: any }> }> } };
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading plan…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !data?.plan) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">Failed to load plan</Typography>
        </CardContent>
      </Card>
    );
  }

  const { plan } = data;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>{plan.title}</Typography>
      <Stack spacing={2}>
        {plan.days.map((d, idx) => (
          <Card key={idx}>
            <CardContent>
              <Typography variant="h6">{d.label || `Day ${d.dayIndex}`}</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Grid container spacing={1}>
                {d.items.map((it, i) => (
                  <Grid key={i} item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">{it.meal || `Meal ${i + 1}`}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {it.foodItem?.name || 'Item'} • Servings: {it.servings}
                        </Typography>
                        {it.foodItem && (
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(it.foodItem.calories)} kcal • P {Math.round(it.foodItem.protein)}g • C {Math.round(it.foodItem.carbs)}g • F {Math.round(it.foodItem.fat)}g
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                {d.items.length === 0 && (
                  <Grid item xs={12}>
                    <Typography color="text.secondary">No items for this day.</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}


