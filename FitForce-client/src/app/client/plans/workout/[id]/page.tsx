'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useWorkspaceBranding } from '@/hooks/useWorkspaceBranding';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Stack,
  CircularProgress,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip
} from '@mui/material';
import { PlayArrow, FitnessCenter } from '@mui/icons-material';
import WorkoutTracking from '@/components/workout/WorkoutTracking';

// Helper function to extract YouTube video ID from URL
const getYouTubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Helper function to get YouTube thumbnail URL
const getYouTubeThumbnail = (videoId: string, quality: 'default' | 'medium' | 'high' = 'medium'): string => {
  return `https://img.youtube.com/vi/${videoId}/${quality}default.jpg`;
};

// Helper function to open YouTube video
const openYouTubeVideo = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

export default function ClientWorkoutPlanDetail() {
  const params = useParams();
  const id = params?.id as string;
  const intl = useIntl();
  const { logoUrl, primaryColor, workspaceName } = useWorkspaceBranding();
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
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}CC 100%)`,
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          {logoUrl ? (
            <Box sx={{ width: 56, height: 56, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={`${workspaceName} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </Box>
          ) : (
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              <FitnessCenter sx={{ fontSize: 32 }} />
            </Avatar>
          )}
          <Box flex={1}>
            <Typography variant="h4" fontWeight={700}>
              {plan.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
              Complete workout plan for your goals
            </Typography>
          </Box>
        </Stack>
      </Paper>

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
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { 
                  xs: '1fr', 
                  sm: 'repeat(2, 1fr)', 
                  md: 'repeat(3, 1fr)' 
                }, 
                gap: 2,
                width: '100%'
              }}>
                {d.items.map((it, i) => {
                  const videoId = it?.exercise?.videoUrl ? getYouTubeVideoId(it.exercise.videoUrl) : null;
                  const thumbnailUrl = videoId ? getYouTubeThumbnail(videoId, 'medium') : null;
                  
                  return (
                    <Card 
                      key={i}
                      sx={{ 
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        border: '2px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: 3,
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
                        }
                      }}
                    >
                      {/* Exercise Thumbnail */}
                      {thumbnailUrl && (
                        <Box sx={{ position: 'relative', height: 200 }}>
                          <CardMedia
                            component="img"
                            height="200"
                            image={thumbnailUrl}
                            alt={it.exercise?.name || 'Exercise'}
                            sx={{
                              objectFit: 'cover',
                              cursor: 'pointer'
                            }}
                            onClick={() => openYouTubeVideo(it.exercise.videoUrl)}
                          />
                          {/* Play Button Overlay */}
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                              borderRadius: '50%',
                              width: 60,
                              height: 60,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 0, 0, 0.8)',
                                transform: 'translate(-50%, -50%) scale(1.1)',
                              }
                            }}
                            onClick={() => openYouTubeVideo(it.exercise.videoUrl)}
                          >
                            <PlayArrow sx={{ color: 'white', fontSize: 30 }} />
                          </Box>
                        </Box>
                      )}
                      
                      <CardContent sx={{ flexGrow: 1, p: 2 }}>
                        {/* Muscle Group Chip */}
                        <Chip
                          label={it.exercise?.muscleGroup || 'Unknown'}
                          size="small"
                          color="primary"
                          sx={{ 
                            mb: 1,
                            fontWeight: 600
                          }}
                        />
                        
                        {/* Exercise Name */}
                        <Typography 
                          variant="h6" 
                          component="h3"
                          sx={{ 
                            fontWeight: 700,
                            mb: 1,
                            color: '#333',
                            fontSize: '1.1rem',
                            lineHeight: 1.3
                          }}
                        >
                          {it.exercise?.name || 'Exercise'}
                        </Typography>
                        
                        {/* Exercise Details */}
                        <Stack spacing={1} sx={{ mt: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#666' }}>
                              Sets:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#333' }}>
                              {it.sets || 'N/A'}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#666' }}>
                              Reps:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#333' }}>
                              {it.reps || 'N/A'}
                            </Typography>
                          </Box>
                          
                          {it.planSets?.[0]?.weight && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#666' }}>
                                Weight:
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#333' }}>
                                {it.planSets[0].weight}kg
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                        
                        {/* Plan Sets */}
                        {Array.isArray(it.planSets) && it.planSets.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#666', mb: 1 }}>
                              Sets Details:
                            </Typography>
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
                        
                        {/* Notes */}
                        {it.notes && (
                          <Box sx={{ mt: 2, p: 1, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ 
                              fontStyle: 'italic', 
                              color: '#555',
                              fontSize: '0.85rem'
                            }}>
                              {it.notes}
                            </Typography>
                          </Box>
                        )}
                        
                        {/* YouTube Link Button */}
                        {it.exercise?.videoUrl && (
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            startIcon={<PlayArrow />}
                            onClick={() => openYouTubeVideo(it.exercise.videoUrl)}
                            sx={{ 
                              mt: 2,
                              width: '100%',
                              fontWeight: 600
                            }}
                          >
                            Watch Video
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {d.items.length === 0 && (
                  <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">No exercises for this day.</Typography>
                  </Box>
                )}
              </Box>
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


