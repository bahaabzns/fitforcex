'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  MenuItem,
  Alert,
  Checkbox,
  FormControlLabel,
  Grid
} from '@mui/material';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import {
  Add,
  AddCircle,
  Edit,
  Trash,
  Copy,
  AttachCircle,
  CloseCircle,
  ArrowLeft2,
  ArrowRight2,
  Category,
  DocumentText,
  Setting2,
  Messages2
} from '@wandersonalwes/iconsax-react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';
import MobileSwipeableSections from '@/components/MobileSwipeableSections';
import LoadPlanDialog from '@/components/LoadPlanDialog';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { FormSchedulingPopup } from '@/components/forms/FormSchedulingPopup';

interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string; // YouTube link
  gifImage?: string; // GIF image URL
  category?: string;
  equipmentNeeded?: string;
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

// SortableExercise Component
function SortableExercise({ 
  exercise, 
  index, 
  onEdit, 
  onDelete, 
  formatRepRange,
  onPreviewGif
}: { 
  exercise: any; 
  index: number; 
  onEdit: (ex: any) => void; 
  onDelete: (id: string) => void;
  formatRepRange: (reps: string, sets: number) => string;
  onPreviewGif: (src: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: exercise.id 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const repRange = formatRepRange(exercise.reps, exercise.sets);

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      sx={{ 
        cursor: 'grab',
        transition: 'all 0.2s',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)'
        },
        '&:active': {
          cursor: 'grabbing'
        }
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          {/* Drag Handle */}
          <Box 
            {...attributes} 
            {...listeners}
            sx={{ 
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: '100%',
              '&:active': {
                cursor: 'grabbing'
              }
            }}
          >
            <Category size={20} style={{ opacity: 0.5 }} />
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {exercise.exercise.gifImage && (
                <Tooltip title="Preview GIF" arrow>
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: 2,
                      overflow: 'hidden',
                      flex: '0 0 auto',
                      cursor: 'pointer',
                      border: 1,
                      borderColor: 'divider',
                      '&:hover': { opacity: 0.9 }
                    }}
                    onClick={(e) => { e.stopPropagation(); onPreviewGif(exercise.exercise.gifImage as string); }}
                  >
                    <img
                      src={exercise.exercise.gifImage}
                      alt={exercise.exercise.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                </Tooltip>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`#${index + 1}`} 
                    size="small" 
                    color="primary" 
                    sx={{ height: 20, fontSize: '0.75rem' }} 
                  />
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }} noWrap>
                    {exercise.exercise.name}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                    {exercise.exercise.muscleGroup}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, px: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
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
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5, mt: 0.5 }}>
              <Chip 
                label={exercise.exercise.category || ''}
                size="small"
                variant="outlined"
                sx={{ display: (exercise.exercise.category ? 'inline-flex' : 'none') }}
              />
              <Chip 
                label={exercise.exercise.equipmentNeeded || ''}
                size="small"
                variant="outlined"
                sx={{ display: (exercise.exercise.equipmentNeeded ? 'inline-flex' : 'none') }}
              />
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
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5, alignItems: 'center' }}>
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(exercise);
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
                if (window.confirm(`Remove ${exercise.exercise.name} from this day?`)) {
                  onDelete(exercise.id);
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
}

// SortableDay Component
function SortableDay({ 
  day, 
  index, 
  children 
}: { 
  day: any; 
  index: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: day.id 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style}>
      {children}
    </Box>
  );
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
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState<string[]>([]);
  const [exerciseEquipmentFilter, setExerciseEquipmentFilter] = useState<string[]>([]);
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null);
  
  // UI states
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [isPlanDirty, setIsPlanDirty] = useState(false);
  const [dragDayIndex, setDragDayIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [planQuery, setPlanQuery] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editingPlanTitleId, setEditingPlanTitleId] = useState<string | null>(null);
  const [editingPlanTitleValue, setEditingPlanTitleValue] = useState('');
  const [editingDayTitleId, setEditingDayTitleId] = useState<string | null>(null);
  const [editingDayTitleValue, setEditingDayTitleValue] = useState('');
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
  
  // Client display name
  const [clientName, setClientName] = useState<string>('');

  const handleDayDrop = (toIndex: number) => {
    if (dragDayIndex === null || toIndex === dragDayIndex || !localWorkoutPlan) return;
    const arr = [...localWorkoutPlan.days];
    const from = dragDayIndex;
    const item = arr[from];
    arr.splice(from, 1);
    arr.splice(toIndex, 0, item);
    setLocalWorkoutPlan(prev => prev ? { ...prev, days: arr } : prev);
    setSelectedDayIndex((idx) => {
      if (idx === from) return toIndex;
      if (from < idx && toIndex >= idx) return idx - 1;
      if (from > idx && toIndex <= idx) return idx + 1;
      return idx;
    });
    setDragDayIndex(null);
    setIsPlanDirty(true);
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Cardio tab state
  const [cardioTab, setCardioTab] = useState(0); // 0: Days, 1: Cardio
  const [cardioData, setCardioData] = useState({
    yearsOld: 0,
    heartRateMax: 0,
    heartRateTarget: 0,
    startCardio: 0,
    startHit: 0
  });
  
  // Form completion dialog for plan activation
  const [formCompletionDialogOpen, setFormCompletionDialogOpen] = useState(false);
  const [submittedForms, setSubmittedForms] = useState<Array<{ id: string; formTitle: string; submittedAt: string }>>([]);
  const [selectedFormsToArchive, setSelectedFormsToArchive] = useState<string[]>([]);
  const [archivingForms, setArchivingForms] = useState(false);
  const [activatingPlanId, setActivatingPlanId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  
  // Form scheduling popup after plan activation
  const [formSchedulingPopupOpen, setFormSchedulingPopupOpen] = useState(false);

  // Forms tab state
  const [formsSubmissions, setFormsSubmissions] = useState<Array<{ id: string; form: { id: string; title: string; questions?: any }; answers?: any; status?: string; createdAt?: string; formTitle?: string; formType?: string; submittedAt?: string }>>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [expandedSubmissionIds, setExpandedSubmissionIds] = useState<Record<string, boolean>>({});

  // Chat tab state
  const [chatThreadId, setChatThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workout log details dialog state
  const [workoutLogDetailsOpen, setWorkoutLogDetailsOpen] = useState(false);
  const [selectedWorkoutLog, setSelectedWorkoutLog] = useState<any>(null);

  // Handler for opening workout log details
  const handleViewWorkoutLogDetails = (log: any) => {
    setSelectedWorkoutLog(log);
    setWorkoutLogDetailsOpen(true);
  };

  // Load workout logs for this client (disabled for now)
  const { data: logsData, isLoading: logsLoading, mutate: refreshLogs } = useSWR(
    null, // Disabled
    async () => {
      const params = new URLSearchParams();
      params.append('clientId', clientId);
      const res = await api.get(`/api/workout/logs?${params.toString()}`);
      return res.data as { workoutLogs: any[] };
    }
  );

  // Activation handler with form checking
  const handleActivateWorkoutPlan = async () => {
    if (!selectedPlanId) return;
    
    try {
      // Check for submitted workout forms
      const formsResponse = await api.get(`/api/forms/submitted-by-type?clientId=${clientId}&type=workout`);
      const forms = formsResponse.data?.submissions || [];
      
      if (forms.length > 0) {
        // Show dialog to let coach mark forms as done
        setSubmittedForms(forms);
        setSelectedFormsToArchive([]);
        setActivatingPlanId(selectedPlanId);
        setFormCompletionDialogOpen(true);
        return; // Wait for dialog action
      }
      
      // No forms, proceed with activation
      await api.post(`/api/workout/plans/${selectedPlanId}/activate`);
      await loadSavedPlans();
      openSnackbar({ open: true, message: 'Workout plan activated', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
      
      // Show form scheduling popup after successful activation
      setFormSchedulingPopupOpen(true);
    } catch (e) {
      console.error('Error activating plan:', e);
      openSnackbar({ open: true, message: 'Failed to activate plan', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
    }
  };
  
  const handleWorkoutFormCompletionContinue = async () => {
    try {
      setArchivingForms(true);
      
      // Archive selected forms
      for (const formId of selectedFormsToArchive) {
        await api.post(`/api/forms/submissions/${formId}/archive`);
      }
      
      // Close dialog
      setFormCompletionDialogOpen(false);
      
      // Continue with plan activation
      if (activatingPlanId) {
        await api.post(`/api/workout/plans/${activatingPlanId}/activate`);
        await loadSavedPlans();
        
        openSnackbar({
          open: true,
          message: `Workout plan activated${selectedFormsToArchive.length > 0 ? ` and ${selectedFormsToArchive.length} form(s) marked as done` : ''}`,
          variant: 'alert',
          alert: { color: 'success', variant: 'filled' }
        } as any);
        
        // Show form scheduling popup after successful activation
        setFormSchedulingPopupOpen(true);
        
        // Clear the activating plan ID
        setActivatingPlanId(null);
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to complete activation',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      } as any);
    } finally {
      setArchivingForms(false);
    }
  };
  
  const handleFormSchedule = async (formId: string, scheduleAt?: string) => {
    try {
      const requestData: any = {
        formId,
        clientId,
      };

      // Add scheduleAt if scheduling is selected
      if (scheduleAt) {
        requestData.scheduleAt = scheduleAt;
      }

      await api.post('/api/forms/send', requestData);
      
      const message = scheduleAt 
        ? `Form scheduled for ${new Date(scheduleAt).toLocaleDateString()} successfully!`
        : 'Form sent to client successfully!';
      
      openSnackbar({
        open: true,
        message,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' }
      } as any);
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err.response?.data?.message || err.response?.data?.error || 'Failed to schedule form',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      } as any);
    }
  };

  // Load client forms (workout forms only)
  const loadClientForms = useCallback(async () => {
    if (!clientId) return;
    try {
      setFormsLoading(true);
      setFormsError(null);
      // Prefer new submitted endpoint
      let submissions: any[] = [];
      try {
        const res = await api.get(`/api/forms/client/${clientId}/submitted`);
        const raw = res.data?.submissions;
        submissions = Array.isArray(raw) ? raw : [];
      } catch {
        // Fallback: queue items then filter
        const res2 = await api.get(`/api/forms/queue`);
        const items = Array.isArray(res2.data?.items) ? res2.data.items : [];
        submissions = items.filter((s: any) => s.clientId === clientId).map((s: any) => ({
          id: s.id,
          formId: s.formId,
          formTitle: s.formTitle,
          formType: s.formType,
          status: s.status,
          submittedAt: s.completedAt || s.sentAt || s.scheduledAt,
          answers: undefined,
        }));
      }
      // Filter for workout forms only
      const workoutSubmissions = submissions.filter((s: any) => s.formType === 'workout');
      setFormsSubmissions(workoutSubmissions);
    } catch (e: any) {
      setFormsError(e.response?.data?.message || e.response?.data?.error || 'Failed to load forms');
    } finally {
      setFormsLoading(false);
    }
  }, [clientId]);

  // Toggle form submission expansion
  const toggleExpandSubmission = (submissionId: string) => {
    setExpandedSubmissionIds(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };

  // Render answer values for form submissions
  const renderAnswerValue = (answers: any, questions?: any[]) => {
    if (!answers || typeof answers !== 'object') return <Typography variant="body2">No answers available</Typography>;
    
    const questionMap = questions?.reduce((acc, q) => ({ ...acc, [q.id]: q }), {}) || {};
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Object.entries(answers).map(([questionId, answer]) => {
          const question = questionMap[questionId];
          const questionText = question?.text || question?.question || `Question ${questionId}`;
          
          return (
            <Box key={questionId} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {questionText}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Array.isArray(answer) ? answer.join(', ') : String(answer || 'No answer')}
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  };

  // Chat functions
  const ensureClientThread = useCallback(async () => {
    if (!clientId) return null;
    try {
      setChatLoading(true);
      // Try to find an existing thread first
      const inbox = await api.get('/api/messenger/inbox');
      const existing = (inbox.data?.threads || []).find((t: any) => t.client?.id === clientId);
      if (existing) {
        setChatThreadId(existing.id);
        return existing.id as string;
      }
      // Create a new thread with this client
      const created = await api.post('/api/messenger/threads', { clientId });
      const id = created.data?.thread?.id || created.data?.id;
      setChatThreadId(id);
      return id as string;
    } catch (e: any) {
      setChatError('Failed to open chat');
      return null;
    } finally {
      setChatLoading(false);
    }
  }, [clientId]);

  const loadChatMessages = useCallback(async (threadIdParam?: string) => {
    const id = threadIdParam || chatThreadId;
    if (!id) return;
    try {
      const { data } = await api.get(`/api/messenger/threads/${id}/messages`);
      setChatMessages(data?.messages || []);
    } catch (e: any) {
      setChatError('Failed to load messages');
    }
  }, [chatThreadId]);

  const startChatPolling = useCallback((id: string) => {
    const chatPollRef = { current: null as number | null };
    chatPollRef.current = window.setInterval(() => loadChatMessages(id), 4000) as unknown as number;
    return () => {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
      }
    };
  }, [loadChatMessages]);

  const handleSendChat = async () => {
    if (!chatThreadId || (!chatInput.trim() && attachments.length === 0)) return;
    
    setUploading(true);
    try {
      // Upload files first if any
      let uploadedFiles: any[] = [];
      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach((file) => {
          formData.append('files', file);
        });
        
        const { data } = await api.post('/api/messenger/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedFiles = data.files || [];
      }

      // Send message with attachments
      await api.post(`/api/messenger/threads/${chatThreadId}/messages`, { 
        body: chatInput.trim() || (uploadedFiles.length > 0 ? `📎 ${uploadedFiles.length} attachment${uploadedFiles.length > 1 ? 's' : ''}` : ''),
        attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined
      });
      
      setChatInput('');
      setAttachments([]);
      await loadChatMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatError('Failed to send message');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachments([file]); // Only allow one file
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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

  // Load forms when forms tab is selected
  useEffect(() => {
    if (plansTab === 1) loadClientForms();
  }, [plansTab, loadClientForms]);

  // Chat initialization and polling
  useEffect(() => {
    if (plansTab === 3) {
      ensureClientThread().then((id) => {
        if (id) {
          loadChatMessages(id);
          const cleanup = startChatPolling(id);
          return cleanup;
        }
      });
    }
  }, [plansTab, ensureClientThread, loadChatMessages, startChatPolling]);

  // Auto-scroll chat to bottom
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

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
  
  // Load client name
  useEffect(() => {
    const loadClientName = async () => {
      try {
        const response = await api.get(`/api/clients/${clientId}`);
        setClientName(response.data?.client?.fullName || '');
      } catch (err) {
        console.error('Error loading client name:', err);
      }
    };
    
    if (clientId) {
      loadClientName();
    }
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
          
          // Reload saved plans to get the newly saved plan
          const refreshed = await api.get(`/api/clients/${clientId}/workout/plans`);
          setSavedPlans(refreshed.data.plans || []);
          
          setSelectedPlanId(newPlanId);
          setLocalWorkoutPlan(null); // Clear local plan since it's now saved
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
  // Drag and drop handlers
  const handleExerciseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !localWorkoutPlan) return;
    
    const oldIndex = localWorkoutPlan.days[selectedDayIndex].exercises.findIndex((ex: any) => ex.id === active.id);
    const newIndex = localWorkoutPlan.days[selectedDayIndex].exercises.findIndex((ex: any) => ex.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newExercises = arrayMove(localWorkoutPlan.days[selectedDayIndex].exercises, oldIndex, newIndex);
      setLocalWorkoutPlan(prev => prev ? {
        ...prev,
        days: prev.days.map((day, idx) => 
          idx === selectedDayIndex ? { ...day, exercises: newExercises } : day
        )
      } : null);
      setIsPlanDirty(true);
    }
  };

  const handleDayDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !localWorkoutPlan) return;
    
    const oldIndex = localWorkoutPlan.days.findIndex((day: any) => day.id === active.id);
    const newIndex = localWorkoutPlan.days.findIndex((day: any) => day.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newDays = arrayMove(localWorkoutPlan.days, oldIndex, newIndex);
      setLocalWorkoutPlan(prev => prev ? { ...prev, days: newDays } : null);
      // Update selectedDayIndex if needed
      if (selectedDayIndex === oldIndex) {
        setSelectedDayIndex(newIndex);
      } else if (selectedDayIndex === newIndex) {
        setSelectedDayIndex(oldIndex);
      } else if (selectedDayIndex > Math.max(oldIndex, newIndex)) {
        // No change needed
      } else if (selectedDayIndex < Math.min(oldIndex, newIndex)) {
        // No change needed
      }
      setIsPlanDirty(true);
    }
  };

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

  // Activate a workout plan
  const handleActivatePlan = async () => {
    if (!selectedPlanId) return;
    try {
      setActivating(true);
      
      // Check for submitted workout forms
      try {
        const formsResponse = await api.get(`/api/forms/submitted-by-type?clientId=${clientId}&type=workout`);
        const forms = formsResponse.data?.submissions || [];
        
        if (forms.length > 0) {
          // Show dialog to let coach mark forms as done
          setSubmittedForms(forms);
          setSelectedFormsToArchive([]);
          setActivatingPlanId(selectedPlanId);
          setFormCompletionDialogOpen(true);
          setActivating(false);
          return; // Wait for dialog action
        }
      } catch (err) {
        console.error('Error checking forms:', err);
        // Continue with activation even if form check fails
      }
      
      // No forms, proceed with activation
      await api.post(`/api/workout/plans/${selectedPlanId}/activate`);
      await loadSavedPlans();
      openSnackbar({ open: true, message: 'Workout plan activated', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
      
      // Show form scheduling popup after successful activation
      setFormSchedulingPopupOpen(true);
    } catch (e) {
      console.error('Error activating plan:', e);
      openSnackbar({ open: true, message: 'Failed to activate plan', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
    } finally {
      setActivating(false);
    }
  };


  return (
    <Box sx={{ width: '100%', overflow: 'hidden', maxWidth: '100vw', px: { xs: 0, md: 0 } }}>
    <Stack spacing={1} sx={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 1, md: 0 } }}>
        <Typography variant="h5">{clientName || 'Client'}</Typography>
        <Stack direction="row" spacing={1} sx={{ gap: { xs: 0.5, md: 1 } }}>
            {localWorkoutPlan && isPlanDirty && (
            <Button variant="outlined" onClick={saveLocalPlan} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
              </Button>
            )}
            {selectedPlanId && !String(selectedPlanId).startsWith('local_') && (
            <Button variant="contained" color="success" onClick={handleActivatePlan} disabled={activating}>
                {activating ? 'Activating…' : 'Activate'}
              </Button>
            )}
          </Stack>
      </Box>

      {/* Main Content */}
      {(isMobile ? (
        <MobileSwipeableSections
          sections={[
            // Section 1: Plans
            <Card key="plans" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <CardHeader
            title={
              <Box sx={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
                <Tabs 
                  value={plansTab} 
                  onChange={(_, v) => setPlansTab(v)} 
                  variant="scrollable" 
                  allowScrollButtonsMobile 
                  scrollButtons="auto"
                  sx={{
                    '& .MuiTab-root': {
                      minWidth: 48
                    }
                  }}
                >
                  {[
                    <Tab key="plans-icon" label="" icon={<Category size={20} />} iconPosition="top" />,
                    <Tab key="forms-icon" label="" icon={<DocumentText size={20} />} iconPosition="top" />,
                    <Tab key="tools-icon" label="" icon={<Setting2 size={20} />} iconPosition="top" />,
                    <Tab key="chat-icon" label="" icon={<Messages2 size={20} />} iconPosition="top" />,
                  ]}
                </Tabs>
              </Box>
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
              <Grid container spacing={2} direction="column">
                {/* Combine local plan with saved plans */}
                {[
                  // Add local draft plan if it exists
                  ...(localWorkoutPlan && localWorkoutPlan.id.startsWith('local_') 
                    ? [{
                        id: localWorkoutPlan.id,
                        title: localWorkoutPlan.title,
                        days: localWorkoutPlan.days
                      }]
                    : []),
                  ...savedPlans
                ]
                  .filter(plan => plan.title.toLowerCase().includes(planQuery.toLowerCase()))
                  .map((plan: any) => {
                    const isSelected = selectedPlanId === plan.id;
                    const isDraft = plan.isDraft;
                    return (
                      <Grid item xs={12} key={plan.id}>
                        <Card
                    onClick={async () => {
                      setSelectedPlanId(plan.id);
                      if (isMobile) setMobileSection(1);
                            
                            // If it's a draft, we already have it in localWorkoutPlan
                            if (isDraft) {
                              setSelectedDayIndex(0);
                              return;
                            }
                            
                            // Otherwise fetch from server
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
                          sx={{
                            cursor: 'pointer',
                            border: '1px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            bgcolor: isSelected ? 'primary.lighter' : 'background.paper',
                            position: 'relative',
                            '&:hover .plan-actions': { opacity: 1 }
                          }}
                        >
                          <CardContent sx={{ py: 1.25 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 60 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.25, color: isSelected ? 'primary.main' : undefined }}>
                                {plan.title}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="text.secondary">
                                  {plan.status ? `Status: ${plan.status} • ` : ''}{plan.createdAt ? `Created: ${new Date(plan.createdAt).toLocaleDateString()} • ` : ''}{plan.days?.length || 0} days
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {plan.status && (
                                    <Chip size="small" label={plan.status} color={plan.status === 'active' ? 'success' : 'default'} />
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          </CardContent>
                          <Box className="plan-actions" sx={{ position: 'absolute', top: 6, right: 6, opacity: isMobile ? 1 : 0, transition: 'opacity .2s', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                              <IconButton 
                                size="small" 
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
                                title="Copy plan" 
                                sx={{ '&:hover': { bgcolor: 'action.selected' } }}
                              >
                                <Copy size={16} />
                              </IconButton>
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Delete this plan?')) {
                                    handleDeletePlan(plan.id);
                                  }
                                }}
                                title="Delete plan" 
                                sx={{ '&:hover': { bgcolor: 'error.lighter' } }}
                              >
                                <Trash size={16} />
                              </IconButton>
                            </Box>
                        </Card>
                      </Grid>
                    );
                  })}
                
                {savedPlans.length === 0 && !localWorkoutPlan?.id.startsWith('local_') && (
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="body1" sx={{ textAlign: 'center' }}>
                          No plans yet
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                          Create your first workout plan
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            )
            ) : plansTab === 1 ? (
              <Box sx={{ py: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Workout Forms</Typography>
                {formsError && <Alert severity="error" sx={{ mb: 2 }}>{formsError}</Alert>}
                {formsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : formsSubmissions.length === 0 ? (
                  <Typography color="text.secondary">No workout form submissions found for this client.</Typography>
                ) : (
                  <List>
                    {formsSubmissions.map((s) => (
                      <ListItem key={s.id} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 1 }}>
                          <ListItemText
                            primary={s.formTitle || s.form?.title || 'Untitled form'}
                            secondary={
                              <>
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {s.formType ? `${s.formType} • ` : ''}
                                  {s.submittedAt ? new Date(s.submittedAt as string).toLocaleString() : (s.createdAt ? new Date(s.createdAt as string).toLocaleString() : '')}
                                  {s.status ? ` • ${s.status}` : ''}
                                </Typography>
                              </>
                            }
                          />
                          <Button size="small" onClick={() => toggleExpandSubmission(s.id)}>
                            {expandedSubmissionIds[s.id] ? 'Hide Answers' : 'View Answers'}
                          </Button>
                        </Box>
                        {expandedSubmissionIds[s.id] && (
                          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, mt: 1 }}>
                            {renderAnswerValue(s.answers || {}, s.form?.questions)}
                          </Box>
                        )}
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            ) : plansTab === 2 ? (
              <Box sx={{ py: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Tools</Typography>
                <Typography color="text.secondary">Tools coming soon…</Typography>
              </Box>
            ) : plansTab === 3 ? (
              <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', height: '60vh' }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Chat</Typography>
                {chatError && <Alert severity="error" sx={{ mb: 1 }}>{chatError}</Alert>}
                <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }} ref={chatScrollRef}>
                    {chatLoading && chatMessages.length === 0 ? (
                      <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>
                    ) : (
                      chatMessages.map((m: any) => (
                        <Box key={m.id} sx={{ display: 'flex', justifyContent: (m.isMine || m.mine || m.sender?.isMe) ? 'flex-end' : 'flex-start', mb: 1 }}>
                          <Box sx={{ px: 1, py: 0.5, bgcolor: (m.isMine || m.mine || m.sender?.isMe) ? 'primary.light' : 'action.hover', borderRadius: 1, maxWidth: '70%' }}>
                            <Typography variant="body2">{m.body || m.message || m.text || ''}</Typography>
                            {m.attachments && m.attachments.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                {m.attachments.map((attachment: any, index: number) => (
                                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <AttachCircle fontSize="small" />
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      href={attachment.url}
                                      target="_blank"
                                      sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: '0.75rem' }}
                                    >
                                      {attachment.originalName || attachment.filename || `Attachment ${index + 1}`}
                                      {attachment.size && ` (${(attachment.size / 1024).toFixed(1)} KB)`}
                                    </Button>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            <Typography variant="caption" color="text.secondary">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</Typography>
                          </Box>
                        </Box>
                      ))
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                      fullWidth
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    />
                    <IconButton
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      sx={{ 
                        bgcolor: 'grey.100',
                        '&:hover': { bgcolor: 'grey.200' }
                      }}
                    >
                      <AttachCircle />
                    </IconButton>
                    <Button 
                      variant="contained" 
                      onClick={handleSendChat} 
                      disabled={(!chatInput.trim() && attachments.length === 0) || uploading}
                    >
                      {uploading ? 'Sending...' : 'Send'}
                    </Button>
                  </Box>
                  
                  {/* Attachment preview */}
                  {attachments.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {attachments.map((file, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </Typography>
                          <IconButton size="small" onClick={() => handleRemoveAttachment(index)}>
                            <CloseCircle />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {plansTab === 0 && 'Select a plan to view details'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>,

            // Section 2: Days
            <Card key="days" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ pb: 0 }}>
              {/* Row 1: Plan name with close */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {editingPlanTitleId === localWorkoutPlan?.id ? (
                    <TextField
                      size="small"
                      value={editingPlanTitleValue}
                      autoFocus
                      onChange={(e) => setEditingPlanTitleValue(e.target.value)}
                      onBlur={() => {
                        if (localWorkoutPlan) {
                          setLocalWorkoutPlan((prev) => prev ? { ...prev, title: editingPlanTitleValue || prev.title } : null);
                          setIsPlanDirty(true);
                        }
                        setEditingPlanTitleId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingPlanTitleId(null);
                      }}
                    />
                  ) : (
                    <Typography 
                      variant="h6" 
                      onClick={() => {
                        if (localWorkoutPlan) {
                          const t = localWorkoutPlan.title || '';
                          setEditingPlanTitleId(localWorkoutPlan.id);
                          setEditingPlanTitleValue(t);
                        }
                      }} 
                      sx={{ cursor: 'text' }}
                    >
                      {localWorkoutPlan?.title || 'Plan'}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {localWorkoutPlan && cardioTab === 0 && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsCreateDayDialogOpen(true)}
                    >
                      Add Day
                    </Button>
                  )}
                  <IconButton size="medium" onClick={clearLocalPlan} title="Close" sx={{ fontSize: 18, lineHeight: 1 }}>✕</IconButton>
                </Box>
              </Box>

              {/* Tabs */}
              {localWorkoutPlan && (
                <Box>
                  <Tabs value={cardioTab} onChange={(_, v) => setCardioTab(v)} variant="fullWidth">
                    <Tab label="Days" />
                  </Tabs>
                </Box>
              )}
            </CardContent>
            <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', p: 0, '&:last-child': { pb: 0 } }}>
              {localWorkoutPlan ? (
                cardioTab === 0 ? (
                  // Days tab content
                  <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, px: 2, pt: 2 }}>
                    {localWorkoutPlan.days.map((day, index) => (
                      <Card
                      draggable
                      onDragStart={() => setDragDayIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDayDrop(index)}
                      key={day.id}
                        sx={{ 
                          border: selectedDayIndex === index ? 2 : 1,
                          borderColor: selectedDayIndex === index ? 'primary.main' : 'divider',
                          bgcolor: selectedDayIndex === index ? 'primary.lighter' : 'background.paper',
                          cursor: 'pointer',
                          position: 'relative',
                          '&:hover .day-actions': { opacity: 1 }
                        }}
                      onClick={() => {
                        setSelectedDayIndex(index);
                        // On mobile, automatically move to section 3 (exercises) when day is selected
                        if (isMobile) {
                          setMobileSection(2);
                        }
                      }}
                    >
                        <CardHeader title={day.title} />
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <Box sx={{ mr: 1, color: 'text.disabled', cursor: 'grab', fontSize: 18, lineHeight: 1 }} title="Drag to reorder">≡</Box>
                            <Typography variant="body2" color="text.secondary">
                              {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
                            </Typography>
                          </Box>
                        </CardContent>
                        <Box className="day-actions" sx={{ position: 'absolute', top: 6, right: 6, opacity: isMobile ? 1 : 0, transition: 'opacity .2s', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                          <IconButton 
                                size="small" 
                            title="Copy day"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!localWorkoutPlan) return;
                              const newId = `day_${Date.now()}`;
                              const copiedDay = {
                                ...day,
                                id: newId,
                                exercises: day.exercises.map((ex: any, idx: number) => ({
                                  ...ex,
                                  id: `exercise_${Date.now()}_${idx}_${Math.random()}`
                                }))
                              };
                              setLocalWorkoutPlan(prev => prev ? {
                                ...prev,
                                days: [...prev.days, copiedDay]
                              } : null);
                              setIsPlanDirty(true);
                            }}
                            sx={{ '&:hover': { bgcolor: 'action.selected' } }}
                          >
                            <Copy size={16} />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="error" 
                            title="Delete day"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!localWorkoutPlan) return;
                              if (window.confirm('Delete this day?')) {
                                setLocalWorkoutPlan(prev => prev ? {
                                  ...prev,
                                  days: prev.days.filter((_, i) => i !== index)
                                } : null);
                                if (selectedDayIndex === index) {
                                  setSelectedDayIndex(0);
                                } else if (selectedDayIndex > index) {
                                  setSelectedDayIndex(selectedDayIndex - 1);
                                }
                                setIsPlanDirty(true);
                              }
                            }}
                            sx={{ '&:hover': { bgcolor: 'error.lighter' } }}
                          >
                            <Trash size={16} />
                          </IconButton>
                          </Box>
                      </Card>
                  ))}
                  
                  <Box>
                    <Card
                      sx={{
                        border: '1px dashed',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={() => setIsCreateDayDialogOpen(true)}
                    >
                      <Button startIcon={<Add size={16} />}>Add Day</Button>
                    </Card>
                  </Box>
                  
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
                      </Box>
                    )}
                  </Box>
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
            <CardContent sx={{ pb: 1 }}>
              {/* Row 1: Day name with close */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {localWorkoutPlan && localWorkoutPlan.days[selectedDayIndex] ? (
                    editingDayTitleId === localWorkoutPlan.days[selectedDayIndex].id ? (
                      <TextField
                      size="small"
                        value={editingDayTitleValue}
                        autoFocus
                        onChange={(e) => setEditingDayTitleValue(e.target.value)}
                        onBlur={() => {
                          if (localWorkoutPlan) {
                            setLocalWorkoutPlan((prev) => prev ? {
                              ...prev,
                              days: prev.days.map((day, idx) => 
                                idx === selectedDayIndex 
                                  ? { ...day, title: editingDayTitleValue || day.title }
                                  : day
                              )
                            } : null);
                            setIsPlanDirty(true);
                          }
                          setEditingDayTitleId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingDayTitleId(null);
                        }}
                      />
                    ) : (
                      <Typography 
                        variant="h6" 
                        onClick={() => {
                          if (localWorkoutPlan && localWorkoutPlan.days[selectedDayIndex]) {
                            const t = localWorkoutPlan.days[selectedDayIndex].title || '';
                            setEditingDayTitleId(localWorkoutPlan.days[selectedDayIndex].id);
                            setEditingDayTitleValue(t);
                          }
                        }} 
                        sx={{ cursor: 'text' }}
                      >
                        {localWorkoutPlan?.days[selectedDayIndex]?.title || 'Day'}
                      </Typography>
                    )
                  ) : (
                    <Typography variant="h6">Exercises</Typography>
                  )}
                </Box>
                {localWorkoutPlan && localWorkoutPlan.days[selectedDayIndex] && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsAddExerciseDialogOpen(true)}
                    >
                      Add Exercise
                    </Button>
                    <IconButton size="medium" onClick={() => setSelectedDayIndex(0)} title="Close" sx={{ fontSize: 18, lineHeight: 1 }}>✕</IconButton>
                  </Box>
                )}
              </Box>
            </CardContent>
            <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
                <Box sx={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
                  <Tabs 
                    value={plansTab} 
                    onChange={(_, v) => setPlansTab(v)} 
                    variant="scrollable" 
                    allowScrollButtonsMobile 
                    scrollButtons="auto"
                    sx={{
                      '& .MuiTab-root': {
                        minWidth: { xs: 48, md: 'auto' }
                      }
                    }}
                  >
                        <Tab label="Plans" />
                        <Tab label="Forms" />
                        <Tab label="Tools" />
                        <Tab label="Chat" />
                  </Tabs>
                </Box>
              }
              subheader={
                plansTab === 0 ? (
                  <Box sx={{ mt: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
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
                <Grid container spacing={2} direction="column">
                  {/* Combine local plan with saved plans */}
                  {[
                    // Add local draft plan if it exists
                    ...(localWorkoutPlan && localWorkoutPlan.id.startsWith('local_') 
                      ? [{
                          id: localWorkoutPlan.id,
                          title: localWorkoutPlan.title,
                          days: localWorkoutPlan.days
                        }]
                      : []),
                    ...savedPlans
                  ]
                    .filter(plan => plan.title.toLowerCase().includes(planQuery.toLowerCase()))
                    .map((plan: any) => {
                      const isSelected = selectedPlanId === plan.id;
                      const isDraft = plan.isDraft;
                      return (
                        <Grid item xs={12} key={plan.id}>
                          <Card
                      onClick={() => {
                              setSelectedPlanId(plan.id);
                              
                              // If it's a draft, we already have it in localWorkoutPlan
                              if (isDraft) {
                        setSelectedDayIndex(0);
                                return;
                              }
                              
                              // Otherwise, set up the plan from saved data
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
                              border: '1px solid',
                              borderColor: isSelected ? 'primary.main' : 'divider',
                              bgcolor: isSelected ? 'primary.lighter' : 'background.paper',
                              position: 'relative',
                              '&:hover .plan-actions': { opacity: 1 }
                            }}
                          >
                            <CardContent sx={{ py: 1.25 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 60 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.25, color: isSelected ? 'primary.main' : undefined }}>
                                  {plan.title}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    {plan.days?.length || 0} days
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {plan.status && (
                                      <Chip size="small" label={plan.status} color={plan.status === 'active' ? 'success' : 'default'} />
                                    )}
                                  </Box>
                                </Box>
                              </Box>
                            </CardContent>
                            <Box className="plan-actions" sx={{ position: 'absolute', top: 6, right: 6, opacity: 0, transition: 'opacity .2s', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                                <IconButton
                          size="small"
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
                                  title="Copy plan"
                                  sx={{ '&:hover': { bgcolor: 'action.selected' } }}
                        >
                                  <Copy size={16} />
                                </IconButton>
                        <IconButton
                          size="small"
                                  color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this plan?')) {
                              handleDeletePlan(plan.id);
                            }
                          }}
                                  title="Delete plan"
                                  sx={{ '&:hover': { bgcolor: 'error.lighter' } }}
                        >
                          <Trash size={16} />
                        </IconButton>
                              </Box>
                          </Card>
                        </Grid>
                      );
                    })}
                  
                  {savedPlans.length === 0 && !localWorkoutPlan?.id.startsWith('local_') && (
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="body1" sx={{ textAlign: 'center' }}>
                            No plans yet
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                            Create your first workout plan
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>
                )
              ) : plansTab === 1 ? (
                <Box sx={{ py: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>Workout Forms</Typography>
                  {formsError && <Alert severity="error" sx={{ mb: 2 }}>{formsError}</Alert>}
                  {formsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : formsSubmissions.length === 0 ? (
                    <Typography color="text.secondary">No workout form submissions found for this client.</Typography>
                  ) : (
                    <List>
                      {formsSubmissions.map((s) => (
                        <ListItem key={s.id} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 1 }}>
                            <ListItemText
                              primary={s.formTitle || s.form?.title || 'Untitled form'}
                              secondary={
                                <>
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    {s.formType ? `${s.formType} • ` : ''}
                                    {s.submittedAt ? new Date(s.submittedAt as string).toLocaleString() : (s.createdAt ? new Date(s.createdAt as string).toLocaleString() : '')}
                                    {s.status ? ` • ${s.status}` : ''}
                                  </Typography>
                                </>
                              }
                            />
                            <Button size="small" onClick={() => toggleExpandSubmission(s.id)}>
                              {expandedSubmissionIds[s.id] ? 'Hide Answers' : 'View Answers'}
                            </Button>
                          </Box>
                          {expandedSubmissionIds[s.id] && (
                            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, mt: 1 }}>
                              {renderAnswerValue(s.answers || {}, s.form?.questions)}
                            </Box>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              ) : plansTab === 2 ? (
                <Box sx={{ py: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>Tools</Typography>
                  <Typography color="text.secondary">Tools coming soon…</Typography>
                </Box>
              ) : plansTab === 3 ? (
                <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', height: '60vh' }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>Chat</Typography>
                  {chatError && <Alert severity="error" sx={{ mb: 1 }}>{chatError}</Alert>}
                  <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }} ref={chatScrollRef}>
                      {chatLoading && chatMessages.length === 0 ? (
                        <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>
                      ) : (
                        chatMessages.map((m: any) => (
                          <Box key={m.id} sx={{ display: 'flex', justifyContent: (m.isMine || m.mine || m.sender?.isMe) ? 'flex-end' : 'flex-start', mb: 1 }}>
                            <Box sx={{ px: 1, py: 0.5, bgcolor: (m.isMine || m.mine || m.sender?.isMe) ? 'primary.light' : 'action.hover', borderRadius: 1, maxWidth: '70%' }}>
                              <Typography variant="body2">{m.body || m.message || m.text || ''}</Typography>
                              {m.attachments && m.attachments.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  {m.attachments.map((attachment: any, index: number) => (
                                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                      <AttachCircle fontSize="small" />
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        href={attachment.url}
                                        target="_blank"
                                        sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: '0.75rem' }}
                                      >
                                        {attachment.originalName || attachment.filename || `Attachment ${index + 1}`}
                                        {attachment.size && ` (${(attachment.size / 1024).toFixed(1)} KB)`}
                                      </Button>
                                    </Box>
                                  ))}
                                </Box>
                              )}
                              <Typography variant="caption" color="text.secondary">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</Typography>
                            </Box>
                          </Box>
                        ))
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
                      <TextField
                        size="small"
                        placeholder="Type a message..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                        fullWidth
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      />
                      <IconButton
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        sx={{ 
                          bgcolor: 'grey.100',
                          '&:hover': { bgcolor: 'grey.200' }
                        }}
                      >
                        <AttachCircle />
                      </IconButton>
                      <Button 
                        variant="contained" 
                        onClick={handleSendChat} 
                        disabled={(!chatInput.trim() && attachments.length === 0) || uploading}
                      >
                        {uploading ? 'Sending...' : 'Send'}
                      </Button>
                    </Box>
                    
                    {/* Attachment preview */}
                    {attachments.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        {attachments.map((file, index) => (
                          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </Typography>
                            <IconButton size="small" onClick={() => handleRemoveAttachment(index)}>
                              <CloseCircle />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {plansTab === 0 && 'Select a plan to view details'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Days */}
          {localWorkoutPlan && (
            <Card sx={{ flex: '1 1 0', minWidth: 0, height: '75vh', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ pb: 0 }}>
                {/* Row 1: Plan name with close */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {editingPlanTitleId === localWorkoutPlan?.id ? (
                      <TextField
                        size="small"
                        value={editingPlanTitleValue}
                        autoFocus
                        onChange={(e) => setEditingPlanTitleValue(e.target.value)}
                        onBlur={() => {
                          if (localWorkoutPlan) {
                            setLocalWorkoutPlan((prev) => prev ? { ...prev, title: editingPlanTitleValue || prev.title } : null);
                            setIsPlanDirty(true);
                          }
                          setEditingPlanTitleId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingPlanTitleId(null);
                        }}
                      />
                    ) : (
                      <Typography 
                        variant="h6" 
                        onClick={() => {
                          if (localWorkoutPlan) {
                            const t = localWorkoutPlan.title || '';
                            setEditingPlanTitleId(localWorkoutPlan.id);
                            setEditingPlanTitleValue(t);
                          }
                        }} 
                        sx={{ cursor: 'text' }}
                      >
                        {localWorkoutPlan?.title || 'Plan'}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {cardioTab === 0 && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsCreateDayDialogOpen(true)}
                    >
                      Add Day
                    </Button>
                    )}
                    <IconButton size="medium" onClick={clearLocalPlan} title="Close" sx={{ fontSize: 18, lineHeight: 1 }}>✕</IconButton>
                  </Box>
                </Box>

                {/* Tabs */}
                <Box>
                  <Tabs value={cardioTab} onChange={(_, v) => setCardioTab(v)} variant="fullWidth">
                    <Tab label="Days" />
                  </Tabs>
                </Box>
              </CardContent>
              <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', p: 0, '&:last-child': { pb: 0 } }}>
                {cardioTab === 0 ? (
                  // Days tab content
                  localWorkoutPlan.days.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                      <SortableContext 
                        items={localWorkoutPlan.days.map(day => day.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, px: 2, pt: 2 }}>
                          {localWorkoutPlan.days.map((day, index) => (
                            <SortableDay key={day.id} day={day} index={index}>
                              <Card
                                sx={{ 
                                  border: selectedDayIndex === index ? 2 : 1,
                                  borderColor: selectedDayIndex === index ? 'primary.main' : 'divider',
                                  bgcolor: selectedDayIndex === index ? 'primary.lighter' : 'background.paper',
                                  cursor: 'pointer',
                                  position: 'relative',
                                  '&:hover .day-actions': { opacity: 1 }
                                }}
                                onClick={() => setSelectedDayIndex(index)}
                              >
                                <CardHeader title={day.title} />
                                <CardContent>
                                  <Typography variant="body2" color="text.secondary">
                                    {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
                                  </Typography>
                                </CardContent>
                                <Box className="day-actions" sx={{ position: 'absolute', top: 6, right: 6, opacity: 0, transition: 'opacity .2s', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                                  <IconButton 
                                    size="small" 
                                    title="Copy day"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!localWorkoutPlan) return;
                                      const newId = `day_${Date.now()}`;
                                      const copiedDay = {
                                        ...day,
                                        id: newId,
                                        exercises: day.exercises.map((ex: any, idx: number) => ({
                                          ...ex,
                                          id: `exercise_${Date.now()}_${idx}_${Math.random()}`
                                        }))
                                      };
                                      setLocalWorkoutPlan(prev => prev ? {
                                        ...prev,
                                        days: [...prev.days, copiedDay]
                                      } : null);
                                      setIsPlanDirty(true);
                                    }}
                                    sx={{ '&:hover': { bgcolor: 'action.selected' } }}
                                  >
                                    <Copy size={16} />
                                  </IconButton>
                                  <IconButton 
                                    size="small" 
                                    color="error" 
                                    title="Delete day"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!localWorkoutPlan) return;
                                      if (window.confirm('Delete this day?')) {
                                        setLocalWorkoutPlan(prev => prev ? {
                                          ...prev,
                                          days: prev.days.filter((_, i) => i !== index)
                                        } : null);
                                        if (selectedDayIndex === index) {
                                          setSelectedDayIndex(0);
                                        } else if (selectedDayIndex > index) {
                                          setSelectedDayIndex(selectedDayIndex - 1);
                                        }
                                        setIsPlanDirty(true);
                                      }
                                    }}
                                    sx={{ '&:hover': { bgcolor: 'error.lighter' } }}
                                  >
                                    <Trash size={16} />
                                  </IconButton>
                                </Box>
                              </Card>
                            </SortableDay>
                          ))}
                          
                          <Box>
                            <Card
                              sx={{
                                border: '1px dashed',
                                borderColor: 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onClick={() => setIsCreateDayDialogOpen(true)}
                            >
                              <Button startIcon={<Add size={16} />}>Add Day</Button>
                            </Card>
                          </Box>
                        </Box>
                      </SortableContext>
                    </DndContext>
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
              <CardContent sx={{ pb: 1 }}>
                {/* Row 1: Day name with close */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {editingDayTitleId === localWorkoutPlan.days[selectedDayIndex].id ? (
                      <TextField
                      size="small"
                        value={editingDayTitleValue}
                        autoFocus
                        onChange={(e) => setEditingDayTitleValue(e.target.value)}
                        onBlur={() => {
                          if (localWorkoutPlan) {
                            setLocalWorkoutPlan((prev) => prev ? {
                              ...prev,
                              days: prev.days.map((day, idx) => 
                                idx === selectedDayIndex 
                                  ? { ...day, title: editingDayTitleValue || day.title }
                                  : day
                              )
                            } : null);
                            setIsPlanDirty(true);
                          }
                          setEditingDayTitleId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingDayTitleId(null);
                        }}
                      />
                    ) : (
                      <Typography 
                        variant="h6" 
                        onClick={() => {
                          if (localWorkoutPlan && localWorkoutPlan.days[selectedDayIndex]) {
                            const t = localWorkoutPlan.days[selectedDayIndex].title || '';
                            setEditingDayTitleId(localWorkoutPlan.days[selectedDayIndex].id);
                            setEditingDayTitleValue(t);
                          }
                        }} 
                        sx={{ cursor: 'text' }}
                      >
                        {localWorkoutPlan.days[selectedDayIndex].title}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add size={16} />}
                      onClick={() => setIsAddExerciseDialogOpen(true)}
                    >
                      Add Exercise
                    </Button>
                    <IconButton size="medium" onClick={() => setSelectedDayIndex(0)} title="Close" sx={{ fontSize: 18, lineHeight: 1 }}>✕</IconButton>
                  </Box>
                </Box>
              </CardContent>
              <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {localWorkoutPlan.days[selectedDayIndex].exercises.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExerciseDragEnd}>
                    <SortableContext 
                      items={localWorkoutPlan.days[selectedDayIndex].exercises.map(ex => ex.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <Stack spacing={2}>
                        {localWorkoutPlan.days[selectedDayIndex].exercises.map((ex, index) => (
                          <SortableExercise
                            key={ex.id}
                            exercise={ex}
                            index={index}
                            onEdit={openEditExerciseDialog}
                            onDelete={removeExerciseFromDay}
                            formatRepRange={formatRepRange}
                            onPreviewGif={(src) => setImagePreviewSrc(src)}
                          />
                        ))}
                      </Stack>
                    </SortableContext>
                  </DndContext>
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
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      ))}

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
        setExerciseCategoryFilter([]);
        setExerciseEquipmentFilter([]);
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
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  multiple
                  label="Category"
                  value={exerciseCategoryFilter}
                  onChange={(e) => setExerciseCategoryFilter(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {Array.from(new Set(workspaceExercises.map((e) => e.category).filter(Boolean) as string[]))
                    .sort()
                    .map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Equipment</InputLabel>
                <Select
                  multiple
                  label="Equipment"
                  value={exerciseEquipmentFilter}
                  onChange={(e) => setExerciseEquipmentFilter(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {Array.from(new Set(workspaceExercises.map((e) => e.equipmentNeeded).filter(Boolean) as string[]))
                    .sort()
                    .map((eq) => (
                      <MenuItem key={eq} value={eq}>{eq}</MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {workspaceExercises.filter((exercise) => {
                const matchesSearch =
                  exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                  exercise.muscleGroup.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                  (exercise.description && exercise.description.toLowerCase().includes(exerciseSearchTerm.toLowerCase()));
                const matchesCategory = exerciseCategoryFilter.length === 0 || exerciseCategoryFilter.includes((exercise.category || ''));
                const matchesEquipment = exerciseEquipmentFilter.length === 0 || exerciseEquipmentFilter.includes((exercise.equipmentNeeded || ''));
                return matchesSearch && matchesCategory && matchesEquipment;
              }).length} exercise(s) found
            </Typography>
          </Box>
          <List>
            {workspaceExercises
              .filter((exercise) => {
                const matchesSearch =
                  exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                  exercise.muscleGroup.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                  (exercise.description && exercise.description.toLowerCase().includes(exerciseSearchTerm.toLowerCase()));
                const matchesCategory = exerciseCategoryFilter.length === 0 || exerciseCategoryFilter.includes((exercise.category || ''));
                const matchesEquipment = exerciseEquipmentFilter.length === 0 || exerciseEquipmentFilter.includes((exercise.equipmentNeeded || ''));
                return matchesSearch && matchesCategory && matchesEquipment;
              })
              .map((exercise) => {
              const isSelected = selectedExercises.includes(exercise.id);
              
            return (
              <ListItem key={exercise.id} sx={{ border: '1px solid', borderColor: 'divider', mb: 1, borderRadius: 1 }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ pr: 10 }}>
                    <Avatar
                      variant="rounded"
                      src={exercise.gifImage}
                      sx={{ width: 48, height: 48, boxShadow: 1, cursor: exercise.gifImage ? 'pointer' : 'default' }}
                      onClick={(e) => { e.stopPropagation(); if (exercise.gifImage) setImagePreviewSrc(exercise.gifImage); }}
                    />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>{exercise.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {exercise.muscleGroup} - {exercise.description || 'No description'}
                      </Typography>
                    </Box>
                  </Stack>
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

      {/* Image Preview Dialog */}
      <Dialog
        open={Boolean(imagePreviewSrc)}
        onClose={() => setImagePreviewSrc(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Exercise Preview</DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {imagePreviewSrc && (
            <Box sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Box
                component="img"
                src={imagePreviewSrc}
                alt="Exercise GIF"
                sx={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: 2,
                  boxShadow: 3
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImagePreviewSrc(null)}>Close</Button>
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
      
      {/* Form Completion Dialog */}
      <Dialog
        open={formCompletionDialogOpen}
        onClose={() => {
          if (!archivingForms) {
            setFormCompletionDialogOpen(false);
            setActivatingPlanId(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5">Submitted Workout Forms Found</Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This client has submitted {submittedForms.length} workout form{submittedForms.length !== 1 ? 's' : ''}. 
            Would you like to mark any of them as done before activating the plan?
          </Alert>
          
          {submittedForms.length > 0 && (
            <Stack spacing={1}>
              {submittedForms.map((form) => (
                <FormControlLabel
                  key={form.id}
                  control={
                    <Checkbox
                      checked={selectedFormsToArchive.includes(form.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFormsToArchive([...selectedFormsToArchive, form.id]);
                        } else {
                          setSelectedFormsToArchive(selectedFormsToArchive.filter(id => id !== form.id));
                        }
                      }}
                      disabled={archivingForms}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">{form.formTitle}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Submitted: {new Date(form.submittedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setFormCompletionDialogOpen(false);
              setActivatingPlanId(null);
            }}
            disabled={archivingForms}
          >
            Cancel
          </Button>
          <Button
            onClick={handleWorkoutFormCompletionContinue}
            variant="contained"
            disabled={archivingForms}
          >
            {archivingForms ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Processing...
              </>
            ) : (
              `Continue${selectedFormsToArchive.length > 0 ? ` & Mark ${selectedFormsToArchive.length} as Done` : ''}`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Workout Log Details Dialog */}
      <Dialog
        open={workoutLogDetailsOpen}
        onClose={() => setWorkoutLogDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Workout Details
        </DialogTitle>
        <DialogContent>
          {selectedWorkoutLog && (
            <Stack spacing={3}>
              {/* Basic Info */}
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Workout Information
                </Typography>
                <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Workout Plan
                    </Typography>
                    <Typography variant="body1">
                      {selectedWorkoutLog.workoutPlan?.title || 'Workout'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Day
                    </Typography>
                    <Typography variant="body1">
                      Day {Number(selectedWorkoutLog.dayIndex) + 1}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Date
                    </Typography>
                    <Typography variant="body1">
                      {new Date(selectedWorkoutLog.date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={selectedWorkoutLog.completed ? 'Completed' : 'In Progress'}
                      color={selectedWorkoutLog.completed ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>
                </Stack>
                
                {selectedWorkoutLog.startTime && selectedWorkoutLog.endTime && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography variant="body1">
                      {selectedWorkoutLog.startTime} - {selectedWorkoutLog.endTime}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Exercises */}
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Exercises ({selectedWorkoutLog.exercises?.length || 0})
                </Typography>
                <Stack spacing={2}>
                  {selectedWorkoutLog.exercises?.map((exercise: any, index: number) => (
                    <Card key={index} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={500}>
                          {exercise.exerciseName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Target: {exercise.targetSets} sets x {exercise.targetReps} reps
                          {exercise.targetWeight && ` @ ${exercise.targetWeight}kg`}
                        </Typography>
                        
                        {/* Sets */}
                        <Stack spacing={1}>
                          {exercise.sets?.map((set: any, setIndex: number) => (
                            <Box key={setIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ minWidth: '60px' }}>
                                Set {setIndex + 1}:
                              </Typography>
                              {set.reps && (
                                <Chip label={`${set.reps} reps`} size="small" variant="outlined" />
                              )}
                              {set.weight && (
                                <Chip label={`${set.weight}kg`} size="small" variant="outlined" />
                              )}
                              {set.restTime && (
                                <Chip label={`${set.restTime}s rest`} size="small" variant="outlined" />
                              )}
                              {set.completed && (
                                <Chip label="Completed" size="small" color="success" />
                              )}
                              {set.completedAt && (
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(set.completedAt).toLocaleTimeString()}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Stack>
                        
                        {exercise.notes && (
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                            Notes: {exercise.notes}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>

              {/* General Notes */}
              {selectedWorkoutLog.notes && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    General Notes
                  </Typography>
                  <Typography variant="body2">
                    {selectedWorkoutLog.notes}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkoutLogDetailsOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Form Scheduling Popup */}
      <FormSchedulingPopup
        open={formSchedulingPopupOpen}
        onClose={() => setFormSchedulingPopupOpen(false)}
        onSchedule={handleFormSchedule}
        clientId={clientId}
        formType="workout"
        clientName={clientName}
      />
    </Stack>
    </Box>
  );
}
