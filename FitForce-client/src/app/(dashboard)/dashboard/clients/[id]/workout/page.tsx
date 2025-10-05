'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Chip,
  TextField,
  Stack,
  CircularProgress,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add,
  AddCircle,
  Edit,
  Trash,
  ArrowLeft2,
  ArrowRight2,
  Copy
} from '@wandersonalwes/iconsax-react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';
import MobileSwipeableSections from '@/components/MobileSwipeableSections';

interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Plan {
  id: string;
  title: string;
  createdBy?: string;
  createdAt?: string;
  status?: string;
  days?: any[];
}

interface Day {
  id: string;
  label: string;
  dayIndex: number;
  exerciseIds: string[];
}

interface WorkoutPlanSet {
  id: string;
  setIndex: number;
  repMin?: number;
  repMax?: number;
  rir?: number;
  weight?: number;
  tempo?: string;
  restSeconds?: number;
  notes?: string;
}

interface WorkoutExercise {
  id: string;
  exercise: Exercise;
  sets: number;
  reps: number;
  notes?: string;
  planSets: WorkoutPlanSet[];
}

export default function ClientWorkoutPage() {
  const { id: clientId } = useParams() as { id: string };
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileSection, setMobileSection] = useState(0);
  
  // Local workout state - everything works locally first
  const [localWorkoutPlan, setLocalWorkoutPlan] = useState<{
    id: string;
    title: string;
    days: Array<{
      id: string;
      title: string;
      exercises: Array<{
        id: string;
        exercise: Exercise;
        sets: number;
        reps: string;
        restSeconds: number;
        tempo: string;
        rir: number;
        notes?: string;
      }>;
    }>;
  } | null>(null);
  
  // Loaded plans from server (read-only reference)
  const [savedPlans, setSavedPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  
  // Exercise library
  const [workspaceExercises, setWorkspaceExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  
  // Dialog states
  const [isCreatePlanDialogOpen, setIsCreatePlanDialogOpen] = useState(false);
  const [isCreateDayDialogOpen, setIsCreateDayDialogOpen] = useState(false);
  const [isAddExerciseDialogOpen, setIsAddExerciseDialogOpen] = useState(false);
  const [isEditExerciseDialogOpen, setIsEditExerciseDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<any>(null);
  
  // Form states
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newDayTitle, setNewDayTitle] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  
  // UI states
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [isPlanDirty, setIsPlanDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planQuery, setPlanQuery] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfTemplates, setPdfTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [pdfTemplateId, setPdfTemplateId] = useState<string>('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Load workspace exercises
  useEffect(() => {
    const loadExercises = async () => {
      try {
        setLoadingExercises(true);
        const response = await api.get('/api/workout/exercises');
        setWorkspaceExercises(response.data.exercises || []);
      } catch (err: any) {
        openSnackbar({
          open: true,
          message: 'Failed to load exercises',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoadingExercises(false);
      }
    };
    loadExercises();
  }, []);

  // Load saved plans (for reference only)
  useEffect(() => {
    const loadSavedPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await api.get(`/api/clients/${clientId}/workout/plans`);
        setSavedPlans(response.data.plans || []);
      } catch (err: any) {
        openSnackbar({
          open: true,
          message: 'Failed to load saved workout plans',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoadingPlans(false);
      }
    };
    if (clientId) loadSavedPlans();
  }, [clientId]);

  // Create new local workout plan
  const createLocalPlan = () => {
    const newPlan = {
      id: `local_${Date.now()}`,
      title: newPlanTitle,
      days: []
    };
    setLocalWorkoutPlan(newPlan);
    setSelectedPlanId(newPlan.id);
    setIsPlanDirty(true);
    setSelectedDayIndex(0);
      setNewPlanTitle('');
      setIsCreatePlanDialogOpen(false);
  };

  // Add day to local plan
  const addDayToLocalPlan = () => {
    if (!localWorkoutPlan || !newDayTitle.trim()) return;
    
    const newDay = {
      id: `day_${Date.now()}`,
      title: newDayTitle,
      exercises: []
    };
    
    setLocalWorkoutPlan(prev => prev ? {
      ...prev,
      days: [...prev.days, newDay]
    } : null);
    
    setSelectedDayIndex(localWorkoutPlan.days.length); // Select new day
    setIsPlanDirty(true);
      setNewDayTitle('');
      setIsCreateDayDialogOpen(false);
  };

  // Add exercise to selected day
  const addExerciseToDay = () => {
    if (!localWorkoutPlan || selectedExercises.length === 0) return;
    
    const currentDay = localWorkoutPlan.days[selectedDayIndex];
    if (!currentDay) return;
    
    const newExercises = selectedExercises.map(exerciseId => {
      const exercise = workspaceExercises.find(e => e.id === exerciseId);
      return {
        id: `exercise_${Date.now()}_${Math.random()}`,
        exercise: exercise!,
                      sets: 3,
                      reps: "8-12",
                      restSeconds: 60,
                      tempo: "",
                      rir: 0,
                      notes: "",
                      individualSets: [
                        { id: 'set_1', reps: "8-12", restSeconds: 60, tempo: "", rir: 0 },
                        { id: 'set_2', reps: "8-12", restSeconds: 60, tempo: "", rir: 0 },
                        { id: 'set_3', reps: "8-12", restSeconds: 60, tempo: "", rir: 0 }
                      ]
      };
    });
    
    setLocalWorkoutPlan(prev => prev ? {
      ...prev,
      days: prev.days.map((day, index) => 
        index === selectedDayIndex 
          ? { ...day, exercises: [...day.exercises, ...newExercises] }
          : day
      )
    } : null);
    
    setIsPlanDirty(true);
    setSelectedExercises([]);
    setIsAddExerciseDialogOpen(false);
  };

  // Save local plan to database
  const saveLocalPlan = async () => {
    if (!localWorkoutPlan || !clientId) return;
    
    try {
      setSaving(true);
      
      const daysPayload = {
        cycleLengthDays: localWorkoutPlan.days.length,
        days: localWorkoutPlan.days.map((day, idx) => ({
          dayIndex: idx + 1,
          label: day.title,
          items: day.exercises.map((exercise) => ({
            exerciseId: exercise.exercise.id,
            sets: exercise.sets,
            reps: exercise.reps, // Keep as string (e.g., "8-12")
            restSeconds: exercise.restSeconds,
            tempo: exercise.tempo,
            rir: exercise.rir,
            notes: exercise.notes || ""
          }))
        }))
      };

      console.log('[DEBUG] Saving workout plan:', {
        title: localWorkoutPlan.title,
        daysCount: daysPayload.days.length,
        days: daysPayload.days.map(d => ({
          label: d.label,
          itemsCount: d.items.length,
          items: d.items
        }))
      });

      const isNewLocal = localWorkoutPlan.id.startsWith('local_');

      if (isNewLocal) {
        // Create new plan first, then upsert days to that plan
        const createRes = await api.post(`/api/clients/${clientId}/workout/plans`, {
          title: localWorkoutPlan.title,
          cycleLengthDays: daysPayload.cycleLengthDays,
          days: daysPayload.days
        });
        const newPlanId = createRes.data?.plan?.id;
        if (newPlanId) {
          // reflect in saved plans
          const newSavedPlan = {
            id: newPlanId,
            title: createRes.data.plan.title,
            createdAt: createRes.data.plan.createdAt,
            days: createRes.data.plan.days || []
          };
          setSavedPlans((prev) => [newSavedPlan, ...prev]);
          
          // Convert saved plan to local state for continued editing
          setLocalWorkoutPlan({
            id: newPlanId,
            title: newSavedPlan.title,
            days: newSavedPlan.days.map((day: any) => ({
              id: day.id,
              title: day.label || `Day ${day.dayIndex}`,
              exercises: day.items?.map((item: any) => ({
                id: item.id,
                exercise: item.exercise,
                sets: item.sets,
                reps: String(item.reps),
                restSeconds: item.restSeconds || 60,
                tempo: item.tempo || "",
                rir: item.rir || 0,
                notes: item.notes || "",
                individualSets: Array.from({ length: item.sets || 1 }, (_, index) => ({
                  id: `set_${index + 1}`,
                  reps: String(item.reps),
                  restSeconds: item.restSeconds || 60,
                  tempo: item.tempo || "",
                  rir: item.rir || 0
                }))
              })) || []
            }))
          });
          
          setSelectedPlanId(newPlanId);
          setIsPlanDirty(false);
          setSelectedDayIndex(0);
          openSnackbar({
            open: true,
            message: 'Workout plan created successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
        }
      } else {
        // Update existing plan days instead of creating a new plan
        await api.put(`/api/workout/plans/${localWorkoutPlan.id}/days`, daysPayload);
        // Refresh the saved plans list to reflect updates
        try {
          const refreshed = await api.get(`/api/clients/${clientId}/workout/plans`);
          setSavedPlans(refreshed.data.plans || []);
        } catch {}
        setIsPlanDirty(false);
        openSnackbar({
          open: true,
          message: 'Workout plan updated successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
      }
    } catch (err: any) {
      console.error('Failed to save workout plan:', err);
      openSnackbar({
        open: true,
        message: 'Failed to save workout plan',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  // Clear local plan (discard changes)
  const clearLocalPlan = () => {
    setLocalWorkoutPlan(null);
    setSelectedPlanId(null);
    setIsPlanDirty(false);
    setSelectedDayIndex(0);
  };

  const openPdfDialog = async () => {
    try {
      const res = await api.get('/api/templates', { params: { kind: 'workout' } });
      setPdfTemplates((res.data?.templates || []).map((t: any) => ({ id: t.id, name: t.name })));
      setPdfTemplateId('');
      setPdfDialogOpen(true);
    } catch {}
  };

  const generatePdf = async () => {
    if (!selectedPlanId || !pdfTemplateId) return;
    setGeneratingPdf(true);
    try {
      const res = await api.post(`/api/workout/plans/${selectedPlanId}/generate-pdf`, { templateId: pdfTemplateId });
      const url: string | undefined = res.data?.pdfUrl;
      if (url) window.open(url, '_blank');
      setPdfDialogOpen(false);
    } catch (e) {
      // noop
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Update exercise set values
  const updateExerciseSet = (exerciseId: string, field: 'reps' | 'restSeconds' | 'tempo' | 'rir' | 'notes', value: any) => {
    setLocalWorkoutPlan(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        days: prev.days.map(day => ({
          ...day,
          exercises: day.exercises.map(exercise => {
            if (exercise.id === exerciseId) {
              return { ...exercise, [field]: value };
            }
            return exercise;
          })
        }))
      };
    });
    setIsPlanDirty(true);
  };

  // Remove exercise from day
  const removeExerciseFromDay = (exerciseId: string) => {
    if (!localWorkoutPlan) return;
    
    setLocalWorkoutPlan(prev => prev ? {
      ...prev,
      days: prev.days.map((day, dayIndex) => 
        dayIndex === selectedDayIndex 
          ? { ...day, exercises: day.exercises.filter(ex => ex.id !== exerciseId) }
          : day
      )
    } : null);
    
    setIsPlanDirty(true);
  };

  // Add sets to exercise (copy set)
  const addSetToExercise = (exerciseId: string) => {
    setLocalWorkoutPlan(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        days: prev.days.map(day => ({
          ...day,
          exercises: day.exercises.map(exercise => {
            if (exercise.id === exerciseId) {
              return { ...exercise, sets: exercise.sets + 1 };
            }
            return exercise;
          })
        }))
      };
    });
    setIsPlanDirty(true);
  };

  // Remove set from exercise
  const removeSetFromExercise = (exerciseId: string) => {
    setLocalWorkoutPlan(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        days: prev.days.map(day => ({
          ...day,
          exercises: day.exercises.map(exercise => {
            if (exercise.id === exerciseId && exercise.sets > 1) {
              return { ...exercise, sets: exercise.sets - 1 };
            }
            return exercise;
          })
        }))
      };
    });
    setIsPlanDirty(true);
  };

  // Format rep range display
  const formatRepRange = (reps: string, sets: number) => {
    if (!reps) return `${sets} × 0`;
    
    // Clean reps string and extract numbers
    const cleanReps = reps.toString().replace(/[^0-9\-]/g, '');
    const numbers = cleanReps.split('-').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    
    if (numbers.length === 0) return `${sets} × ${reps}`;
    if (numbers.length === 1) return `${sets} × ${numbers[0]}`;
    
    const minReps = Math.min(...numbers);
    const maxReps = Math.max(...numbers);
    
    return `${sets} × ${minReps}-${maxReps}`;
  };

  // Open exercise edit dialog
  const openEditExerciseDialog = (exercise: any) => {
    // Initialize individualSets if they don't exist
    const exerciseWithSets = {
      ...exercise,
      individualSets: exercise.individualSets || Array.from({ length: exercise.sets || 1 }, (_, index) => ({
        id: `set_${index + 1}`,
        reps: exercise.reps || "8-12",
        restSeconds: exercise.restSeconds || 60,
        tempo: exercise.tempo || "",
        rir: exercise.rir || 0
      }))
    };
    
    setEditingExercise(exerciseWithSets);
    setIsEditExerciseDialogOpen(true);
  };

  // Close exercise edit dialog
  const closeEditExerciseDialog = () => {
    setIsEditExerciseDialogOpen(false);
    setEditingExercise(null);
  };

  // Save exercise changes
  const saveExerciseChanges = () => {
    if (!editingExercise || !localWorkoutPlan) return;
    
    // Update the summary values based on individual sets
    const updatedExercise = {
      ...editingExercise,
      sets: editingExercise.individualSets?.length || 0,
      reps: editingExercise.individualSets?.[0]?.reps || "8-12",
      restSeconds: editingExercise.individualSets?.[0]?.restSeconds || 60,
      tempo: editingExercise.individualSets?.[0]?.tempo || "",
      rir: editingExercise.individualSets?.[0]?.rir || 0
    };
    
    setLocalWorkoutPlan(prev => prev ? {
      ...prev,
      days: prev.days.map(day => ({
        ...day,
        exercises: day.exercises.map(exercise => {
          if (exercise.id === editingExercise.id) {
            return updatedExercise;
          }
          return exercise;
        })
      }))
    } : null);
    
    setIsPlanDirty(true);
    closeEditExerciseDialog();
  };

  // Add new individual set
  const addNewSet = () => {
    const newSet = {
      id: `set_${Date.now()}_${Math.random()}`,
      reps: editingExercise.reps || "8-12",
      restSeconds: editingExercise.restSeconds || 60,
      tempo: editingExercise.tempo || "",
      rir: editingExercise.rir || 0
    };
    
    setEditingExercise(prev => ({
      ...prev,
      individualSets: [...(prev.individualSets || []), newSet]
    }));
  };

  // Remove individual set
  const removeIndividualSet = (setId: string) => {
    setEditingExercise(prev => ({
      ...prev,
      individualSets: (prev.individualSets || []).filter(set => set.id !== setId)
    }));
  };

  // Update individual set
  const updateIndividualSet = (setId: string, field: string, value: any) => {
    setEditingExercise(prev => ({
      ...prev,
      individualSets: (prev.individualSets || []).map(set => 
        set.id === setId ? { ...set, [field]: value } : set
      )
    }));
  };


  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>Workout Maker</Typography>
          {localWorkoutPlan && isPlanDirty && (
            <Button
              variant="contained"
              size="large"
              onClick={saveLocalPlan}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={20} /> : null}
              sx={{ 
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              {saving ? 'Saving...' : 'Save Plan'}
            </Button>
          )}
          {/* Send PDF for selected saved plan */}
          {selectedPlanId && !String(selectedPlanId).startsWith('local_') && (
            <Button
              sx={{ ml: 1, mt: 1 }}
              variant="outlined"
              size="small"
              onClick={openPdfDialog}
            >
              Send PDF
            </Button>
          )}
        </Box>
        <Chip label={`Client: ${clientId}`} variant="outlined" />
      </Box>

      {/* Main Content */}
      {isMobile ? (
        <MobileSwipeableSections
          sections={[
            // Section 1: Plans
            <Card key="plans" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardHeader
            title="Plans"
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search plans..."
                  value={planQuery}
                  onChange={(e) => setPlanQuery(e.target.value)}
                  sx={{ width: 200 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add size={16} />}
                  onClick={() => setIsCreatePlanDialogOpen(true)}
                >
                  Create Plan
                </Button>
                {selectedPlanId && (
                  <Button variant="outlined" size="small" onClick={openPdfDialog}>Send PDF</Button>
                )}
                {selectedPlanId && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      try {
                        await api.post(`/api/workout/plans/${selectedPlanId}/activate`);
                        // refresh saved plans
                        await loadSavedPlans();
                        openSnackbar({ open: true, message: 'Workout plan activated', variant: 'alert', alert: { color: 'success' } });
                      } catch (e) {
                        openSnackbar({ open: true, message: 'Failed to activate plan', variant: 'alert', alert: { color: 'error' } });
                      }
                    }}
                  >
                    Activate
                  </Button>
                )}
              </Stack>
            }
          />
          <CardContent>
            {loadingPlans ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List>
                {/* Local Plan (if exists) */}
                {localWorkoutPlan && localWorkoutPlan.id.startsWith('local_') && (
                  <ListItem
                    key={localWorkoutPlan.id}
                    button
                    selected={selectedPlanId === localWorkoutPlan.id}
                    onClick={() => {
                      setSelectedPlanId(localWorkoutPlan.id);
                      setSelectedDayIndex(0);
                    }}
                    sx={{ 
                      backgroundColor: 'primary.lighter',
                      border: '1px solid',
                      borderColor: 'primary.main',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemText
                      primary={`${localWorkoutPlan.title} (Draft)`}
                      secondary={`Local draft • ${localWorkoutPlan.days.length} days`}
                    />
                  </ListItem>
                )}
                
                {/* Saved Plans */}
                {savedPlans
                  .filter(plan => plan.title.toLowerCase().includes(planQuery.toLowerCase()))
                  .map((plan) => (
                  <ListItem
                    key={plan.id}
                    button
                    selected={selectedPlanId === plan.id}
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      // On mobile, automatically move to section 2 (days) when plan is selected
                      if (isMobile) {
                        setMobileSection(1);
                      }
                        // Convert saved plan to local state for editing
                        setLocalWorkoutPlan({
                          id: plan.id,
                          title: plan.title,
                          days: plan.days?.map((day: any) => ({
                            id: day.id,
                            title: day.label || `Day ${day.dayIndex}`,
                            exercises: day.items?.map((item: any) => ({
                              id: item.id,
                              exercise: item.exercise,
                              sets: item.sets,
                              reps: String(item.reps),
                              restSeconds: item.restSeconds || 60,
                              tempo: item.tempo || "",
                              rir: item.rir || 0,
                              notes: item.notes || "",
                              individualSets: Array.from({ length: item.sets || 1 }, (_, index) => ({
                                id: `set_${index + 1}`,
                                reps: String(item.reps),
                                restSeconds: item.restSeconds || 60,
                                tempo: item.tempo || "",
                                rir: item.rir || 0
                              }))
                            })) || []
                          })) || []
                        });
                        setSelectedDayIndex(0);
                    }}
                  >
                  <ListItemText
                      primary={plan.title}
                      secondary={
                        `${plan.status ? `Status: ${plan.status} • ` : ''}Created: ${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'Unknown'} • ${plan.days?.length || 0} days`
                      }
                    />
                    </ListItem>
                  ))}
                
                {savedPlans.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No plans yet"
                      secondary="Create your first workout plan"
                      sx={{ textAlign: 'center' }}
                    />
                  </ListItem>
                )}
              </List>
            )}
          </CardContent>
        </Card>,

            // Section 2: Days
            <Card key="days" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title={localWorkoutPlan ? `Days - ${localWorkoutPlan.title}` : 'Days'}
              action={
                localWorkoutPlan ? (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Add size={16} />}
                    onClick={() => setIsCreateDayDialogOpen(true)}
                  >
                    Create Day
                  </Button>
                ) : null
              }
            />
            <CardContent>
              {localWorkoutPlan ? (
                <List>
                  {localWorkoutPlan.days.map((day, index) => (
                  <ListItem
                    key={day.id}
                    button
                    selected={selectedDayIndex === index}
                    onClick={() => {
                      setSelectedDayIndex(index);
                      // On mobile, automatically move to section 3 (exercises) when day is selected
                      if (isMobile) {
                        setMobileSection(2);
                      }
                    }}
                  >
                    <ListItemText
                      primary={day.title}
                      secondary={`${day.exercises.length} exercises`}
                    />
                  </ListItem>
                ))}
                
                {localWorkoutPlan.days.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No days added yet"
                      secondary="Add your first training day"
                      sx={{ textAlign: 'center' }}
                    />
                  </ListItem>
                )}
              </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    Select a plan to view days
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>,

            // Section 3: Exercises
            <Card key="exercises" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title={localWorkoutPlan && localWorkoutPlan.days[selectedDayIndex] ? `Exercises - ${localWorkoutPlan.days[selectedDayIndex].title}` : 'Exercises'}
              action={
                localWorkoutPlan && localWorkoutPlan.days[selectedDayIndex] ? (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Add size={16} />}
                    onClick={() => setIsAddExerciseDialogOpen(true)}
                  >
                    Add Exercise
                  </Button>
                ) : null
              }
            />
            <CardContent>
              {localWorkoutPlan && localWorkoutPlan.days[selectedDayIndex] ? (
                <>
                {localWorkoutPlan.days[selectedDayIndex].exercises.map((exercise) => {
                  // Calculate rep range visualization
                  const repRange = formatRepRange(exercise.reps, exercise.sets);
                  
                  return (
                    <Card key={exercise.id} sx={{ mb: 2, cursor: 'pointer' }}
                          onClick={() => openEditExerciseDialog(exercise)}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                              {exercise.exercise.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              {exercise.exercise.muscleGroup}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {repRange}
                            </Typography>
                            {exercise.notes && (
                              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5, fontSize: '0.875rem' }}>
                                💡 {exercise.notes}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditExerciseDialog(exercise);
                              }}
                            >
                              <Edit size={18} />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeExerciseFromDay(exercise.id);
                              }}
                            >
                              <Trash size={18} />
                            </IconButton>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {localWorkoutPlan.days[selectedDayIndex].exercises.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="textSecondary">
                      No exercises added yet. Add exercises to this day.
                    </Typography>
                  </Box>
                )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    Select a day to view exercises
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
          ]}
          activeSection={mobileSection}
          onSectionChange={setMobileSection}
        />
      ) : (
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
          {/* Section 1: Plans */}
          <Card sx={{ flex: '1 1 0', minWidth: 0 }}>
            <CardHeader
              title="Plans"
              action={
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    placeholder="Search plans..."
                    value={planQuery}
                    onChange={(e) => setPlanQuery(e.target.value)}
                    sx={{ width: 200 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Add size={16} />}
                    onClick={() => setIsCreatePlanDialogOpen(true)}
                  >
                    Create Plan
                  </Button>
                </Stack>
              }
            />
            <CardContent>
              {loadingPlans ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <List>
                  {localWorkoutPlan && (
                    <ListItem
                      button
                      selected={selectedPlanId === localWorkoutPlan.id}
                      onClick={() => {
                        setSelectedPlanId(localWorkoutPlan.id);
                        setSelectedDayIndex(0);
                      }}
                      sx={{ 
                        backgroundColor: 'primary.lighter',
                        mb: 1,
                        borderRadius: 1
                      }}
                    >
                      <ListItemText
                        primary={`${localWorkoutPlan.title} (Editing)`}
                        secondary={`${localWorkoutPlan.days.length} days`}
                      />
                      <Chip label="Current" color="primary" size="small" />
                    </ListItem>
                  )}
                  
                  {savedPlans
                    .filter(plan => plan.title.toLowerCase().includes(planQuery.toLowerCase()))
                    .map((plan) => (
                    <ListItem
                      key={plan.id}
                      button
                      selected={selectedPlanId === plan.id}
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setLocalWorkoutPlan({
                          id: plan.id,
                          title: plan.title,
                          days: plan.days?.map((day: any) => ({
                            id: day.id,
                            title: day.label || `Day ${day.dayIndex}`,
                            exercises: day.exercises?.map((ex: any) => ({
                              id: ex.id,
                              exercise: ex.exercise,
                              sets: ex.sets,
                              reps: ex.reps,
                              restSeconds: ex.restSeconds,
                              tempo: ex.tempo,
                              rir: ex.rir,
                              notes: ex.notes
                            })) || []
                          })) || []
                        });
                        setSelectedDayIndex(0);
                      }}
                    >
                    <ListItemText
                      primary={plan.title}
                      secondary={`${plan.days?.length || 0} days`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Delete this plan?')) {
                            handleDeletePlan(plan.id);
                          }
                        }}
                      >
                        <Trash size={16} />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  ))}
                  
                  {savedPlans.length === 0 && !localWorkoutPlan && (
                    <ListItem>
                      <ListItemText
                        primary="No plans yet"
                        secondary="Create your first workout plan"
                        sx={{ textAlign: 'center' }}
                      />
                    </ListItem>
                  )}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Days */}
          {localWorkoutPlan && (
            <Card sx={{ flex: '1 1 0', minWidth: 0 }}>
              <CardHeader
                title={`Days - ${localWorkoutPlan.title}`}
                action={
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsCreateDayDialogOpen(true)}
                    >
                      Add Day
                    </Button>
                }
              />
              <CardContent>
                <List>
                  {localWorkoutPlan.days.map((day, index) => (
                    <ListItem
                      key={day.id}
                      button
                      selected={selectedDayIndex === index}
                      onClick={() => setSelectedDayIndex(index)}
                    >
                      <ListItemText
                        primary={day.title}
                        secondary={`${day.exercises.length} exercises`}
                      />
                    </ListItem>
                  ))}
                  
                  {localWorkoutPlan.days.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary="No days yet"
                        secondary="Add your first workout day"
                        sx={{ textAlign: 'center' }}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Section 3: Exercises */}
          {localWorkoutPlan && localWorkoutPlan.days.length > 0 && localWorkoutPlan.days[selectedDayIndex] && (
            <Card sx={{ flex: '1 1 0', minWidth: 0 }}>
              <CardHeader
                title={`Exercises - ${localWorkoutPlan.days[selectedDayIndex].title}`}
                action={
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Add size={16} />}
                    onClick={() => setIsAddExerciseDialogOpen(true)}
                  >
                    Add Exercise
                  </Button>
                }
              />
              <CardContent>
                {localWorkoutPlan.days[selectedDayIndex].exercises.length > 0 ? (
                  <List>
                    {localWorkoutPlan.days[selectedDayIndex].exercises.map((ex) => (
                      <ListItem key={ex.id}>
                        <ListItemText
                          primary={ex.exercise.name}
                          secondary={`${ex.sets} sets × ${ex.reps} reps | Rest: ${ex.restSeconds}s | Tempo: ${ex.tempo} | RIR: ${ex.rir}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingExercise(ex);
                              setIsEditExerciseDialogOpen(true);
                            }}
                          >
                            <Edit size={16} />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setLocalWorkoutPlan(prev => prev ? {
                                ...prev,
                                days: prev.days.map((d, i) => i === selectedDayIndex ? {
                                  ...d,
                                  exercises: d.exercises.filter(e => e.id !== ex.id)
                                } : d)
                              } : null);
                              setIsPlanDirty(true);
                            }}
                          >
                            <Trash size={16} />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">
                      No exercises yet. Add your first exercise!
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={isCreatePlanDialogOpen} onClose={() => setIsCreatePlanDialogOpen(false)}>
        <DialogTitle>Create Workout Plan</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Plan Title"
            value={newPlanTitle}
            onChange={(e) => setNewPlanTitle(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreatePlanDialogOpen(false)}>Cancel</Button>
          <Button onClick={createLocalPlan} disabled={!newPlanTitle.trim()}>
            Create Plan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Day Dialog */}
      <Dialog open={isCreateDayDialogOpen} onClose={() => setIsCreateDayDialogOpen(false)}>
        <DialogTitle>Create Workout Day</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Day Title"
            value={newDayTitle}
            onChange={(e) => setNewDayTitle(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDayDialogOpen(false)}>Cancel</Button>
          <Button onClick={addDayToLocalPlan} disabled={!newDayTitle.trim() || !localWorkoutPlan}>
            Add Day
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Exercise Dialog */}
      <Dialog open={isAddExerciseDialogOpen} onClose={() => setIsAddExerciseDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Exercises to Workout Day</DialogTitle>
        <DialogContent>
          <List>
            {workspaceExercises.map((exercise) => {
              const isSelected = selectedExercises.includes(exercise.id);
              
              return (
                <ListItem key={exercise.id} sx={{ border: '1px solid', borderColor: 'divider', mb: 1, borderRadius: 1 }}>
                  <ListItemText
                    primary={exercise.name}
                    secondary={`${exercise.muscleGroup} - ${exercise.description || 'No description'}`}
                  />
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      variant={isSelected ? "contained" : "outlined"}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedExercises(prev => prev.filter(id => id !== exercise.id));
                        } else {
                          setSelectedExercises(prev => [...prev, exercise.id]);
                        }
                      }}
                    >
                      {isSelected ? 'Remove' : 'Add'}
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddExerciseDialogOpen(false)}>Cancel</Button>
          <Button onClick={addExerciseToDay} disabled={!selectedExercises.length || !localWorkoutPlan}>
            Add Selected
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Exercise Dialog */}
      <Dialog open={isEditExerciseDialogOpen} onClose={closeEditExerciseDialog} maxWidth="md" fullWidth>
        <DialogTitle>Edit Exercise: {editingExercise?.exercise?.name}</DialogTitle>
        <DialogContent>
          {editingExercise && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Exercise Notes */}
              <Box>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Exercise Notes"
                  value={editingExercise.notes || ''}
                  onChange={(e) => setEditingExercise(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any specific notes or cues for this exercise..."
                />
              </Box>

              {/* Individual Sets Table */}
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Individual Sets
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Set</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Reps</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Rest (sec)</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Tempo</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>RIR</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
 {(editingExercise.individualSets || []).map((set: any, index: number) => (
                        <tr key={set.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px', fontWeight: 500 }}>{index + 1}</td>
                          <td style={{ padding: '8px' }}>
                            <TextField
                              size="small"
                              value={set.reps}
                              onChange={(e) => updateIndividualSet(set.id, 'reps', e.target.value)}
                              sx={{ width: '120px' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <TextField
                              size="small"
                              type="number"
                              value={set.restSeconds}
                              onChange={(e) => updateIndividualSet(set.id, 'restSeconds', parseInt(e.target.value) || 0)}
                              sx={{ width: '100px' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <TextField
                              size="small"
                              value={set.tempo}
                              onChange={(e) => updateIndividualSet(set.id, 'tempo', e.target.value)}
                              sx={{ width: '100px' }}
                              placeholder="e.g. 2-1-2"
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <TextField
                              size="small"
                              type="number"
                              value={set.rir}
                              onChange={(e) => updateIndividualSet(set.id, 'rir', parseInt(e.target.value) || 0)}
                              sx={{ width: '80px' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => removeIndividualSet(set.id)}
                              disabled={(editingExercise.individualSets || []).length <= 1}
                            >
                              <Trash size={16} />
                            </IconButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Box>

              {/* Quick Actions */}
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Quick Actions
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<AddCircle size={16} />}
                    onClick={addNewSet}
                  >
                    Add Set
                  </Button>
                  {(editingExercise.individualSets || []).length > 1 && (
        <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Trash size={16} />}
                      onClick={() => {
                        const lastSet = editingExercise.individualSets[editingExercise.individualSets.length - 1];
                        removeIndividualSet(lastSet.id);
                      }}
                    >
                      Remove Last Set
        </Button>
                  )}
                </Stack>
              </Box>

              {/* Preview */}
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Preview: {formatRepRange(editingExercise.reps, editingExercise.sets)}
                </Typography>
      </Box>
    </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditExerciseDialog}>Cancel</Button>
          <Button variant="contained" onClick={saveExerciseChanges}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate PDF Dialog */}
      <Dialog open={pdfDialogOpen} onClose={() => setPdfDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Select PDF Template</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="tpl-label">Template</InputLabel>
            <Select labelId="tpl-label" label="Template" value={pdfTemplateId} onChange={(e) => setPdfTemplateId(e.target.value as string)}>
              {pdfTemplates.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPdfDialogOpen(false)}>Cancel</Button>
          <Button onClick={generatePdf} variant="contained" disabled={!pdfTemplateId || generatingPdf}>{generatingPdf ? 'Generating...' : 'Generate'}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
