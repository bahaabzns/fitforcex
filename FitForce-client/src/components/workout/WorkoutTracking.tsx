'use client';

import { useState, useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  TextField,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  InputAdornment,
  LinearProgress
} from '@mui/material';
import { 
  Check, 
  SkipNext, 
  SkipPrevious
} from '@mui/icons-material';
import api from '@/utils/axios';

interface WorkoutSet {
  id: string;
  reps: number | null;
  weight: number | null;
  restTime: number | null;
  completed: boolean;
  completedAt?: string;
}

interface ExerciseTracking {
  id: string;
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  targetWeight?: number;
  sets: WorkoutSet[];
  notes: string;
  completed: boolean;
  isCardio?: boolean;
  targetDurationSeconds?: number;
  actualDurationSeconds?: number;
}

interface WorkoutTrackingData {
  planId: string;
  dayIndex: number;
  date: string;
  startTime?: string;
  endTime?: string;
  exercises: ExerciseTracking[];
  notes: string;
  completed: boolean;
}

interface CurrentExercisePosition {
  exerciseIndex: number;
}

interface ExerciseByExerciseState {
  currentPosition: CurrentExercisePosition;
  totalExercises: number;
  completedExercises: number;
  isWorkoutComplete: boolean;
}

interface WorkoutTrackingProps {
  planId: string;
  dayIndex: number;
  planData: {
    title: string;
    days: Array<{
      dayIndex: number;
      label?: string;
      items: Array<{
        id: string;
        exercise: any;
        sets: number;
        reps: string;
        notes?: string;
        planSets?: Array<{
          repMin?: number;
          repMax?: number;
          weight?: number;
        }>;
      }>;
    }>;
  };
  onClose: () => void;
  onWorkoutSubmitted?: (data: WorkoutTrackingData) => void;
}

const isCardioExercise = (item: any) => {
  const exerciseNode = item?.exercise ? item.exercise : item;
  if (item?.isCardio !== undefined) return Boolean(item.isCardio);
  if (exerciseNode?.isCardio !== undefined) return Boolean(exerciseNode.isCardio);
  const category = exerciseNode?.category?.toLowerCase() || '';
  const muscleGroup = exerciseNode?.muscleGroup?.toLowerCase() || '';
  return (
    category === 'cardio' ||
    muscleGroup.includes('cardio') ||
    Boolean(
      item?.durationSeconds ||
        item?.durationMinutes ||
        item?.targetDurationSeconds ||
        exerciseNode?.defaultDurationSeconds,
    )
  );
};

const extractCardioMeta = (item: any) => {
  let notes = item?.notes || '';
  let durationSeconds =
    item?.durationSeconds ||
    (item?.durationMinutes ? item.durationMinutes * 60 : undefined);
  if ((!durationSeconds || durationSeconds <= 0) && item?.exercise?.defaultDurationSeconds) {
    durationSeconds = item.exercise.defaultDurationSeconds;
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

  return {
    durationSeconds: durationSeconds ?? null,
    notes: notes || '',
  };
};

const formatTimerValue = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(String(hours).padStart(2, '0'));
  }
  parts.push(String(minutes).padStart(2, '0'));
  parts.push(String(secs).padStart(2, '0'));
  return parts.join(':');
};

export default function WorkoutTracking({
  planId,
  dayIndex,
  planData,
  onClose,
  onWorkoutSubmitted
}: WorkoutTrackingProps) {
  const intl = useIntl();
  const [trackingData, setTrackingData] = useState<WorkoutTrackingData | null>(null);
  const [saving, setSaving] = useState(false);
  const [workoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutStartTime] = useState(new Date().toTimeString().slice(0, 5));
  const [workoutEndTime, setWorkoutEndTime] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [cardioTimers, setCardioTimers] = useState<Record<string, { elapsed: number; running: boolean }>>({});
  
  // Exercise-by-exercise tracking state
  const [exerciseByExerciseState, setExerciseByExerciseState] = useState<ExerciseByExerciseState>({
    currentPosition: { exerciseIndex: 0 },
    totalExercises: 0,
    completedExercises: 0,
    isWorkoutComplete: false
  });
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [incompleteWorkout, setIncompleteWorkout] = useState<any>(null);

  const currentDay = planData.days.find(d => d.dayIndex === dayIndex);

  useEffect(() => {
    if (currentDay) {
      const exercises: ExerciseTracking[] = currentDay.items.map((item, index) => {
        const isCardio = isCardioExercise(item);
        const { durationSeconds, notes } = extractCardioMeta(item);
        const targetDuration = isCardio
          ? durationSeconds || item.exercise?.defaultDurationSeconds || 600
          : undefined;

        const baseSets = Array.from({ length: item.sets || 1 }, (_, setIndex) => ({
          id: `set_${index}_${setIndex}`,
          reps: null,
          weight: null,
          restTime: null,
          completed: false
        }));

        return {
          id: `exercise_${index}`,
          exerciseId: item.id,
          exerciseName: item.exercise?.name || 'Exercise',
          targetSets: item.sets || 1,
          targetReps: String(item.reps || '8-12'),
          targetWeight: item.planSets?.[0]?.weight,
          sets: isCardio ? baseSets.slice(0, 1) : baseSets,
          notes: notes,
          completed: false,
          isCardio,
          targetDurationSeconds: targetDuration,
          actualDurationSeconds: isCardio ? item.actualDurationSeconds ?? 0 : undefined,
        };
      });

      setTrackingData({
        planId,
        dayIndex,
        date: workoutDate,
        startTime: workoutStartTime,
        exercises,
        notes: '',
        completed: false
      });

      setExerciseByExerciseState({
        currentPosition: { exerciseIndex: 0 },
        totalExercises: exercises.length,
        completedExercises: 0,
        isWorkoutComplete: false
      });

      setCardioTimers(() => {
        const timers: Record<string, { elapsed: number; running: boolean }> = {};
        exercises.forEach((exercise) => {
          if (exercise.isCardio) {
            timers[exercise.id] = {
              elapsed: exercise.actualDurationSeconds ?? 0,
              running: false,
            };
          }
        });
        return timers;
      });
    }
  }, [planId, dayIndex, currentDay, workoutDate, workoutStartTime]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCardioTimers((prev) => {
        let changed = false;
        const next: typeof prev = {};
        Object.entries(prev).forEach(([key, timer]) => {
          if (timer.running) {
            next[key] = { running: true, elapsed: timer.elapsed + 1 };
            changed = true;
          } else {
            next[key] = timer;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check for incomplete workout on component mount using localStorage
  useEffect(() => {
    checkForIncompleteWorkout();
  }, [planId, dayIndex]);

  const checkForIncompleteWorkout = () => {
    try {
      const storageKey = `incomplete_workout_${planId}_${dayIndex}`;
      const incompleteWorkoutData = localStorage.getItem(storageKey);
      
      if (incompleteWorkoutData) {
        const parsedData = JSON.parse(incompleteWorkoutData);
        const today = new Date().toDateString();
        const storedDate = parsedData.trackingData?.date || parsedData.date;
        
        if (storedDate) {
          const workoutDate = new Date(storedDate).toDateString();
          if (workoutDate === today) {
            setIncompleteWorkout(parsedData);
            setShowContinueDialog(true);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch (error) {
      console.log('No incomplete workout found:', error);
    }
  };

  const saveIncompleteWorkoutToStorage = () => {
    if (!trackingData) return;
    
    try {
      const storageKey = `incomplete_workout_${planId}_${dayIndex}`;
      const incompleteData = {
        trackingData,
        exerciseByExerciseState,
        cardioTimers,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(storageKey, JSON.stringify(incompleteData));
      console.log('Incomplete workout saved to localStorage');
    } catch (error) {
      console.error('Error saving incomplete workout:', error);
    }
  };

  const clearIncompleteWorkoutFromStorage = () => {
    try {
      const storageKey = `incomplete_workout_${planId}_${dayIndex}`;
      localStorage.removeItem(storageKey);
      console.log('Incomplete workout cleared from localStorage');
    } catch (error) {
      console.error('Error clearing incomplete workout:', error);
    }
  };

  // Exercise-by-exercise navigation functions
  const getCurrentExercise = () => {
    if (!trackingData) {
      console.log('No tracking data available');
      return null;
    }
    
    const { exerciseIndex } = exerciseByExerciseState.currentPosition;
    const exercise = trackingData.exercises[exerciseIndex];
    
    console.log('getCurrentExercise:', {
      exerciseIndex,
      totalExercises: trackingData.exercises.length,
      exercise: exercise ? {
        name: exercise.exerciseName,
        setsCount: exercise.sets.length,
        sets: exercise.sets.map(s => ({ reps: s.reps, weight: s.weight, completed: s.completed }))
      } : null
    });
    
    return exercise || null;
  };

  const updateSetData = (setIndex: number, field: keyof WorkoutSet, value: any) => {
    if (!trackingData) return;
    
    const newTrackingData = { ...trackingData };
    const { exerciseIndex } = exerciseByExerciseState.currentPosition;
    const set = newTrackingData.exercises[exerciseIndex].sets[setIndex];
    
    if (set) {
      set[field] = value;
      setTrackingData(newTrackingData);
    }
  };

  const updateExerciseNotes = (value: string) => {
    if (!trackingData) return;

    const newTrackingData = { ...trackingData };
    const { exerciseIndex } = exerciseByExerciseState.currentPosition;
    if (newTrackingData.exercises[exerciseIndex]) {
      newTrackingData.exercises[exerciseIndex].notes = value;
      setTrackingData(newTrackingData);
    }
  };

  const getCardioTimer = (exerciseId: string) =>
    cardioTimers[exerciseId] || { elapsed: 0, running: false };

  const toggleCardioTimer = (exerciseId: string) => {
    setCardioTimers((prev) => {
      const timer = prev[exerciseId] || { elapsed: 0, running: false };
      return {
        ...prev,
        [exerciseId]: { ...timer, running: !timer.running },
      };
    });
  };

  const resetCardioTimer = (exerciseId: string) => {
    setCardioTimers((prev) => ({
      ...prev,
      [exerciseId]: { elapsed: 0, running: false },
    }));
    if (trackingData) {
      const newTrackingData = { ...trackingData };
      const exerciseIndex = newTrackingData.exercises.findIndex((ex) => ex.id === exerciseId);
      if (exerciseIndex >= 0) {
        newTrackingData.exercises[exerciseIndex].actualDurationSeconds = 0;
        setTrackingData(newTrackingData);
      }
    }
  };

  const stopCardioTimer = (exerciseId: string) => {
    setCardioTimers((prev) => {
      if (!prev[exerciseId] || !prev[exerciseId].running) {
        return prev;
      }
      return {
        ...prev,
        [exerciseId]: { ...prev[exerciseId], running: false },
      };
    });
  };

  const getCardioElapsed = (exercise: ExerciseTracking) => {
    const timer = cardioTimers[exercise.id];
    return timer ? timer.elapsed : exercise.actualDurationSeconds ?? 0;
  };

  const completeExercise = async () => {
    if (!trackingData) return;

    const newTrackingData = { ...trackingData };
    const { exerciseIndex } = exerciseByExerciseState.currentPosition;
    const exercise = newTrackingData.exercises[exerciseIndex];
    
    if (exercise.isCardio) {
      const elapsed = getCardioElapsed(exercise);
      exercise.actualDurationSeconds = elapsed;
      stopCardioTimer(exercise.id);
      if (!exercise.sets || exercise.sets.length === 0) {
        exercise.sets = [{
          id: `set_${exerciseIndex}_0`,
          reps: null,
          weight: null,
          restTime: null,
          completed: false,
        }];
      }
    }

    // Mark all sets as completed
    exercise.sets.forEach(set => {
      if (!set.completed) {
        set.completed = true;
        set.completedAt = new Date().toISOString();
      }
    });
    
    // Mark exercise as completed
    exercise.completed = true;
    
    setTrackingData(newTrackingData);
    
    // Save progress for this exercise
    await saveExerciseProgress();
    
    // Save incomplete workout to localStorage for continue functionality
    saveIncompleteWorkoutToStorage();
    
    // Move to next exercise
    moveToNextExercise();
  };

  const skipExercise = async () => {
    if (!trackingData) return;

    const newTrackingData = { ...trackingData };
    const { exerciseIndex } = exerciseByExerciseState.currentPosition;
    const exercise = newTrackingData.exercises[exerciseIndex];

    if (exercise.isCardio) {
      stopCardioTimer(exercise.id);
      exercise.actualDurationSeconds = 0;
      if (!exercise.sets || exercise.sets.length === 0) {
        exercise.sets = [{
          id: `set_${exerciseIndex}_0`,
          reps: null,
          weight: null,
          restTime: null,
          completed: false,
        }];
      }
    }
    
    // Mark all sets as completed with 0 reps (skipped)
    exercise.sets.forEach(set => {
      set.completed = true;
      set.reps = 0;
      set.weight = 0;
      set.completedAt = new Date().toISOString();
    });
    
    // Mark exercise as completed
    exercise.completed = true;
    
    setTrackingData(newTrackingData);
    
    // Save progress for this exercise
    await saveExerciseProgress();
    
    // Move to next exercise
    moveToNextExercise();
  };

  const moveToNextExercise = () => {
    if (!trackingData) return;

    const { exerciseIndex } = exerciseByExerciseState.currentPosition;
    
    if (exerciseIndex < trackingData.exercises.length - 1) {
      // Move to next exercise
      setExerciseByExerciseState(prev => ({
        ...prev,
        currentPosition: { exerciseIndex: exerciseIndex + 1 },
        completedExercises: prev.completedExercises + 1
      }));
    } else {
      // All exercises completed
      setExerciseByExerciseState(prev => ({ 
        ...prev, 
        completedExercises: prev.completedExercises + 1,
        isWorkoutComplete: true 
      }));
    }
  };

  const moveToPreviousExercise = () => {
    if (!trackingData) return;

    const { exerciseIndex } = exerciseByExerciseState.currentPosition;
    
    if (exerciseIndex > 0) {
      setExerciseByExerciseState(prev => ({
        ...prev,
        currentPosition: { exerciseIndex: exerciseIndex - 1 },
        completedExercises: Math.max(0, prev.completedExercises - 1)
      }));
    }
  };

  const saveExerciseProgress = async () => {
    if (!trackingData) return;

    setSaving(true);
    try {
      const currentTime = new Date().toTimeString().slice(0, 5);
      
      // Transform data to remove id fields
      const transformedExercises = trackingData.exercises.map((exercise) => {
        const { id, sets, ...rest } = exercise;
        const actualDurationSeconds = exercise.isCardio
          ? cardioTimers[exercise.id]?.elapsed ?? exercise.actualDurationSeconds ?? 0
          : undefined;
        return {
          ...rest,
          actualDurationSeconds: exercise.isCardio ? actualDurationSeconds : rest.actualDurationSeconds,
          sets: sets.map(({ id: setId, ...setRest }) => setRest),
        };
      });
      
      const progressData = {
        ...trackingData,
        endTime: currentTime, // Update end time when saving progress
        completed: false,
        exercises: transformedExercises
      };
      
      console.log('Saving exercise progress:', progressData);
      
      // Only save progress if there are completed exercises
      const hasCompletedExercises = transformedExercises.some(exercise => exercise.completed);
      
      if (hasCompletedExercises) {
        const response = await api.post('/api/workout/logs', progressData);
        console.log('Exercise progress saved:', response.data);
      } else {
        console.log('No completed exercises to save');
      }
    } catch (error) {
      console.error('Error saving exercise progress:', error);
    } finally {
      setSaving(false);
    }
  };

  const calculateWorkoutStats = () => {
    if (!trackingData) return { totalSets: 0, totalVolume: 0, averageReps: 0 };

    let totalSets = 0;
    let totalVolume = 0;
    let totalReps = 0;
    let completedSets = 0;

    trackingData.exercises.forEach(exercise => {
      exercise.sets.forEach(set => {
        if (set.completed && set.reps && set.weight) {
          totalSets++;
          totalVolume += set.reps * set.weight;
          totalReps += set.reps;
          completedSets++;
        }
      });
    });

    return {
      totalSets,
      totalVolume,
      averageReps: completedSets > 0 ? Math.round(totalReps / completedSets) : 0
    };
  };

  const handleSubmitWorkout = async () => {
    if (!trackingData) return;

    setSaving(true);
    try {
      const endTime = new Date().toTimeString().slice(0, 5); // Auto-calculate end time
      
      // Transform data to remove id fields
      const transformedExercises = trackingData.exercises.map((exercise) => {
        const { id, sets, ...rest } = exercise;
        const actualDurationSeconds = exercise.isCardio
          ? cardioTimers[exercise.id]?.elapsed ?? exercise.actualDurationSeconds ?? 0
          : undefined;
        return {
          ...rest,
          actualDurationSeconds: exercise.isCardio ? actualDurationSeconds : rest.actualDurationSeconds,
          sets: sets.map(({ id: setId, ...setRest }) => setRest),
        };
      });
      
      const completedData = {
        ...trackingData,
        endTime,
        completed: true,
        exercises: transformedExercises
      };

      console.log('Sending workout data:', completedData);
      console.log('Exercises after transformation:', transformedExercises);

      // Call the API to save the workout
      const response = await api.post('/api/workout/logs', completedData);
      
      console.log('Workout submitted successfully:', response.data);
      
      // Clear incomplete workout from localStorage since workout is now complete
      clearIncompleteWorkoutFromStorage();
      
      setShowSummary(true);
      onWorkoutSubmitted?.(completedData);
    } catch (error) {
      console.error('Error submitting workout:', error);
      alert('Error submitting workout. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!trackingData || !currentDay) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const stats = calculateWorkoutStats();
  const activeExercise = getCurrentExercise();
  const activeCardioTimer = activeExercise ? getCardioTimer(activeExercise.id) : { elapsed: 0, running: false };
  const activeCardioTarget = activeExercise?.targetDurationSeconds ?? 0;
  const hasReachedCardioTarget =
    Boolean(activeExercise?.isCardio && activeCardioTarget > 0 && activeCardioTimer.elapsed >= activeCardioTarget);

  return (
    <Box sx={{ p: 2 }}>
      {/* Continue Workout Dialog */}
      <Dialog open={showContinueDialog} onClose={() => setShowContinueDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Continue Previous Workout?</DialogTitle>
        <DialogContent>
          <Typography>
            You have an incomplete workout from today. Would you like to continue where you left off or start a new workout?
          </Typography>
          {incompleteWorkout && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Previous workout: {(incompleteWorkout.trackingData?.planId ?? incompleteWorkout.planId) || planData.title} - Day {((incompleteWorkout.trackingData?.dayIndex ?? incompleteWorkout.dayIndex) ?? 0) + 1}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Started: {(incompleteWorkout.trackingData?.startTime ?? incompleteWorkout.startTime) || '—'} on {(incompleteWorkout.trackingData?.date || incompleteWorkout.date) ? new Date(incompleteWorkout.trackingData?.date || incompleteWorkout.date).toLocaleDateString() : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Progress: Exercise {incompleteWorkout.exerciseByExerciseState?.currentPosition?.exerciseIndex + 1} of {incompleteWorkout.exerciseByExerciseState?.totalExercises}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowContinueDialog(false);
            clearIncompleteWorkoutFromStorage();
          }}>Start New Workout</Button>
          <Button variant="contained" onClick={() => {
            setShowContinueDialog(false);
            // Load previous workout data
            if (incompleteWorkout) {
              const trackingPayload = incompleteWorkout.trackingData || incompleteWorkout;
              setTrackingData(trackingPayload);
              setExerciseByExerciseState(incompleteWorkout.exerciseByExerciseState);
              setCardioTimers(incompleteWorkout.cardioTimers || {});
              console.log('Loaded incomplete workout:', incompleteWorkout);
            }
          }}>Continue Previous Workout</Button>
        </DialogActions>
      </Dialog>

      {/* Workout Complete Dialog */}
      <Dialog open={exerciseByExerciseState.isWorkoutComplete} onClose={() => {}} maxWidth="sm" fullWidth>
        <DialogTitle>🎉 Workout Complete!</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            Congratulations! You've completed all sets in your workout.
          </Alert>
          <Typography>
            Would you like to finish the workout or continue with additional exercises?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setExerciseByExerciseState(prev => ({ ...prev, isWorkoutComplete: false }));
          }}>Continue</Button>
          <Button variant="contained" onClick={handleSubmitWorkout}>
            Finish Workout
          </Button>
        </DialogActions>
      </Dialog>

      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={<FormattedMessage id="workout-tracking" />}
          subheader={`${planData.title} - ${currentDay.label || `Day ${dayIndex}`}`}
        />
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Workout Date: {workoutDate}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start Time: {workoutStartTime}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Duration: {workoutStartTime && workoutEndTime ? 
                  `${Math.floor((new Date(`2000-01-01T${workoutEndTime}`).getTime() - new Date(`2000-01-01T${workoutStartTime}`).getTime()) / (1000 * 60))} minutes` : 
                  'In Progress...'
                }
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ mr: 2 }}>
              Workout Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {exerciseByExerciseState.currentPosition.exerciseIndex + 1} of {trackingData?.exercises.length} exercises
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={(exerciseByExerciseState.currentPosition.exerciseIndex / (trackingData?.exercises.length || 1)) * 100}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </CardContent>
      </Card>

      {/* Current Exercise Display */}
      {activeExercise && (
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title={activeExercise.exerciseName}
            subheader={`Exercise ${exerciseByExerciseState.currentPosition.exerciseIndex + 1} of ${trackingData?.exercises.length}`}
            action={
              !activeExercise.isCardio && (
                <Chip 
                  label={`Target: ${activeExercise.targetReps} reps`}
                  color="primary"
                  variant="outlined"
                />
              )
            }
          />
          <CardContent>
            {activeExercise.isCardio ? (
              <Box
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: hasReachedCardioTarget ? 'success.lighter' : 'action.hover',
                  border: '1px solid',
                  borderColor: hasReachedCardioTarget ? 'success.main' : 'primary.main',
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>
                      {intl.formatMessage({ id: 'client.workout.targetDuration' })}
                    </Typography>
                    <Typography variant="h4" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                      {formatTimerValue(activeCardioTarget)}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>
                      {intl.formatMessage({ id: 'client.workout.elapsedTime' })}
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: hasReachedCardioTarget ? 'success.main' : 'text.primary',
                      }}
                    >
                      {formatTimerValue(activeCardioTimer.elapsed)}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    color={activeCardioTimer.running ? 'warning' : 'primary'}
                    onClick={() => toggleCardioTimer(activeExercise.id)}
                  >
                    {activeCardioTimer.running
                      ? intl.formatMessage({ id: 'client.workout.pauseTimer' })
                      : activeCardioTimer.elapsed > 0
                        ? intl.formatMessage({ id: 'client.workout.resumeTimer' })
                        : intl.formatMessage({ id: 'client.workout.startTimer' })}
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => resetCardioTimer(activeExercise.id)}
                    disabled={activeCardioTimer.elapsed === 0}
                  >
                    {intl.formatMessage({ id: 'client.workout.resetTimer' })}
                  </Button>
                </Stack>

                {hasReachedCardioTarget && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    {intl.formatMessage({ id: 'client.workout.targetHit' })}
                  </Alert>
                )}
              </Box>
            ) : (
              <>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  All Sets ({activeExercise.sets.length}) - Fill all sets before completing exercise
                </Typography>

                {process.env.NODE_ENV === 'development' && (
                  <Box sx={{ mb: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="caption">
                      Debug: Exercise {exerciseByExerciseState.currentPosition.exerciseIndex + 1}, Sets: {activeExercise.sets.length}, Current Exercise: {activeExercise.exerciseName}
                    </Typography>
                  </Box>
                )}

                <Stack spacing={2}>
                  {activeExercise.sets.map((set, setIndex) => (
                    <Card key={setIndex} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="h6" sx={{ minWidth: '80px', fontWeight: 'bold' }}>
                          Set {setIndex + 1}
                        </Typography>

                        <TextField
                          label="Reps"
                          type="number"
                          value={set.reps || ''}
                          onChange={(e) => updateSetData(setIndex, 'reps', parseInt(e.target.value) || null)}
                          sx={{ width: '120px' }}
                          InputProps={{
                            inputProps: { min: 0, max: 100 }
                          }}
                          placeholder="0"
                        />

                        <TextField
                          label="Weight (kg)"
                          type="number"
                          value={set.weight || ''}
                          onChange={(e) => updateSetData(setIndex, 'weight', parseFloat(e.target.value) || null)}
                          sx={{ width: '140px' }}
                          InputProps={{
                            inputProps: { min: 0, step: 0.5 }
                          }}
                          placeholder="0"
                        />

                        <TextField
                          label="Rest Time (sec)"
                          type="number"
                          value={set.restTime || ''}
                          onChange={(e) => updateSetData(setIndex, 'restTime', parseInt(e.target.value) || null)}
                          sx={{ width: '140px' }}
                          InputProps={{
                            inputProps: { min: 0, max: 600 }
                          }}
                          placeholder="0"
                        />

                        <Chip 
                          label={set.completed ? '✓ Completed' : '⏳ Pending'}
                          color={set.completed ? 'success' : 'default'}
                          size="small"
                          sx={{ minWidth: '100px' }}
                        />
                      </Box>
                    </Card>
                  ))}
                </Stack>
              </>
            )}

            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.200' }}>
              <Typography variant="body2" color="info.dark" sx={{ fontWeight: 500 }}>
                {activeExercise.isCardio
                  ? '📝 Use the timer to log your cardio duration. Tap "Complete Exercise" once finished.'
                  : '📝 Fill in reps, weight, and rest time for ALL sets above, then click "Complete Exercise" to move to the next exercise.'}
              </Typography>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              sx={{ mt: 2 }}
              label="Exercise Notes"
              placeholder="Add notes for this exercise..."
              value={activeExercise.notes || ''}
              onChange={(e) => updateExerciseNotes(e.target.value)}
            />
            
            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<SkipPrevious />}
                onClick={moveToPreviousExercise}
                disabled={exerciseByExerciseState.currentPosition.exerciseIndex === 0}
              >
                Previous Exercise
              </Button>
              
              <Button
                variant="outlined"
                color="warning"
                startIcon={<SkipNext />}
                onClick={skipExercise}
                disabled={saving}
              >
                Skip Exercise
              </Button>
              
              <Button
                variant="contained"
                color="success"
                startIcon={<Check />}
                onClick={completeExercise}
                disabled={saving}
                size="large"
              >
                Complete Exercise & Move to Next
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={saveExerciseProgress}
          disabled={saving}
        >
          <FormattedMessage id="save-progress" />
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmitWorkout}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} /> : <Check />}
        >
          <FormattedMessage id="submit-workout" />
        </Button>
      </Box>

      {/* Summary Dialog */}
      <Dialog open={showSummary} onClose={() => setShowSummary(false)} maxWidth="sm" fullWidth>
        <DialogTitle><FormattedMessage id="workout-summary" /></DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="success">
              <FormattedMessage id="workout-logged" />
            </Alert>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary">
                  {stats.totalSets}
                </Typography>
                <Typography variant="caption">
                  <FormattedMessage id="total-sets" />
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary">
                  {stats.totalVolume}kg
                </Typography>
                <Typography variant="caption">
                  <FormattedMessage id="total-volume" />
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary">
                  {stats.averageReps}
                </Typography>
                <Typography variant="caption">
                  <FormattedMessage id="average-reps" />
                </Typography>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowSummary(false);
            onClose();
          }}>
            <FormattedMessage id="dashboard" />
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
