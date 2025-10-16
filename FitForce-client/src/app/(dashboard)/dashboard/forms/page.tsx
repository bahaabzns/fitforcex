'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';
import { FormattedMessage, useIntl } from 'react-intl';

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
import { Trash } from '@wandersonalwes/iconsax-react';

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
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [viewTemplate, setViewTemplate] = useState<FormTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<FormTemplate | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTitleArabic, setEditTitleArabic] = useState('');
  const [editFormType, setEditFormType] = useState<'nutrition' | 'workout'>('nutrition');
  const [editQuestions, setEditQuestions] = useState<Array<{ id: string; originalId?: string; label: string; labelArabic?: string; type: string; required?: boolean; options?: string[]; optionsArabic?: string[] }>>([]);
  // Add-question builder for edit dialog
  const [editCustomType, setEditCustomType] = useState<string>('text');
  const [editCustomLabel, setEditCustomLabel] = useState<string>('');
  const [editCustomLabelArabic, setEditCustomLabelArabic] = useState<string>('');
  const [editCustomRequired, setEditCustomRequired] = useState<boolean>(false);
  const [editCustomOptions, setEditCustomOptions] = useState<string>('');
  const [editCustomError, setEditCustomError] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  // Separate selection for assignment so selecting in the assign UI does not open the view dialog
  const [assignTemplateId, setAssignTemplateId] = useState<string>('');
  const [assignClientId, setAssignClientId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>('');
  const [clients, setClients] = useState<Array<{ id: string; fullName: string; email?: string }>>([]);
  const [defaultQuestions, setDefaultQuestions] = useState<
    Array<{ id: string; label: string; type: string; required?: boolean; options?: string[] }>
  >([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formType, setFormType] = useState<'nutrition' | 'workout'>('nutrition');
  const [title, setTitle] = useState('');
  const [titleArabic, setTitleArabic] = useState('');
  const [newQuestions, setNewQuestions] = useState<
    Array<{ id: string; originalId?: string; label: string; labelArabic?: string; type: string; required?: boolean; options?: string[]; optionsArabic?: string[] }>
  >([]);
  const [creating, setCreating] = useState(false);
  // custom question builder
  const [customType, setCustomType] = useState<string>('text');
  const [customLabel, setCustomLabel] = useState<string>('');
  const [customLabelArabic, setCustomLabelArabic] = useState<string>('');
  const [customRequired, setCustomRequired] = useState<boolean>(false);
  const [customOptions, setCustomOptions] = useState<string>('');
  const [customError, setCustomError] = useState<string>('');

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
      } catch {
        setError('Failed to load forms');
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [effectiveWorkspaceId]);

  // Load clients for dropdown
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get('/api/clients');
        setClients(Array.isArray(res.data?.clients) ? res.data.clients : []);
      } catch {}
    };
    fetchClients();
  }, [effectiveWorkspaceId]);

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
      const questions = newQuestions.map(({ id, label, labelArabic, type, required, options, optionsArabic }) => ({ id, name: label, nameArabic: labelArabic, question: label, questionArabic: labelArabic, type, required, options, optionsArabic }));
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

  const updateTemplate = async () => {
    if (!editTemplate) return;
    if (!editTitle.trim()) return;
    setUpdating(true);
    setError(null);
    try {
      const questions = editQuestions.map(({ id, label, labelArabic, type, required, options, optionsArabic, originalId }) => ({ id: originalId || id, name: label, nameArabic: labelArabic, question: label, questionArabic: labelArabic, type, required, options, optionsArabic }));
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

      {error && <Alert severity="error">{error}</Alert>}

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
                      label={q.label}
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

            {/* Added questions - editable */}
            {newQuestions.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Questions
                </Typography>
                <Stack spacing={1}>
                  {newQuestions.map((q, idx) => (
                    <Box key={q.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Grid container spacing={1}>
                        {/* Row 1: Type + Required */}
                        <Grid item xs={12} sm={8} md={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel id={`qtype-${q.id}`}>Type</InputLabel>
                            <Select
                              labelId={`qtype-${q.id}`}
                              label="Type"
                              value={q.type}
                              onChange={(e) => {
                                const val = String(e.target.value);
                                setNewQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, type: val, options: ['select','checkbox','radio'].includes(val) ? (x.options||[]) : undefined } : x));
                              }}
                            >
                              <MenuItem value="text">text</MenuItem>
                              <MenuItem value="textarea">textarea</MenuItem>
                              <MenuItem value="number">number</MenuItem>
                              <MenuItem value="select">select</MenuItem>
                              <MenuItem value="checkbox">checkbox</MenuItem>
                              <MenuItem value="radio">radio</MenuItem>
                              <MenuItem value="attachment">attachment</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
                          <FormControlLabel control={<Switch size="small" checked={!!q.required} onChange={(e) => setNewQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, required: e.target.checked } : x))} />} label="Required" />
                        </Grid>

                        {/* Row 2: Label + Arabic Label */}
                        <Grid item xs={12} sm={6}>
                          <TextField size="small" fullWidth label="Label" value={q.label} onChange={(e) => setNewQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, label: e.target.value } : x))} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField size="small" fullWidth label="Label (Arabic)" value={q.labelArabic || ''} onChange={(e) => setNewQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, labelArabic: e.target.value } : x))} />
                        </Grid>

                        {/* Row 3: Options (if needed) + Delete */}
                        {['select','checkbox','radio'].includes(q.type) ? (
                          <Grid item xs={12} sm={9}>
                            <TextField size="small" fullWidth label="Options (comma separated)" value={(q.options||[]).join(', ')} onChange={(e) => setNewQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : x))} />
                          </Grid>
                        ) : (
                          <Grid item xs={12} sm={9} />
                        )}
                        <Grid item xs={12} sm={3} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <IconButton size="small" color="error" onClick={() => setNewQuestions((prev) => prev.filter((_, i) => i !== idx))}>
                            <Trash />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Stack>
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
                <Grid item xs={12} sm={3}>
                  <FormControlLabel control={<Switch checked={customRequired} onChange={(e) => setCustomRequired(e.target.checked)} />} label="Required" />
                </Grid>
                <Grid item xs={12} sm={9}>
                  <TextField fullWidth label="Options (comma separated)" value={customOptions} onChange={(e) => setCustomOptions(e.target.value)} disabled={!['select', 'checkbox', 'radio'].includes(customType)} />
                </Grid>
              </Grid>
              {customError && <Alert severity="error" sx={{ mt: 1 }}>{customError}</Alert>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    setCustomError('');
                    if (!customLabel.trim()) {
                      setCustomError('Question label is required');
                      return;
                    }
                    const opts = customOptions
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setNewQuestions((prev) => [
                      ...prev,
                      {
                        id: `q_${Date.now()}`,
                        label: customLabel.trim(),
                        labelArabic: customLabelArabic.trim() || undefined,
                        type: customType,
                        required: customRequired,
                        options: opts.length ? opts : undefined,
                      },
                    ]);
                    setCustomLabel('');
                    setCustomLabelArabic('');
                    setCustomRequired(false);
                    setCustomOptions('');
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
                <CardHeader title={t.title} subheader={[t.type ? `Type: ${t.type}` : null, t.createdAt ? new Date(t.createdAt).toLocaleString() : null].filter(Boolean).join(' • ')} />
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
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* View Template Dialog */}
      <Dialog open={!!viewTemplate} onClose={() => setViewTemplate(null)} fullWidth maxWidth="md">
        <DialogTitle>{viewTemplate?.title || 'Form'}</DialogTitle>
        <DialogContent dividers>
          {Array.isArray(viewTemplate?.questions) && viewTemplate!.questions.length > 0 ? (
            <Stack spacing={2}>
              {viewTemplate!.questions.map((q, idx) => {
                console.log('Question object:', q); // Debug log
                return (
                  <Card key={idx} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        {q.question || q.label || q.text || q.title || `Question ${idx + 1}`}
                      </Typography>
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
              </Select>
            </FormControl>

            {editQuestions.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Questions
                </Typography>
                <Stack spacing={1}>
                  {editQuestions.map((q, idx) => (
                    <Box key={q.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Grid container spacing={1}>
                        <Grid item xs={12} sm={8} md={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel id={`edit-qtype-${q.id}`}>Type</InputLabel>
                            <Select
                              labelId={`edit-qtype-${q.id}`}
                              label="Type"
                              value={q.type}
                              onChange={(e) => {
                                const val = String(e.target.value);
                                setEditQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, type: val, options: ['select','checkbox','radio'].includes(val) ? (x.options||[]) : undefined } : x));
                              }}
                            >
                              <MenuItem value="text">text</MenuItem>
                              <MenuItem value="textarea">textarea</MenuItem>
                              <MenuItem value="number">number</MenuItem>
                              <MenuItem value="select">select</MenuItem>
                              <MenuItem value="checkbox">checkbox</MenuItem>
                              <MenuItem value="radio">radio</MenuItem>
                              <MenuItem value="attachment">attachment</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
                          <FormControlLabel control={<Switch size="small" checked={!!q.required} onChange={(e) => setEditQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, required: e.target.checked } : x))} />} label="Required" />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField size="small" fullWidth label="Label" value={q.label} onChange={(e) => setEditQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, label: e.target.value } : x))} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField size="small" fullWidth label="Label (Arabic)" value={q.labelArabic || ''} onChange={(e) => setEditQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, labelArabic: e.target.value } : x))} />
                        </Grid>

                        {['select','checkbox','radio'].includes(q.type) ? (
                          <Grid item xs={12} sm={9}>
                            <TextField size="small" fullWidth label="Options (comma separated)" value={(q.options||[]).join(', ')} onChange={(e) => setEditQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : x))} />
                          </Grid>
                        ) : (
                          <Grid item xs={12} sm={9} />
                        )}
                        <Grid item xs={12} sm={3} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <IconButton size="small" color="error" onClick={() => setEditQuestions((prev) => prev.filter((_, i) => i !== idx))}>
                            <Trash />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Stack>
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
                <Grid item xs={12} sm={3}>
                  <FormControlLabel control={<Switch checked={editCustomRequired} onChange={(e) => setEditCustomRequired(e.target.checked)} />} label="Required" />
                </Grid>
                <Grid item xs={12} sm={9}>
                  <TextField fullWidth label="Options (comma separated)" value={editCustomOptions} onChange={(e) => setEditCustomOptions(e.target.value)} disabled={!['select', 'checkbox', 'radio'].includes(editCustomType)} />
                </Grid>
              </Grid>
              {editCustomError && <Alert severity="error" sx={{ mt: 1 }}>{editCustomError}</Alert>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditCustomError('');
                    if (!editCustomLabel.trim()) {
                      setEditCustomError('Question label is required');
                      return;
                    }
                    const opts = editCustomOptions
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setEditQuestions((prev) => [
                      ...prev,
                      {
                        id: `eq_${Date.now()}`,
                        label: editCustomLabel.trim(),
                        labelArabic: editCustomLabelArabic.trim() || undefined,
                        type: editCustomType,
                        required: editCustomRequired,
                        options: opts.length ? opts : undefined,
                      },
                    ]);
                    setEditCustomLabel('');
                    setEditCustomLabelArabic('');
                    setEditCustomRequired(false);
                    setEditCustomOptions('');
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

      {/* Simple send-to-client UI */}
      <Card>
        <CardHeader title="Send Form to Client" />
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
            <FormControl fullWidth>
              <InputLabel id="send-form-label">Template</InputLabel>
              <Select labelId="send-form-label" label="Template" value={assignTemplateId} onChange={(e) => setAssignTemplateId(String(e.target.value))}>
                {templates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="send-form-client-label">Client</InputLabel>
              <Select labelId="send-form-client-label" label="Client" value={assignClientId} onChange={(e) => setAssignClientId(String(e.target.value))}>
                {clients.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.fullName}{c.email ? ` • ${c.email}` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Schedule at (optional)"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="If set in the future, the form will be pending until this time"
            />
            <Button variant="contained" disabled={!assignTemplateId || !assignClientId || assigning} onClick={async () => {
              if (!assignTemplateId || !assignClientId) return;
              setAssigning(true);
              try {
                const payload: any = { formId: assignTemplateId, clientId: assignClientId };
                if (scheduleAt && !Number.isNaN(new Date(scheduleAt).getTime())) payload.scheduleAt = new Date(scheduleAt).toISOString();
                await api.post('/api/forms/send', payload);
                openSnackbar({ open: true, message: scheduleAt ? 'Form scheduled' : 'Form sent to client', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
                setAssignClientId('');
                setAssignTemplateId('');
                setScheduleAt('');
              } catch (e) {
                openSnackbar({ open: true, message: 'Failed to send form', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
              } finally {
                setAssigning(false);
              }
            }}>{assigning ? 'Sending…' : 'Send'}</Button>

            <Button variant="outlined" disabled={!assignTemplateId || !assignClientId || assigning} onClick={async () => {
              if (!assignTemplateId || !assignClientId) return;
              setAssigning(true);
              try {
                // Explicit immediate todo (ignore scheduleAt)
                await api.post('/api/forms/send', { formId: assignTemplateId, clientId: assignClientId });
                openSnackbar({ open: true, message: 'Form sent as To do', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
                setAssignClientId('');
                setAssignTemplateId('');
                setScheduleAt('');
              } catch (e) {
                openSnackbar({ open: true, message: 'Failed to send form', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
              } finally {
                setAssigning(false);
              }
            }}>Send as To do</Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

// View Template Dialog
// Placed after main component to keep file flat; leverages same MUI Dialog
// Renders when viewTemplate is set
