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
  Chip,
  Paper,
  Avatar,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PlayArrow, FitnessCenter } from '@mui/icons-material';
import WorkoutTracking from '@/components/workout/WorkoutTracking';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

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

const formatDuration = (totalSeconds: number) => {
  if (!totalSeconds || totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(String(hours).padStart(2, '0'));
  }
  parts.push(String(minutes).padStart(2, '0'));
  parts.push(String(seconds).padStart(2, '0'));
  return parts.join(':');
};

const getCardioMeta = (item: any) => {
  const exercise = item?.exercise || {};
  const category = exercise?.category?.toLowerCase() || '';
  const muscleGroup = exercise?.muscleGroup?.toLowerCase() || '';
  let notes = item?.notes || '';
  let durationSeconds =
    item?.durationSeconds ||
    (item?.durationMinutes ? item.durationMinutes * 60 : undefined);
  if ((!durationSeconds || durationSeconds <= 0) && exercise?.defaultDurationSeconds) {
    durationSeconds = exercise.defaultDurationSeconds;
  }

  if (
    (!durationSeconds || durationSeconds <= 0) &&
    typeof notes === 'string' &&
    notes.trim().startsWith('{')
  ) {
    try {
      const parsed = JSON.parse(notes);
      if (parsed?.durationSeconds) {
        durationSeconds = parsed.durationSeconds;
        notes = parsed.originalNotes || '';
      }
    } catch (_err) {
      // Notes were plain text; leave as-is
    }
  }

  const hasDuration = Boolean(durationSeconds);
  const explicitCardio = item?.isCardio ?? exercise?.isCardio;
  const isCardio =
    hasDuration ||
    (explicitCardio !== undefined
      ? Boolean(explicitCardio)
      : category === 'cardio' ||
        muscleGroup.includes('cardio'));

  return {
    isCardio,
    durationSeconds: isCardio ? durationSeconds ?? null : null,
    notes: notes || '',
  };
};

export default function ClientWorkoutPlanDetail() {
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const isArabic = currentLang === 'ar';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const params = useParams();
  const id = params?.id as string;
  const intl = useIntl();
  const { logoUrl, primaryColor, workspaceName } = useWorkspaceBranding();
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
          <Typography color="text.secondary">{t('client.plans.loading')}</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !data?.plan) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">{t('client.plans.loadError')}</Typography>
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
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'background.default', maxWidth: '100%', overflowX: 'hidden' }}>
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
        <Stack direction="row" alignItems="center" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
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
          <Box flex={1} sx={{ minWidth: 0 }}>
            <Typography variant="h4" fontWeight={700}>
              {(isArabic && (plan as any).titleArabic) || plan.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
              {t('client.workout.subtitle')}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Stack spacing={2}>
        {plan.days.map((d, idx) => (
          <Card key={idx}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ minWidth: 0, flex: 1 }}>
                  {d.label || `${t('client.workout.day')} ${d.dayIndex}`}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => handleStartWorkout(d.dayIndex)}
                  disabled={d.items.length === 0}
                >
                  {t('client.workout.log')}
                </Button>
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={2} sx={{ width: '100%' }}>
                {d.items.map((it, i) => {
                  const videoId = it?.exercise?.videoUrl ? getYouTubeVideoId(it.exercise.videoUrl) : null;
                  const youtubeThumbnailUrl = videoId ? getYouTubeThumbnail(videoId, 'medium') : null;
                  const gifUrl = it?.exercise?.gifImage || null;

                  const mediaUrl = gifUrl || youtubeThumbnailUrl;
                  const isYouTube = !!youtubeThumbnailUrl && !gifUrl;
                  const hasGif = !!gifUrl;
                  const cardioMeta = getCardioMeta(it);
                  const isCardio = cardioMeta.isCardio;
                  const cardioDurationSeconds = cardioMeta.durationSeconds;
                  const notesContent = cardioMeta.notes || it?.notes;
                  
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
                      <Box
                        sx={(theme) => ({
                          display: { xs: 'none', sm: 'flex' },
                          flexDirection: 'column',
                          alignItems: 'center',
                          minWidth: 48,
                          pt: 1
                        })}
                      >
                        <Box
                          sx={(theme) => ({
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            color: 'white',
                            background: primaryColor || theme.palette.primary.main,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                          })}
                        >
                          {i + 1}
                        </Box>
                        {i !== d.items.length - 1 && (
                          <Box
                            sx={(theme) => ({
                              width: 4,
                              flexGrow: 1,
                              mt: 0.75,
                              borderRadius: 999,
                              background: `linear-gradient(180deg, ${(primaryColor || theme.palette.primary.main)} 0%, transparent 100%)`
                            })}
                          />
                        )}
                      </Box>
                      <Card
                        sx={{
                          flexGrow: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          backgroundColor: (theme) =>
                            theme.palette.mode === 'dark'
                              ? 'background.paper'
                              : 'rgba(255, 255, 255, 0.95)',
                          borderRadius: 3,
                          boxShadow: (theme) =>
                            theme.palette.mode === 'dark'
                              ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                              : '0 8px 32px rgba(15, 23, 42, 0.12)',
                          overflow: 'hidden',
                          borderLeft: (theme) =>
                            `4px solid ${primaryColor || theme.palette.primary.main}`,
                          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: (theme) =>
                              theme.palette.mode === 'dark'
                                ? '0 12px 40px rgba(0,0,0,0.5)'
                                : '0 16px 45px rgba(15,23,42,0.18)',
                          },
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          alignItems="stretch"
                          sx={{ width: '100%' }}
                        >
                          {/* Exercise Media - Always show if available, especially on mobile */}
                          {mediaUrl ? (
                            <Box
                              sx={{
                                position: 'relative',
                                width: { xs: '100%', sm: 280 },
                                flexShrink: 0,
                                minHeight: { xs: 220, sm: '100%' },
                                overflow: 'hidden',
                                alignSelf: 'stretch',
                                backgroundColor: (theme) =>
                                  theme.palette.mode === 'dark'
                                    ? 'rgba(0, 0, 0, 0.2)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={mediaUrl}
                                alt={it.exercise?.name || 'Exercise'}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                  cursor: isYouTube ? 'pointer' : 'default',
                                  minHeight: '100%',
                                  minWidth: '100%',
                                }}
                                onClick={() => isYouTube && openYouTubeVideo(it.exercise.videoUrl)}
                                onError={(e) => {
                                  // Fallback if image fails to load - hide image and show placeholder
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector('.image-placeholder')) {
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'image-placeholder';
                                    placeholder.style.cssText = `
                                      width: 100%;
                                      height: 100%;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      background: ${theme.palette.mode === 'dark'
                                        ? 'rgba(0, 0, 0, 0.3)'
                                        : 'rgba(0, 0, 0, 0.05)'};
                                      color: ${theme.palette.text.secondary};
                                      font-size: 0.875rem;
                                    `;
                                    placeholder.textContent = hasGif ? 'GIF not available' : 'Image not available';
                                    parent.appendChild(placeholder);
                                  }
                                }}
                                loading="lazy"
                              />
                              {/* Play Button Overlay - only for YouTube videos */}
                              {isYouTube && (
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
                                    zIndex: 1,
                                    '&:hover': {
                                      backgroundColor: 'rgba(255, 0, 0, 0.8)',
                                      transform: 'translate(-50%, -50%) scale(1.08)',
                                    },
                                    '&:active': {
                                      transform: 'translate(-50%, -50%) scale(0.95)',
                                    }
                                  }}
                                  onClick={() => openYouTubeVideo(it.exercise.videoUrl)}
                                >
                                  <PlayArrow sx={{ color: 'white', fontSize: 30 }} />
                                </Box>
                              )}
                            </Box>
                          ) : (
                            // Placeholder when no media is available
                            <Box
                              sx={{
                                width: { xs: '100%', sm: 280 },
                                flexShrink: 0,
                                minHeight: { xs: 220, sm: '100%' },
                                alignSelf: 'stretch',
                                backgroundColor: (theme) =>
                                  theme.palette.mode === 'dark'
                                    ? 'rgba(0, 0, 0, 0.2)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <FitnessCenter sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
                            </Box>
                          )}
                          
                          <CardContent
                            sx={{
                              flexGrow: 1,
                              p: { xs: 2, sm: 3 },
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                        {/* Muscle Group Chip */}
                        <Chip
                          label={(isArabic && it.exercise?.muscleGroupArabic) || it.exercise?.muscleGroup || t('unknown')}
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
                            color: 'text.primary',
                            fontSize: '1.1rem',
                            lineHeight: 1.3
                          }}
                        >
                          {(isArabic && it.exercise?.nameArabic) || it.exercise?.name || t('exercise')}
                        </Typography>
                        
                        {/* Exercise Details */}
                        <Stack spacing={1} sx={{ mt: 2 }}>
                          {isCardio ? (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                {t('client.workout.duration')}
                              </Typography>
                              <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'success.main' }}>
                                {formatDuration(cardioDurationSeconds || 0)}
                              </Typography>
                            </Box>
                          ) : (
                            <>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                  {t('client.workout.sets')}:
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                  {it.sets || 'N/A'}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                  {t('client.workout.reps')}:
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                  {it.reps || 'N/A'}
                                </Typography>
                              </Box>
                              
                              {!isCardio && it.planSets?.[0]?.weight && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                    {t('client.workout.weight')}:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                    {it.planSets[0].weight}kg
                                  </Typography>
                                </Box>
                              )}
                            </>
                          )}
                        </Stack>
                        
                        {isCardio ? (
                          <Box
                            sx={{
                              mt: 2,
                              p: 2,
                              borderRadius: 2,
                              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : 'success.lighter'),
                              border: '1px solid',
                              borderColor: 'success.light',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}
                            >
                              {t('client.workout.duration')}
                            </Typography>
                            <Typography
                              variant="h4"
                              sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'success.main', mt: 0.5 }}
                            >
                              {formatDuration(cardioDurationSeconds || 0)}
                            </Typography>
                            {notesContent && (
                              <Typography
                                variant="body2"
                                sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}
                              >
                                {notesContent}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <>
                            {!isCardio && Array.isArray(it.planSets) && it.planSets.length > 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1 }}>
                                  {t('client.workout.setsDetails')}:
                                </Typography>
                                {it.planSets.map((s: any, setIndex: number) => (
                                  <Chip
                                    key={setIndex}
                                    label={`${intl.formatMessage({ id: 'set' })} ${setIndex + 1}: ${s.repMin ?? s.reps ?? ''}${s.repMax ? '-' + s.repMax : ''}${s.weight ? ` @ ${s.weight}kg` : ''}${s.tempo ? ` • Tempo: ${s.tempo}` : ''}${(s.rir !== undefined && s.rir !== null) ? ` • RIR: ${s.rir}` : ''}${s.restSeconds ? ` • Rest: ${s.restSeconds}s` : ''}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ mr: 1, mb: 0.5 }}
                                  />
                                ))}

                                {/* Exercise-level summary (tempo / RIR / rest) */}
                                {(it.tempo || (it.rir !== undefined && it.rir !== null) || it.restSeconds) && (
                                  <Box sx={{ mt: 1 }}>
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                      {it.tempo && (
                                        <Chip size="small" label={`Tempo: ${it.tempo}`} sx={{ mr: 1, mb: 0.5 }} />
                                      )}
                                      {(it.rir !== undefined && it.rir !== null) && (
                                        <Chip size="small" label={`RIR: ${it.rir}`} sx={{ mr: 1, mb: 0.5 }} />
                                      )}
                                      {it.restSeconds && (
                                        <Chip size="small" label={`Rest: ${it.restSeconds}s`} sx={{ mr: 1, mb: 0.5 }} />
                                      )}
                                    </Stack>
                                  </Box>
                                )}
                              </Box>
                            )}

                            {notesContent && (
                              <Box sx={{ mt: 2, p: 1, backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'action.hover' : 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', fontSize: '0.85rem' }}>
                                  {notesContent}
                                </Typography>
                              </Box>
                            )}
                          </>
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
                            {t('client.workout.watchVideo')}
                          </Button>
                        )}
                        </CardContent>
                      </Stack>
                    </Card>
                  </Box>
                  );
                })}
                {d.items.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">{t('client.workout.noExercises')}</Typography>
                  </Box>
                )}
              </Stack>
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


