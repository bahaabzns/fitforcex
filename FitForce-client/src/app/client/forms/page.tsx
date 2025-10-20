'use client';

import useSWR from 'swr';
import api from '@/utils/axios';
import { 
  Box, 
  Card, 
  Stack, 
  Typography, 
  CircularProgress, 
  Button as MuiButton, 
  Divider, 
  Alert, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  RadioGroup, 
  Radio, 
  FormControlLabel, 
  FormGroup, 
  Checkbox, 
  Tabs, 
  Tab,
  Paper,
  Collapse,
  IconButton,
  Chip,
  Avatar,
  LinearProgress
} from '@mui/material';
import { openSnackbar } from '@/api/snackbar';
import { useState } from 'react';
import { 
  Assignment,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Schedule,
  Send,
  Archive,
  AttachFile,
  Delete,
  CloudUpload
} from '@mui/icons-material';

export default function ClientFormsPage() {
  const { data, isLoading, error, mutate } = useSWR('client-todo-forms', async () => {
    const res = await api.get('/api/forms/client/todo');
    return res.data as { submissions: Array<{ id: string; form: { id: string; title: string; questions: any[] } }> };
  });

  const { data: archived, isLoading: loadingArchived } = useSWR('client-archived-forms', async () => {
    const res = await api.get('/api/forms/client/archived');
    return res.data as { submissions: Array<{ id: string; form: { id: string; title: string; questions: any[] }; answers?: any; createdAt?: string }> };
  });

  const [tab, setTab] = useState(0);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answersBySubmission, setAnswersBySubmission] = useState<Record<string, Record<string, any>>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

  const getAnswers = (submissionId: string) => answersBySubmission[submissionId] || {};
  const setAnswer = (submissionId: string, questionId: string, value: any) => {
    setAnswersBySubmission((prev) => ({
      ...prev,
      [submissionId]: { ...(prev[submissionId] || {}), [questionId]: value }
    }));
  };

  const validateRequired = (submission: { id: string; form: { questions: any[] } }) => {
    const a = getAnswers(submission.id);
    const missing: string[] = [];
    (submission.form.questions || []).forEach((q: any) => {
      if (q.required) {
        const val = a[q.id];
        if (q.type === 'checkbox') {
          if (!Array.isArray(val) || val.length === 0) missing.push(q.id);
        } else if (val === undefined || val === null || String(val).trim() === '') {
          missing.push(q.id);
        }
      }
    });
    return missing;
  };

  const handleSubmit = async (submissionId: string) => {
    setSubmittingId(submissionId);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const submission = (data?.submissions || []).find((s) => s.id === submissionId);
      if (!submission) return;
      const missing = validateRequired(submission as any);
      if (missing.length > 0) {
        const msg = 'Please answer all required questions';
        setSubmitError(msg);
        openSnackbar({ open: true, message: msg, variant: 'alert', alert: { color: 'warning', variant: 'filled' } } as any);
        setSubmittingId(null);
        return;
      }
      const answers = getAnswers(submissionId);
      await api.post('/api/forms/client/submit', { submissionId, answers });
      setSubmitSuccess('Form submitted successfully!');
      openSnackbar({ open: true, message: 'Form submitted successfully!', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
      setExpandedId(null);
      setAnswersBySubmission((prev) => {
        const next = { ...prev };
        delete next[submissionId];
        return next;
      });
      mutate();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to submit form';
      setSubmitError(msg);
      openSnackbar({ open: true, message: msg, variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleFileUpload = async (submissionId: string, questionId: string, file: File) => {
    const uploadKey = `${submissionId}-${questionId}`;
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }));
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('submissionId', submissionId);
      formData.append('questionId', questionId);
      
      const response = await api.post('/api/forms/client/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const attachment = response.data.attachment;
      setAnswer(submissionId, questionId, attachment);
      
      openSnackbar({
        open: true,
        message: 'File uploaded successfully!',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' }
      } as any);
    } catch (error: any) {
      console.error('File upload error:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.error || 'Failed to upload file',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      } as any);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleFileRemove = (submissionId: string, questionId: string) => {
    setAnswer(submissionId, questionId, null);
  };

  if (isLoading || loadingArchived) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, minHeight: '60vh' }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} />
          <Typography color="text.secondary" variant="h6">Loading your forms…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Failed to load forms. Please try again later.
        </Alert>
      </Box>
    );
  }

  const submissions = data?.submissions || [];
  const archivedSubmissions = archived?.submissions || [];

  const renderQuestion = (q: any, idx: number, s: any) => {
    const qid = q.id || `q_${idx}`;
    const label = q.question || q.label || `Question ${idx + 1}`;
    const required = !!q.required;
    const qtype = q.type || 'text';
    const options = Array.isArray(q.options) ? q.options : [];
    const value = getAnswers(s.id)[qid];
    
    switch (qtype) {
      case 'textarea':
        return (
          <TextField 
            key={qid} 
            fullWidth 
            label={label} 
            required={required} 
            value={value || ''} 
            onChange={(e) => setAnswer(s.id, qid, e.target.value)} 
            multiline 
            minRows={3}
            variant="outlined"
          />
        );
      case 'number':
        return (
          <TextField 
            key={qid} 
            fullWidth 
            type="number" 
            label={label} 
            required={required} 
            value={value ?? ''} 
            onChange={(e) => setAnswer(s.id, qid, e.target.value)}
            variant="outlined"
          />
        );
      case 'select':
        return (
          <FormControl key={qid} fullWidth variant="outlined">
            <InputLabel id={`sel-${qid}`}>{label}{required ? ' *' : ''}</InputLabel>
            <Select 
              labelId={`sel-${qid}`} 
              label={label} 
              value={value ?? ''} 
              onChange={(e) => setAnswer(s.id, qid, e.target.value)}
            >
              <MenuItem value=""><em>Select an option</em></MenuItem>
              {options.map((opt: string, i: number) => (
                <MenuItem key={i} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'radio':
        return (
          <FormControl key={qid} component="fieldset">
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              {label}{required ? ' *' : ''}
            </Typography>
            <RadioGroup value={value ?? ''} onChange={(e) => setAnswer(s.id, qid, e.target.value)}>
              {options.map((opt: string, i: number) => (
                <FormControlLabel key={i} value={opt} control={<Radio />} label={opt} />
              ))}
            </RadioGroup>
          </FormControl>
        );
      case 'checkbox':
        return (
          <FormGroup key={qid}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              {label}{required ? ' *' : ''}
            </Typography>
            {options.map((opt: string, i: number) => {
              const arr = Array.isArray(value) ? value : [];
              const checked = arr.includes(opt);
              return (
                <FormControlLabel 
                  key={i} 
                  control={
                    <Checkbox 
                      checked={checked} 
                      onChange={(e) => {
                        const next = new Set(arr);
                        if (e.target.checked) next.add(opt); else next.delete(opt);
                        setAnswer(s.id, qid, Array.from(next));
                      }} 
                    />
                  } 
                  label={opt} 
                />
              );
            })}
          </FormGroup>
        );
      case 'attachment':
        const uploadKey = `${s.id}-${qid}`;
        const isUploading = uploadingFiles[uploadKey];
        const attachment = value;
        
        return (
          <Box key={qid} sx={{ width: '100%' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              {label}{required ? ' *' : ''}
            </Typography>
            
            {attachment ? (
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 2, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  bgcolor: 'success.light',
                  color: 'success.contrastText'
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <AttachFile />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {attachment.originalName}
                    </Typography>
                    <Typography variant="caption">
                      {(attachment.size / 1024).toFixed(1)} KB
                    </Typography>
                  </Box>
                </Stack>
                <MuiButton
                  size="small"
                  color="inherit"
                  onClick={() => handleFileRemove(s.id, qid)}
                  startIcon={<Delete />}
                >
                  Remove
                </MuiButton>
              </Paper>
            ) : (
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 3, 
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'primary.main',
                  }
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      handleFileUpload(s.id, qid, file);
                    }
                  };
                  input.click();
                }}
              >
                {isUploading ? (
                  <Stack alignItems="center" spacing={1}>
                    <CircularProgress size={24} />
                    <Typography variant="body2">Uploading...</Typography>
                  </Stack>
                ) : (
                  <Stack alignItems="center" spacing={1}>
                    <CloudUpload sx={{ fontSize: 32 }} />
                    <Typography variant="body2" fontWeight={600}>
                      Click to upload file
                    </Typography>
                    <Typography variant="caption">
                      Images, PDFs, Documents (max 10MB)
                    </Typography>
                  </Stack>
                )}
              </Paper>
            )}
          </Box>
        );
      case 'text':
      default:
        return (
          <TextField 
            key={qid} 
            fullWidth 
            label={label} 
            required={required} 
            value={value || ''} 
            onChange={(e) => setAnswer(s.id, qid, e.target.value)}
            variant="outlined"
          />
        );
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              <Assignment sx={{ fontSize: 32 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700}>Your Forms</Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
                Complete forms to help your trainer customize your program
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2}>
            <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)' }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Pending</Typography>
              <Typography variant="h5" fontWeight={700}>{submissions.length}</Typography>
            </Paper>
            <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)' }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Completed</Typography>
              <Typography variant="h5" fontWeight={700}>{archivedSubmissions.length}</Typography>
            </Paper>
          </Stack>
        </Stack>
      </Paper>

      {/* Status Messages */}
      {submitError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}
      {submitSuccess && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSubmitSuccess(null)}>
          {submitSuccess}
        </Alert>
      )}

      {/* Tabs */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tab} 
            onChange={(_, v) => setTab(v)}
            sx={{ px: 2 }}
          >
            <Tab 
              icon={<Schedule />}
              iconPosition="start"
              label={`To Do (${submissions.length})`}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab 
              icon={<Archive />}
              iconPosition="start"
              label={`Completed (${archivedSubmissions.length})`}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
          </Tabs>
        </Box>
      </Card>

      {/* Pending Forms */}
      {tab === 0 && (
        submissions.length === 0 ? (
          <Card sx={{ borderRadius: 3 }}>
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} gutterBottom>
                All Caught Up!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                You have no pending forms to complete.
              </Typography>
            </Box>
          </Card>
        ) : (
          <Stack spacing={3}>
            {submissions.map((s) => {
              const open = expandedId === s.id;
              const qlist = Array.isArray(s.form.questions) ? s.form.questions : [];
              const ans = getAnswers(s.id);
              const answeredCount = Object.keys(ans).length;
              const progress = qlist.length > 0 ? (answeredCount / qlist.length) * 100 : 0;
              
              return (
                <Card 
                  key={s.id}
                  elevation={open ? 4 : 1}
                  sx={{ 
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    border: open ? '2px solid' : '1px solid',
                    borderColor: open ? 'primary.main' : 'divider'
                  }}
                >
                  <Box sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Stack direction="row" alignItems="center" spacing={2} flex={1}>
                        <Avatar sx={{ bgcolor: 'warning.main', width: 48, height: 48 }}>
                          <Assignment />
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="h6" fontWeight={700}>{s.form.title}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                            <Chip size="small" label={`${qlist.length} Questions`} variant="outlined" />
                            {answeredCount > 0 && (
                              <Chip 
                                size="small" 
                                label={`${answeredCount}/${qlist.length} Answered`} 
                                color="primary"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                          {progress > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {Math.round(progress)}% Complete
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Stack>
                      <IconButton 
                        onClick={() => setExpandedId(open ? null : s.id)}
                        color="primary"
                        sx={{ 
                          bgcolor: 'primary.50',
                          '&:hover': { bgcolor: 'primary.100' }
                        }}
                      >
                        {open ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Stack>

                    <Collapse in={open} timeout="auto">
                      <Box sx={{ mt: 3 }}>
                        <Divider sx={{ mb: 3 }} />
                        <Stack spacing={3}>
                          {qlist.map((q: any, idx: number) => renderQuestion(q, idx, s))}
                        </Stack>
                        <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
                          <MuiButton 
                            variant="contained" 
                            size="large"
                            onClick={() => handleSubmit(s.id)} 
                            disabled={submittingId === s.id}
                            startIcon={submittingId === s.id ? <CircularProgress size={20} /> : <Send />}
                            fullWidth
                          >
                            {submittingId === s.id ? 'Submitting…' : 'Submit Form'}
                          </MuiButton>
                          <MuiButton 
                            variant="outlined" 
                            onClick={() => setExpandedId(null)}
                            disabled={submittingId === s.id}
                            sx={{ minWidth: 120 }}
                          >
                            Cancel
                          </MuiButton>
                        </Stack>
                      </Box>
                    </Collapse>
                  </Box>
                </Card>
              );
            })}
          </Stack>
        )
      )}

      {/* Archived Forms */}
      {tab === 1 && (
        archivedSubmissions.length === 0 ? (
          <Card sx={{ borderRadius: 3 }}>
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Archive sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} gutterBottom>
                No Completed Forms
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Forms you complete will appear here.
              </Typography>
            </Box>
          </Card>
        ) : (
          <Stack spacing={2}>
            {archivedSubmissions.map((s) => (
              <Card key={s.id} sx={{ borderRadius: 3 }}>
                <Box sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar sx={{ bgcolor: 'success.main', width: 48, height: 48 }}>
                      <CheckCircle />
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" fontWeight={700}>{s.form.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Submitted on {s.createdAt ? new Date(s.createdAt).toLocaleString() : 'Unknown date'}
                      </Typography>
                    </Box>
                    <Chip label="Completed" color="success" />
                  </Stack>
                </Box>
              </Card>
            ))}
          </Stack>
        )
      )}
    </Box>
  );
}
