'use client';

import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Card, Stack, Typography, CircularProgress, Button as MuiButton, Divider, Alert, TextField, FormControl, InputLabel, Select, MenuItem, RadioGroup, Radio, FormControlLabel, FormGroup, Checkbox, Tabs, Tab } from '@mui/material';
import { openSnackbar } from '@/api/snackbar';
import { useState } from 'react';

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
      setSubmitSuccess('Form submitted');
      openSnackbar({ open: true, message: 'Form submitted', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
      setExpandedId(null);
      mutate();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to submit form';
      setSubmitError(msg);
      openSnackbar({ open: true, message: msg, variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
    } finally {
      setSubmittingId(null);
    }
  };

  if (isLoading || loadingArchived) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading your forms…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Card>
        <Box sx={{ p: 2 }}>
          <Alert severity="error">Failed to load forms</Alert>
        </Box>
      </Card>
    );
  }

  const submissions = data?.submissions || [];

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>Your Forms</Typography>
      <Card sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={`To do (${(data?.submissions || []).length})`} />
            <Tab label={`Archived (${(archived?.submissions || []).length})`} />
          </Tabs>
        </Box>
      </Card>
      {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
      {submitSuccess && <Alert severity="success" sx={{ mb: 2 }}>{submitSuccess}</Alert>}
      {tab === 0 && (submissions.length === 0 ? (
        <Card>
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">No forms pending.</Typography>
          </Box>
        </Card>
      ) : (
        <Stack spacing={2}>
          {submissions.map((s) => {
            const open = expandedId === s.id;
            const qlist = Array.isArray(s.form.questions) ? s.form.questions : [];
            const ans = getAnswers(s.id);
            return (
              <Card key={s.id}>
                <Box sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">{s.form.title}</Typography>
                      <Typography variant="body2" color="text.secondary">Questions: {qlist.length}</Typography>
                    </Box>
                    <MuiButton variant="outlined" onClick={() => setExpandedId(open ? null : s.id)}>
                      {open ? 'Close' : 'Open'}
                    </MuiButton>
                  </Stack>
                  {open && (
                    <Box sx={{ mt: 2 }}>
                      <Stack spacing={2}>
                        {qlist.map((q: any, idx: number) => {
                          const qid = q.id || `q_${idx}`;
                          const label = q.question || q.label || `Question ${idx + 1}`;
                          const required = !!q.required;
                          const qtype = q.type || 'text';
                          const options = Array.isArray(q.options) ? q.options : [];
                          const value = ans[qid];
                          switch (qtype) {
                            case 'textarea':
                              return (
                                <TextField key={qid} fullWidth label={label} required={required} value={value || ''} onChange={(e) => setAnswer(s.id, qid, e.target.value)} multiline minRows={3} />
                              );
                            case 'number':
                              return (
                                <TextField key={qid} fullWidth type="number" label={label} required={required} value={value ?? ''} onChange={(e) => setAnswer(s.id, qid, e.target.value)} />
                              );
                            case 'select':
                              return (
                                <FormControl key={qid} fullWidth>
                                  <InputLabel id={`sel-${qid}`}>{label}{required ? ' *' : ''}</InputLabel>
                                  <Select labelId={`sel-${qid}`} label={label} value={value ?? ''} onChange={(e) => setAnswer(s.id, qid, e.target.value)}>
                                    {options.map((opt: string, i: number) => (
                                      <MenuItem key={i} value={opt}>{opt}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              );
                            case 'radio':
                              return (
                                <FormControl key={qid}>
                                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
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
                                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                    {label}{required ? ' *' : ''}
                                  </Typography>
                                  {options.map((opt: string, i: number) => {
                                    const arr = Array.isArray(value) ? value : [];
                                    const checked = arr.includes(opt);
                                    return (
                                      <FormControlLabel key={i} control={<Checkbox checked={checked} onChange={(e) => {
                                        const next = new Set(arr);
                                        if (e.target.checked) next.add(opt); else next.delete(opt);
                                        setAnswer(s.id, qid, Array.from(next));
                                      }} />} label={opt} />
                                    );
                                  })}
                                </FormGroup>
                              );
                            case 'text':
                            default:
                              return (
                                <TextField key={qid} fullWidth label={label} required={required} value={value || ''} onChange={(e) => setAnswer(s.id, qid, e.target.value)} />
                              );
                          }
                        })}
                        <Stack direction="row" spacing={1}>
                          <MuiButton variant="contained" onClick={() => handleSubmit(s.id)} disabled={submittingId === s.id}>
                            {submittingId === s.id ? 'Submitting…' : 'Submit'}
                          </MuiButton>
                          <MuiButton variant="text" onClick={() => setExpandedId(null)}>Cancel</MuiButton>
                        </Stack>
                      </Stack>
                    </Box>
                  )}
                </Box>
              </Card>
            );
          })}
        </Stack>
      ))}

      {tab === 1 && (
        (archived?.submissions || []).length === 0 ? (
          <Card>
            <Box sx={{ p: 3 }}>
              <Typography color="text.secondary">No archived forms.</Typography>
            </Box>
          </Card>
        ) : (
          <Stack spacing={2}>
            {(archived?.submissions || []).map((s) => (
              <Card key={s.id}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6">{s.form.title}</Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" color="text.secondary">Submitted {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</Typography>
                </Box>
              </Card>
            ))}
          </Stack>
        )
      )}
    </Box>
  );
}


