'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/utils/axios';
import ResponsiveTable from '@/components/ResponsiveTable';

// MUI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Grid';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

type QueueStatus = 'pending' | 'sent' | 'completed' | 'archived';

interface QueueItem {
  id: string;
  clientId?: string;
  clientName: string;
  formTitle: string;
  formType?: 'nutrition' | 'workout' | string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  status: QueueStatus;
}

function statusColor(s: QueueStatus) {
  switch (s) {
    case 'pending':
      return 'warning';
    case 'sent':
      return 'info';
    case 'completed':
      return 'success';
    case 'archived':
      return 'default';
    default:
      return 'default';
  }
}

function statusLabel(s: QueueStatus) {
  switch (s) {
    case 'pending':
      return 'Scheduless';
    case 'sent':
      return 'Form Requests';
    case 'completed':
      return 'Form Submissions';
    case 'archived':
      return 'Done';
    default:
      return s;
  }
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all');
  const [tab, setTab] = useState<number>(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewSubmission, setViewSubmission] = useState<any | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/forms/queue');
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch {
        setError('Failed to load queue');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const counts = useMemo(() => {
    return {
      all: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      sent: items.filter((i) => i.status === 'sent').length,
      completed: items.filter((i) => i.status === 'completed').length,
      archived: items.filter((i) => i.status === 'archived').length
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const byStatus = statusFilter === 'all' ? true : it.status === statusFilter;
      const byText = !q
        ? true
        : it.clientName.toLowerCase().includes(q) || it.formTitle.toLowerCase().includes(q);
      return byStatus && byText;
    });
  }, [items, search, statusFilter]);

  const openView = async (id: string) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewError(null);
    setViewSubmission(null);
    try {
      const res = await api.get(`/api/forms/submissions/${id}`);
      setViewSubmission(res.data?.submission || null);
    } catch {
      setViewError('Failed to load submission');
    } finally {
      setViewLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading queue…</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4">Queue</Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search by client or form title"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Stack>

          {/* Status Tabs */}
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              const map = ['all', 'pending', 'sent', 'completed', 'archived'] as const;
              setStatusFilter(map[v] as QueueStatus | 'all');
            }}
            sx={{ mb: 2 }}
          >
            <Tab label={`All (${counts.all})`} />
            <Tab label={`Schedules (${counts.pending})`} />
            <Tab label={`Form Requests (${counts.sent})`} />
            <Tab label={`Form Submissions (${counts.completed})`} />
            <Tab label={`Done (${counts.archived})`} />
          </Tabs>

          {isMobile ? (
            // Mobile Cards View
            <Grid container spacing={2}>
              {filtered.map((row) => (
                <Grid item xs={12} key={row.id}>
                  <Card 
                    sx={{ 
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 4,
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <CardContent>
                      <Stack spacing={2}>
                        {/* Header with Avatar and Status */}
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {row.clientName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6">
                              {row.clientName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {row.formTitle}
                            </Typography>
                          </Box>
                          <Chip 
                            size="small" 
                            color={statusColor(row.status) as any} 
                            label={statusLabel(row.status)} 
                            variant="outlined" 
                          />
                        </Stack>

                        <Divider />

                        {/* Form Type */}
                        {row.formType && (
                          <Box>
                            <Chip 
                              size="small" 
                              label={row.formType} 
                              variant="outlined"
                              color="primary"
                            />
                          </Box>
                        )}

                        <Divider />

                        {/* Timeline Details */}
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Scheduled
                            </Typography>
                            <Typography variant="body2">
                              {row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString() : '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Sent
                            </Typography>
                            <Typography variant="body2">
                              {row.sentAt ? new Date(row.sentAt).toLocaleDateString() : '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              Completed
                            </Typography>
                            <Typography variant="body2">
                              {row.completedAt ? new Date(row.completedAt).toLocaleDateString() : '-'}
                            </Typography>
                          </Grid>
                        </Grid>

                        <Divider />

                        {/* Actions */}
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                          {row.status === 'completed' && (
                            <Button 
                              size="small" 
                              variant="outlined" 
                              onClick={() => openView(row.id)}
                            >
                              View Submission
                            </Button>
                          )}
                          {row.status === 'completed' && row.clientId && row.formType && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                const path = row.formType === 'nutrition'
                                  ? `/dashboard/clients/${row.clientId}/nutrition`
                                  : `/dashboard/clients/${row.clientId}/workout`;
                                window.location.href = path;
                              }}
                            >
                              {row.formType === 'nutrition' ? 'Create Nutrition Plan' : 'Create Workout Plan'}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {filtered.length === 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                        No queue items match your filters
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          ) : (
            // Desktop Table View
            <ResponsiveTable>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Form</TableCell>
                    <TableCell>Scheduled</TableCell>
                    <TableCell>Sent</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>
                        {row.formTitle}
                        {row.formType ? <Chip size="small" label={row.formType} sx={{ ml: 1 }} /> : null}
                      </TableCell>
                      <TableCell>{row.scheduledAt ? new Date(row.scheduledAt).toLocaleString() : '-'}</TableCell>
                      <TableCell>{row.sentAt ? new Date(row.sentAt).toLocaleString() : '-'}</TableCell>
                      <TableCell>{row.completedAt ? new Date(row.completedAt).toLocaleString() : '-'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" color={statusColor(row.status) as any} label={statusLabel(row.status)} variant="outlined" />
                          {row.status === 'completed' && (
                            <Button size="small" variant="outlined" onClick={() => openView(row.id)}>View</Button>
                          )}
                          {row.status === 'completed' && row.clientId && row.formType && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                const path = row.formType === 'nutrition'
                                  ? `/dashboard/clients/${row.clientId}/nutrition`
                                  : `/dashboard/clients/${row.clientId}/workout`;
                                window.location.href = path;
                              }}
                            >
                              {row.formType === 'nutrition' ? 'Create Nutrition Plan' : 'Create Workout Plan'}
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                          No queue items match your filters
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>

      {/* View Submission Dialog */}
      <Dialog fullWidth maxWidth="md" open={viewOpen} onClose={() => setViewOpen(false)}>
        <DialogTitle>Form Submission</DialogTitle>
        <DialogContent dividers>
          {viewLoading && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          )}
          {viewError && <Alert severity="error">{viewError}</Alert>}
          {!viewLoading && !viewError && viewSubmission && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">{viewSubmission.form?.title || 'Form'}</Typography>
                <Chip size="small" color="success" label="Submitted" />
              </Stack>
              <Typography variant="caption" color="text.secondary">{viewSubmission.updatedAt ? `Submitted ${new Date(viewSubmission.updatedAt).toLocaleString()}` : ''}</Typography>
              <Box sx={{ mt: 2 }}>
                {Array.isArray(viewSubmission.form?.questions) ? (
                  <Stack spacing={1.5}>
                    {viewSubmission.form.questions.map((q: any, idx: number) => {
                      const qid = q.id || `q_${idx}`;
                      const label = q.question || q.label || `Question ${idx + 1}`;
                      const val = viewSubmission.answers ? viewSubmission.answers[qid] : undefined;
                      let display: any = val;
                      if (Array.isArray(val)) display = val.join(', ');
                      if (val === true) display = 'Yes';
                      if (val === false) display = 'No';
                      if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) display = '—';
                      return (
                        <Card key={qid} variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{label}</Typography>
                            <Typography variant="body2" color="text.secondary">{String(display)}</Typography>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  viewSubmission.answers && typeof viewSubmission.answers === 'object' ? (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
{JSON.stringify(viewSubmission.answers, null, 2)}
                    </pre>
                  ) : (
                    <Typography color="text.secondary">No answers data.</Typography>
                  )
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}





