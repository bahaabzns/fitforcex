import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Divider,
  Stack,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { CalendarToday, Assignment, Schedule } from '@mui/icons-material';
import api from '@/utils/axios';

interface FormTemplate {
  id: string;
  title: string;
  type: string;
  questions: any[];
  createdAt: string;
  updatedAt: string;
}

interface FormSchedulingPopupProps {
  open: boolean;
  onClose: () => void;
  onSchedule: (formId: string, scheduleAt?: string) => void;
  clientId: string;
  formType: 'workout' | 'nutrition';
  clientName?: string;
  onlyScheduled?: boolean; // When true, hide immediate assignment option
}

export const FormSchedulingPopup: React.FC<FormSchedulingPopupProps> = ({
  open,
  onClose,
  onSchedule,
  clientId,
  formType,
  clientName,
  onlyScheduled = false,
}) => {
  const [availableForms, setAvailableForms] = useState<FormTemplate[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>(onlyScheduled ? 'scheduled' : 'immediate');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  // Load available forms when popup opens
  useEffect(() => {
    if (open) {
      loadAvailableForms();
    }
  }, [open, formType]);

  const loadAvailableForms = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/forms/templates', {
        params: { type: formType }
      });
      
      const forms = response.data?.templates || [];
      setAvailableForms(forms);
      
      if (forms.length === 0) {
        setError(`No ${formType} forms available for scheduling.`);
      }
    } catch (err: any) {
      console.error('Error loading forms:', err);
      setError('Failed to load available forms');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedFormId) {
      setError('Please select a form to schedule');
      return;
    }

    // Validate duration if scheduling is selected
    if (scheduleType === 'scheduled' && (!durationDays || durationDays <= 0)) {
      setError('Please enter a valid duration in days');
      return;
    }

    try {
      setScheduling(true);
      setError(null);

      // Calculate scheduled date based on duration
      let scheduleAt: string | undefined;
      if (scheduleType === 'scheduled') {
        const now = new Date();
        const scheduledDate = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));
        scheduleAt = scheduledDate.toISOString();
      }

      await onSchedule(selectedFormId, scheduleAt);
      
      // Reset form
      setSelectedFormId('');
      setScheduleType(onlyScheduled ? 'scheduled' : 'immediate');
      setScheduledDate('');
      setDurationDays(7);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule form');
    } finally {
      setScheduling(false);
    }
  };

  const handleSkip = () => {
    setSelectedFormId('');
    setScheduleType(onlyScheduled ? 'scheduled' : 'immediate');
    setScheduledDate('');
    setDurationDays(7);
    setError(null);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFormTypeColor = (type: string) => {
    switch (type) {
      case 'workout':
        return 'primary';
      case 'nutrition':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleSkip}
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assignment color="primary" />
          <Box>
            <Typography variant="h6" component="div">
              Schedule {formType.charAt(0).toUpperCase() + formType.slice(1)} Form
            </Typography>
            {clientName && (
              <Typography variant="body2" color="text.secondary">
                for {clientName}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Would you like to schedule a {formType} form for this client? This will help gather additional information to improve their plan.
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : availableForms.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            No {formType} forms are available for scheduling. You can create forms in the Forms section.
          </Alert>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Select Form</InputLabel>
              <Select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                label="Select Form"
              >
                {availableForms.map((form) => (
                  <MenuItem key={form.id} value={form.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="body1" sx={{ flex: 1 }}>
                        {form.title}
                      </Typography>
                      <Chip 
                        label={form.type} 
                        size="small" 
                        color={getFormTypeColor(form.type) as any}
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Scheduling Options
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Assignment Type</InputLabel>
              <Select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as 'immediate' | 'scheduled')}
                label="Assignment Type"
                disabled={onlyScheduled}
              >
                {!onlyScheduled && (
                <MenuItem value="immediate">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assignment fontSize="small" />
                    <Box>
                      <Typography variant="body1">Immediate Assignment</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Form will be sent to client immediately
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
                )}
                <MenuItem value="scheduled">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Schedule fontSize="small" />
                    <Box>
                      <Typography variant="body1">Scheduled Assignment</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Form will be sent to client after a specified duration
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {scheduleType === 'scheduled' && (
              <TextField
                fullWidth
                label="Duration (Days)"
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 0)}
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{ mb: 2 }}
                helperText={`Form will be sent to client in ${durationDays} day${durationDays !== 1 ? 's' : ''} (${new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()})`}
                inputProps={{
                  min: 1,
                  max: 365
                }}
              />
            )}

            {selectedFormId && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Form Details:
                </Typography>
                {(() => {
                  const selectedForm = availableForms.find(f => f.id === selectedFormId);
                  return selectedForm ? (
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {selectedForm.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Created: {formatDate(selectedForm.createdAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Questions: {Array.isArray(selectedForm.questions) ? selectedForm.questions.length : 0}
                      </Typography>
                    </Box>
                  ) : null;
                })()}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleSkip} disabled={scheduling}>
          Skip
        </Button>
        <LoadingButton
          onClick={handleSchedule}
          loading={scheduling}
          variant="contained"
          disabled={!selectedFormId || loading}
          startIcon={<CalendarToday />}
        >
          {scheduleType === 'immediate' ? 'Send Form Now' : `Schedule in ${durationDays} Day${durationDays !== 1 ? 's' : ''}`}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
