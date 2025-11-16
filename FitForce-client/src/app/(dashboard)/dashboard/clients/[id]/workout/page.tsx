'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination
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
import WorkoutMakerMobile from '@/components/workout/WorkoutMakerMobile';
import LoadPlanDialog from '@/components/LoadPlanDialog';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { FormSchedulingPopup } from '@/components/forms/FormSchedulingPopup';
import SortableExercise from '@/components/workout/SortableExercise';
import { exportWorkoutPlanToPDF } from '@/utils/pdfExport';
import { useWorkspaceBranding } from '@/hooks/useWorkspaceBranding';

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

// SortableExercise moved to components/workout/SortableExercise

// Cardio Duration Selector Component
function CardioDurationSelector({ 
  totalSeconds, 
  onChange 
}: { 
  totalSeconds: number; 
  onChange: (totalSeconds: number) => void;
}) {
  const theme = useTheme();
  
  // Convert total seconds to hours, minutes, seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const handleHoursChange = (value: number) => {
    const newTotalSeconds = value * 3600 + minutes * 60 + seconds;
    onChange(Math.max(0, newTotalSeconds));
  };

  const handleMinutesChange = (value: number) => {
    const newTotalSeconds = hours * 3600 + value * 60 + seconds;
    onChange(Math.max(0, newTotalSeconds));
  };

  const handleSecondsChange = (value: number) => {
    const newTotalSeconds = hours * 3600 + minutes * 60 + value;
    onChange(Math.max(0, newTotalSeconds));
  };

  return (
    <Box sx={{ 
      p: 3,
      borderRadius: 2,
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.08)' : 'primary.lighter',
      border: '2px solid',
      borderColor: 'primary.main',
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 3 },
        justifyContent: 'center'
      }}>
        {/* Hours */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1 }}>
          <Typography variant="caption" sx={{ 
            fontSize: '0.75rem', 
            color: 'text.secondary', 
            textTransform: 'uppercase', 
            letterSpacing: 1,
            fontWeight: 600
          }}>
            Hours
          </Typography>
          <FormControl sx={{ minWidth: { xs: '100%', sm: 120 } }}>
            <Select
              value={hours}
              onChange={(e) => handleHoursChange(Number(e.target.value))}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiSelect-select': {
                  py: 1.5,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  textAlign: 'center'
                }
              }}
            >
              {Array.from({ length: 5 }, (_, i) => i).map((h) => (
                <MenuItem key={h} value={h}>
                  {h} {h === 1 ? 'hour' : 'hours'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Separator */}
        <Typography variant="h4" sx={{ 
          color: 'primary.main',
          fontWeight: 700,
          display: { xs: 'none', sm: 'block' },
          alignSelf: 'center',
          mt: 3
        }}>
          :
        </Typography>

        {/* Minutes */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1 }}>
          <Typography variant="caption" sx={{ 
            fontSize: '0.75rem', 
            color: 'text.secondary', 
            textTransform: 'uppercase', 
            letterSpacing: 1,
            fontWeight: 600
          }}>
            Minutes
          </Typography>
          <FormControl sx={{ minWidth: { xs: '100%', sm: 120 } }}>
            <Select
              value={minutes}
              onChange={(e) => handleMinutesChange(Number(e.target.value))}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiSelect-select': {
                  py: 1.5,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  textAlign: 'center'
                }
              }}
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <MenuItem key={m} value={m}>
                  {m} {m === 1 ? 'minute' : 'minutes'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Separator */}
        <Typography variant="h4" sx={{ 
          color: 'primary.main',
          fontWeight: 700,
          display: { xs: 'none', sm: 'block' },
          alignSelf: 'center',
          mt: 3
        }}>
          :
        </Typography>

        {/* Seconds */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1 }}>
          <Typography variant="caption" sx={{ 
            fontSize: '0.75rem', 
            color: 'text.secondary', 
            textTransform: 'uppercase', 
            letterSpacing: 1,
            fontWeight: 600
          }}>
            Seconds
          </Typography>
          <FormControl sx={{ minWidth: { xs: '100%', sm: 120 } }}>
            <Select
              value={seconds}
              onChange={(e) => handleSecondsChange(Number(e.target.value))}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiSelect-select': {
                  py: 1.5,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  textAlign: 'center'
                }
              }}
            >
              {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                <MenuItem key={s} value={s}>
                  {s} {s === 1 ? 'second' : 'seconds'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Total Duration Display */}
      <Box sx={{ 
        mt: 3,
        pt: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        textAlign: 'center'
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Total Duration
        </Typography>
        <Typography variant="h5" sx={{ 
          fontWeight: 700,
          color: 'primary.main',
          fontFamily: 'monospace'
        }}>
          {hours > 0 && `${hours}:`}
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          ({totalSeconds} {totalSeconds === 1 ? 'second' : 'seconds'} total)
        </Typography>
      </Box>
    </Box>
  );
}

// SortableDay Component
function SortableDay({ 
  day, 
  index, 
  children,
  isSelected,
  onSelect,
  onCopy,
  onDelete
}: { 
  day: any; 
  index: number;
  children?: React.ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: day.id 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  // Drag handle component
  const DragHandle = (
    <Box 
      sx={{ 
        mr: 1, 
        color: 'text.disabled', 
        cursor: 'grab',
        fontSize: 18, 
        lineHeight: 1,
        '&:active': { cursor: 'grabbing' }
      }} 
      title="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      ≡
    </Box>
  );

  return (
    <Box ref={setNodeRef} style={style}>
      {children ? (
        // When children provided, clone and inject drag handle
        React.cloneElement(children as React.ReactElement, {
          children: (
            <>
              {React.Children.map((children as React.ReactElement).props.children, (child: any) => {
                if (child?.type === CardContent && child?.props?.children) {
                  return React.cloneElement(child, {
                    children: (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        {DragHandle}
                        {child.props.children}
                      </Box>
                    )
                  });
                }
                return child;
              })}
            </>
          )
        })
      ) : (
        <Card
          sx={{ 
            cursor: 'pointer',
            border: '2px solid',
            borderColor: isSelected ? 'primary.main' : 'divider',
            bgcolor: isSelected 
              ? theme.palette.mode === 'dark' 
                ? 'rgba(25, 118, 210, 0.08)'  // Subtle blue tint in dark mode
                : 'primary.lighter' 
              : 'background.paper',
            position: 'relative',
            boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
            borderRadius: 2,
            transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            '&:hover .day-actions': { opacity: 1 },
            '&:hover': {
              borderColor: isSelected ? 'primary.dark' : 'primary.main',
              boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.06)',
              transform: isDragging ? undefined : 'translateY(-2px)',
              bgcolor: isSelected 
                ? theme.palette.mode === 'dark'
                  ? 'rgba(25, 118, 210, 0.12)'  // Slightly more visible on hover in dark mode
                  : 'primary.lighter'
                : 'action.hover'
            },
          }}
          onClick={onSelect}
        >
          <CardHeader title={day.title} />
          <CardContent sx={{ py: 1.75, px: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              {DragHandle}
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
              </Typography>
            </Box>
          </CardContent>
          <Box className="day-actions" sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.3s ease', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
            <IconButton 
              size="small" 
              title="Copy day"
              onClick={(e) => {
                e.stopPropagation();
                onCopy?.();
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
                onDelete?.();
              }}
              sx={{ '&:hover': { bgcolor: 'error.lighter' } }}
            >
              <Trash size={16} />
            </IconButton>
          </Box>
        </Card>
      )}
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
  const [exercisePage, setExercisePage] = useState(1);
  const exercisesPerPage = 10;
  
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
  const [plansTab, setPlansTab] = useState(0); // 0: Plans, 1: Forms, 2: Tools, 3: Chat, 4: Logs
  const [copyingPlanId, setCopyingPlanId] = useState<string | null>(null);
  // CaDay catalog and UI
  const [caDays, setCaDays] = useState<Array<{ id: string; name: string; imageUrl?: string; url?: string; urls?: string[] }>>([]);
  const [caDayDialogOpen, setCaDayDialogOpen] = useState(false);
  
  // Client display name
  const [clientName, setClientName] = useState<string>('');
  // Workspace branding
  const { workspaceName } = useWorkspaceBranding();
  // PDF export state
  const [exportingPdf, setExportingPdf] = useState(false);

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
  const [cardioTab, setCardioTab] = useState(0); // 0: Days only
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

  // Load workout logs for this client
  const { data: logsData, isLoading: logsLoading, mutate: refreshLogs } = useSWR(
    plansTab === 4 ? `client-workout-logs-${clientId}` : null,
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
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: 'primary.main' }}>
                {questionText}
              </Typography>
              <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
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

  // Hydrate loaded plan exercises with full workspace exercise objects (ensures gifImage available)
  useEffect(() => {
    if (!localWorkoutPlan || workspaceExercises.length === 0) return;
    setLocalWorkoutPlan((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        days: prev.days.map((day) => ({
          ...day,
          exercises: day.exercises.map((ex: any) => {
            const full = workspaceExercises.find((w) => w.id === (ex.exercise?.id || ex.exerciseId));
            if (!full) return ex;
            // Only replace if different to avoid unnecessary renders
            if (ex.exercise && ex.exercise.id === full.id && ex.exercise.gifImage === full.gifImage) return ex;
            return { ...ex, exercise: full };
          })
        }))
      } as any;
      return updated;
    });
  }, [workspaceExercises]);

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
  const createLocalPlan = async () => {
    if (!newPlanTitle.trim() || !clientId) return;
    try {
      setSaving(true);
      // Persist immediately so the plan is not only in memory
      // Prefer workout module create endpoint
      const res = await api.post('/api/workout/plans', { title: newPlanTitle.trim(), clientId });
      const created = res.data?.plan || res.data;
      if (created?.id) {
        // Initialize local builder with the newly created server plan id
        const newPlan = {
          id: created.id,
          title: created.title || newPlanTitle.trim(),
          days: [] as any[]
        };
        setLocalWorkoutPlan(newPlan);
        setSelectedPlanId(created.id);
        setIsPlanDirty(true);
        setSelectedDayIndex(0);
        setNewPlanTitle('');
        setIsCreatePlanDialogOpen(false);
        // Refresh saved plans list so it appears immediately
        try { await loadSavedPlans(); } catch {}
      }
    } catch (e) {
      // Fallback toast can be added if snackbar util is available in this file
      console.error('Failed to create workout plan', e);
    } finally {
      setSaving(false);
    }
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
      const isCardio = exercise?.category?.toLowerCase() === 'cardio';
      
      if (isCardio) {
        return {
          id: `exercise_${Date.now()}_${Math.random()}`,
          exercise: exercise!,
          sets: 1,
          reps: "",
          restSeconds: 0,
          tempo: "",
          rir: 0,
          notes: "",
          videoUrl: "",
          thumbnailUrl: "",
          durationSeconds: 600, // Default 10 minutes (600 seconds) for cardio
          durationMinutes: 10, // Keep for backward compatibility
          individualSets: []
        };
      } else {
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
      }
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
          items: day.exercises.map((exercise) => {
            const isCardio = exercise.exercise?.category?.toLowerCase() === 'cardio';
            const baseItem: any = {
              exerciseId: exercise.exercise.id,
              sets: exercise.sets,
              reps: exercise.reps, // Keep as string (e.g., "8-12")
              restSeconds: exercise.restSeconds,
              tempo: exercise.tempo,
              rir: exercise.rir,
              notes: exercise.notes || "",
            };
            
            // Add duration for cardio exercises
            if (isCardio) {
              if ((exercise as any).durationSeconds) {
                baseItem.durationSeconds = (exercise as any).durationSeconds;
              } else if ((exercise as any).durationMinutes) {
                // Convert minutes to seconds for backward compatibility
                baseItem.durationSeconds = (exercise as any).durationMinutes * 60;
              }
              // For cardio exercises, we'll store durationSeconds in notes as JSON on the backend
              // The backend will handle this conversion
            }
            
            // Persist per-set data if available (only for non-cardio)
            if (!isCardio && (exercise as any).individualSets && Array.isArray((exercise as any).individualSets)) {
              baseItem.planSets = (exercise as any).individualSets.map((s: any, index: number) => {
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
                });
            }
            
            return baseItem;
          })
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
              exercises: day.items?.map((item: any) => {
                const isCardio = item.exercise?.category?.toLowerCase() === 'cardio';
                
                // Parse notes to extract durationSeconds if stored as JSON
                let notes = item.notes || "";
                let durationSeconds: number | undefined = undefined;
                if (isCardio && item.notes) {
                  try {
                    const notesData = JSON.parse(item.notes);
                    if (notesData.durationSeconds) {
                      durationSeconds = notesData.durationSeconds;
                      notes = notesData.originalNotes || "";
                    }
                  } catch (e) {
                    // Not JSON, use notes as-is
                  }
                }
                
                // Fallback to durationMinutes if available
                if (!durationSeconds && isCardio) {
                  if (item.durationSeconds) {
                    durationSeconds = item.durationSeconds;
                  } else if (item.durationMinutes) {
                    durationSeconds = item.durationMinutes * 60;
                  }
                }
                
                return {
                  id: item.id,
                  exercise: item.exercise,
                  sets: item.sets,
                  reps: String(item.reps),
                  restSeconds: item.restSeconds || 60,
                  tempo: item.tempo || "",
                  rir: item.rir || 0,
                  notes: notes,
                  durationSeconds: durationSeconds,
                  durationMinutes: durationSeconds ? Math.round(durationSeconds / 60) : undefined,
                  individualSets: isCardio ? [] : Array.from({ length: item.sets || 1 }, (_, index) => ({
                    id: `set_${index + 1}`,
                    reps: String(item.reps),
                    restSeconds: item.restSeconds || 60,
                    tempo: item.tempo || "",
                    rir: item.rir || 0
                  }))
                };
              }) || []
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
    // Check if exercise is cardio (case-insensitive) or has durationMinutes set
    // Also check muscle group for cardiovascular exercises
    const category = exercise.exercise?.category?.toLowerCase() || '';
    const muscleGroup = exercise.exercise?.muscleGroup?.toLowerCase() || '';
    const isCardio = category === 'cardio' || 
                    muscleGroup.includes('cardiovascular') || 
                    !!(exercise as any).durationMinutes;
    
    if (isCardio) {
      // For cardio, just set the exercise with duration
      // If it has individualSets from before, convert to durationSeconds if not already set
      let durationSeconds = (exercise as any).durationSeconds;
      if (!durationSeconds && (exercise as any).durationMinutes) {
        // Convert minutes to seconds
        durationSeconds = (exercise as any).durationMinutes * 60;
      }
      if (!durationSeconds && (exercise as any).individualSets && (exercise as any).individualSets.length > 0) {
        // Default to 10 minutes (600 seconds) if converting from sets
        durationSeconds = 600;
      }
      if (!durationSeconds) {
        // Default to 10 minutes (600 seconds)
        durationSeconds = 600;
      }
      setEditingExercise({
        ...exercise,
        durationSeconds: durationSeconds,
        durationMinutes: Math.round(durationSeconds / 60), // Keep for backward compatibility
        individualSets: [],
        sets: 1,
        reps: "",
        restSeconds: 0,
        tempo: "",
        rir: 0
      });
    } else {
      // Initialize individualSets if they don't exist
      const exerciseWithSets = {
        ...exercise,
        notes: exercise.notes || "",
        individualSets: exercise.individualSets || Array.from({ length: exercise.sets || 1 }, (_, index) => ({
          id: `set_${index + 1}`,
          reps: exercise.reps || "8-12",
          restSeconds: exercise.restSeconds || 60,
          tempo: exercise.tempo || "",
          rir: exercise.rir || 0
        }))
      };
      setEditingExercise(exerciseWithSets);
    }
    
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
    
    // Check if exercise is cardio (case-insensitive) or has durationMinutes set
    // Also check muscle group for cardiovascular exercises
    const category = editingExercise.exercise?.category?.toLowerCase() || '';
    const muscleGroup = editingExercise.exercise?.muscleGroup?.toLowerCase() || '';
    const isCardio = category === 'cardio' || 
                    muscleGroup.includes('cardiovascular') || 
                    !!(editingExercise as any).durationMinutes;
    
    // Update the summary values based on individual sets (for non-cardio) or duration (for cardio)
    const updatedExercise = isCardio ? {
      ...editingExercise,
      sets: 1,
      reps: "",
      restSeconds: 0,
      tempo: "",
      rir: 0,
      durationSeconds: (editingExercise as any).durationSeconds || ((editingExercise as any).durationMinutes || 30) * 60,
      durationMinutes: Math.round(((editingExercise as any).durationSeconds || ((editingExercise as any).durationMinutes || 30) * 60) / 60), // Keep for backward compatibility
      individualSets: []
    } : {
      ...editingExercise,
      sets: editingExercise.individualSets?.length || 0,
      reps: editingExercise.individualSets?.[0]?.reps || "8-12",
      restSeconds: editingExercise.individualSets?.[0]?.restSeconds || 60,
      tempo: editingExercise.individualSets?.[0]?.tempo || "",
      rir: editingExercise.individualSets?.[0]?.rir || 0,
      notes: editingExercise.notes || ""
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

  // Parse tempo string "x-x-x-x" to array of 4 numbers
  const parseTempo = (tempo: string): [number, number, number, number] => {
    if (!tempo) return [0, 0, 0, 0];
    const parts = tempo.split('-').map(p => parseInt(p.trim()) || 0);
    return [
      parts[0] || 0,
      parts[1] || 0,
      parts[2] || 0,
      parts[3] || 0
    ];
  };

  // Format tempo array to "x-x-x-x" string
  const formatTempo = (values: [number, number, number, number]): string => {
    return values.map(v => v || 0).join('-');
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

  // Update tempo value for a specific set and position
  const updateTempoValue = (setId: string, position: 0 | 1 | 2 | 3, value: string) => {
    setEditingExercise((prev: any) => {
      const updatedSets = (prev.individualSets || []).map((set: any) => {
        if (set.id === setId) {
          const currentTempo = set.tempo || "";
          const tempoValues = parseTempo(currentTempo);
          // Ensure value is >= 0, default to 0 if empty or invalid
          const numValue = value === "" ? 0 : Math.max(0, Math.floor(parseFloat(value) || 0));
          tempoValues[position] = numValue;
          return { ...set, tempo: formatTempo(tempoValues) };
        }
        return set;
      });
      return { ...prev, individualSets: updatedSets };
    });
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

  const handleExportPDF = async () => {
    if (!localWorkoutPlan || !localWorkoutPlan.days || localWorkoutPlan.days.length === 0) {
      openSnackbar({
        open: true,
        message: 'Please select a plan with days first',
        variant: 'alert',
        alert: { color: 'warning' }
      } as any);
      return;
    }

    try {
      setExportingPdf(true);
      await exportWorkoutPlanToPDF({
        workspaceName: workspaceName || 'Workspace',
        clientName: clientName || 'Client',
        planName: localWorkoutPlan.title,
        days: localWorkoutPlan.days.map(day => ({
          id: day.id,
          title: day.title,
          exercises: day.exercises.map(ex => ({
            id: ex.id,
            exercise: ex.exercise,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.restSeconds,
            tempo: ex.tempo,
            rir: ex.rir,
            notes: ex.notes,
            individualSets: (ex as any).individualSets
          }))
        }))
      }, (message) => {
        // Progress callback - could show in snackbar or console
        console.log('PDF Export:', message);
      });
      openSnackbar({
        open: true,
        message: 'PDF exported successfully',
        variant: 'alert',
        alert: { color: 'success' }
      } as any);
    } catch (error: any) {
      console.error('Failed to export PDF:', error);
      openSnackbar({
        open: true,
        message: error?.message || 'Failed to export PDF',
        variant: 'alert',
        alert: { color: 'error' }
      } as any);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', maxWidth: '100vw', px: { xs: 0, md: 0 } }}>
    <Stack spacing={1} sx={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 1, md: 0 } }}>
        <Typography variant="h5">{clientName || 'Client'}</Typography>
        <Stack direction="row" spacing={1} sx={{ gap: { xs: 0.5, md: 1 } }}>
          {localWorkoutPlan && localWorkoutPlan.days && localWorkoutPlan.days.length > 0 && (
            <Button 
              variant="outlined" 
              onClick={handleExportPDF} 
              disabled={exportingPdf} 
              size={isMobile ? 'small' : 'medium'}
              startIcon={<DocumentText size={16} />}
            >
              {exportingPdf ? 'Exporting...' : 'Export PDF'}
            </Button>
          )}
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
        <WorkoutMakerMobile
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
                    <Tab key="logs-icon" label="" icon={<DocumentText size={20} />} iconPosition="top" />,
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
                              const exFull = (workspaceExercises || []).find((e) => e.id === (item.exercise?.id || item.exerciseId)) || item.exercise;
                              return {
                                id: item.id,
                                exercise: exFull,
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
                            border: '2px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            bgcolor: isSelected 
                              ? theme.palette.mode === 'dark' 
                                ? 'rgba(25, 118, 210, 0.08)'  // Subtle blue tint in dark mode
                                : 'primary.lighter' 
                              : 'background.paper',
                            position: 'relative',
                            boxShadow: 'none',
                            borderRadius: 2,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            overflow: 'hidden',
                            '&:hover': {
                              borderColor: isSelected ? 'primary.dark' : 'primary.main',
                              transform: 'translateY(-2px)',
                              boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.06)',
                              bgcolor: isSelected 
                                ? theme.palette.mode === 'dark'
                                  ? 'rgba(25, 118, 210, 0.12)'  // Slightly more visible on hover in dark mode
                                  : 'primary.lighter'
                                : 'action.hover'
                            },
                            '&:hover .plan-actions': { opacity: 1 }
                          }}
                        >
                          <CardContent sx={{ py: 2.5, px: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 90 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 60 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, color: isSelected ? 'primary.main' : 'text.primary', fontSize: '0.95rem', transition: 'color 0.2s' }}>
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
                          <Box className="plan-actions" sx={{ position: 'absolute', top: 8, right: 8, opacity: isMobile ? 1 : 0, transition: 'opacity 0.3s ease', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
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
                      chatMessages.map((m: any) => {
                        const isClient = m.senderType === 'client';
                        return (
                        <Box key={m.id} sx={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', mb: 1 }}>
                          <Box sx={{ 
                            px: 2, 
                            py: 1.5, 
                            bgcolor: isClient ? 'primary.main' : 'background.paper',
                            color: isClient ? 'white' : 'text.primary',
                            borderRadius: 2,
                            borderBottomRightRadius: isClient ? 0 : 2,
                            borderBottomLeftRadius: isClient ? 2 : 0,
                            maxWidth: '75%',
                            boxShadow: 1
                          }}>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body || m.message || m.text || ''}</Typography>
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
                            <Typography variant="caption" sx={{ 
                              display: 'block', 
                              mt: 0.5,
                              opacity: isClient ? 0.8 : 0.6,
                              fontSize: '0.7rem'
                            }}>
                              {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                            </Typography>
                          </Box>
                        </Box>
                        );
                      })
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
            ) : plansTab === 4 ? (
              // Logs tab content
              <Box sx={{ py: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>Workout Logs</Typography>
                {logsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    {Array.isArray(logsData?.workoutLogs) && logsData!.workoutLogs.length > 0 ? (
                      <Stack spacing={1.5}>
                        {logsData!.workoutLogs.map((log: any) => (
                          <Card 
                            key={log.id} 
                            variant="outlined" 
                            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} 
                            onClick={() => handleViewWorkoutLogDetails(log)}
                          >
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Box>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {log.workoutPlan?.title || 'Workout'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Day {Number(log.dayIndex) + 1}
                                  </Typography>
                                </Box>
                                <Chip 
                                  label={log.completed ? 'Completed' : 'In Progress'} 
                                  color={log.completed ? 'success' : 'warning'} 
                                  size="small" 
                                />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ color: 'text.secondary' }}>
                                <Typography variant="body2">
                                  {new Date(log.date).toLocaleDateString()}
                                </Typography>
                                {log.startTime && log.endTime && (
                                  <Typography variant="body2">
                                    {log.startTime} - {log.endTime}
                                  </Typography>
                                )}
                                <Typography variant="body2">
                                  {Array.isArray(log.exercises) ? `${log.exercises.length} exercises` : '-'}
                                </Typography>
                              </Stack>
                              {log.notes && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  {log.notes}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          No workout logs found for this client
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
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
              {localWorkoutPlan && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {localWorkoutPlan && editingPlanTitleId === localWorkoutPlan?.id ? (
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
              )}

              {/* Tabs */}
              <Box>
                <Tabs value={cardioTab} onChange={(_, v) => setCardioTab(v)} variant="fullWidth">
                  <Tab label="Days" />
                </Tabs>
              </Box>
            </CardContent>
            <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', p: 0, '&:last-child': { pb: 0 } }}>
              {localWorkoutPlan ? (
                cardioTab === 0 ? (
                  // Days tab content
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                    <SortableContext 
                      items={localWorkoutPlan.days.map(day => day.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, px: 2, pt: 2 }}>
                        {localWorkoutPlan.days.map((day, index) => (
                          <SortableDay
                            key={day.id}
                            day={day}
                            index={index}
                            isSelected={selectedDayIndex === index}
                            onSelect={() => {
                              setSelectedDayIndex(index);
                              // On mobile, automatically move to section 3 (exercises) when day is selected
                              if (isMobile) {
                                setMobileSection(2);
                              }
                            }}
                            onCopy={() => {
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
                            onDelete={() => {
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
                          />
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
                    </SortableContext>
                  </DndContext>
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
                  // Check if exercise is cardio (case-insensitive) or has durationMinutes set
                  // Also check muscle group for cardiovascular exercises
                  const category = exercise.exercise?.category?.toLowerCase() || '';
                  const muscleGroup = exercise.exercise?.muscleGroup?.toLowerCase() || '';
                  const isCardio = category === 'cardio' || 
                                  muscleGroup.includes('cardiovascular') || 
                                  !!(exercise as any).durationMinutes;
                  
                  return (
                    <Card 
                      key={exercise.id} 
                      sx={{ 
                        mb: 2, 
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        borderRadius: 2,
                        boxShadow: 1,
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          boxShadow: 4,
                          transform: 'translateY(-2px)',
                          borderColor: 'primary.light'
                        }
                      }}
                      onClick={() => openEditExerciseDialog(exercise)}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, overflow: 'visible' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
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
                            {!isCardio && exercise.tempo && (
                              <Chip 
                                label={`Tempo: ${exercise.tempo}`} 
                                size="small" 
                                variant="outlined"
                                sx={{ mb: 0.5 }}
                              />
                            )}
                            {!isCardio && exercise.rir > 0 && (
                              <Chip 
                                label={`RIR: ${exercise.rir}`} 
                                size="small" 
                                variant="outlined"
                                sx={{ mb: 0.5 }}
                              />
                            )}
                            {exercise.notes && (
                              <Box
                                sx={{
                                  mt: 2,
                                  p: 2,
                                  borderRadius: 2,
                                  bgcolor: 'info.lighter',
                                  border: '2px solid',
                                  borderColor: 'info.main',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                }}
                              >
                                <Typography 
                                  variant="subtitle2" 
                                  sx={{ 
                                    fontWeight: 700,
                                    color: 'info.dark',
                                    mb: 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5
                                  }}
                                >
                                  💡 Exercise Notes
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: 'info.darker',
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {exercise.notes}
                                </Typography>
                              </Box>
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
                      
                      {/* Cardio: Show Duration/Time selector */}
                      {isCardio ? (
                        <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 }, width: '100%' }}>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: 1,
                            py: { xs: 1, sm: 1.5 },
                            px: { xs: 1, sm: 2 },
                            borderRadius: 2,
                            bgcolor: 'action.hover',
                            border: '2px solid',
                            borderColor: 'primary.main',
                            position: 'relative'
                          }}>
                            <Box sx={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center',
                              gap: 0.5
                            }}>
                              <Typography variant="caption" sx={{ 
                                fontSize: { xs: '0.65rem', sm: '0.7rem' }, 
                                color: 'text.secondary', 
                                textTransform: 'uppercase', 
                                letterSpacing: 1 
                              }}>
                                Duration
                              </Typography>
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'baseline', 
                                gap: 0.5,
                                position: 'relative'
                              }}>
                                {(() => {
                                  const totalSeconds = (exercise as any).durationSeconds || ((exercise as any).durationMinutes || 10) * 60;
                                  const hours = Math.floor(totalSeconds / 3600);
                                  const minutes = Math.floor((totalSeconds % 3600) / 60);
                                  const seconds = totalSeconds % 60;
                                  const hasHours = hours > 0;
                                  
                                  return (
                                    <>
                                      <Typography variant="h4" sx={{ 
                                        fontWeight: 700, 
                                        color: 'primary.main',
                                        lineHeight: 1,
                                        fontFamily: 'monospace',
                                        fontSize: { xs: '1.75rem', sm: '2rem' }
                                      }}>
                                        {hasHours && `${hours}:`}
                                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                                      </Typography>
                                      {!hasHours && (
                                        <Typography variant="h6" sx={{ 
                                          fontWeight: 500, 
                                          color: 'text.secondary',
                                          fontSize: { xs: '0.875rem', sm: '1rem' },
                                          ml: 0.5
                                        }}>
                                          min
                                        </Typography>
                                      )}
                                    </>
                                  );
                                })()}
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        // Regular Exercise: Minimized Sets Table
                        (exercise as any).individualSets && Array.isArray((exercise as any).individualSets) && (exercise as any).individualSets.length > 0 ? (
                        <Box sx={{ px: 2, pb: 2, width: '100%', overflow: 'hidden' }}>
                          <TableContainer 
                            component={Paper} 
                            elevation={0} 
                            sx={{ 
                              bgcolor: 'transparent', 
                              boxShadow: 'none',
                              width: '100%',
                              maxWidth: '100%',
                              overflow: 'hidden'
                            }}
                          >
                            <Table 
                              size="small" 
                              sx={{ 
                                width: '100%',
                                tableLayout: 'auto',
                                border: 'none',
                                '& .MuiTableCell-root': { 
                                  border: 'none',
                                  py: 0.35, 
                                  px: 0.5, 
                                  fontSize: '0.65rem',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                  bgcolor: 'transparent'
                                },
                                '& .MuiTableHead-root .MuiTableCell-root': {
                                  bgcolor: 'transparent',
                                  pb: 0.5
                                },
                                '& .MuiTableRow-root': {
                                  bgcolor: 'transparent'
                                }
                              }}
                            >
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4, width: '8%' }}>Set</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Reps</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Rest</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Tempo</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>RIR</TableCell>
                                  {(exercise as any).individualSets.some((set: any) => set.notes) && (
                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Notes</TableCell>
                                  )}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(exercise as any).individualSets.map((set: any, setIndex: number) => (
                                  <TableRow key={set.id || setIndex}>
                                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35, fontWeight: 500 }}>{setIndex + 1}</TableCell>
                                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{set.reps || '-'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{set.restSeconds ? `${set.restSeconds}s` : '-'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{set.tempo || '-'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{set.rir !== undefined && set.rir !== null ? set.rir : '-'}</TableCell>
                                    {(exercise as any).individualSets.some((s: any) => s.notes) && (
                                      <TableCell sx={{ fontSize: '0.65rem', color: 'text.secondary', py: 0.35 }}>
                                        {set.notes || '-'}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      ) : (
                        <Box sx={{ px: 2, pb: 2, width: '100%', overflow: 'hidden' }}>
                          <TableContainer 
                            component={Paper} 
                            elevation={0} 
                            sx={{ 
                              bgcolor: 'transparent', 
                              boxShadow: 'none',
                              width: '100%',
                              maxWidth: '100%',
                              overflow: 'hidden'
                            }}
                          >
                            <Table 
                              size="small" 
                              sx={{ 
                                width: '100%',
                                tableLayout: 'auto',
                                border: 'none',
                                '& .MuiTableCell-root': { 
                                  border: 'none',
                                  py: 0.35, 
                                  px: 0.5, 
                                  fontSize: '0.65rem',
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                  bgcolor: 'transparent'
                                },
                                '& .MuiTableHead-root .MuiTableCell-root': {
                                  bgcolor: 'transparent',
                                  pb: 0.5
                                },
                                '& .MuiTableRow-root': {
                                  bgcolor: 'transparent'
                                }
                              }}
                            >
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Sets</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Reps</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Rest</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                <TableRow>
                                  <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{exercise.sets || '-'}</TableCell>
                                  <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{repRange || '-'}</TableCell>
                                  <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{exercise.restSeconds ? `${exercise.restSeconds}s` : '-'}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                            </TableContainer>
                          </Box>
                        )
                      )}
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
                        <Tab label="Logs" />
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
                        border: '2px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: isSelected 
                          ? theme.palette.mode === 'dark' 
                            ? 'rgba(25, 118, 210, 0.08)'  // Subtle blue tint in dark mode
                            : 'primary.lighter' 
                          : 'background.paper',
                        position: 'relative',
                        boxShadow: 'none',
                        borderRadius: 2,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden',
                        '&:hover': {
                          borderColor: isSelected ? 'primary.dark' : 'primary.main',
                          transform: 'translateY(-2px)',
                          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.06)',
                          bgcolor: isSelected 
                            ? theme.palette.mode === 'dark'
                              ? 'rgba(25, 118, 210, 0.12)'  // Slightly more visible on hover in dark mode
                              : 'primary.lighter'
                            : 'action.hover'
                        },
                        '&:hover .plan-actions': { opacity: 1 }
                      }}
                          >
                            <CardContent sx={{ py: 2.5, px: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 90 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 60 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, color: isSelected ? 'primary.main' : 'text.primary', fontSize: '0.95rem', transition: 'color 0.2s' }}>
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
                            <Box className="plan-actions" sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.3s ease', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
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
                        chatMessages.map((m: any) => {
                          const isClient = m.senderType === 'client';
                          return (
                          <Box key={m.id} sx={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', mb: 1 }}>
                            <Box sx={{ 
                              px: 2, 
                              py: 1.5, 
                              bgcolor: isClient ? 'primary.main' : 'background.paper',
                              color: isClient ? 'white' : 'text.primary',
                              borderRadius: 2,
                              borderBottomRightRadius: isClient ? 0 : 2,
                              borderBottomLeftRadius: isClient ? 2 : 0,
                              maxWidth: '75%',
                              boxShadow: 1
                            }}>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body || m.message || m.text || ''}</Typography>
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
                              <Typography variant="caption" sx={{ 
                                display: 'block', 
                                mt: 0.5,
                                opacity: isClient ? 0.8 : 0.6,
                                fontSize: '0.7rem'
                              }}>
                                {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                              </Typography>
                            </Box>
                          </Box>
                          );
                        })
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
              ) : plansTab === 4 ? (
                // Logs tab content
                <Box sx={{ py: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>Workout Logs</Typography>
                  {logsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      {Array.isArray(logsData?.workoutLogs) && logsData!.workoutLogs.length > 0 ? (
                        <Stack spacing={1.5}>
                          {logsData!.workoutLogs.map((log: any) => (
                            <Card 
                              key={log.id} 
                              variant="outlined" 
                              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} 
                              onClick={() => handleViewWorkoutLogDetails(log)}
                            >
                              <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                  <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                      {log.workoutPlan?.title || 'Workout'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Day {Number(log.dayIndex) + 1}
                                    </Typography>
                                  </Box>
                                  <Chip 
                                    label={log.completed ? 'Completed' : 'In Progress'} 
                                    color={log.completed ? 'success' : 'warning'} 
                                    size="small" 
                                  />
                                </Stack>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ color: 'text.secondary' }}>
                                  <Typography variant="body2">
                                    {new Date(log.date).toLocaleDateString()}
                                  </Typography>
                                  {log.startTime && log.endTime && (
                                    <Typography variant="body2">
                                      {log.startTime} - {log.endTime}
                                    </Typography>
                                  )}
                                  <Typography variant="body2">
                                    {Array.isArray(log.exercises) ? `${log.exercises.length} exercises` : '-'}
                                  </Typography>
                                </Stack>
                                {log.notes && (
                                  <Typography variant="body2" sx={{ mt: 1 }}>
                                    {log.notes}
                                  </Typography>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </Stack>
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 8 }}>
                          <Typography variant="body2" color="text.secondary">
                            No workout logs found for this client
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
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
                {localWorkoutPlan && (
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
                )}

                {/* Tabs */}
                <Box>
                  <Tabs value={cardioTab} onChange={(_, v) => setCardioTab(v)} variant="fullWidth">
                    <Tab label="Days" />
                  </Tabs>
                </Box>
              </CardContent>
              <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', p: 0, '&:last-child': { pb: 0 } }}>
                {cardioTab === 0 && localWorkoutPlan ? (
                  // Days tab content
                  localWorkoutPlan.days.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                      <SortableContext 
                        items={localWorkoutPlan.days.map(day => day.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2, px: 2, pt: 2 }}>
                          {localWorkoutPlan.days.map((day, index) => (
                            <SortableDay
                              key={day.id}
                              day={day}
                              index={index}
                              isSelected={selectedDayIndex === index}
                              onSelect={() => setSelectedDayIndex(index)}
                              onCopy={() => {
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
                              onDelete={() => {
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
                            />
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
                ) : null
              }
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
                            onPreviewGif={(src: string) => setImagePreviewSrc(src)}
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
        setExercisePage(1);
      }} maxWidth="md" fullWidth>
        <DialogTitle>Add Exercises to Workout Day</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              placeholder="Search exercises by name, muscle group, or category..."
              value={exerciseSearchTerm}
              onChange={(e) => {
                setExerciseSearchTerm(e.target.value);
                setExercisePage(1);
              }}
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
                    onChange={(e) => {
                      setExerciseCategoryFilter(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]));
                      setExercisePage(1);
                    }}
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
                    onChange={(e) => {
                      setExerciseEquipmentFilter(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]));
                      setExercisePage(1);
                    }}
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
            {(() => {
              const filteredExercises = workspaceExercises.filter((exercise) => {
                const matchesSearch =
                  exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                  exercise.muscleGroup.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
                  (exercise.description && exercise.description.toLowerCase().includes(exerciseSearchTerm.toLowerCase()));
                const matchesCategory = exerciseCategoryFilter.length === 0 || exerciseCategoryFilter.includes((exercise.category || ''));
                const matchesEquipment = exerciseEquipmentFilter.length === 0 || exerciseEquipmentFilter.includes((exercise.equipmentNeeded || ''));
                return matchesSearch && matchesCategory && matchesEquipment;
              });
              const totalPages = Math.ceil(filteredExercises.length / exercisesPerPage);
              const startIndex = (exercisePage - 1) * exercisesPerPage;
              const endIndex = startIndex + exercisesPerPage;
              const paginatedExercises = filteredExercises.slice(startIndex, endIndex);
              
              return (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {filteredExercises.length} exercise(s) found
                  </Typography>
                  <List>
                    {paginatedExercises.map((exercise) => {
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
                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
                      <Pagination
                        count={totalPages}
                        page={exercisePage}
                        onChange={(_, page) => setExercisePage(page)}
                        color="primary"
                        size="large"
                      />
                    </Box>
                  )}
                </>
              );
            })()}
          </Box>
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
              {/* Cardio: Duration selector */}
              {(() => {
                const category = editingExercise.exercise?.category?.toLowerCase() || '';
                const muscleGroup = editingExercise.exercise?.muscleGroup?.toLowerCase() || '';
                return category === 'cardio' || 
                       muscleGroup.includes('cardiovascular') || 
                       !!(editingExercise as any).durationMinutes;
              })() ? (
                <>
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Duration
                  </Typography>
                  <CardioDurationSelector
                    totalSeconds={(editingExercise as any).durationSeconds || ((editingExercise as any).durationMinutes || 10) * 60}
                    onChange={(totalSeconds) => {
                      setEditingExercise((prev: any) => ({
                        ...prev,
                        durationSeconds: totalSeconds,
                        durationMinutes: Math.round(totalSeconds / 60) // Keep for backward compatibility
                      }));
                    }}
                  />
                </Box>

                {/* Exercise Notes for Cardio */}
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                    Exercise Notes
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Notes for this exercise"
                    value={editingExercise.notes || ''}
                    onChange={(e) => setEditingExercise((prev: any) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any specific notes, cues, or instructions for this exercise..."
                    helperText="These notes will be visible to the client when viewing their workout plan"
                  />
                </Box>
                </>
              ) : (
                <>
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Individual Sets
                  </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${theme.palette.divider}` }}>
                    <thead>
                      <tr style={{ backgroundColor: `${theme.palette.action.hover}`, borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: `${theme.palette.text.primary}` }}>Set</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: `${theme.palette.text.primary}` }}>Reps</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: `${theme.palette.text.primary}` }}>Rest (sec)</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: `${theme.palette.text.primary}`, minWidth: '220px' }}>Tempo</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: `${theme.palette.text.primary}` }}>RIR</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: `${theme.palette.text.primary}` }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
 {(editingExercise.individualSets || []).map((set: any, index: number) => (
                        <tr key={set.id} style={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                          <td style={{ padding: '12px', fontWeight: 500, color: `${theme.palette.text.primary}` }}>{index + 1}</td>
                          <td style={{ padding: '8px' }}>
                            <TextField
                              size="small"
                              value={set.reps}
                              onChange={(e) => {
                                // Only allow numbers and "-" character
                                const filteredValue = e.target.value.replace(/[^0-9\-]/g, '');
                                updateIndividualSet(set.id, 'reps', filteredValue);
                              }}
                              onKeyPress={(e) => {
                                // Prevent typing characters that aren't numbers or "-"
                                const char = e.key;
                                if (char && !/[0-9\-]/.test(char) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(char)) {
                                  e.preventDefault();
                                }
                              }}
                              sx={{ width: '120px' }}
                              placeholder="e.g. 8-12"
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {[0, 1, 2, 3].map((pos) => {
                                const tempoValues = parseTempo(set.tempo || "");
                                return (
                                  <React.Fragment key={pos}>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={tempoValues[pos] || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        updateTempoValue(set.id, pos as 0 | 1 | 2 | 3, val);
                                      }}
                                      onBlur={(e) => {
                                        if (e.target.value === "") {
                                          updateTempoValue(set.id, pos as 0 | 1 | 2 | 3, "0");
                                        }
                                      }}
                                      sx={{ 
                                        width: '50px',
                                        '& .MuiInputBase-input': {
                                          textAlign: 'center',
                                          padding: '8px 4px'
                                        }
                                      }}
                                      InputProps={{
                                        inputProps: { 
                                          min: 0,
                                          step: 1
                                        }
                                      }}
                                      placeholder="0"
                                    />
                                    {pos < 3 && (
                                      <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>-</Typography>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </Box>
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

              {/* Quick Actions - Only for non-cardio exercises */}
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

              {/* Exercise Notes */}
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Exercise Notes
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Notes for this exercise"
                  value={editingExercise.notes || ''}
                  onChange={(e) => setEditingExercise((prev: any) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any specific notes, cues, or instructions for this exercise..."
                  helperText="These notes will be visible to the client when viewing their workout plan"
                />
              </Box>

              {/* Preview - Only for non-cardio exercises */}
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Preview: {formatRepRange(editingExercise.reps, editingExercise.sets)}
                </Typography>
              </Box>
                </>
              )}
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
                          <Box
                            sx={{
                              mt: 2,
                              p: 2,
                              borderRadius: 2,
                              bgcolor: 'info.lighter',
                              border: '2px solid',
                              borderColor: 'info.main',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                            }}
                          >
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 700,
                                color: 'info.dark',
                                mb: 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}
                            >
                              💡 Exercise Notes
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: 'info.darker',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                              }}
                            >
                              {exercise.notes}
                            </Typography>
                          </Box>
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
