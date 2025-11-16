'use client';

import useSWR from 'swr';
import api from '@/utils/axios';
import { useWorkspaceBranding } from '@/hooks/useWorkspaceBranding';
import useConfig from '@/hooks/useConfig';
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
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

export default function ClientFormsPage() {
  const { logoUrl, primaryColor, workspaceName } = useWorkspaceBranding();
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const isArabic = currentLang === 'ar';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;

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
        } else if (q.type === 'select' && typeof val === 'object' && val !== null && 'other' in val) {
          // Handle "Other" option - check if other text is provided
          if (!val.other || String(val.other).trim() === '') {
            missing.push(q.id);
          }
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

  const handleFileUpload = async (submissionId: string, questionId: string, files: File[]) => {
    const uploadKey = `${submissionId}-${questionId}`;
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }));
    
    try {
      // Get current attachments (could be single file or array)
      const currentValue = getAnswers(submissionId)[questionId];
      const currentAttachments = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
      
      // Upload all new files
      const uploadedAttachments = [];
      for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('submissionId', submissionId);
      formData.append('questionId', questionId);
      
      const response = await api.post('/api/forms/client/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
        uploadedAttachments.push(response.data.attachment);
      }
      
      // Combine existing and new attachments
      const allAttachments = [...currentAttachments, ...uploadedAttachments];
      setAnswer(submissionId, questionId, allAttachments.length === 1 ? allAttachments[0] : allAttachments);
      
      openSnackbar({
        open: true,
        message: `${files.length} file(s) uploaded successfully!`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' }
      } as any);
    } catch (error: any) {
      console.error('File upload error:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.error || 'Failed to upload file(s)',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      } as any);
    } finally {
      setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleFileRemove = (submissionId: string, questionId: string, fileIndex?: number) => {
    const currentValue = getAnswers(submissionId)[questionId];
    if (Array.isArray(currentValue)) {
      // Multiple files - remove specific file
      if (fileIndex !== undefined) {
        const updated = currentValue.filter((_, i) => i !== fileIndex);
        setAnswer(submissionId, questionId, updated.length === 0 ? null : (updated.length === 1 ? updated[0] : updated));
      } else {
        setAnswer(submissionId, questionId, null);
      }
    } else {
      // Single file
    setAnswer(submissionId, questionId, null);
    }
  };

  if (isLoading || loadingArchived) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, minHeight: '60vh' }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} />
          <Typography color="text.secondary" variant="h6">{t('client.forms.loading')}</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {t('client.forms.error')}
        </Alert>
      </Box>
    );
  }

  const submissions = data?.submissions || [];
  const archivedSubmissions = archived?.submissions || [];

  const renderQuestion = (q: any, idx: number, s: any) => {
    const qid = q.id || `q_${idx}`;
    // Use Arabic label if available and user is in Arabic mode
    const label = isArabic 
      ? (q.questionArabic || q.labelArabic || q.question || q.label || `Question ${idx + 1}`)
      : (q.question || q.label || q.questionArabic || q.labelArabic || `Question ${idx + 1}`);
    // Use Arabic description if available and user is in Arabic mode
    const description = isArabic 
      ? (q.descriptionArabic || q.description) 
      : (q.description || q.descriptionArabic);
    // Use Arabic placeholder if available and user is in Arabic mode
    const placeholder = isArabic 
      ? (q.placeholderArabic || q.placeholder || '')
      : (q.placeholder || q.placeholderArabic || '');
    const required = !!q.required;
    const qtype = q.type || 'text';
    const options = Array.isArray(q.options) ? q.options : [];
    const value = getAnswers(s.id)[qid];
    
    // Enhanced question header component
    const QuestionHeader = () => (
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          py: 2,
          px: 1,
          mb: 2,
          borderBottom: '2px solid',
          borderColor: 'divider',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 700,
            mb: description ? 1 : 0,
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            lineHeight: 1.4,
            color: 'text.primary',
            wordBreak: 'break-word',
          }}
        >
          {label}
          {required && (
            <Typography 
              component="span" 
              sx={{ 
                color: 'error.main', 
                ml: 0.5,
                fontSize: 'inherit',
              }}
            >
              *
            </Typography>
          )}
        </Typography>
        {description && (
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              fontSize: { xs: '0.9rem', sm: '1rem' },
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              mt: 0.5,
            }}
          >
            {description}
          </Typography>
        )}
      </Box>
    );
    
    switch (qtype) {
      case 'textarea':
        return (
          <Box key={qid} sx={{ mb: 4 }}>
            <QuestionHeader />
            <TextField 
              fullWidth 
              placeholder={placeholder || (isArabic ? 'أدخل إجابتك هنا' : 'Enter your answer here')}
              required={required} 
              value={value || ''} 
              onChange={(e) => setAnswer(s.id, qid, e.target.value)} 
              multiline 
              minRows={3}
              variant="outlined"
            />
          </Box>
        );
      case 'number':
        return (
          <Box key={qid} sx={{ mb: 4 }}>
            <QuestionHeader />
            <TextField 
              fullWidth 
              type="number" 
              placeholder={placeholder || (isArabic ? 'أدخل الرقم' : 'Enter number')}
              required={required} 
              value={value ?? ''} 
              onChange={(e) => setAnswer(s.id, qid, e.target.value)}
              variant="outlined"
            />
          </Box>
        );
      case 'date':
        return (
          <Box key={qid} sx={{ mb: 4 }}>
            <QuestionHeader />
            <TextField 
              fullWidth 
              type="date" 
              placeholder={placeholder}
              required={required} 
              value={value || ''} 
              onChange={(e) => setAnswer(s.id, qid, e.target.value)}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        );
      case 'select':
        const selectOptions = Array.isArray(q.options) ? q.options : [];
        const selectOptionsArabic = Array.isArray(q.optionsArabic) ? q.optionsArabic : [];
        const allowOther = q.allowOther || false;
        const isOtherSelected = typeof value === 'object' && value !== null && 'other' in value;
        const otherValue = isOtherSelected ? (value as any).other : '';
        const selectValue = isOtherSelected ? '__other__' : (typeof value === 'string' ? value : '');
        
        return (
          <Box key={qid} sx={{ mb: 4 }}>
            <QuestionHeader />
            <FormControl fullWidth variant="outlined">
            <InputLabel id={`sel-${qid}`}>{isArabic ? 'اختر خياراً' : 'Select an option'}</InputLabel>
            <Select 
              labelId={`sel-${qid}`} 
              label={isArabic ? 'اختر خياراً' : 'Select an option'}
              value={selectValue} 
              onChange={(e) => {
                if (e.target.value === '__other__') {
                  setAnswer(s.id, qid, { other: '' });
                } else {
                  setAnswer(s.id, qid, e.target.value);
                }
              }}
            >
                <MenuItem value=""><em>{isArabic ? 'اختر خياراً' : 'Select an option'}</em></MenuItem>
                {selectOptions.map((opt: string, i: number) => {
                  const optAr = selectOptionsArabic[i] || '';
                  // Show Arabic option if available, otherwise show English
                  const displayText = isArabic && optAr ? optAr : opt;
                  return (
                    <MenuItem key={i} value={opt}>{displayText}</MenuItem>
                  );
                })}
                {allowOther && (
                  <MenuItem value="__other__">
                    {isArabic ? 'أخرى' : 'Other'}
                  </MenuItem>
                )}
            </Select>
          </FormControl>
          {isOtherSelected && (
            <TextField
              fullWidth
              variant="outlined"
              label={isArabic ? 'يرجى تحديد الإجابة' : 'Please specify'}
              value={otherValue}
              onChange={(e) => setAnswer(s.id, qid, { other: e.target.value })}
              sx={{ mt: 2 }}
              required={required}
            />
          )}
          </Box>
        );
      case 'radio':
        const radioOptions = Array.isArray(q.options) ? q.options : [];
        const radioOptionsArabic = Array.isArray(q.optionsArabic) ? q.optionsArabic : [];
        return (
          <Box key={qid} sx={{ mb: 4 }}>
            <QuestionHeader />
            <FormControl component="fieldset" fullWidth>
            <RadioGroup value={value ?? ''} onChange={(e) => setAnswer(s.id, qid, e.target.value)}>
              {radioOptions.map((opt: string, i: number) => {
                const optAr = radioOptionsArabic[i] || '';
                // Show Arabic option if available, otherwise show English
                const displayText = isArabic && optAr ? optAr : opt;
                return (
                  <FormControlLabel key={i} value={opt} control={<Radio />} label={displayText} />
                );
              })}
            </RadioGroup>
          </FormControl>
          </Box>
        );
      case 'checkbox':
        const checkboxOptions = Array.isArray(q.options) ? q.options : [];
        const checkboxOptionsArabic = Array.isArray(q.optionsArabic) ? q.optionsArabic : [];
        return (
          <Box key={qid} sx={{ mb: 4 }}>
            <QuestionHeader />
            <FormGroup>
            {checkboxOptions.map((opt: string, i: number) => {
              const arr = Array.isArray(value) ? value : [];
              const checked = arr.includes(opt);
              const optAr = checkboxOptionsArabic[i] || '';
              // Show Arabic option if available, otherwise show English
              const displayText = isArabic && optAr ? optAr : opt;
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
                  label={displayText} 
                />
              );
            })}
          </FormGroup>
          </Box>
        );
      case 'attachment':
        const uploadKey = `${s.id}-${qid}`;
        const isUploading = uploadingFiles[uploadKey];
        const attachments = Array.isArray(value) ? value : (value ? [value] : []);
        
        return (
          <Box key={qid} sx={{ width: '100%', mb: 4 }}>
            <QuestionHeader />
            
            {attachments.length > 0 && (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {attachments.map((attachment: any, fileIdx: number) => (
              <Paper 
                    key={fileIdx}
                elevation={1} 
                sx={{ 
                  p: 2, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'success.dark' : 'success.light',
                  color: (theme) => theme.palette.mode === 'dark' ? 'success.contrastText' : 'success.contrastText'
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
                      onClick={() => handleFileRemove(s.id, qid, fileIdx)}
                  startIcon={<Delete />}
                >
                  Remove
                </MuiButton>
              </Paper>
                ))}
              </Stack>
            )}
            
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 3, 
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                  color: 'primary.contrastText',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'primary.main',
                  }
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                input.multiple = true; // Allow multiple files
                input.accept = 'image/*,video/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx';
                  input.onchange = (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []);
                  if (files.length > 0) {
                    handleFileUpload(s.id, qid, files);
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
                    Click to upload file(s)
                    </Typography>
                    <Typography variant="caption">
                    Images, Videos, PDFs, Documents (max 10MB per file)
                  </Typography>
                  {attachments.length > 0 && (
                    <Typography variant="caption" sx={{ mt: 0.5 }}>
                      {attachments.length} file(s) uploaded
                    </Typography>
                  )}
                  </Stack>
                )}
              </Paper>
          </Box>
        );
      case 'text':
      default:
        return (
          <Box key={qid} sx={{ mb: 4 }}>
            <QuestionHeader />
            <TextField 
              fullWidth 
              placeholder={placeholder || (isArabic ? 'أدخل إجابتك هنا' : 'Enter your answer here')}
              required={required} 
              value={value || ''} 
              onChange={(e) => setAnswer(s.id, qid, e.target.value)}
              variant="outlined"
            />
          </Box>
        );
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}CC 100%)`,
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              <Assignment sx={{ fontSize: 32 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={700}>{t('client.forms.title')}</Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
                {t('client.forms.subtitle')}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2}>
            <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)' }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('client.forms.pending')}</Typography>
              <Typography variant="h5" fontWeight={700}>{submissions.length}</Typography>
            </Paper>
            <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)' }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('client.forms.completed')}</Typography>
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
              label={`${t('client.forms.todo')} (${submissions.length})`}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab 
              icon={<Archive />}
              iconPosition="start"
              label={`${t('client.forms.completed')} (${archivedSubmissions.length})`}
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
                {t('client.forms.allCaughtUp')}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t('client.forms.noPending')}
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
                          <Typography variant="h6" fontWeight={700}>{(isArabic && (s.form as any).titleArabic) || s.form.title}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                            <Chip size="small" label={`${qlist.length} ${t('client.forms.questions')}`} variant="outlined" />
                            {answeredCount > 0 && (
                              <Chip 
                                size="small" 
                                label={`${answeredCount}/${qlist.length} ${t('client.forms.answered')}`} 
                                color="primary"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                          {progress > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {Math.round(progress)}% {t('client.forms.complete')}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Stack>
                      <IconButton 
                        onClick={() => setExpandedId(open ? null : s.id)}
                        color="primary"
                        sx={{ 
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'action.hover' : 'primary.50',
                          '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'action.selected' : 'primary.100' }
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
                            {submittingId === s.id ? t('client.forms.submitting') : t('client.forms.submit')}
                          </MuiButton>
                          <MuiButton 
                            variant="outlined" 
                            onClick={() => setExpandedId(null)}
                            disabled={submittingId === s.id}
                            sx={{ minWidth: 120 }}
                          >
                            {t('cancel')}
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
                {t('client.forms.noCompleted')}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t('client.forms.noCompletedDesc')}
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
                      <Typography variant="h6" fontWeight={700}>{(isArabic && (s.form as any).titleArabic) || s.form.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('client.forms.submittedOn')} {s.createdAt ? new Date(s.createdAt).toLocaleString() : t('unknown-date')}
                      </Typography>
                    </Box>
                    <Chip label={t('completed')} color="success" />
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
