'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';

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
  questions: Array<{ id?: string; label: string; type: string; required?: boolean }>;
  createdAt?: string;
};

export default function FormsPage() {
  const workspaceId = useAppSelector((s) => s.workspace.id);

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
  const [defaultQuestions, setDefaultQuestions] = useState<
    Array<{ id: string; label: string; type: string; required?: boolean; options?: string[] }>
  >([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [newQuestions, setNewQuestions] = useState<
    Array<{ id: string; label: string; type: string; required?: boolean; options?: string[] }>
  >([]);
  const [creating, setCreating] = useState(false);
  // custom question builder
  const [customType, setCustomType] = useState<string>('text');
  const [customLabel, setCustomLabel] = useState<string>('');
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
              type: q.type || 'text',
              required: !!q.required,
              options: q.options
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
      const questions = newQuestions.map(({ id, label, type, required, options }) => ({ id, question: label, type, required, options }));
      console.log('createTemplate - sending request with:', { title: title.trim(), questions });
      await api.post('/api/forms/templates', { title: title.trim(), questions }, { headers: { 'x-workspace-id': effectiveWorkspaceId } });
      console.log('createTemplate - request successful');
      setShowCreate(false);
      setTitle('');
      setNewQuestions([]);
      setCustomType('text');
      setCustomLabel('');
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
        <DialogTitle>New Form Template</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField fullWidth label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

            {/* Fixed (default) questions list */}
            {defaultQuestions.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Fixed questions
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {defaultQuestions.map((q) => (
                    <Chip
                      key={q.id}
                      label={q.label}
                      onClick={() => setNewQuestions((prev) => [...prev, { ...q, id: `${q.id}_${Date.now()}` }])}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Added questions preview */}
            {newQuestions.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Questions
                </Typography>
                <List dense>
                  {newQuestions.map((q, idx) => (
                    <ListItem key={q.id} divider>
                      <ListItemText
                        primary={`${q.label}`}
                        secondary={`${q.type}${q.required ? ' • required' : ''}${q.options?.length ? ` • options: ${q.options.join(', ')}` : ''}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => setNewQuestions((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Custom question builder */}
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Add custom question
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel id="q-type-label">Type</InputLabel>
                    <Select labelId="q-type-label" label="Type" value={customType} onChange={(e) => setCustomType(e.target.value)}>
                      <MenuItem value="text">Text</MenuItem>
                      <MenuItem value="textarea">Textarea</MenuItem>
                      <MenuItem value="number">Number</MenuItem>
                      <MenuItem value="select">Select</MenuItem>
                      <MenuItem value="checkbox">Checkbox</MenuItem>
                      <MenuItem value="radio">Radio</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField fullWidth label="Question label" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                </Grid>
                {(customType === 'select' || customType === 'radio' || customType === 'checkbox') && (
                  <Grid size={12}>
                    <TextField
                      fullWidth
                      label="Options (comma separated)"
                      value={customOptions}
                      onChange={(e) => setCustomOptions(e.target.value)}
                    />
                  </Grid>
                )}
                <Grid size={12}>
                  <Stack direction="row" spacing={1}>
                    <FormControlLabel
                      control={<Switch checked={customRequired} onChange={(e) => setCustomRequired(e.target.checked)} />}
                      label="Required"
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setCustomError('');
                        if (!customLabel.trim()) {
                          setCustomError('Question label is required');
                          return;
                        }
                        if (customType === 'select' || customType === 'radio' || customType === 'checkbox') {
                          const count = customOptions
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean).length;
                          if (count < 2) {
                            setCustomError('Provide at least two options, separated by commas');
                            return;
                          }
                        }
                        const options = customOptions
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        setNewQuestions((prev) => [
                          ...prev,
                          {
                            id: `cq_${Date.now()}`,
                            label: customLabel.trim(),
                            type: customType,
                            required: customRequired,
                            options: options.length ? options : undefined
                          }
                        ]);
                        setCustomLabel('');
                        setCustomOptions('');
                        setCustomType('text');
                        setCustomRequired(false);
                      }}
                    >
                      Add Question
                    </Button>
                  </Stack>
                  {customError && (
                    <Typography color="error" sx={{ mt: 1 }}>
                      {customError}
                    </Typography>
                  )}
                </Grid>
              </Grid>
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
                <CardHeader title={t.title} subheader={t.createdAt ? new Date(t.createdAt).toLocaleString() : undefined} />
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Questions: {Array.isArray(t.questions) ? t.questions.length : 0}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => setViewTemplate(t)}>
                      Open
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
    </Box>
  );
}

// View Template Dialog
// Placed after main component to keep file flat; leverages same MUI Dialog
// Renders when viewTemplate is set
