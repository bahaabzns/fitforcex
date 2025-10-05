'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  CircularProgress,
  Divider,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip
} from '@mui/material';
import { PlayArrow, FitnessCenter } from '@mui/icons-material';
import WorkoutTracking from '@/components/workout/WorkoutTracking';

export default function ClientWorkoutPlanDetail() {
  const params = useParams();
  const id = params?.id as string;
  const intl = useIntl();
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  const { data, isLoading, error } = useSWR(() => (id ? `client-workout-plan-${id}` : null), async () => {
    const wsRes = await api.get('/api/clients/profile');
    const workspaceId = wsRes.data?.workspace?.id;
    const res = await api.get(`/api/clients/workout-plans/${id}`, { headers: workspaceId ? { 'x-workspace-id': workspaceId } : {} });
    const workoutPlan = (res.data as any)?.workoutPlan;
    return { plan: workoutPlan } as { plan: { id: string; title: string; days: Array<{ dayIndex: number; label?: string; items: Array<{ reps?: number; sets?: number; notes?: string; planSets?: any[]; exercise?: any }> }> } };
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

  const handleStartWorkout = (dayIndex: number) => {
    setSelectedDayIndex(dayIndex);
    setTrackingDialogOpen(true);
  };

  const handleWorkoutSubmitted = (data: any) => {
    console.log('Workout submitted:', data);
    setTrackingDialogOpen(false);
    // You could show a success message or refresh the data here
  };

  const plan = data.plan;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>{plan.title}</Typography>
      <Stack spacing={2}>
        {plan.days.map((d, idx) => (
          <Card key={idx}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">{d.label || `Day ${d.dayIndex}`}</Typography>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => handleStartWorkout(d.dayIndex)}
                  disabled={d.items.length === 0}
                >
                  <FormattedMessage id="log-workout" />
                </Button>
              </Box>
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
                          <Box sx={{ mt: 1 }}>
                            {it.planSets.map((s: any, setIndex: number) => (
                              <Chip
                                key={setIndex}
                                label={`${intl.formatMessage({ id: 'set' })} ${setIndex + 1}: ${s.repMin ?? s.reps ?? ''}${s.repMax ? '-' + s.repMax : ''}${s.weight ? ` @ ${s.weight}kg` : ''}`}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 1, mb: 0.5 }}
                              />
                            ))}
                          </Box>
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

      {/* Workout Tracking Dialog */}
      <Dialog 
        open={trackingDialogOpen} 
        onClose={() => setTrackingDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FitnessCenter />
            <FormattedMessage id="workout-tracking" />
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <WorkoutTracking
            planId={id}
            dayIndex={selectedDayIndex}
            planData={plan}
            onClose={() => setTrackingDialogOpen(false)}
            onWorkoutSubmitted={handleWorkoutSubmitted}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}


