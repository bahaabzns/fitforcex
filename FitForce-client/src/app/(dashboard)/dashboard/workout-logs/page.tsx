'use client';

import { useState } from 'react';
import useSWR from 'swr';
import api from '@/utils/axios';
import { FormattedMessage, useIntl } from 'react-intl';
import ResponsiveTable from '@/components/ResponsiveTable';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  Avatar,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Visibility, FilterList, Refresh } from '@mui/icons-material';

interface WorkoutLog {
  id: string;
  planId: string;
  dayIndex: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  completed: boolean;
  exercises: any[];
  workoutPlan: {
    title: string;
  };
  client: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
}

interface WorkoutLogsResponse {
  workoutLogs: WorkoutLog[];
}

export default function WorkoutLogsPage() {
  const intl = useIntl();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    clientId: '',
    planId: '',
    startDate: '',
    endDate: '',
  });

  const { data, isLoading, error, mutate } = useSWR<WorkoutLogsResponse>(
    'workout-logs',
    async () => {
      const params = new URLSearchParams();
      if (filters.clientId) params.append('clientId', filters.clientId);
      if (filters.planId) params.append('planId', filters.planId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const response = await api.get(`/api/workout/logs?${params.toString()}`);
      return response.data;
    }
  );

  const handleViewDetails = (log: WorkoutLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    mutate();
  };

  const clearFilters = () => {
    setFilters({
      clientId: '',
      planId: '',
      startDate: '',
      endDate: '',
    });
    mutate();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">Failed to load workout logs</Typography>
        </CardContent>
      </Card>
    );
  }

  const workoutLogs = data?.workoutLogs || [];

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          <FormattedMessage id="workout-logs" />
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => mutate()}
        >
          <FormattedMessage id="refresh" />
        </Button>
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <FilterList sx={{ mr: 1, verticalAlign: 'middle' }} />
            <FormattedMessage id="filters" />
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label={intl.formatMessage({ id: 'client-id' })}
                value={filters.clientId}
                onChange={(e) => handleFilterChange('clientId', e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label={intl.formatMessage({ id: 'plan-id' })}
                value={filters.planId}
                onChange={(e) => handleFilterChange('planId', e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label={intl.formatMessage({ id: 'start-date' })}
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label={intl.formatMessage({ id: 'end-date' })}
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button variant="contained" onClick={applyFilters}>
              <FormattedMessage id="apply-filters" />
            </Button>
            <Button variant="outlined" onClick={clearFilters}>
              <FormattedMessage id="clear-filters" />
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Workout Logs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <FormattedMessage id="workout-logs" /> ({workoutLogs.length})
          </Typography>
          
          {workoutLogs.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              <FormattedMessage id="no-workout-logs-found" />
            </Typography>
          ) : (
            isMobile ? (
              // Mobile Cards View
              <Grid container spacing={2}>
                {workoutLogs.map((log) => (
                  <Grid item xs={12} key={log.id}>
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
                              {log.client.fullName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="h6">
                                {log.client.fullName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {log.client.email}
                              </Typography>
                            </Box>
                            <Chip
                              label={log.completed ? intl.formatMessage({ id: 'completed' }) : intl.formatMessage({ id: 'in-progress' })}
                              color={log.completed ? 'success' : 'warning'}
                              size="small"
                            />
                          </Stack>

                          <Divider />

                          {/* Workout Plan Details */}
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              {log.workoutPlan.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <FormattedMessage id="day" /> {log.dayIndex + 1}
                            </Typography>
                          </Box>

                          <Divider />

                          {/* Workout Details */}
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Date
                              </Typography>
                              <Typography variant="body2">
                                {new Date(log.date).toLocaleDateString()}
                              </Typography>
                              {log.startTime && (
                                <Typography variant="caption" color="text.secondary">
                                  {log.startTime}
                                </Typography>
                              )}
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Duration
                              </Typography>
                              <Typography variant="body2">
                                {log.startTime && log.endTime ? (
                                  calculateDuration(log.startTime, log.endTime)
                                ) : (
                                  <FormattedMessage id="not-completed" />
                                )}
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" color="text.secondary">
                                Exercises
                              </Typography>
                              <Typography variant="body2">
                                {log.exercises.length} <FormattedMessage id="exercises" />
                              </Typography>
                            </Grid>
                          </Grid>

                          <Divider />

                          {/* Actions */}
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Visibility />}
                              onClick={() => handleViewDetails(log)}
                            >
                              View Details
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              // Desktop Table View
              <ResponsiveTable>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><FormattedMessage id="client" /></TableCell>
                      <TableCell><FormattedMessage id="workout-plan" /></TableCell>
                      <TableCell><FormattedMessage id="date" /></TableCell>
                      <TableCell><FormattedMessage id="duration" /></TableCell>
                      <TableCell><FormattedMessage id="status" /></TableCell>
                      <TableCell><FormattedMessage id="exercises" /></TableCell>
                      <TableCell><FormattedMessage id="actions" /></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workoutLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {log.client.fullName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {log.client.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.workoutPlan.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <FormattedMessage id="day" /> {log.dayIndex + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(log.date).toLocaleDateString()}
                          </Typography>
                          {log.startTime && (
                            <Typography variant="caption" color="text.secondary">
                              {log.startTime}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.startTime && log.endTime ? (
                            <Typography variant="body2">
                              {calculateDuration(log.startTime, log.endTime)}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              <FormattedMessage id="not-completed" />
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={log.completed ? intl.formatMessage({ id: 'completed' }) : intl.formatMessage({ id: 'in-progress' })}
                            color={log.completed ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.exercises.length} <FormattedMessage id="exercises" />
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={intl.formatMessage({ id: 'view-details' })}>
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(log)}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            )
          )}
        </CardContent>
      </Card>

      {/* Workout Log Details Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <FormattedMessage id="workout-details" />
        </DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Stack spacing={3}>
              {/* Basic Info */}
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  <FormattedMessage id="workout-information" />
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      <FormattedMessage id="client" />
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.client.fullName}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      <FormattedMessage id="workout-plan" />
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.workoutPlan.title}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      <FormattedMessage id="date" />
                    </Typography>
                    <Typography variant="body1">
                      {new Date(selectedLog.date).toLocaleDateString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      <FormattedMessage id="status" />
                    </Typography>
                    <Chip
                      label={selectedLog.completed ? intl.formatMessage({ id: 'completed' }) : intl.formatMessage({ id: 'in-progress' })}
                      color={selectedLog.completed ? 'success' : 'warning'}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Exercises */}
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  <FormattedMessage id="exercises" />
                </Typography>
                <Stack spacing={2}>
                  {selectedLog.exercises.map((exercise, index) => (
                    <Card key={index} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={500}>
                          {exercise.exerciseName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {exercise.targetSets} <FormattedMessage id="sets" /> x {exercise.targetReps} <FormattedMessage id="reps" />
                        </Typography>
                        
                        {/* Sets */}
                        <Stack spacing={1}>
                          {exercise.sets.map((set: any, setIndex: number) => (
                            <Box key={setIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ minWidth: '60px' }}>
                                <FormattedMessage id="set" /> {setIndex + 1}:
                              </Typography>
                              {set.reps && (
                                <Chip label={`${set.reps} reps`} size="small" variant="outlined" />
                              )}
                              {set.weight && (
                                <Chip label={`${set.weight}kg`} size="small" variant="outlined" />
                              )}
                              {set.completed && (
                                <Chip label={intl.formatMessage({ id: 'completed' })} size="small" color="success" />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>

              {/* Notes */}
              {selectedLog.notes && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    <FormattedMessage id="notes" />
                  </Typography>
                  <Typography variant="body2">
                    {selectedLog.notes}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>
            <FormattedMessage id="close" />
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function calculateDuration(startTime: string, endTime: string): string {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}
