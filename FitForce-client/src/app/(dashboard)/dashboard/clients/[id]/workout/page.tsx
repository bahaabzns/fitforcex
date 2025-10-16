'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string; // YouTube link
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
      caDay?: {
        name?: string;
        imageUrl?: string;
        url?: string;
        urls?: string[];
      };
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
  const [uploadingThumb, setUploadingThumb] = useState(false);
  
  // Form states
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newDayTitle, setNewDayTitle] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  
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
  const [activeTab, setActiveTab] = useState<'builder' | 'logs'>('builder');
  const [plansTab, setPlansTab] = useState(0); // 0: Plans, 1: Forms, 2: Tools, 3: Chat
  const [copyingPlanId, setCopyingPlanId] = useState<string | null>(null);
  // CaDay catalog and UI
  const [caDays, setCaDays] = useState<Array<{ id: string; name: string; imageUrl?: string; url?: string; urls?: string[] }>>([]);
  const [caDayDialogOpen, setCaDayDialogOpen] = useState(false);
  
  // Cardio tab state
  const [cardioTab, setCardioTab] = useState(0); // 0: Days, 1: Cardio
  const [cardioData, setCardioData] = useState({
    yearsOld: 0,
    heartRateMax: 0,
    heartRateTarget: 0,
    startCardio: 0,
    startHit: 0
  });

  // Load workout logs for this client (for Logs tab)
  const { data: logsData, isLoading: logsLoading, mutate: refreshLogs } = useSWR(
    activeTab === 'logs' ? `client-${clientId}-workout-logs` : null,
    async () => {
      const params = new URLSearchParams();
      params.append('clientId', clientId);
      const res = await api.get(`/api/workout/logs?${params.toString()}`);
      return res.data as { workoutLogs: any[] };
    }
  );

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
    // Load ca_day catalog
    (async () => {
      try {
        const res = await api.get('/api/workout/caday');
        setCaDays(res.data.caDays || []);
      } catch {}
    })();
  }, []);

  // Load saved plans function
    const loadSavedPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await api.get(`/api/clients/${clientId}/workout/plans`, {
          params: { t: Date.now() },
          headers: { 'Cache-Control': 'no-cache' }
        });
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

  // Load cardio data when a plan is selected
  useEffect(() => {
    if (selectedPlanId && !String(selectedPlanId).startsWith('local_')) {
      const selectedPlan = savedPlans.find(p => p.id === selectedPlanId);
      if (selectedPlan) {
        setCardioData({
          yearsOld: (selectedPlan as any).yearsOld || 0,
          heartRateMax: (selectedPlan as any).heartRateMax || 0,
          heartRateTarget: (selectedPlan as any).heartRateTarget || 0,
          startCardio: (selectedPlan as any).startCardio || 0,
          startHit: (selectedPlan as any).startHit || 0
        });
      }
    } else {
      // Reset cardio data for local plans
      setCardioData({
        yearsOld: 0,
        heartRateMax: 0,
        heartRateTarget: 0,
        startCardio: 0,
        startHit: 0
      });
    }
  }, [selectedPlanId, savedPlans]);

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
          videoUrl: "",
          thumbnailUrl: "",
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
      
      const parseRepRange = (repValue: any): { repMin: number | null; repMax: number | null } => {
        if (typeof repValue === 'number') return { repMin: repValue, repMax: repValue };
        const str = String(repValue || '').trim();
        if (!str) return { repMin: null, repMax: null };
        const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
          return { repMin: parseInt(rangeMatch[1]), repMax: parseInt(rangeMatch[2]) };
        }
        const singleMatch = str.match(/(\d+)/);
        if (singleMatch) {
          const v = parseInt(singleMatch[1]);
          return { repMin: v, repMax: v };
        }
        return { repMin: null, repMax: null };
      };

      const daysPayload = {
        cycleLengthDays: localWorkoutPlan.days.length,
        days: localWorkoutPlan.days.map((day, idx) => ({
          dayIndex: idx + 1,
          label: day.title,
          caDayName: (day as any).caDay?.name || null,
          caDayImageUrl: (day as any).caDay?.imageUrl || null,
          caDayUrl: (day as any).caDay?.url || null,
          caDayUrls: (day as any).caDay?.urls || null,
          items: day.exercises.map((exercise) => ({
            exerciseId: exercise.exercise.id,
            sets: exercise.sets,
            reps: exercise.reps, // Keep as string (e.g., "8-12")
            restSeconds: exercise.restSeconds,
            tempo: exercise.tempo,
            rir: exercise.rir,
            notes: exercise.notes || "",
            // Persist per-set data if available
            planSets: (exercise as any).individualSets && Array.isArray((exercise as any).individualSets)
              ? (exercise as any).individualSets.map((s: any, index: number) => {
                  const { repMin, repMax } = parseRepRange(s?.reps ?? exercise.reps);
                  const set: any = { setIndex: index + 1 };
                  if (typeof repMin === 'number') set.repMin = repMin;
                  if (typeof repMax === 'number') set.repMax = repMax;
                  if (typeof s?.rir === 'number') set.rir = s.rir; else if (typeof exercise.rir === 'number') set.rir = exercise.rir;
                  if (typeof s?.weight === 'number') set.weight = s.weight;
                  if (s?.tempo || exercise.tempo) set.tempo = s?.tempo || exercise.tempo;
                  if (typeof s?.restSeconds === 'number') set.restSeconds = s.restSeconds; else if (typeof exercise.restSeconds === 'number') set.restSeconds = exercise.restSeconds;
                  if (s?.notes) set.notes = s.notes;
                  return set;
                })
              : undefined
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
          days: daysPayload.days.map(d => ({
            // creation path does not accept planSets; send only aggregate fields
            dayIndex: d.dayIndex,
            label: d.label,
            caDayName: (d as any).caDayName || null,
            caDayImageUrl: (d as any).caDayImageUrl || null,
            caDayUrl: (d as any).caDayUrl || null,
            caDayUrls: (d as any).caDayUrls || null,
            items: d.items.map((it: any) => ({
              exerciseId: it.exerciseId,
              sets: it.sets,
              reps: it.reps,
              restSeconds: it.restSeconds,
              tempo: it.tempo,
              rir: it.rir,
              notes: it.notes
            }))
          }))
        });
        const newPlanId = createRes.data?.plan?.id;
        if (newPlanId) {
          // Immediately persist per-set data via PUT if present
          try {
            await api.put(`/api/workout/plans/${newPlanId}/days`, daysPayload);
          } catch {}

          // Update plan with cardio data
          try {
            await api.put(`/api/clients/${clientId}/workout/plans/${newPlanId}`, {
              title: localWorkoutPlan.title,
              ...cardioData
            });
          } catch {}

          // reflect in saved plans
          const newSavedPlan = {
            id: newPlanId,
            title: createRes.data.plan.title,
            createdAt: createRes.data.plan.createdAt,
            days: createRes.data.plan.days || [],
            ...cardioData
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
        // Update existing plan with cardio data
        try {
          await api.put(`/api/clients/${clientId}/workout/plans/${localWorkoutPlan.id}`, {
            title: localWorkoutPlan.title,
            ...cardioData
          });
        } catch {}
        
        // Update existing plan days
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

      {/* Tabs */}
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Button variant={activeTab === 'builder' ? 'contained' : 'outlined'} size="small" onClick={() => setActiveTab('builder')}>Builder</Button>
        <Button variant={activeTab === 'logs' ? 'contained' : 'outlined'} size="small" onClick={() => setActiveTab('logs')}>Logs</Button>
      </Stack>

      {/* Main Content */}
      {activeTab === 'builder' && (isMobile ? (
        <MobileSwipeableSections
          sections={[
            // Section 1: Plans
            <Card key="plans" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardHeader
            title={
              <Tabs value={plansTab} onChange={(_, v) => setPlansTab(v)} variant="scrollable" allowScrollButtonsMobile>
                <Tab label="Plans" />
                <Tab label="Forms" />
                <Tab label="Tools" />
                <Tab label="Chat" />
              </Tabs>
            }
            subheader={
              plansTab === 0 ? (
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
              ) : null
            }
          />
          <CardContent>
            {plansTab === 0 ? (
              loadingPlans ? (
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
                    onClick={async () => {
                      setSelectedPlanId(plan.id);
                      if (isMobile) setMobileSection(1);
                      try {
                        const daysRes = await api.get(`/api/workout/plans/${plan.id}/days`, {
                          params: { t: Date.now() },
                          headers: { 'Cache-Control': 'no-cache' }
                        });
                        const srvDays: any[] = daysRes.data?.plan?.days || [];
                        setLocalWorkoutPlan({
                          id: plan.id,
                          title: plan.title,
                          days: srvDays.map((day: any) => ({
                            id: day.id,
                            title: day.label || `Day ${day.dayIndex}`,
                            caDay: day.caDayName || day.caDayImageUrl || day.caDayUrl || (day.caDayUrls && day.caDayUrls.length > 0) ? {
                              name: day.caDayName || '',
                              imageUrl: day.caDayImageUrl || '',
                              url: day.caDayUrl || '',
                              urls: day.caDayUrls || []
                            } : undefined,
                            exercises: (day.items || []).map((item: any) => {
                              const individualSets = (item.planSets && item.planSets.length > 0)
                                ? item.planSets
                                    .sort((a: any, b: any) => (a.setIndex || 0) - (b.setIndex || 0))
                                    .map((s: any, idx: number) => ({
                                      id: `set_${s.setIndex || idx + 1}`,
                                      reps: (typeof s.repMin === 'number' && typeof s.repMax === 'number' && s.repMin !== s.repMax)
                                        ? `${s.repMin}-${s.repMax}`
                                        : (typeof s.repMin === 'number' ? String(s.repMin) : String(item.reps)),
                                      restSeconds: typeof s.restSeconds === 'number' ? s.restSeconds : (item.restSeconds || 60),
                                      tempo: s.tempo || item.tempo || "",
                                      rir: typeof s.rir === 'number' ? s.rir : (item.rir || 0),
                                      notes: s.notes || undefined
                                    }))
                                : Array.from({ length: item.sets || 1 }, (_, index) => ({
                                    id: `set_${index + 1}`,
                                    reps: String(item.reps),
                                    restSeconds: item.restSeconds || 60,
                                    tempo: item.tempo || "",
                                    rir: item.rir || 0
                                  }));
                              return {
                                id: item.id,
                                exercise: item.exercise,
                                sets: item.sets,
                                reps: String(item.reps),
                                restSeconds: item.restSeconds || 60,
                                tempo: item.tempo || "",
                                rir: item.rir || 0,
                                notes: item.notes || "",
                                individualSets
                              };
                            })
                          }))
                        });
                        setSelectedDayIndex(0);
                      } catch {}
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
            )
            ) : (
              <Box sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {plansTab === 1 && 'Forms coming soon…'}
                  {plansTab === 2 && 'Tools coming soon…'}
                  {plansTab === 3 && 'Chat coming soon…'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>,

            // Section 2: Days
            <Card key="days" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title={
                localWorkoutPlan ? (
                  <Tabs value={cardioTab} onChange={(_, v) => setCardioTab(v)} variant="scrollable" allowScrollButtonsMobile>
                    <Tab label="Days" />
                  </Tabs>
                ) : 'Days'
              }
              action={
                localWorkoutPlan ? (
                  cardioTab === 0 ? (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsCreateDayDialogOpen(true)}
                    >
                      Add Day
                    </Button>
                  ) : null
                ) : null
              }
            />
            <CardContent sx={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              {localWorkoutPlan ? (
                cardioTab === 0 ? (
                  // Days tab content
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
                              {(day as any).caDay && (
                                <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  {(day as any).caDay.imageUrl && <img src={(day as any).caDay.imageUrl} alt="ca_day" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                                  <Typography variant="caption" color="text.secondary">ca_day: {(day as any).caDay.name}</Typography>
                                </Box>
                              )}
                            </Box>
                            {selectedDayIndex === index && (
                              <Chip 
                                label="Selected" 
                                size="small" 
                                color="primary"
                                sx={{ fontWeight: 500 }}
                              />
                            )}
                            <Button size="small" variant="outlined" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDayIndex(index);
                              setCaDayDialogOpen(true);
                            }}>Choose ca_day</Button>
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
                ) : null
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
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setCaDayDialogOpen(true)}
                    >
                      Choose ca_day
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsAddExerciseDialogOpen(true)}
                    >
                      Add Exercise
                    </Button>
                  </Stack>
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
          <Card sx={{ flex: '1 1 0', minWidth: 0, height: '75vh', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title={
                <Tabs value={plansTab} onChange={(_, v) => setPlansTab(v)} variant="scrollable" allowScrollButtonsMobile>
                  <Tab label="Plans" />
                  <Tab label="Forms" />
                  <Tab label="Tools" />
                  <Tab label="Chat" />
                </Tabs>
              }
              subheader={
                plansTab === 0 ? (
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
                ) : null
              }
            />
            <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {plansTab === 0 ? (
                loadingPlans ? (
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
                            days: (plan.days || []).map((day: any) => ({
                              id: day.id,
                              title: day.label || `Day ${day.dayIndex}`,
                              exercises: (day.items || []).map((item: any) => {
                                const individualSets = (item.planSets && item.planSets.length > 0)
                                  ? item.planSets
                                      .sort((a: any, b: any) => (a.setIndex || 0) - (b.setIndex || 0))
                                      .map((s: any, idx: number) => ({
                                        id: `set_${s.setIndex || idx + 1}`,
                                        reps: (typeof s.repMin === 'number' && typeof s.repMax === 'number' && s.repMin !== s.repMax)
                                          ? `${s.repMin}-${s.repMax}`
                                          : (typeof s.repMin === 'number' ? String(s.repMin) : String(item.reps)),
                                        restSeconds: typeof s.restSeconds === 'number' ? s.restSeconds : (item.restSeconds || 60),
                                        tempo: s.tempo || item.tempo || "",
                                        rir: typeof s.rir === 'number' ? s.rir : (item.rir || 0),
                                        notes: s.notes || undefined
                                      }))
                                  : Array.from({ length: item.sets || 1 }, (_, index) => ({
                                      id: `set_${index + 1}`,
                                      reps: String(item.reps),
                                      restSeconds: item.restSeconds || 60,
                                      tempo: item.tempo || "",
                                      rir: item.rir || 0
                                    }));
                                return {
                                  id: item.id,
                                  exercise: item.exercise,
                                  sets: item.sets,
                                  reps: String(item.reps),
                                  restSeconds: item.restSeconds || 60,
                                  tempo: item.tempo || "",
                                  rir: item.rir || 0,
                                  notes: item.notes || "",
                                  individualSets
                                };
                              })
                            }))
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
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              setCopyingPlanId(plan.id);
                              await api.post(`/api/workout/plans/${plan.id}/copy`, { targetClientId: clientId });
                              await loadSavedPlans();
                              openSnackbar({ open: true, message: 'Workout plan copied', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
                            } catch (e) {
                              openSnackbar({ open: true, message: 'Failed to copy plan', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
                            } finally {
                              setCopyingPlanId(null);
                            }
                          }}
                          disabled={copyingPlanId === plan.id}
                        >
                          {copyingPlanId === plan.id ? 'Copying…' : 'Copy'}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await api.post(`/api/workout/plans/${plan.id}/activate`);
                              await loadSavedPlans();
                              openSnackbar({ open: true, message: 'Workout plan activated', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
                            } catch (e) {
                              openSnackbar({ open: true, message: 'Failed to activate plan', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
                            }
                          }}
                        >
                          Activate
                        </Button>
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
                      </Stack>
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
                )
              ) : (
                <Box sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {plansTab === 1 && 'Forms coming soon…'}
                    {plansTab === 2 && 'Tools coming soon…'}
                    {plansTab === 3 && 'Chat coming soon…'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Days */}
          {localWorkoutPlan && (
            <Card sx={{ flex: '1 1 0', minWidth: 0, height: '75vh', display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title={
                  <Tabs value={cardioTab} onChange={(_, v) => setCardioTab(v)} variant="scrollable" allowScrollButtonsMobile>
                    <Tab label="Days" />
                    <Tab label="Cardio" />
                  </Tabs>
                }
                action={
                  cardioTab === 0 ? (
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
              <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {cardioTab === 0 ? (
                  // Days tab content
                  localWorkoutPlan.days.length > 0 ? (
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
                  )
                ) : (
                  // Cardio tab content
                  <Box sx={{ py: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Cardio Settings</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="Years Old"
                        type="number"
                        value={cardioData.yearsOld}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setCardioData(prev => ({ ...prev, yearsOld: value }));
                          setIsPlanDirty(true);
                        }}
                        size="small"
                        inputProps={{ min: 0 }}
                      />
                      <TextField
                        fullWidth
                        label="Heart Rate Max"
                        type="number"
                        value={cardioData.heartRateMax}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setCardioData(prev => ({ ...prev, heartRateMax: value }));
                          setIsPlanDirty(true);
                        }}
                        size="small"
                        inputProps={{ min: 0 }}
                      />
                      <TextField
                        fullWidth
                        label="Heart Rate Target"
                        type="number"
                        value={cardioData.heartRateTarget}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setCardioData(prev => ({ ...prev, heartRateTarget: value }));
                          setIsPlanDirty(true);
                        }}
                        size="small"
                        inputProps={{ min: 0 }}
                      />
                      <TextField
                        fullWidth
                        label="Start Cardio"
                        type="number"
                        value={cardioData.startCardio}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setCardioData(prev => ({ ...prev, startCardio: value }));
                          setIsPlanDirty(true);
                        }}
                        size="small"
                        inputProps={{ min: 0 }}
                      />
                      <TextField
                        fullWidth
                        label="Start Hit"
                        type="number"
                        value={cardioData.startHit}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setCardioData(prev => ({ ...prev, startHit: value }));
                          setIsPlanDirty(true);
                        }}
                        size="small"
                        inputProps={{ min: 0 }}
                      />
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section 3: Exercises */}
          {localWorkoutPlan && localWorkoutPlan.days.length > 0 && localWorkoutPlan.days[selectedDayIndex] && (
            <Card sx={{ flex: '1 1 0', minWidth: 0, height: '75vh', display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title={`Exercises - ${localWorkoutPlan.days[selectedDayIndex].title}`}
                action={
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setCaDayDialogOpen(true)}
                    >
                      Choose ca_day
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsAddExerciseDialogOpen(true)}
                    >
                      Add Exercise
                    </Button>
                  </Stack>
                }
              />
              <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {/* Show selected ca_day summary if present */}
                {(localWorkoutPlan.days[selectedDayIndex] as any).caDay && (
                  <Box sx={{
                    mb: 2,
                    p: 1.5,
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {(localWorkoutPlan.days[selectedDayIndex] as any).caDay.imageUrl && (
                      <img src={(localWorkoutPlan.days[selectedDayIndex] as any).caDay.imageUrl} alt="ca_day" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                    )}
                    <Typography variant="body2" fontWeight={600}>
                      {(localWorkoutPlan.days[selectedDayIndex] as any).caDay.name
                    }</Typography>
                    {(localWorkoutPlan.days[selectedDayIndex] as any).caDay.url && (
                      <Button size="small" href={(localWorkoutPlan.days[selectedDayIndex] as any).caDay.url} target="_blank">
                        Open
                      </Button>
                    )}
                  </Box>
                )}
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
      ))}

      {activeTab === 'logs' && (
        <Card>
          <CardHeader
            title={`Workout Logs (${logsData?.workoutLogs?.length || 0})`}
            action={<Button variant="outlined" size="small" onClick={() => refreshLogs()}>Refresh</Button>}
          />
          <CardContent>
            {logsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {Array.isArray(logsData?.workoutLogs) && logsData!.workoutLogs.length > 0 ? (
                  <Stack spacing={1.5}>
                    {logsData!.workoutLogs.map((log: any) => (
                      <Card key={log.id} variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => {
                        // TODO: Add workout log details dialog
                        console.log('View workout log details:', log);
                      }}>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{log.workoutPlan?.title || 'Workout'}</Typography>
                              <Typography variant="caption" color="text.secondary">Day {Number(log.dayIndex) + 1}</Typography>
                            </Box>
                            <Chip label={log.completed ? 'Completed' : 'In Progress'} color={log.completed ? 'success' : 'warning'} size="small" />
                          </Stack>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ color: 'text.secondary' }}>
                            <Typography variant="body2">{new Date(log.date).toLocaleDateString()}</Typography>
                            <Typography variant="body2">{log.startTime && log.endTime ? `${log.startTime} - ${log.endTime}` : 'Not completed'}</Typography>
                            <Typography variant="body2">{Array.isArray(log.exercises) ? `${log.exercises.length} exercises` : '-'}</Typography>
                          </Stack>
                          {log.notes && (
                            <Typography variant="body2" sx={{ mt: 1 }}>{log.notes}</Typography>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No workout logs found</Typography>
                )}
              </>
            )}
          </CardContent>
        </Card>
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

      {/* Choose CaDay Dialog */}
      <Dialog open={caDayDialogOpen} onClose={() => setCaDayDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Configure ca_day for Day {selectedDayIndex + 1}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Direct Edit Section */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Direct Edit
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="ca_day Name"
                  value={(localWorkoutPlan?.days[selectedDayIndex] as any)?.caDay?.name || ''}
                  onChange={(e) => {
                    if (!localWorkoutPlan) return;
                    setLocalWorkoutPlan(prev => prev ? {
                      ...prev,
                      days: prev.days.map((d, i) => i === selectedDayIndex ? ({
                        ...d,
                        caDay: { ...d.caDay, name: e.target.value } as any
                      }) : d)
                    } : null);
                    setIsPlanDirty(true);
                  }}
                />
                <TextField
                  fullWidth
                  label="Image URL"
                  value={(localWorkoutPlan?.days[selectedDayIndex] as any)?.caDay?.imageUrl || ''}
                  onChange={(e) => {
                    if (!localWorkoutPlan) return;
                    setLocalWorkoutPlan(prev => prev ? {
                      ...prev,
                      days: prev.days.map((d, i) => i === selectedDayIndex ? ({
                        ...d,
                        caDay: { ...d.caDay, imageUrl: e.target.value } as any
                      }) : d)
                    } : null);
                    setIsPlanDirty(true);
                  }}
                />
                <TextField
                  fullWidth
                  label="Single URL (Legacy)"
                  value={(localWorkoutPlan?.days[selectedDayIndex] as any)?.caDay?.url || ''}
                  onChange={(e) => {
                    if (!localWorkoutPlan) return;
                    setLocalWorkoutPlan(prev => prev ? {
                      ...prev,
                      days: prev.days.map((d, i) => i === selectedDayIndex ? ({
                        ...d,
                        caDay: { ...d.caDay, url: e.target.value } as any
                      }) : d)
                    } : null);
                    setIsPlanDirty(true);
                  }}
                />
                
                {/* Multiple URLs Section */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Multiple URLs
                  </Typography>
                  <Stack spacing={1}>
                    {((localWorkoutPlan?.days[selectedDayIndex] as any)?.caDay?.urls || []).map((url: string, index: number) => (
                      <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          fullWidth
                          label={`URL ${index + 1}`}
                          value={url}
                          onChange={(e) => {
                            if (!localWorkoutPlan) return;
                            const newUrls = [...((localWorkoutPlan.days[selectedDayIndex] as any).caDay?.urls || [])];
                            newUrls[index] = e.target.value;
                            setLocalWorkoutPlan(prev => prev ? {
                              ...prev,
                              days: prev.days.map((d, i) => i === selectedDayIndex ? ({
                                ...d,
                                caDay: { ...d.caDay, urls: newUrls } as any
                              }) : d)
                            } : null);
                            setIsPlanDirty(true);
                          }}
                        />
                        <IconButton
                          color="error"
                          onClick={() => {
                            if (!localWorkoutPlan) return;
                            const newUrls = [...((localWorkoutPlan.days[selectedDayIndex] as any).caDay?.urls || [])];
                            newUrls.splice(index, 1);
                            setLocalWorkoutPlan(prev => prev ? {
                              ...prev,
                              days: prev.days.map((d, i) => i === selectedDayIndex ? ({
                                ...d,
                                caDay: { ...d.caDay, urls: newUrls } as any
                              }) : d)
                            } : null);
                            setIsPlanDirty(true);
                          }}
                        >
                          <Trash size={16} />
                        </IconButton>
                      </Box>
                    ))}
                    <Button
                      variant="outlined"
                      startIcon={<Add size={16} />}
                      onClick={() => {
                        if (!localWorkoutPlan) return;
                        const currentUrls = (localWorkoutPlan.days[selectedDayIndex] as any).caDay?.urls || [];
                        setLocalWorkoutPlan(prev => prev ? {
                          ...prev,
                          days: prev.days.map((d, i) => i === selectedDayIndex ? ({
                            ...d,
                            caDay: { ...d.caDay, urls: [...currentUrls, ''] } as any
                          }) : d)
                        } : null);
                        setIsPlanDirty(true);
                      }}
                    >
                      Add URL
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Box>


            {/* Predefined caDays Section */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Predefined ca_days
              </Typography>
              <Stack spacing={1}>
                <Button variant="outlined" onClick={() => {
                  if (!localWorkoutPlan) return;
                  setLocalWorkoutPlan(prev => prev ? {
                    ...prev,
                    days: prev.days.map((d, i) => i === selectedDayIndex ? ({ ...d, caDay: undefined } as any) : d)
                  } : null);
                  setIsPlanDirty(true);
                }}>Clear</Button>
                {caDays.map((c) => (
                  <Card key={c.id} variant="outlined" onClick={() => {
                    if (!localWorkoutPlan) return;
                    setLocalWorkoutPlan(prev => prev ? {
                      ...prev,
                      days: prev.days.map((d, i) => i === selectedDayIndex ? ({ ...d, caDay: c } as any) : d)
                    } : null);
                    setIsPlanDirty(true);
                    setCaDayDialogOpen(false);
                  }} sx={{ cursor: 'pointer' }}>
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {c.imageUrl && <img src={c.imageUrl} alt="img" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600}>{c.name}</Typography>
                          {c.url && <Typography variant="caption" color="text.secondary">{c.url}</Typography>}
                          {c.urls && c.urls.length > 0 && (
                            <Box sx={{ mt: 0.5 }}>
                              {c.urls.map((url: string, index: number) => (
                                <Typography key={index} variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                  Link {index + 1}: {url}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCaDayDialogOpen(false)}>Close</Button>
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
      <Dialog open={isAddExerciseDialogOpen} onClose={() => {
        setIsAddExerciseDialogOpen(false);
        setExerciseSearchTerm('');
      }} maxWidth="md" fullWidth>
        <DialogTitle>Add Exercises to Workout Day</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              placeholder="Search exercises by name, muscle group, or category..."
              value={exerciseSearchTerm}
              onChange={(e) => setExerciseSearchTerm(e.target.value)}
              sx={{ mb: 2 }}
              autoFocus
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {workspaceExercises.filter((exercise) =>
                exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                exercise.muscleGroup.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                (exercise.description && exercise.description.toLowerCase().includes(exerciseSearchTerm.toLowerCase()))
              ).length} exercise(s) found
            </Typography>
          </Box>
          <List>
            {workspaceExercises
              .filter((exercise) =>
                exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                exercise.muscleGroup.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                (exercise.description && exercise.description.toLowerCase().includes(exerciseSearchTerm.toLowerCase()))
              )
              .map((exercise) => {
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
              {/* Media */}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Media
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  {/* Thumbnail uploader */}
                  <Box>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Thumbnail</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={uploadingThumb}
                        component="label"
                      >
                        {uploadingThumb ? <CircularProgress size={18} /> : 'Upload'}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              setUploadingThumb(true);
                              // Get presigned URL (reuse 'landing' type)
                              const presign = await api.post(`/api/upload/landing/presigned`, {
                                filename: file.name,
                                contentType: file.type || 'image/jpeg'
                              });
                              const { uploadUrl, publicUrl } = presign.data;
                              await fetch(uploadUrl, {
                                method: 'PUT',
                                headers: { 'Content-Type': file.type || 'image/jpeg' },
                                body: file
                              });
                              setEditingExercise((prev: any) => ({ ...prev, thumbnailUrl: publicUrl }));
                              setIsPlanDirty(true);
                            } catch (err) {
                              openSnackbar({ open: true, message: 'Thumbnail upload failed', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
                            } finally {
                              setUploadingThumb(false);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                      </Button>
                      {editingExercise.thumbnailUrl && (
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editingExercise.thumbnailUrl} alt="thumb" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4 }} />
                          <Button size="small" onClick={() => setEditingExercise((prev: any) => ({ ...prev, thumbnailUrl: '' }))}>Remove</Button>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                  {/* YouTube link */}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>YouTube Link</Typography>
                    <TextField
                      fullWidth
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={editingExercise.videoUrl || ''}
                      onChange={(e) => setEditingExercise((prev: any) => ({ ...prev, videoUrl: e.target.value }))}
                    />
                  </Box>
                </Stack>
              </Box>
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
