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
  Copy
} from '@wandersonalwes/iconsax-react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';
import MobileSwipeableSections from '@/components/MobileSwipeableSections';
import LoadPlanDialog from '@/components/LoadPlanDialog';

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
  const [loadPlanDialogOpen, setLoadPlanDialogOpen] = useState(false);

  // Load workspace exercises
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const response = await api.get('/api/workout/exercises');
        setWorkspaceExercises(response.data.exercises || []);
      } catch (err: any) {
        console.error('Failed to load exercises:', err);
      }
    };
    loadExercises();
  }, []);

  // Load saved plans function
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
        alert: { color: 'error', variant: 'filled' }
      } as any);
      } finally {
        setLoadingPlans(false);
      }
    };

  // Load saved plans (for reference only)
  useEffect(() => {
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
            alert: { color: 'success', variant: 'filled' }
          } as any);
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
          alert: { color: 'success', variant: 'filled' }
        } as any);
      }
    } catch (err: any) {
      console.error('Failed to save workout plan:', err);
      openSnackbar({
        open: true,
        message: 'Failed to save workout plan',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      } as any);
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
    
    setEditingExercise((prev: any) => ({
      ...prev,
      individualSets: [...(prev.individualSets || []), newSet]
    }));
  };

  // Remove individual set
  const removeIndividualSet = (setId: string) => {
    setEditingExercise((prev: any) => ({
      ...prev,
      individualSets: (prev.individualSets || []).filter((set: any) => set.id !== setId)
    }));
  };

  // Update individual set
  const updateIndividualSet = (setId: string, field: string, value: any) => {
    setEditingExercise((prev: any) => ({
      ...prev,
      individualSets: (prev.individualSets || []).map((set: any) => 
        set.id === setId ? { ...set, [field]: value } : set
      )
    }));
  };

  // Delete a workout plan
  const handleDeletePlan = async (planId: string) => {
    try {
      await api.delete(`/api/workout/plans/${planId}`);
      setSavedPlans(prev => prev.filter(p => p.id !== planId));
      
      // If the deleted plan was selected, clear the local state
      if (selectedPlanId === planId) {
        clearLocalPlan();
      }
      
      openSnackbar({
        open: true,
        message: 'Workout plan deleted successfully',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' }
      } as any);
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to delete workout plan',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      } as any);
    }
  };


  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>Workout Maker</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
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
                variant="outlined"
                size="small"
                onClick={openPdfDialog}
              >
                Send PDF
              </Button>
            )}
          </Stack>
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
            subheader={
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Add size={16} />}
                    onClick={() => setIsCreatePlanDialogOpen(true)}
                    sx={{ flex: 1 }}
                  >
                    Create
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Copy size={16} />}
                    onClick={() => setLoadPlanDialogOpen(true)}
                    sx={{ flex: 1 }}
                  >
                    Load
                  </Button>
                </Stack>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search plans..."
                  value={planQuery}
                  onChange={(e) => setPlanQuery(e.target.value)}
                />
                {selectedPlanId && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={openPdfDialog}
                      sx={{ flex: 1 }}
                    >
                      Send PDF
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={async () => {
                        try {
                          await api.post(`/api/workout/plans/${selectedPlanId}/activate`);
                          await loadSavedPlans();
                          openSnackbar({ open: true, message: 'Workout plan activated', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
                        } catch (e) {
                          openSnackbar({ open: true, message: 'Failed to activate plan', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
                        }
                      }}
                      sx={{ flex: 1 }}
                    >
                      Activate
                    </Button>
                  </Stack>
                )}
              </Box>
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
                    component="div"
                    onClick={() => {
                      setSelectedPlanId(localWorkoutPlan.id);
                      setSelectedDayIndex(0);
                    }}
                    sx={{ 
                      backgroundColor: 'primary.lighter',
                      border: '1px solid',
                      borderColor: 'primary.main',
                      borderRadius: 1,
                      mb: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'primary.light'
                      }
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
                    component="div"
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
                    Add Day
                  </Button>
                ) : null
              }
            />
            <CardContent sx={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              {localWorkoutPlan ? (
                <>
                  {localWorkoutPlan.days.map((day, index) => (
                    <Card
                    key={day.id}
                      sx={{ 
                        mb: 2,
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: selectedDayIndex === index ? 'primary.main' : 'transparent',
                        transition: 'all 0.2s',
                        bgcolor: selectedDayIndex === index ? 'primary.lighter' : 'background.paper',
                        '&:hover': {
                          borderColor: 'primary.main',
                          boxShadow: 2
                        }
                      }}
                    onClick={() => {
                      setSelectedDayIndex(index);
                      // On mobile, automatically move to section 3 (exercises) when day is selected
                      if (isMobile) {
                        setMobileSection(2);
                      }
                    }}
                  >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Chip 
                                label={`Day ${index + 1}`} 
                                size="small" 
                                color={selectedDayIndex === index ? "primary" : "default"}
                                sx={{ height: 20, fontSize: '0.75rem', fontWeight: 600 }} 
                              />
                              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                                {day.title}
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="textSecondary">
                              {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
                            </Typography>
                          </Box>
                          {selectedDayIndex === index && (
                            <Chip 
                              label="Selected" 
                              size="small" 
                              color="primary"
                              sx={{ fontWeight: 500 }}
                            />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                ))}
                
                {localWorkoutPlan.days.length === 0 && (
                    <Box sx={{ 
                      textAlign: 'center', 
                      py: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2
                    }}>
                      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                        No days yet
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Add your first workout day
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<Add size={20} />}
                        onClick={() => setIsCreateDayDialogOpen(true)}
                        sx={{ mt: 1 }}
                      >
                        Add First Day
                      </Button>
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}>
                  <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Select a plan first
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Choose a workout plan to view its days
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
            <CardContent sx={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
              {localWorkoutPlan && localWorkoutPlan.days[selectedDayIndex] ? (
                <>
                {localWorkoutPlan.days[selectedDayIndex].exercises.map((exercise, index) => {
                  // Calculate rep range visualization
                  const repRange = formatRepRange(exercise.reps, exercise.sets);
                  
                  return (
                    <Card 
                      key={exercise.id} 
                      sx={{ 
                        mb: 2, 
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: 3,
                          transform: 'translateY(-2px)'
                        }
                      }}
                      onClick={() => openEditExerciseDialog(exercise)}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Chip 
                                label={`#${index + 1}`} 
                                size="small" 
                                color="primary" 
                                sx={{ height: 20, fontSize: '0.75rem' }} 
                              />
                              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, wordBreak: 'break-word' }}>
                              {exercise.exercise.name}
                            </Typography>
                            </Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              {exercise.exercise.muscleGroup}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                              <Chip 
                                label={repRange} 
                                size="small" 
                                variant="outlined"
                                sx={{ fontWeight: 500 }}
                              />
                              {exercise.restSeconds > 0 && (
                                <Chip 
                                  label={`Rest: ${exercise.restSeconds}s`} 
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                              {exercise.tempo && (
                                <Chip 
                                  label={`Tempo: ${exercise.tempo}`} 
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                              {exercise.rir > 0 && (
                                <Chip 
                                  label={`RIR: ${exercise.rir}`} 
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                            </Box>
                            {exercise.notes && (
                              <Typography 
                                variant="body2" 
                                color="textSecondary" 
                                sx={{ 
                                  mt: 1, 
                                  fontSize: '0.875rem',
                                  fontStyle: 'italic',
                                  pl: 1,
                                  borderLeft: '3px solid',
                                  borderColor: 'primary.main'
                                }}
                              >
                                💡 {exercise.notes}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditExerciseDialog(exercise);
                              }}
                              sx={{ 
                                bgcolor: 'primary.lighter',
                                '&:hover': { bgcolor: 'primary.light' }
                              }}
                            >
                              <Edit size={18} />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Remove ${exercise.exercise.name} from this day?`)) {
                                removeExerciseFromDay(exercise.id);
                                }
                              }}
                              sx={{ 
                                bgcolor: 'error.lighter',
                                '&:hover': { bgcolor: 'error.light' }
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
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                  }}>
                    <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                      No exercises yet
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Add exercises to this day to build your workout
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add size={20} />}
                      onClick={() => setIsAddExerciseDialogOpen(true)}
                      sx={{ mt: 1 }}
                    >
                      Add First Exercise
                    </Button>
                  </Box>
                )}
                </>
              ) : (
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}>
                  <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Select a day first
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Choose a workout day to view and add exercises
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
              subheader={
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsCreatePlanDialogOpen(true)}
                      sx={{ flex: 1 }}
                    >
                      Create
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Copy size={16} />}
                      onClick={() => setLoadPlanDialogOpen(true)}
                      sx={{ flex: 1 }}
                    >
                      Load
                    </Button>
                  </Stack>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search plans..."
                    value={planQuery}
                    onChange={(e) => setPlanQuery(e.target.value)}
                  />
                </Box>
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
                      component="div"
                      onClick={() => {
                        setSelectedPlanId(localWorkoutPlan.id);
                        setSelectedDayIndex(0);
                      }}
                      sx={{ 
                        backgroundColor: 'primary.lighter',
                        mb: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'primary.light'
                        }
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
                      component="div"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
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
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
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
            <Card sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
              <CardContent sx={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
                {localWorkoutPlan.days.length > 0 ? (
                  <Stack spacing={2}>
                  {localWorkoutPlan.days.map((day, index) => (
                      <Card
                      key={day.id}
                        sx={{ 
                          cursor: 'pointer',
                          border: '2px solid',
                          borderColor: selectedDayIndex === index ? 'primary.main' : 'transparent',
                          transition: 'all 0.2s',
                          bgcolor: selectedDayIndex === index ? 'primary.lighter' : 'background.paper',
                          '&:hover': {
                            borderColor: 'primary.main',
                            boxShadow: 2
                          }
                        }}
                      onClick={() => setSelectedDayIndex(index)}
                    >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Chip 
                                  label={`Day ${index + 1}`} 
                                  size="small" 
                                  color={selectedDayIndex === index ? "primary" : "default"}
                                  sx={{ height: 20, fontSize: '0.75rem', fontWeight: 600 }} 
                                />
                                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                                  {day.title}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="textSecondary">
                                {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
                              </Typography>
                            </Box>
                            {selectedDayIndex === index && (
                              <Chip 
                                label="Selected" 
                                size="small" 
                                color="primary"
                                sx={{ fontWeight: 500 }}
                              />
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                  }}>
                    <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                      No days yet
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Add your first workout day
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add size={20} />}
                      onClick={() => setIsCreateDayDialogOpen(true)}
                      sx={{ mt: 1 }}
                    >
                      Add First Day
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section 3: Exercises */}
          {localWorkoutPlan && localWorkoutPlan.days.length > 0 && localWorkoutPlan.days[selectedDayIndex] && (
            <Card sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
              <CardContent sx={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
                {localWorkoutPlan.days[selectedDayIndex].exercises.length > 0 ? (
                  <Stack spacing={2}>
                    {localWorkoutPlan.days[selectedDayIndex].exercises.map((ex, index) => {
                      const repRange = formatRepRange(ex.reps, ex.sets);
                      
                      return (
                        <Card 
                          key={ex.id}
                          sx={{ 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              boxShadow: 3,
                              transform: 'translateY(-2px)'
                            }
                          }}
                          onClick={() => openEditExerciseDialog(ex)}
                        >
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Chip 
                                    label={`#${index + 1}`} 
                                    size="small" 
                                    color="primary" 
                                    sx={{ height: 20, fontSize: '0.75rem' }} 
                                  />
                                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                                    {ex.exercise.name}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                  {ex.exercise.muscleGroup}
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                                  <Chip 
                                    label={repRange} 
                                    size="small" 
                                    variant="outlined"
                                    sx={{ fontWeight: 500 }}
                                  />
                                  {ex.restSeconds > 0 && (
                                    <Chip 
                                      label={`Rest: ${ex.restSeconds}s`} 
                                      size="small" 
                                      variant="outlined"
                                    />
                                  )}
                                  {ex.tempo && (
                                    <Chip 
                                      label={`Tempo: ${ex.tempo}`} 
                                      size="small" 
                                      variant="outlined"
                                    />
                                  )}
                                  {ex.rir > 0 && (
                                    <Chip 
                                      label={`RIR: ${ex.rir}`} 
                                      size="small" 
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                                {ex.notes && (
                                  <Typography 
                                    variant="body2" 
                                    color="textSecondary" 
                                    sx={{ 
                                      mt: 1, 
                                      fontSize: '0.875rem',
                                      fontStyle: 'italic',
                                      pl: 1,
                                      borderLeft: '3px solid',
                                      borderColor: 'primary.main'
                                    }}
                                  >
                                    💡 {ex.notes}
                                  </Typography>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
                          <IconButton
                            size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditExerciseDialog(ex);
                                  }}
                                  sx={{ 
                                    bgcolor: 'primary.lighter',
                                    '&:hover': { bgcolor: 'primary.light' }
                            }}
                          >
                            <Edit size={16} />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Remove ${ex.exercise.name} from this day?`)) {
                                      removeExerciseFromDay(ex.id);
                                    }
                                  }}
                                  sx={{ 
                                    bgcolor: 'error.lighter',
                                    '&:hover': { bgcolor: 'error.light' }
                            }}
                          >
                            <Trash size={16} />
                          </IconButton>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                  }}>
                    <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                      No exercises yet
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Add exercises to this day to build your workout
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add size={20} />}
                      onClick={() => setIsAddExerciseDialogOpen(true)}
                      sx={{ mt: 1 }}
                    >
                      Add First Exercise
                    </Button>
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
                  onChange={(e) => setEditingExercise((prev: any) => ({ ...prev, notes: e.target.value }))}
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

      {/* Load Plan Dialog */}
      <LoadPlanDialog
        open={loadPlanDialogOpen}
        onClose={() => setLoadPlanDialogOpen(false)}
        planType="workout"
        currentClientId={clientId}
        onPlanLoaded={() => {
          loadSavedPlans();
          openSnackbar({
            open: true,
            message: 'Workout plan copied successfully!',
            variant: 'alert',
            alert: { color: 'success', variant: 'filled' }
          } as any);
        }}
      />
    </Stack>
  );
}
