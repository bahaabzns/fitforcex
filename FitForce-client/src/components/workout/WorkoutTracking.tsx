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
  Grid,
  Stack,
  Chip,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Paper
} from '@mui/material';
import { Add, Remove, Check, PlayArrow, Pause, Stop } from '@mui/icons-material';
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

export default function WorkoutTracking({
  planId,
  dayIndex,
  planData,
  onClose,
  onWorkoutSubmitted
}: WorkoutTrackingProps) {
  const intl = useIntl();
  const [trackingData, setTrackingData] = useState<WorkoutTrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutStartTime, setWorkoutStartTime] = useState(new Date().toTimeString().slice(0, 5));
  const [workoutEndTime, setWorkoutEndTime] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const currentDay = planData.days.find(d => d.dayIndex === dayIndex);

  useEffect(() => {
    if (currentDay) {
      const exercises: ExerciseTracking[] = currentDay.items.map((item, index) => ({
        id: `exercise_${index}`,
        exerciseId: item.id,
        exerciseName: item.exercise?.name || 'Exercise',
        targetSets: item.sets || 1,
        targetReps: String(item.reps || '8-12'),
        targetWeight: item.planSets?.[0]?.weight,
        sets: Array.from({ length: item.sets || 1 }, (_, setIndex) => ({
          id: `set_${index}_${setIndex}`,
          reps: null,
          weight: null,
          restTime: null,
          completed: false
        })),
        notes: item.notes || '',
        completed: false
      }));

      setTrackingData({
        planId,
        dayIndex,
        date: workoutDate,
        startTime: workoutStartTime,
        exercises,
        notes: workoutNotes,
        completed: false
      });
    }
  }, [planId, dayIndex, currentDay, workoutDate, workoutStartTime, workoutNotes]);

  const updateSetData = (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: any) => {
    if (!trackingData) return;

    const newTrackingData = { ...trackingData };
    newTrackingData.exercises[exerciseIndex].sets[setIndex] = {
      ...newTrackingData.exercises[exerciseIndex].sets[setIndex],
      [field]: value
    };

    setTrackingData(newTrackingData);
  };

  const toggleSetCompleted = (exerciseIndex: number, setIndex: number) => {
    if (!trackingData) return;

    const newTrackingData = { ...trackingData };
    const set = newTrackingData.exercises[exerciseIndex].sets[setIndex];
    
    set.completed = !set.completed;
    set.completedAt = set.completed ? new Date().toISOString() : undefined;

    setTrackingData(newTrackingData);
  };

  const addSet = (exerciseIndex: number) => {
    if (!trackingData) return;

    const newTrackingData = { ...trackingData };
    const exercise = newTrackingData.exercises[exerciseIndex];
    const newSet: WorkoutSet = {
      id: `set_${exerciseIndex}_${exercise.sets.length}`,
      reps: null,
      weight: null,
      restTime: null,
      completed: false
    };

    exercise.sets.push(newSet);
    setTrackingData(newTrackingData);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    if (!trackingData) return;

    const newTrackingData = { ...trackingData };
    newTrackingData.exercises[exerciseIndex].sets.splice(setIndex, 1);
    setTrackingData(newTrackingData);
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
      const endTime = workoutEndTime || new Date().toTimeString().slice(0, 5);
      const completedData = {
        ...trackingData,
        endTime,
        completed: true,
        notes: workoutNotes,
        exercises: trackingData.exercises.map(({ id, ...exercise }) => ({
          ...exercise,
          sets: exercise.sets.map(({ id, ...set }) => set) // Remove id field from sets
        }))
      };

      // Call the API to save the workout
      const response = await api.post('/api/workout/logs', completedData);
      
      console.log('Workout submitted successfully:', response.data);
      
      setShowSummary(true);
      onWorkoutSubmitted?.(completedData);
    } catch (error) {
      console.error('Error submitting workout:', error);
      alert('Error submitting workout. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProgress = async () => {
    if (!trackingData) return;

    setSaving(true);
    try {
      // Save progress without marking as completed
      const response = await api.post('/api/workout/logs', {
        ...trackingData,
        completed: false,
        notes: workoutNotes,
        exercises: trackingData.exercises.map(({ id, ...exercise }) => ({
          ...exercise,
          sets: exercise.sets.map(({ id, ...set }) => set) // Remove id field from sets
        }))
      });
      
      console.log('Progress saved:', response.data);
      alert(intl.formatMessage({ id: 'save-progress' }) + ' - ' + intl.formatMessage({ id: 'continue-later' }));
    } catch (error) {
      console.error('Error saving progress:', error);
      alert('Error saving progress. Please try again.');
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

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={<FormattedMessage id="workout-tracking" />}
          subheader={`${planData.title} - ${currentDay.label || `Day ${dayIndex}`}`}
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={intl.formatMessage({ id: 'workout-date' })}
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={intl.formatMessage({ id: 'start-time' })}
                type="time"
                value={workoutStartTime}
                onChange={(e) => setWorkoutStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={intl.formatMessage({ id: 'end-time' })}
                type="time"
                value={workoutEndTime}
                onChange={(e) => setWorkoutEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Exercises */}
      <Stack spacing={3}>
        {trackingData.exercises.map((exercise, exerciseIndex) => (
          <Card key={exercise.id}>
            <CardHeader
              title={exercise.exerciseName}
              subheader={`${exercise.targetSets} ${intl.formatMessage({ id: 'sets' })} x ${exercise.targetReps} ${intl.formatMessage({ id: 'reps' })}`}
              action={
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => addSet(exerciseIndex)}
                >
                  <FormattedMessage id="add" />
                </Button>
              }
            />
            <CardContent>
              <Stack spacing={2}>
                {exercise.sets.map((set, setIndex) => (
                  <Paper key={set.id} variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={1}>
                        <Typography variant="subtitle2" color="text.secondary">
                          <FormattedMessage id="set" /> {setIndex + 1}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <TextField
                          fullWidth
                          label={intl.formatMessage({ id: 'actual-reps' })}
                          type="number"
                          value={set.reps || ''}
                          onChange={(e) => updateSetData(exerciseIndex, setIndex, 'reps', parseInt(e.target.value) || null)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <TextField
                          fullWidth
                          label={intl.formatMessage({ id: 'actual-weight' })}
                          type="number"
                          value={set.weight || ''}
                          onChange={(e) => updateSetData(exerciseIndex, setIndex, 'weight', parseFloat(e.target.value) || null)}
                          size="small"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">kg</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <TextField
                          fullWidth
                          label={intl.formatMessage({ id: 'rest-time' })}
                          type="number"
                          value={set.restTime || ''}
                          onChange={(e) => updateSetData(exerciseIndex, setIndex, 'restTime', parseInt(e.target.value) || null)}
                          size="small"
                          InputProps={{
                            endAdornment: <InputAdornment position="end">sec</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <IconButton
                          color={set.completed ? 'success' : 'default'}
                          onClick={() => toggleSetCompleted(exerciseIndex, setIndex)}
                        >
                          <Check />
                        </IconButton>
                        {exercise.sets.length > 1 && (
                          <IconButton
                            color="error"
                            onClick={() => removeSet(exerciseIndex, setIndex)}
                            size="small"
                          >
                            <Remove />
                          </IconButton>
                        )}
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Workout Notes */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={intl.formatMessage({ id: 'notes' })}
            value={workoutNotes}
            onChange={(e) => setWorkoutNotes(e.target.value)}
            placeholder="Add any notes about your workout..."
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={handleSaveProgress}
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
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="h6" color="primary">
                  {stats.totalSets}
                </Typography>
                <Typography variant="caption">
                  <FormattedMessage id="total-sets" />
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="h6" color="primary">
                  {stats.totalVolume}kg
                </Typography>
                <Typography variant="caption">
                  <FormattedMessage id="total-volume" />
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="h6" color="primary">
                  {stats.averageReps}
                </Typography>
                <Typography variant="caption">
                  <FormattedMessage id="average-reps" />
                </Typography>
              </Grid>
            </Grid>
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
