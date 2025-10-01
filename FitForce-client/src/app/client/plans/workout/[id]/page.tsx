'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Card, CardContent, Typography, Stack, CircularProgress, Divider, Grid } from '@mui/material';

export default function ClientWorkoutPlanDetail() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading, error } = useSWR(() => (id ? `client-workout-plan-${id}` : null), async () => {
    const wsRes = await api.get('/api/clients/profile');
    const workspaceId = wsRes.data?.workspace?.id;
    const res = await api.get(`/api/workout/plans/${id}/days`, { headers: workspaceId ? { 'x-workspace-id': workspaceId } : {} });
    return res.data as { plan: { id: string; title: string; days: Array<{ dayIndex: number; label?: string; items: Array<{ reps?: number; sets?: number; notes?: string; planSets?: any[]; exercise?: any }> }> } };
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
                  <Grid key={i} item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2">{it.exercise?.name || 'Exercise'}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {typeof it.sets === 'number' && typeof it.reps === 'number' ? `${it.sets} x ${it.reps}` : ''} {it.notes ? `• ${it.notes}` : ''}
                        </Typography>
                        {Array.isArray(it.planSets) && it.planSets.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {it.planSets.map((s: any) => `${s.repMin ?? s.reps ?? ''}${s.repMax ? '-' + s.repMax : ''}${s.weight ? ` @ ${s.weight}kg` : ''}`).join('  |  ')}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                {d.items.length === 0 && (
                  <Grid item xs={12}>
                    <Typography color="text.secondary">No exercises for this day.</Typography>
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


