'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Alert,
  Chip,
  CircularProgress,
  Grid,
  Divider,
} from '@mui/material';
import { Add, Edit, Cancel } from '@mui/icons-material';
import api from '@/utils/axios';

interface Workspace {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  members: Array<{
    id: string;
    user: {
      id: string;
      fullName: string;
      email: string;
    };
    role: {
      id: string;
      name: string;
    };
    createdAt: string;
  }>;
  workspaceSubscription?: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    package: {
      id: string;
      name: string;
      durationMonths: number;
      priceCents: number;
    };
  };
  workspaceSubscriptions?: Array<{
    id: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    queuePosition?: number | null;
    package: {
      id: string;
      name: string;
      durationMonths: number;
      priceCents: number;
    };
    createdAt: string;
    updatedAt: string;
  }>;
  roles: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
}

interface SubscriptionTabProps {
  workspace: Workspace;
  onRefresh: () => void;
}

interface Package {
  id: string;
  name: string;
  description?: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
}

export default function SubscriptionTab({ workspace, onRefresh }: SubscriptionTabProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual subscription form state
  const [subscriptionMode, setSubscriptionMode] = useState<'package' | 'custom'>('package');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [customDuration, setCustomDuration] = useState(1);
  const [customAmount, setCustomAmount] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [skipPayment, setSkipPayment] = useState(false);
  const [teamMembersEnabled, setTeamMembersEnabled] = useState(true);

  // Edit subscription form state
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data } = await api.get('/api/admin/workspace-packages');
      setPackages(data.packages || []);
    } catch (e) {
      console.error('Failed to fetch packages:', e);
    }
  };

  const handleCreateSubscription = async () => {
    // Allow omitted dates; server will compute using package/custom duration.
    // If end date provided without start date, keep minimal validation.
    if (endDate && !startDate) {
      setError('Start date is required when end date is provided');
      return;
    }

    if (subscriptionMode === 'package' && !selectedPackageId) {
      setError('Please select a package');
      return;
    }

    if (subscriptionMode === 'custom' && customDuration < 1) {
      setError('Duration must be at least 1 month');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: any = {
        skipPayment,
        teamMembersEnabled,
      };

      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;

      if (subscriptionMode === 'package') {
        payload.packageId = selectedPackageId;
      } else {
        payload.customDuration = customDuration;
        payload.customAmount = customAmount;
      }

      await api.post(`/api/admin/workspaces/${workspace.id}/subscriptions/manual`, payload);
      
      setIsCreateDialogOpen(false);
      resetForm();
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubscription = async () => {
    if (!workspace.workspaceSubscription) return;

    try {
      setLoading(true);
      setError(null);

      await api.put(`/api/admin/workspaces/${workspace.id}/subscriptions/${workspace.workspaceSubscription.id}`, {
        startDate: editStartDate,
        endDate: editEndDate,
        status: editStatus,
        teamMembersEnabled,
      });

      setIsEditDialogOpen(false);
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!workspace.workspaceSubscription) return;

    try {
      setLoading(true);
      setError(null);

      await api.delete(`/api/admin/workspaces/${workspace.id}/subscriptions/${workspace.workspaceSubscription.id}`);
      
      setIsCancelDialogOpen(false);
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubscriptionMode('package');
    setSelectedPackageId('');
    setCustomDuration(1);
    setCustomAmount(0);
    setStartDate('');
    setEndDate('');
    setSkipPayment(false);
  };

  const openEditDialog = () => {
    if (workspace.workspaceSubscription) {
      setEditStartDate(workspace.workspaceSubscription.startDate.split('T')[0]);
      setEditEndDate(workspace.workspaceSubscription.endDate.split('T')[0]);
      setEditStatus(workspace.workspaceSubscription.status);
      setIsEditDialogOpen(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pre_active':
        return 'info';
      case 'expired':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Subscription Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {workspace.workspaceSubscription && (
            <>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={openEditDialog}
              >
                Edit Subscription
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Cancel />}
                onClick={() => setIsCancelDialogOpen(true)}
              >
                Cancel Subscription
              </Button>
            </>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Create Manual Subscription
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Current Subscription */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Subscription
          </Typography>
          {workspace.workspaceSubscription ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Status:
                    </Typography>
                    <Chip
                      label={workspace.workspaceSubscription.status}
                      color={getStatusColor(workspace.workspaceSubscription.status) as any}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Package:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {workspace.workspaceSubscription.package.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Duration:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {workspace.workspaceSubscription.package.durationMonths} months
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Price:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {(workspace.workspaceSubscription.package.priceCents / 100).toFixed(2)} EGP
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Start Date:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {new Date(workspace.workspaceSubscription.startDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      End Date:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {new Date(workspace.workspaceSubscription.endDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No active subscription
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Queued Subscriptions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Queued Subscriptions
          </Typography>
          {Array.isArray(workspace.workspaceSubscriptions) && workspace.workspaceSubscriptions.filter(s => s.status === 'pre_active' || s.status === 'frozen').length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {workspace.workspaceSubscriptions.filter(s => s.status === 'pre_active' || s.status === 'frozen').map((s) => (
                <Box key={s.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, py: 0.5 }}>
                  <Chip label={s.status} color={getStatusColor(s.status) as any} size="small" />
                  <Chip label={`Package: ${s.package.name}`} size="small" variant="outlined" />
                  {typeof s.queuePosition === 'number' && (
                    <Chip label={`Queue: ${s.queuePosition}`} size="small" variant="outlined" />
                  )}
                  <Chip label={`Start: ${s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}`} size="small" variant="outlined" />
                  <Chip label={`End: ${s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}`} size="small" variant="outlined" />
                  <Chip label={`Created: ${new Date(s.createdAt).toLocaleDateString()}`} size="small" variant="outlined" />
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No queued subscriptions
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Archived Subscriptions (hidden from queue) */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Archived Subscriptions
          </Typography>
          {Array.isArray(workspace.workspaceSubscriptions) && workspace.workspaceSubscriptions.filter(s => s.status === 'expired' || s.status === 'cancelled' || s.status === 'refunded').length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {workspace.workspaceSubscriptions.filter(s => s.status === 'expired' || s.status === 'cancelled' || s.status === 'refunded').map((s) => (
                <Box key={s.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, py: 0.5 }}>
                  <Chip label={s.status} color={getStatusColor(s.status) as any} size="small" />
                  <Chip label={`Package: ${s.package.name}`} size="small" variant="outlined" />
                  <Chip label={`Start: ${s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}`} size="small" variant="outlined" />
                  <Chip label={`End: ${s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}`} size="small" variant="outlined" />
                  <Chip label={`Created: ${new Date(s.createdAt).toLocaleDateString()}`} size="small" variant="outlined" />
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No archived subscriptions
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Create Manual Subscription Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Manual Subscription</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <FormControl>
              <InputLabel>Subscription Type</InputLabel>
              <Select
                value={subscriptionMode}
                onChange={(e) => setSubscriptionMode(e.target.value as 'package' | 'custom')}
                label="Subscription Type"
              >
                <MenuItem value="package">Use Existing Package</MenuItem>
                <MenuItem value="custom">Custom Subscription</MenuItem>
              </Select>
            </FormControl>

            {subscriptionMode === 'package' && (
              <FormControl fullWidth>
                <InputLabel>Package</InputLabel>
                <Select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  label="Package"
                >
                  {packages.filter(pkg => pkg.isActive).map((pkg) => (
                    <MenuItem key={pkg.id} value={pkg.id}>
                      {pkg.name} - {(pkg.priceCents / 100).toFixed(2)} EGP ({pkg.durationMonths} months)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {subscriptionMode === 'custom' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Duration (months)"
                    type="number"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(parseInt(e.target.value) || 1)}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Amount (EGP)"
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
              </Grid>
            )}

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Checkbox
                  checked={skipPayment}
                  onChange={(e) => setSkipPayment(e.target.checked)}
                />
              }
              label="Skip Payment (Mark as Paid)"
            />

          <FormControlLabel
            control={
              <Checkbox
                checked={teamMembersEnabled}
                onChange={(e) => setTeamMembersEnabled(e.target.checked)}
              />
            }
            label="Enable Team Members feature"
          />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateSubscription}
            variant="contained"
            disabled={loading}
          >
            Create Subscription
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Subscription</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditSubscription}
            variant="contained"
            disabled={loading}
          >
            Update Subscription
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={isCancelDialogOpen} onClose={() => setIsCancelDialogOpen(false)}>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel the subscription for{' '}
            <strong>{workspace.name}</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action will mark the subscription as cancelled. The workspace will lose access when the current period ends.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCancelDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCancelSubscription}
            variant="contained"
            color="error"
            disabled={loading}
          >
            Cancel Subscription
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
