'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAppSelector } from '@/store';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
  Avatar
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Add,
  Trash,
  Edit
} from '@wandersonalwes/iconsax-react';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';

interface Subscription {
  id: string;
  planName: string;
  status: string;
  startDate: string;
  endDate?: string;
  price: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: number; // in days
  features: string[];
}

export default function ClientSubscriptionPage() {
  const { id: clientId } = useParams() as { id: string };
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const intl = useIntl();
  
  // State for subscriptions
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  
  // State for subscription plans
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  
  // Dialog states
  const [isCreateSubscriptionDialogOpen, setIsCreateSubscriptionDialogOpen] = useState(false);
  
  // Form states
  const [selectedPlanId, setSelectedPlanId] = useState('');
  
  const [saving, setSaving] = useState(false);
  
  // Edit subscription states
  const [isEditSubscriptionDialogOpen, setIsEditSubscriptionDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [editSelectedPlanId, setEditSelectedPlanId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const refreshSubscriptions = async () => {
    if (!workspaceId) return;
    try {
      setLoadingSubscriptions(true);
      const response = await api.get(`/api/clients/${workspaceId}/subscriptions?clientId=${clientId}`);
      const subs = Array.isArray(response.data?.subscriptions) ? response.data.subscriptions : [];
      // Normalize to UI expectations
      const normalized = subs
        .filter(Boolean)
        .map((s: any) => {
          const lastPayment = Array.isArray(s.payments) && s.payments.length > 0 ? s.payments[0] : null;
          return {
            id: s.id,
            planName: s.planName || s.packageName || 'Subscription',
            status: s.status,
            startDate: s.createdAt,
            endDate: s.endDate || s.renewalDate,
            price: s.price ?? (lastPayment ? (lastPayment.amountCents || 0) / 100 : 0),
            currency: s.currency || (lastPayment ? lastPayment.currency : 'USD'),
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          } as Subscription;
        });
      setSubscriptions(normalized);
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to load subscriptions',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  // Load subscriptions
  useEffect(() => {
    refreshSubscriptions();
  }, [clientId, workspaceId]);

  // Load subscription plans
  useEffect(() => {
    const loadPlans = async () => {
      if (!workspaceId) return;
      try {
        setLoadingPlans(true);
        const response = await api.get(`/api/workspaces/${workspaceId}/client-packages`);
        const packages = response.data?.packages || response.data?.plans || [];
        const normalized: SubscriptionPlan[] = packages.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: (p.price ?? (p.priceCents != null ? p.priceCents / 100 : 0)),
          currency: p.currency || 'USD',
          duration: p.duration != null ? p.duration : (p.durationMonths != null ? p.durationMonths * 30 : 30),
          features: Array.isArray(p.features)
            ? p.features
            : p.features && typeof p.features === 'object'
              ? Object.values(p.features)
              : []
        }));
        setSubscriptionPlans(normalized);
      } catch (err: any) {
        openSnackbar({
          open: true,
          message: 'Failed to load subscription plans',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoadingPlans(false);
      }
    };
    loadPlans();
  }, [workspaceId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pre_start':
        return 'info';
      case 'pending':
        return 'warning';
      case 'expired':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const handleCreateSubscription = async () => {
    if (!selectedPlanId) return;
    
    try {
      setSaving(true);
      const response = await api.post('/api/clients/subscription/manual', {
        clientId,
        packageId: selectedPlanId
      });
      
      await refreshSubscriptions(); // Refresh the list
      setSelectedPlanId('');
      setIsCreateSubscriptionDialogOpen(false);
      
      openSnackbar({
        open: true,
        message: 'Subscription created successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      console.error('Create subscription error:', err);
      openSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to create subscription',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setEditSelectedPlanId('');
    setIsEditSubscriptionDialogOpen(true);
  };

  const handleSaveEditSubscription = async () => {
    if (!editingSubscription || !editSelectedPlanId) return;
    
    try {
      setEditSaving(true);
      await api.put(`/api/clients/${workspaceId}/subscriptions/${editingSubscription.id}/update-package`, {
        packageId: editSelectedPlanId
      });
      
      await refreshSubscriptions(); // Refresh the list
      setIsEditSubscriptionDialogOpen(false);
      setEditingSubscription(null);
      setEditSelectedPlanId('');
      
      openSnackbar({
        open: true,
        message: 'Subscription package updated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.error || 'Failed to update subscription',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEditSubscription = () => {
    setIsEditSubscriptionDialogOpen(false);
    setEditingSubscription(null);
    setEditSelectedPlanId('');
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      setSaving(true);
      await api.post(`/api/clients/${workspaceId}/subscriptions/${subscriptionId}/cancel`);
      await refreshSubscriptions();
      openSnackbar({
        open: true,
        message: 'Subscription cancelled successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to cancel subscription',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4">Subscription Management</Typography>
        <Chip label={`Client: ${clientId}`} variant="outlined" />
      </Box>

      {/* Current Subscriptions */}
      <Card>
        <CardHeader
          title={intl.formatMessage({ id: 'current-subscriptions' })}
          action={
            <Button
              variant="contained"
              startIcon={<Add size={16} />}
              onClick={() => setIsCreateSubscriptionDialogOpen(true)}
            >
              Create Subscription
            </Button>
          }
        />
        <CardContent>
          {loadingSubscriptions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : subscriptions.length > 0 ? (
            isMobile ? (
              // Mobile Cards View
              <Grid container spacing={2}>
                {subscriptions.map((subscription) => (
                  <Grid item xs={12} key={subscription.id}>
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
                              📋
                            </Avatar>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="h6">
                                {subscription.planName}
                              </Typography>
                              <Chip
                                label={subscription.status}
                                color={getStatusColor(subscription.status) as any}
                                size="small"
                              />
                            </Box>
                          </Stack>

                          <Divider />

                          {/* Subscription Details */}
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Start Date
                              </Typography>
                              <Typography variant="body2">
                                {new Date(subscription.startDate).toLocaleDateString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Price
                              </Typography>
                              <Typography variant="body2">
                                {subscription.currency} {subscription.price}
                              </Typography>
                            </Grid>
                            {subscription.endDate && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">
                                  End Date
                                </Typography>
                                <Typography variant="body2">
                                  {new Date(subscription.endDate).toLocaleDateString()}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>

                          <Divider />

                          {/* Actions */}
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {(subscription.status === 'active' || subscription.status === 'pre_start') && (
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<Trash size={16} />}
                                onClick={() => handleCancelSubscription(subscription.id)}
                              >
                                Cancel
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              // Desktop List View
              <List>
                {subscriptions.map((subscription) => (
                  <ListItem key={subscription.id}>
                    <ListItemText
                      primary={subscription.planName}
                      secondary={
                        <Stack spacing={1}>
                          <Typography variant="body2">
                            Status: {subscription.status}
                          </Typography>
                          <Typography variant="body2">
                            Start Date: {new Date(subscription.startDate).toLocaleDateString()}
                          </Typography>
                          {subscription.endDate && (
                            <Typography variant="body2">
                              End Date: {new Date(subscription.endDate).toLocaleDateString()}
                            </Typography>
                          )}
                          <Typography variant="body2">
                            Price: {subscription.currency} {subscription.price}
                          </Typography>
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={subscription.status}
                        color={getStatusColor(subscription.status) as any}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      {(subscription.status === 'active' || subscription.status === 'pre_start') && (
                        <>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditSubscription(subscription)}
                            sx={{ mr: 1 }}
                          >
                            <Edit size={16} />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleCancelSubscription(subscription.id)}
                          >
                            <Trash size={16} />
                          </IconButton>
                        </>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )
          ) : (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No subscriptions found
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader title={intl.formatMessage({ id: 'available-subscription-plans' })} />
        <CardContent>
          {loadingPlans ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : subscriptionPlans.length > 0 ? (
            <Grid container spacing={2}>
              {subscriptionPlans.map((plan) => (
                <Grid item xs={12} md={6} lg={4} key={plan.id}>
                  <Card variant="outlined">
                    <CardHeader
                      title={plan.name}
                      subheader={`${plan.currency} ${plan.price} / ${plan.duration} days`}
                    />
                    <CardContent>
                      <List dense>
                        {plan.features.map((feature, index) => (
                          <ListItem key={index} sx={{ py: 0.5 }}>
                            <ListItemText
                              primary={feature}
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No subscription plans available
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Create Subscription Dialog */}
      <Dialog open={isCreateSubscriptionDialogOpen} onClose={() => setIsCreateSubscriptionDialogOpen(false)}>
        <DialogTitle>Create Subscription</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Subscription Plan</InputLabel>
            <Select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
            >
              {subscriptionPlans.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name} - {plan.currency} {plan.price} ({plan.duration} days)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateSubscriptionDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateSubscription} disabled={saving || !selectedPlanId}>
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={isEditSubscriptionDialogOpen} onClose={handleCancelEditSubscription}>
        <DialogTitle>Edit Subscription Package</DialogTitle>
        <DialogContent>
          {editingSubscription && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Current Package: {editingSubscription.planName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start Date: {new Date(editingSubscription.startDate).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                End Date: {editingSubscription.endDate ? new Date(editingSubscription.endDate).toLocaleDateString() : 'N/A'}
              </Typography>
            </Box>
          )}
          <FormControl fullWidth margin="normal">
            <InputLabel>New Subscription Plan</InputLabel>
            <Select
              value={editSelectedPlanId}
              onChange={(e) => setEditSelectedPlanId(e.target.value)}
            >
              {subscriptionPlans.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name} - {plan.currency} {plan.price} ({plan.duration} days)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Note: The start date will remain the same, and a new end date will be calculated based on the selected package duration.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEditSubscription}>Cancel</Button>
          <Button onClick={handleSaveEditSubscription} disabled={editSaving || !editSelectedPlanId}>
            {editSaving ? <CircularProgress size={20} /> : 'Update Package'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
