'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';
import { FormattedMessage, useIntl } from 'react-intl';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// MUI
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { openSnackbar } from '@/api/snackbar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import { Trash, Copy, Add, CloseCircle } from '@wandersonalwes/iconsax-react';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Avatar from '@mui/material/Avatar';
import { Visibility, Person } from '@mui/icons-material';

type FormTemplate = {
  id: string;
  title: string;
  type?: 'nutrition' | 'workout' | string;
  questions: Array<{ id?: string; label: string; type: string; required?: boolean }>;
  createdAt?: string;
};

export default function FormsPage() {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const intl = useIntl();
  const isArabic = String(intl.locale || '').toLowerCase().startsWith('ar');

  // Debug logging
  console.log('FormsPage - workspaceId:', workspaceId);
  console.log(
    'FormsPage - Redux workspace state:',
    useAppSelector((s) => s.workspace)
  );

  // For testing: use a default workspace ID if none is set
  const effectiveWorkspaceId = workspaceId || 'test-workspace-123';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState<boolean>(false);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [viewTemplate, setViewTemplate] = useState<FormTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<FormTemplate | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTitleArabic, setEditTitleArabic] = useState('');
  const [editFormType, setEditFormType] = useState<'nutrition' | 'workout' | 'other'>('nutrition');
  const [editQuestions, setEditQuestions] = useState<Array<{ id: string; originalId?: string; label: string; labelArabic?: string; description?: string; descriptionArabic?: string; type: string; required?: boolean; options?: string[]; optionsArabic?: string[] }>>([]);
  // Add-question builder for edit dialog
  const [editCustomType, setEditCustomType] = useState<string>('text');
  const [editCustomLabel, setEditCustomLabel] = useState<string>('');
  const [editCustomLabelArabic, setEditCustomLabelArabic] = useState<string>('');
  const [editCustomDescription, setEditCustomDescription] = useState<string>('');
  const [editCustomDescriptionArabic, setEditCustomDescriptionArabic] = useState<string>('');
  const [editCustomRequired, setEditCustomRequired] = useState<boolean>(false);
  const [editCustomOptions, setEditCustomOptions] = useState<string[]>([]);
  const [editCustomOptionsArabic, setEditCustomOptionsArabic] = useState<string[]>([]);
  const [editCustomError, setEditCustomError] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [defaultQuestions, setDefaultQuestions] = useState<
    Array<{ id: string; label: string; type: string; required?: boolean; options?: string[] }>
  >([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formType, setFormType] = useState<'nutrition' | 'workout' | 'other'>('nutrition');
  const [title, setTitle] = useState('');
  const [titleArabic, setTitleArabic] = useState('');
  const [newQuestions, setNewQuestions] = useState<
    Array<{ id: string; originalId?: string; label: string; labelArabic?: string; description?: string; descriptionArabic?: string; type: string; required?: boolean; options?: string[]; optionsArabic?: string[] }>
  >([]);
  const [creating, setCreating] = useState(false);
  // custom question builder
  const [customType, setCustomType] = useState<string>('text');
  const [customLabel, setCustomLabel] = useState<string>('');
  const [customLabelArabic, setCustomLabelArabic] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [customDescriptionArabic, setCustomDescriptionArabic] = useState<string>('');
  const [customRequired, setCustomRequired] = useState<boolean>(false);
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [customOptionsArabic, setCustomOptionsArabic] = useState<string[]>([]);
  const [customError, setCustomError] = useState<string>('');
  const [copying, setCopying] = useState<string | null>(null);

  // Form Submissions tab state
  const [activeTab, setActiveTab] = useState(0); // 0 = Templates, 1 = Submissions
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [submissionTypeFilter, setSubmissionTypeFilter] = useState<'all' | 'nutrition' | 'workout' | 'other'>('all');
  const [viewSubmissionDetails, setViewSubmissionDetails] = useState<any | null>(null);
  const [submissionDetailsOpen, setSubmissionDetailsOpen] = useState(false);
  const [submissionDetailsLoading, setSubmissionDetailsLoading] = useState(false);

  // Drag and drop handlers for questions
  const handleEditQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = editQuestions.findIndex((q) => q.id === active.id);
    const newIndex = editQuestions.findIndex((q) => q.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newQuestions = [...editQuestions];
      const [moved] = newQuestions.splice(oldIndex, 1);
      newQuestions.splice(newIndex, 0, moved);
      setEditQuestions(newQuestions);
    }
  };

  const handleNewQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = newQuestions.findIndex((q) => q.id === active.id);
    const newIndex = newQuestions.findIndex((q) => q.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const updated = [...newQuestions];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);
      setNewQuestions(updated);
    }
  };

  useEffect(() => {
    if (!effectiveWorkspaceId) {
      setLoading(false);
      return;
    }
    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/forms/templates');
        console.log('Templates response:', res.data); // Debug log
        setTemplates(Array.isArray(res.data?.templates) ? res.data.templates : []);
        // load default questions (fixed) like the old FE
        try {
          const dq = await api.get('/api/forms/default-questions');
          console.log('Default questions response:', dq.data); // Debug log
          const qs = Array.isArray(dq.data?.questions) ? dq.data.questions : [];
          setDefaultQuestions(
            qs.map((q: any, idx: number) => ({
              id: q.id || `dq_${idx}`,
              label: q.question || q.title || q.label || q.text || `Question ${idx + 1}`,
              labelArabic: q.questionArabic,
              type: q.type || 'text',
              required: !!q.required,
              options: q.options,
              optionsArabic: q.optionsArabic
            }))
          );
        } catch {}
      } catch (e: any) {
        const status = e?.response?.status;
        const message: string = e?.response?.data?.error || e?.response?.data?.message || '';
        const isSubscriptionError = status === 402 || status === 404 || (typeof message === 'string' && message.toLowerCase().includes('subscription')) || (typeof message === 'string' && message.toLowerCase().includes('workspace_subscription_required'));
        if (isSubscriptionError) {
          setSubscriptionRequired(true);
          setError('Workspace subscription required');
        } else {
          setError('Failed to load forms');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [effectiveWorkspaceId]);

  // Load form submissions
  useEffect(() => {
    if (activeTab === 1 && effectiveWorkspaceId) {
      const loadSubmissions = async () => {
        setSubmissionsLoading(true);
        setSubmissionsError(null);
        try {
          const res = await api.get('/api/forms/submissions', { 
            headers: { 'x-workspace-id': effectiveWorkspaceId } 
          });
          const rawSubmissions = Array.isArray(res.data?.submissions) ? res.data.submissions : [];
          // Map submissions to ensure all fields are present
          setSubmissions(rawSubmissions.map((s: any) => ({
            id: s.id,
            clientId: s.clientId || s.client?.id || '',
            clientName: s.clientName || s.client?.fullName || '—',
            clientEmail: s.clientEmail || s.client?.email || null,
            formId: s.formId || s.form?.id || '',
            formTitle: s.formTitle || s.form?.title || '—',
            formTitleArabic: s.formTitleArabic || s.form?.titleArabic || null,
            formType: s.formType || s.form?.type || null,
            status: s.status || 'pending',
            createdAt: s.createdAt,
            completedAt: s.completedAt,
            answers: s.answers,
          })));
        } catch (e: any) {
          setSubmissionsError(e.response?.data?.error || 'Failed to load submissions');
        } finally {
          setSubmissionsLoading(false);
        }
      };
      loadSubmissions();
    }
  }, [activeTab, effectiveWorkspaceId]);

  const filteredSubmissions = useMemo(() => {
    if (submissionTypeFilter === 'all') return submissions;
    return submissions.filter((s: any) => s.formType === submissionTypeFilter);
  }, [submissions, submissionTypeFilter]);

  const handleViewSubmissionDetails = async (submissionId: string) => {
    setSubmissionDetailsLoading(true);
    try {
      const res = await api.get(`/api/forms/submissions/${submissionId}`, {
        headers: { 'x-workspace-id': effectiveWorkspaceId }
      });
      setViewSubmissionDetails(res.data?.submission);
      setSubmissionDetailsOpen(true);
    } catch (e: any) {
      setSubmissionsError(e.response?.data?.error || 'Failed to load submission details');
    } finally {
      setSubmissionDetailsLoading(false);
    }
  };

  const createTemplate = async () => {
    console.log('createTemplate called - workspaceId:', workspaceId);
    console.log('createTemplate called - effectiveWorkspaceId:', effectiveWorkspaceId);
    console.log('createTemplate called - title:', title);
    console.log('createTemplate called - newQuestions:', newQuestions);

    if (!title.trim()) {
      console.log('createTemplate - no title, returning');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const questions = newQuestions.map(({ id, label, labelArabic, description, descriptionArabic, type, required, options, optionsArabic }) => ({ id, name: label, nameArabic: labelArabic, question: label, questionArabic: labelArabic, description: description || null, descriptionArabic: descriptionArabic || null, type, required, options, optionsArabic }));
      console.log('createTemplate - sending request with:', { title: title.trim(), titleArabic: titleArabic.trim() || undefined, type: formType, questions });
      await api.post('/api/forms/templates', { title: title.trim(), titleArabic: titleArabic.trim() || undefined, type: formType, questions }, { headers: { 'x-workspace-id': effectiveWorkspaceId } });
      console.log('createTemplate - request successful');
      setShowCreate(false);
      setTitle('');
      setTitleArabic('');
      setFormType('nutrition');
      setNewQuestions([]);
      setCustomType('text');
      setCustomLabel('');
      setCustomLabelArabic('');
      setCustomRequired(false);
      setCustomOptions('');
      const res = await api.get('/api/forms/templates', { headers: { 'x-workspace-id': effectiveWorkspaceId } });
      setTemplates(Array.isArray(res.data?.templates) ? res.data.templates : []);
    } catch {
      setError('Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (t: FormTemplate) => {
    setEditTemplate(t);
    setEditTitle(t.title || '');
    setEditTitleArabic((t as any).titleArabic || '');
    setEditFormType((t.type as any) === 'workout' ? 'workout' : 'nutrition');
    const mapped = Array.isArray(t.questions) ? t.questions.map((q: any, idx: number) => ({
      id: q.id || `tq_${idx}_${Date.now()}`,
      originalId: q.id,
      label: q.label || q.question || q.title || `Question ${idx + 1}`,
      labelArabic: q.labelArabic || q.questionArabic,
      type: q.type || 'text',
      required: !!q.required,
      options: q.options,
      optionsArabic: q.optionsArabic
    })) : [];
    setEditQuestions(mapped);
    setShowEdit(true);
  };

  const copyTemplate = async (template: FormTemplate) => {
    setCopying(template.id);
    setError(null);
    try {
      // Create a copy with modified title
      const copyTitle = `${template.title} (Copy)`;
      const copyTitleArabic = (template as any).titleArabic ? `${(template as any).titleArabic} (نسخة)` : undefined;
      
      // Map questions for the copy
      const questions = Array.isArray(template.questions) ? template.questions.map((q: any) => ({
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: q.name || q.question || q.label,
        nameArabic: q.nameArabic || q.questionArabic,
        question: q.question || q.name || q.label,
        questionArabic: q.questionArabic || q.nameArabic,
        type: q.type || 'text',
        required: !!q.required,
        options: q.options,
        optionsArabic: q.optionsArabic
      })) : [];

      await api.post('/api/forms/templates', {
        title: copyTitle,
        titleArabic: copyTitleArabic,
        type: template.type || 'nutrition',
        questions
      }, { headers: { 'x-workspace-id': effectiveWorkspaceId } });

      // Refresh templates list
      const res = await api.get('/api/forms/templates', { headers: { 'x-workspace-id': effectiveWorkspaceId } });
      setTemplates(Array.isArray(res.data?.templates) ? res.data.templates : []);
      
      openSnackbar('Form copied successfully', 'success');
    } catch (err: any) {
      console.error('Copy template error:', err);
      if (err.response?.data?.message?.includes('already exists')) {
        setError('A form with this name already exists. Please rename the original form first.');
      } else {
        setError('Failed to copy form');
      }
    } finally {
      setCopying(null);
    }
  };

  const updateTemplate = async () => {
    if (!editTemplate) return;
    if (!editTitle.trim()) return;
    setUpdating(true);
    setError(null);
    try {
      const questions = editQuestions.map(({ id, label, labelArabic, description, descriptionArabic, type, required, options, optionsArabic, originalId }) => ({ id: originalId || id, name: label, nameArabic: labelArabic, question: label, questionArabic: labelArabic, description: description || null, descriptionArabic: descriptionArabic || null, type, required, options, optionsArabic }));
      await api.put(`/api/forms/templates/${editTemplate.id}`, { title: editTitle.trim(), titleArabic: editTitleArabic.trim() || undefined, type: editFormType, questions }, { headers: { 'x-workspace-id': effectiveWorkspaceId } });
      setShowEdit(false);
      setEditTemplate(null);
      setEditTitle('');
      setEditTitleArabic('');
      setEditQuestions([]);
      const res = await api.get('/api/forms/templates', { headers: { 'x-workspace-id': effectiveWorkspaceId } });
      setTemplates(Array.isArray(res.data?.templates) ? res.data.templates : []);
      openSnackbar({ open: true, message: 'Template updated', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
    } catch {
      setError('Failed to update template');
    } finally {
      setUpdating(false);
    }
  };

  if (!effectiveWorkspaceId) {
    return (
      <Card sx={{ borderStyle: 'dashed' }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6">Select a workspace</Typography>
            <Typography color="text.secondary">Choose a workspace to manage forms.</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading forms…</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="h4">Forms</Typography>
        <Button variant="contained" onClick={() => setShowCreate((s) => !s)}>
          Create Template
        </Button>
      </Stack>

      {subscriptionRequired ? (
        <Alert severity="warning" action={<Button color="warning" variant="contained" size="small" href="/dashboard/workspaces/subscription">Manage Subscription</Button>}>
          <Box>
            <Box sx={{ fontWeight: 600, mb: 0.5 }}>Workspace subscription required</Box>
            <Box sx={{ color: 'text.secondary' }}>Your workspace has no active subscription. Activate a plan to manage forms.</Box>
            <Box sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', color: 'warning.dark' }}>workspace_subscription_required</Box>
          </Box>
        </Alert>
      ) : (
        error && <Alert severity="error">{error}</Alert>
      )}

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Templates" />
          <Tab label="Form Submissions" />
        </Tabs>
      </Card>

      {/* Templates Tab Content */}
      {activeTab === 0 && (
        <>
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} fullWidth maxWidth="md">
        <DialogTitle><FormattedMessage id="new-form-template" /></DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField fullWidth label={intl.formatMessage({ id: 'title' })} value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField fullWidth label={intl.formatMessage({ id: 'title-arabic' })} value={titleArabic} onChange={(e) => setTitleArabic(e.target.value)} />
            <FormControl fullWidth>
              <InputLabel id="form-type-label"><FormattedMessage id="type" /></InputLabel>
              <Select labelId="form-type-label" label={intl.formatMessage({ id: 'type' })} value={formType} onChange={(e) => setFormType(e.target.value as any)}>
                <MenuItem value="nutrition">nutrition</MenuItem>
                <MenuItem value="workout">workout</MenuItem>
                <MenuItem value="other">other</MenuItem>
              </Select>
            </FormControl>

            {/* Fixed (default) questions list */}
            {defaultQuestions.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  <FormattedMessage id="fixed-questions" />
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {defaultQuestions.map((q) => (
                    <Chip
                      key={q.id}
                      label={(isArabic ? (q as any).labelArabic : undefined) || q.label}
                      onClick={() =>
                        setNewQuestions((prev) => {
                          // prevent duplicate of the same default question
                          if (prev.some((p) => p.originalId === q.id)) return prev;
                          return [
                            ...prev,
                            { ...q, id: `${q.id}_${Date.now()}`, originalId: q.id },
                          ];
                        })
                      }
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Added questions - editable with drag and drop */}
            {newQuestions.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Questions ({newQuestions.length})
                </Typography>
                <DndContext collisionDetection={closestCenter} onDragEnd={handleNewQuestionDragEnd}>
                  <SortableContext items={newQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                <Stack spacing={1}>
                  {newQuestions.map((q, idx) => (
                        <SortableQuestion
                          key={q.id}
                          question={q}
                          index={idx}
                          onUpdate={(id, field, value) => {
                            setNewQuestions((prev) => prev.map((x) => {
                              if (x.id !== id) return x;
                              if (field === 'type') {
                                return { ...x, type: value, options: ['select','checkbox','radio'].includes(value) ? (x.options||[]) : undefined, optionsArabic: ['select','checkbox','radio'].includes(value) ? (x.optionsArabic||[]) : undefined };
                              }
                              return { ...x, [field]: value };
                            }));
                          }}
                          onDelete={() => setNewQuestions((prev) => prev.filter((_, i) => i !== idx))}
                        />
                  ))}
                </Stack>
                  </SortableContext>
                </DndContext>
              </Box>
            )}

            {/* Custom question builder */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Add custom question
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel id="custom-type-label">Type</InputLabel>
                    <Select labelId="custom-type-label" label="Type" value={customType} onChange={(e) => setCustomType(e.target.value)}>
                      <MenuItem value="text">text</MenuItem>
                      <MenuItem value="textarea">textarea</MenuItem>
                      <MenuItem value="number">number</MenuItem>
                      <MenuItem value="date">date</MenuItem>
                      <MenuItem value="select">select</MenuItem>
                      <MenuItem value="checkbox">checkbox</MenuItem>
                      <MenuItem value="radio">radio</MenuItem>
                      <MenuItem value="attachment">attachment</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField fullWidth label="Question label" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Question label (Arabic)" value={customLabelArabic} onChange={(e) => setCustomLabelArabic(e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Description (optional)" 
                    value={customDescription} 
                    onChange={(e) => setCustomDescription(e.target.value)} 
                    multiline
                    minRows={2}
                    placeholder="Help text or instructions"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Description (Arabic, optional)" 
                    value={customDescriptionArabic} 
                    onChange={(e) => setCustomDescriptionArabic(e.target.value)} 
                    multiline
                    minRows={2}
                    placeholder="نص المساعدة"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControlLabel control={<Switch checked={customRequired} onChange={(e) => setCustomRequired(e.target.checked)} />} label="Required" />
                </Grid>
                </Grid>
              {['select', 'checkbox', 'radio'].includes(customType) && (
                <Box sx={{ mt: 2 }}>
                  <OptionsEditor
                    questionId={`custom-${Date.now()}`}
                    options={customOptions}
                    optionsArabic={customOptionsArabic}
                    onUpdate={(options, optionsArabic) => {
                      setCustomOptions(options);
                      setCustomOptionsArabic(optionsArabic);
                    }}
                  />
                </Box>
              )}
              {customError && <Alert severity="error" sx={{ mt: 1 }}>{customError}</Alert>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    setCustomError('');
                    if (!customLabel.trim()) {
                      setCustomError('Question label is required');
                      return;
                    }
                    setNewQuestions((prev) => [
                      ...prev,
                      {
                        id: `q_${Date.now()}`,
                        label: customLabel.trim(),
                        labelArabic: customLabelArabic.trim() || undefined,
                        description: customDescription.trim() || undefined,
                        descriptionArabic: customDescriptionArabic.trim() || undefined,
                        type: customType,
                        required: customRequired,
                        options: customOptions.length ? customOptions : undefined,
                        optionsArabic: customOptionsArabic.length ? customOptionsArabic : undefined,
                      },
                    ]);
                    setCustomLabel('');
                    setCustomLabelArabic('');
                    setCustomDescription('');
                    setCustomDescriptionArabic('');
                    setCustomRequired(false);
                    setCustomOptions([]);
                    setCustomOptionsArabic([]);
                  }}
                >
                  Add
                </Button>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button variant="contained" disabled={creating} onClick={createTemplate}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {templates.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6">No templates yet</Typography>
              <Typography color="text.secondary">Create your first form template to get started.</Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {templates.map((t) => (
            <Grid key={t.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardHeader title={(isArabic ? (t as any).titleArabic : undefined) || t.title} subheader={[t.type ? `Type: ${t.type}` : null, t.createdAt ? new Date(t.createdAt).toLocaleString() : null].filter(Boolean).join(' • ')} />
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Questions: {Array.isArray(t.questions) ? t.questions.length : 0}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => setViewTemplate(t)}>
                      Open
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => openEdit(t)}>
                      Edit
                    </Button>
                    <IconButton 
                      size="small" 
                      color="primary" 
                      onClick={() => copyTemplate(t)}
                      disabled={copying === t.id}
                      title="Copy form"
                    >
                      <Copy size={16} />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* View Template Dialog */}
      <Dialog open={!!viewTemplate} onClose={() => setViewTemplate(null)} fullWidth maxWidth="md">
        <DialogTitle>{(isArabic ? (viewTemplate as any)?.titleArabic : undefined) || viewTemplate?.title || 'Form'}</DialogTitle>
        <DialogContent dividers>
          {Array.isArray(viewTemplate?.questions) && viewTemplate!.questions.length > 0 ? (
            <Stack spacing={2}>
              {viewTemplate!.questions.map((q, idx) => {
                console.log('Question object:', q); // Debug log
                return (
                  <Card key={idx} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        {(isArabic ? (q as any).questionArabic || (q as any).labelArabic : undefined) || q.question || q.label || q.text || q.title || `Question ${idx + 1}`}
                      </Typography>
                      {(q as any).description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
                          {(isArabic && (q as any).descriptionArabic) ? (q as any).descriptionArabic : (q as any).description}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Type: {q.type}
                        {q.required ? ' • required' : ''}
                      </Typography>
                      {q.options?.length ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Options: {q.options.join(', ')}
                        </Typography>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Typography color="text.secondary">No questions in this template.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewTemplate(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={showEdit} onClose={() => setShowEdit(false)} fullWidth maxWidth="md">
        <DialogTitle>Edit form template</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField fullWidth label={intl.formatMessage({ id: 'title' })} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <TextField fullWidth label={intl.formatMessage({ id: 'title-arabic' })} value={editTitleArabic} onChange={(e) => setEditTitleArabic(e.target.value)} />
            <FormControl fullWidth>
              <InputLabel id="edit-form-type-label"><FormattedMessage id="type" /></InputLabel>
              <Select labelId="edit-form-type-label" label={intl.formatMessage({ id: 'type' })} value={editFormType} onChange={(e) => setEditFormType(e.target.value as any)}>
                <MenuItem value="nutrition">nutrition</MenuItem>
                <MenuItem value="workout">workout</MenuItem>
                <MenuItem value="other">other</MenuItem>
              </Select>
            </FormControl>

            {editQuestions.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Questions ({editQuestions.length})
                </Typography>
                <DndContext collisionDetection={closestCenter} onDragEnd={handleEditQuestionDragEnd}>
                  <SortableContext items={editQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                <Stack spacing={1}>
                  {editQuestions.map((q, idx) => (
                        <SortableQuestion
                          key={q.id}
                          question={q}
                          index={idx}
                          onUpdate={(id, field, value) => {
                            setEditQuestions((prev) => prev.map((x) => {
                              if (x.id !== id) return x;
                              if (field === 'type') {
                                return { ...x, type: value, options: ['select','checkbox','radio'].includes(value) ? (x.options||[]) : undefined, optionsArabic: ['select','checkbox','radio'].includes(value) ? (x.optionsArabic||[]) : undefined };
                              }
                              return { ...x, [field]: value };
                            }));
                          }}
                          onDelete={() => setEditQuestions((prev) => prev.filter((_, i) => i !== idx))}
                          isEditMode={true}
                        />
                  ))}
                </Stack>
                  </SortableContext>
                </DndContext>
              </Box>
            )}

            {/* Add new question in edit mode */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Add question
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel id="edit-custom-type-label">Type</InputLabel>
                    <Select labelId="edit-custom-type-label" label="Type" value={editCustomType} onChange={(e) => setEditCustomType(String(e.target.value))}>
                      <MenuItem value="text">text</MenuItem>
                      <MenuItem value="textarea">textarea</MenuItem>
                      <MenuItem value="number">number</MenuItem>
                      <MenuItem value="date">date</MenuItem>
                      <MenuItem value="select">select</MenuItem>
                      <MenuItem value="checkbox">checkbox</MenuItem>
                      <MenuItem value="radio">radio</MenuItem>
                      <MenuItem value="attachment">attachment</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField fullWidth label="Question label" value={editCustomLabel} onChange={(e) => setEditCustomLabel(e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Question label (Arabic)" value={editCustomLabelArabic} onChange={(e) => setEditCustomLabelArabic(e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Description (optional)" 
                    value={editCustomDescription} 
                    onChange={(e) => setEditCustomDescription(e.target.value)} 
                    multiline
                    minRows={2}
                    placeholder="Help text or instructions"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    fullWidth 
                    label="Description (Arabic, optional)" 
                    value={editCustomDescriptionArabic} 
                    onChange={(e) => setEditCustomDescriptionArabic(e.target.value)} 
                    multiline
                    minRows={2}
                    placeholder="نص المساعدة"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControlLabel control={<Switch checked={editCustomRequired} onChange={(e) => setEditCustomRequired(e.target.checked)} />} label="Required" />
                </Grid>
                </Grid>
              {['select', 'checkbox', 'radio'].includes(editCustomType) && (
                <Box sx={{ mt: 2 }}>
                  <OptionsEditor
                    questionId={`edit-custom-${Date.now()}`}
                    options={editCustomOptions}
                    optionsArabic={editCustomOptionsArabic}
                    onUpdate={(options, optionsArabic) => {
                      setEditCustomOptions(options);
                      setEditCustomOptionsArabic(optionsArabic);
                    }}
                  />
                </Box>
              )}
              {editCustomError && <Alert severity="error" sx={{ mt: 1 }}>{editCustomError}</Alert>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditCustomError('');
                    if (!editCustomLabel.trim()) {
                      setEditCustomError('Question label is required');
                      return;
                    }
                    setEditQuestions((prev) => [
                      ...prev,
                      {
                        id: `eq_${Date.now()}`,
                        label: editCustomLabel.trim(),
                        labelArabic: editCustomLabelArabic.trim() || undefined,
                        description: editCustomDescription.trim() || undefined,
                        descriptionArabic: editCustomDescriptionArabic.trim() || undefined,
                        type: editCustomType,
                        required: editCustomRequired,
                        options: editCustomOptions.length ? editCustomOptions : undefined,
                        optionsArabic: editCustomOptionsArabic.length ? editCustomOptionsArabic : undefined,
                      },
                    ]);
                    setEditCustomLabel('');
                    setEditCustomLabelArabic('');
                    setEditCustomDescription('');
                    setEditCustomDescriptionArabic('');
                    setEditCustomRequired(false);
                    setEditCustomOptions([]);
                    setEditCustomOptionsArabic([]);
                  }}
                >
                  Add question
                </Button>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEdit(false)}>Cancel</Button>
          <Button variant="contained" disabled={updating} onClick={updateTemplate}>
            {updating ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}

      {/* Form Submissions Tab */}
      {activeTab === 1 && (
        <Box>
          {submissionsError && <Alert severity="error" sx={{ mb: 2 }}>{submissionsError}</Alert>}
          
          {/* Type Filter Tabs */}
          <Card sx={{ mb: 2 }}>
            <Tabs 
              value={submissionTypeFilter} 
              onChange={(_, v) => setSubmissionTypeFilter(v)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="All" value="all" />
              <Tab label="Nutrition" value="nutrition" />
              <Tab label="Workout" value="workout" />
              <Tab label="Other" value="other" />
            </Tabs>
          </Card>

          {submissionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
    </Box>
          ) : filteredSubmissions.length === 0 ? (
            <Card>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    No submissions found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {submissionTypeFilter === 'all' 
                      ? 'No form submissions yet.' 
                      : `No ${submissionTypeFilter} form submissions yet.`}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Form</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSubmissions.map((submission: any) => (
                    <TableRow key={submission.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                            <Person fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {submission.clientName || '—'}
                            </Typography>
                            {submission.clientEmail && (
                              <Typography variant="caption" color="text.secondary">
                                {submission.clientEmail}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {isArabic && submission.formTitleArabic 
                            ? submission.formTitleArabic 
                            : submission.formTitle || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={submission.formType || '—'} 
                          size="small"
                          color={
                            submission.formType === 'nutrition' ? 'success' :
                            submission.formType === 'workout' ? 'primary' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={submission.status || 'pending'}
                          size="small"
                          color={
                            submission.status === 'completed' ? 'success' :
                            submission.status === 'pending' ? 'warning' :
                            submission.status === 'archived' ? 'default' :
                            'info'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {submission.completedAt 
                            ? new Date(submission.completedAt).toLocaleDateString()
                            : submission.sentAt
                            ? new Date(submission.sentAt).toLocaleDateString()
                            : submission.createdAt
                            ? new Date(submission.createdAt).toLocaleDateString()
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleViewSubmissionDetails(submission.id)}
                          title="View details"
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </Box>
      )}

      {/* Submission Details Dialog */}
      <Dialog 
        open={submissionDetailsOpen} 
        onClose={() => {
          setSubmissionDetailsOpen(false);
          setViewSubmissionDetails(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Form Submission Details
          {viewSubmissionDetails && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {viewSubmissionDetails.formTitle || '—'}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {submissionDetailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : viewSubmissionDetails ? (
            <Stack spacing={3}>
              {/* Client Info */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Client
                </Typography>
                <Typography variant="body1">
                  {viewSubmissionDetails.clientName || '—'}
                </Typography>
                {viewSubmissionDetails.clientEmail && (
                  <Typography variant="body2" color="text.secondary">
                    {viewSubmissionDetails.clientEmail}
                  </Typography>
                )}
              </Box>

              {/* Form Info */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Form
                </Typography>
                <Typography variant="body1">
                  {isArabic && viewSubmissionDetails.formTitleArabic 
                    ? viewSubmissionDetails.formTitleArabic 
                    : viewSubmissionDetails.formTitle || '—'}
                </Typography>
                <Chip 
                  label={viewSubmissionDetails.formType || '—'} 
                  size="small"
                  sx={{ mt: 1 }}
                  color={
                    viewSubmissionDetails.formType === 'nutrition' ? 'success' :
                    viewSubmissionDetails.formType === 'workout' ? 'primary' :
                    'default'
                  }
                />
              </Box>

              {/* Status */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Status
                </Typography>
                <Chip
                  label={viewSubmissionDetails.status || 'pending'}
                  size="small"
                  color={
                    viewSubmissionDetails.status === 'completed' ? 'success' :
                    viewSubmissionDetails.status === 'pending' ? 'warning' :
                    viewSubmissionDetails.status === 'archived' ? 'default' :
                    'info'
                  }
                />
              </Box>

              {/* Answers */}
              {viewSubmissionDetails.answers && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Answers
                  </Typography>
                  {viewSubmissionDetails.form?.questions && Array.isArray(viewSubmissionDetails.form.questions) && (
                    <Stack spacing={2}>
                      {viewSubmissionDetails.form.questions.map((q: any, idx: number) => {
                        const answer = viewSubmissionDetails.answers?.[q.id || `q_${idx}`];
                        const label = isArabic && q.questionArabic ? q.questionArabic : (q.question || q.label || `Question ${idx + 1}`);
                        const description = isArabic && q.descriptionArabic ? q.descriptionArabic : (q.description || '');
                        
                        return (
                          <Card key={q.id || idx} variant="outlined">
                            <CardContent>
                              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                {label}
                                {q.required && <span style={{ color: 'red' }}> *</span>}
                              </Typography>
                              {description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
                                  {description}
                                </Typography>
                              )}
                              <Typography variant="body1">
                                {answer !== null && answer !== undefined 
                                  ? (Array.isArray(answer) 
                                      ? answer.join(', ') 
                                      : typeof answer === 'object' && answer.originalName
                                      ? `📎 ${answer.originalName} (${(answer.size / 1024).toFixed(1)} KB)`
                                      : String(answer))
                                  : <span style={{ color: '#999', fontStyle: 'italic' }}>No answer</span>}
                              </Typography>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              )}
            </Stack>
          ) : (
            <Typography color="text.secondary">No details available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setSubmissionDetailsOpen(false);
            setViewSubmissionDetails(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

// Sortable Question Component
function SortableQuestion({ 
  question, 
  index, 
  onUpdate, 
  onDelete,
  isEditMode = false 
}: { 
  question: { id: string; label: string; labelArabic?: string; description?: string; descriptionArabic?: string; type: string; required?: boolean; options?: string[]; optionsArabic?: string[] }; 
  index: number;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: () => void;
  isEditMode?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        p: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        bgcolor: isDragging ? 'action.hover' : 'background.paper',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <Grid container spacing={1} alignItems="center">
        <Grid item xs={12} sm={1} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: 'grab',
              color: 'text.secondary',
              fontSize: 20,
              '&:active': { cursor: 'grabbing' }
            }}
          >
            ≡
          </Box>
        </Grid>
        <Grid item xs={12} sm={8} md={5}>
          <FormControl fullWidth size="small">
            <InputLabel id={`qtype-${question.id}`}>Type</InputLabel>
            <Select
              labelId={`qtype-${question.id}`}
              label="Type"
              value={question.type}
              onChange={(e) => onUpdate(question.id, 'type', e.target.value)}
            >
              <MenuItem value="text">text</MenuItem>
              <MenuItem value="textarea">textarea</MenuItem>
              <MenuItem value="number">number</MenuItem>
              <MenuItem value="date">date</MenuItem>
              <MenuItem value="select">select</MenuItem>
              <MenuItem value="checkbox">checkbox</MenuItem>
              <MenuItem value="radio">radio</MenuItem>
              <MenuItem value="attachment">attachment</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4} md={1} sx={{ display: 'flex', alignItems: 'center' }}>
          <FormControlLabel 
            control={
              <Switch 
                size="small" 
                checked={!!question.required} 
                onChange={(e) => onUpdate(question.id, 'required', e.target.checked)} 
              />
            } 
            label="Required" 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField 
            size="small" 
            fullWidth 
            label="Label" 
            value={question.label} 
            onChange={(e) => onUpdate(question.id, 'label', e.target.value)} 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField 
            size="small" 
            fullWidth 
            label="Label (Arabic)" 
            value={question.labelArabic || ''} 
            onChange={(e) => onUpdate(question.id, 'labelArabic', e.target.value)} 
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            size="small" 
            fullWidth 
            label="Description (optional)" 
            value={question.description || ''} 
            onChange={(e) => onUpdate(question.id, 'description', e.target.value)} 
            multiline
            minRows={2}
            placeholder="Help text or instructions"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField 
            size="small" 
            fullWidth 
            label="Description (Arabic, optional)" 
            value={question.descriptionArabic || ''} 
            onChange={(e) => onUpdate(question.id, 'descriptionArabic', e.target.value)} 
            multiline
            minRows={2}
            placeholder="نص المساعدة"
          />
        </Grid>
        {['select','checkbox','radio'].includes(question.type) && (
          <Grid item xs={12}>
            <OptionsEditor
              questionId={question.id}
              options={question.options || []}
              optionsArabic={question.optionsArabic || []}
              onUpdate={(options, optionsArabic) => {
                onUpdate(question.id, 'options', options);
                onUpdate(question.id, 'optionsArabic', optionsArabic);
              }}
            />
          </Grid>
        )}
        <Grid item xs={12} sm={1} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <IconButton size="small" color="error" onClick={onDelete}>
            <Trash />
          </IconButton>
        </Grid>
      </Grid>
    </Box>
  );
}

// Options Editor Component - Better UI for managing options with Arabic
function OptionsEditor({
  questionId,
  options,
  optionsArabic,
  onUpdate
}: {
  questionId: string;
  options: string[];
  optionsArabic: string[];
  onUpdate: (options: string[], optionsArabic: string[]) => void;
}) {
  const [localOptions, setLocalOptions] = useState<Array<{ en: string; ar: string }>>(() => {
    const maxLen = Math.max(options.length, optionsArabic.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      en: options[i] || '',
      ar: optionsArabic[i] || ''
    }));
  });

  useEffect(() => {
    const maxLen = Math.max(options.length, optionsArabic.length);
    setLocalOptions(Array.from({ length: maxLen }, (_, i) => ({
      en: options[i] || '',
      ar: optionsArabic[i] || ''
    })));
  }, [questionId]);

  const updateOption = (index: number, field: 'en' | 'ar', value: string) => {
    const updated = [...localOptions];
    updated[index] = { ...updated[index], [field]: value };
    setLocalOptions(updated);
    onUpdate(
      updated.map(o => o.en).filter(Boolean),
      updated.map(o => o.ar).filter(Boolean)
    );
  };

  const addOption = () => {
    setLocalOptions([...localOptions, { en: '', ar: '' }]);
  };

  const removeOption = (index: number) => {
    const updated = localOptions.filter((_, i) => i !== index);
    setLocalOptions(updated);
    onUpdate(
      updated.map(o => o.en).filter(Boolean),
      updated.map(o => o.ar).filter(Boolean)
    );
  };

  return (
    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Options</Typography>
      <Stack spacing={1}>
        {localOptions.map((opt, idx) => (
          <Grid container spacing={1} key={idx} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                size="small"
                fullWidth
                label="Option (English)"
                value={opt.en}
                onChange={(e) => updateOption(idx, 'en', e.target.value)}
                placeholder="Option name"
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                size="small"
                fullWidth
                label="Option (Arabic)"
                value={opt.ar}
                onChange={(e) => updateOption(idx, 'ar', e.target.value)}
                placeholder="اسم الخيار"
              />
            </Grid>
            <Grid item xs={12} sm={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <IconButton size="small" color="error" onClick={() => removeOption(idx)}>
                <CloseCircle size={16} />
              </IconButton>
            </Grid>
          </Grid>
        ))}
        <Button
          size="small"
          startIcon={<Add size={16} />}
          onClick={addOption}
          variant="outlined"
        >
          Add Option
        </Button>
      </Stack>
    </Paper>
  );
}

// View Template Dialog
// Placed after main component to keep file flat; leverages same MUI Dialog
// Renders when viewTemplate is set
