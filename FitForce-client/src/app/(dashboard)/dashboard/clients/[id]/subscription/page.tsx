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
          
          // Handle queued subscriptions (pre_active with null dates)
          let displayStatus = s.status;
          let displayStartDate = s.startDate || s.createdAt;
          let displayEndDate = s.endDate || s.renewalDate;
          
          if (s.status === 'pre_active') {
            // Show as "Queued" in UI
            displayStatus = 'queued';
          }
          
          return {
            id: s.id,
            planName: s.planName || s.packageName || 'Subscription',
            status: displayStatus,
            startDate: displayStartDate,
            endDate: displayEndDate,
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
        message: intl.formatMessage({ id: 'client.subs.loadError', defaultMessage: 'Failed to load subscriptions' }),
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        action: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'Fade',
        close: true,
        actionButton: false,
        maxStack: 3,
        dense: false,
        iconVariant: 'usedefault'
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
        message: intl.formatMessage({ id: 'client.subs.loadPlansError', defaultMessage: 'Failed to load subscription plans' }),
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        action: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'Fade',
        close: true,
        actionButton: false,
        maxStack: 3,
        dense: false,
        iconVariant: 'usedefault'
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
      case 'pre_active':
        return 'warning';
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
      await api.post('/api/clients/subscription/manual', {
        clientId,
        packageId: selectedPlanId
      });
      
      await refreshSubscriptions(); // Refresh the list
      setSelectedPlanId('');
      setIsCreateSubscriptionDialogOpen(false);
      
      openSnackbar({
        open: true,
        message: intl.formatMessage({ id: 'client.subs.created', defaultMessage: 'Subscription created successfully' }),
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        action: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'Fade',
        close: true,
        actionButton: false,
        maxStack: 3,
        dense: false,
        iconVariant: 'usedefault'
      });
    } catch (err: any) {
      console.error('Create subscription error:', err);
      openSnackbar({
        open: true,
        message: err.response?.data?.error || intl.formatMessage({ id: 'client.subs.createError', defaultMessage: 'Failed to create subscription' }),
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        action: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'Fade',
        close: true,
        actionButton: false,
        maxStack: 3,
        dense: false,
        iconVariant: 'usedefault'
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
        message: intl.formatMessage({ id: 'client.subs.updated', defaultMessage: 'Subscription package updated successfully' }),
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        action: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'Fade',
        close: true,
        actionButton: false,
        maxStack: 3,
        dense: false,
        iconVariant: 'usedefault'
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.error || intl.formatMessage({ id: 'client.subs.updateError', defaultMessage: 'Failed to update subscription' }),
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        action: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'Fade',
        close: true,
        actionButton: false,
        maxStack: 3,
        dense: false,
        iconVariant: 'usedefault'
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
        message: intl.formatMessage({ id: 'client.subs.cancelled', defaultMessage: 'Subscription cancelled successfully' }),
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        action: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'Fade',
        close: true,
        actionButton: false,
        maxStack: 3,
        dense: false,
        iconVariant: 'usedefault'
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: intl.formatMessage({ id: 'client.subs.cancelError', defaultMessage: 'Failed to cancel subscription' }),
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        action: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'Fade',
        close: true,
        actionButton: false,
        maxStack: 3,
        dense: false,
        iconVariant: 'usedefault'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', maxWidth: '100vw', px: { xs: 1, md: 0 } }}>
    <Stack spacing={3} sx={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: 'h6', md: 'h4' } }}><FormattedMessage id="client.subs.title" defaultMessage="Subscription Management" /></Typography>
        <Chip label={intl.formatMessage({ id: 'client.subs.client', defaultMessage: 'Client' }) + `: ${clientId}`} variant="outlined" size={isMobile ? 'small' : 'medium'} />
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
              <FormattedMessage id="client.subs.create" defaultMessage="Create Subscription" />
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
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
                {subscriptions.map((subscription) => (
                  <Box key={subscription.id}>
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
                                label={subscription.status === 'queued' ? 'Queued' : subscription.status}
                                color={getStatusColor(subscription.status) as any}
                                size="small"
                              />
                            </Box>
                          </Stack>

                          <Divider />

                          {/* Subscription Details */}
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                <FormattedMessage id="client.subs.startDate" defaultMessage="Start Date" />
                              </Typography>
                              <Typography variant="body2">
                                {subscription.status === 'queued' ? (
                                  <FormattedMessage id="client.subs.pendingStart" defaultMessage="Pending Start" />
                                ) : (
                                  new Date(subscription.startDate).toLocaleDateString()
                                )}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                <FormattedMessage id="client.subs.price" defaultMessage="Price" />
                              </Typography>
                              <Typography variant="body2">
                                {subscription.currency} {subscription.price}
                              </Typography>
                            </Box>
                            {subscription.endDate && (
                              <Box sx={{ gridColumn: '1 / -1' }}>
                                <Typography variant="caption" color="text.secondary">
                                  <FormattedMessage id="client.subs.endDate" defaultMessage="End Date" />
                                </Typography>
                                <Typography variant="body2">
                                  {subscription.status === 'queued' ? (
                                    <FormattedMessage id="client.subs.pendingEnd" defaultMessage="Pending End" />
                                  ) : (
                                    new Date(subscription.endDate).toLocaleDateString()
                                  )}
                                </Typography>
                              </Box>
                            )}
                          </Box>

                          <Divider />

                          {/* Actions */}
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {(subscription.status === 'active' || subscription.status === 'pre_start') && (
                              <>
                                <Button
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  startIcon={<Edit size={16} />}
                                  onClick={() => handleEditSubscription(subscription)}
                                >
                                  <FormattedMessage id="edit" defaultMessage="Edit" />
                                </Button>
                                <Button
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  startIcon={<Trash size={16} />}
                                  onClick={() => handleCancelSubscription(subscription.id)}
                                >
                                  <FormattedMessage id="client.subs.cancel" defaultMessage="Cancel" />
                                </Button>
                              </>
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>
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
                            {intl.formatMessage({ id: 'client.subs.status', defaultMessage: 'Status' })}: {subscription.status === 'queued' ? 'Queued' : subscription.status}
                          </Typography>
                          <Typography variant="body2">
                            {intl.formatMessage({ id: 'client.subs.startDate', defaultMessage: 'Start Date' })}: {
                              subscription.status === 'queued' 
                                ? intl.formatMessage({ id: 'client.subs.pendingStart', defaultMessage: 'Pending Start' })
                                : new Date(subscription.startDate).toLocaleDateString()
                            }
                          </Typography>
                          {subscription.endDate && (
                            <Typography variant="body2">
                              {intl.formatMessage({ id: 'client.subs.endDate', defaultMessage: 'End Date' })}: {
                                subscription.status === 'queued'
                                  ? intl.formatMessage({ id: 'client.subs.pendingEnd', defaultMessage: 'Pending End' })
                                  : new Date(subscription.endDate).toLocaleDateString()
                              }
                            </Typography>
                          )}
                          <Typography variant="body2">
                            {intl.formatMessage({ id: 'client.subs.price', defaultMessage: 'Price' })}: {subscription.currency} {subscription.price}
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
              <FormattedMessage id="client.subs.none" defaultMessage="No subscriptions found" />
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
            <Box sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))'
              }
            }}>
              {subscriptionPlans.map((plan) => (
                <Box key={plan.id}>
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
                </Box>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No subscription plans available
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Create Subscription Dialog */}
      <Dialog open={isCreateSubscriptionDialogOpen} onClose={() => setIsCreateSubscriptionDialogOpen(false)}>
        <DialogTitle><FormattedMessage id="client.subs.create" defaultMessage="Create Subscription" /></DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel><FormattedMessage id="client.subs.plan" defaultMessage="Subscription Plan" /></InputLabel>
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
          <Button onClick={() => setIsCreateSubscriptionDialogOpen(false)}><FormattedMessage id="cancel" defaultMessage="Cancel" /></Button>
          <Button onClick={handleCreateSubscription} disabled={saving || !selectedPlanId}>
            {saving ? <CircularProgress size={20} /> : intl.formatMessage({ id: 'create', defaultMessage: 'Create' })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={isEditSubscriptionDialogOpen} onClose={handleCancelEditSubscription}>
        <DialogTitle><FormattedMessage id="client.subs.editTitle" defaultMessage="Edit Subscription Package" /></DialogTitle>
        <DialogContent>
          {editingSubscription && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage({ id: 'client.subs.currentPackage', defaultMessage: 'Current Package' })}: {editingSubscription.planName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage({ id: 'client.subs.startDate', defaultMessage: 'Start Date' })}: {new Date(editingSubscription.startDate).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage({ id: 'client.subs.endDate', defaultMessage: 'End Date' })}: {editingSubscription.endDate ? new Date(editingSubscription.endDate).toLocaleDateString() : 'N/A'}
              </Typography>
            </Box>
          )}
          <FormControl fullWidth margin="normal">
            <InputLabel><FormattedMessage id="client.subs.newPlan" defaultMessage="New Subscription Plan" /></InputLabel>
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
            <FormattedMessage id="client.subs.note" defaultMessage="Note: The start date will remain the same, and a new end date will be calculated based on the selected package duration." />
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEditSubscription}><FormattedMessage id="cancel" defaultMessage="Cancel" /></Button>
          <Button onClick={handleSaveEditSubscription} disabled={editSaving || !editSelectedPlanId}>
            {editSaving ? <CircularProgress size={20} /> : intl.formatMessage({ id: 'client.subs.update', defaultMessage: 'Update Package' })}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
    </Box>
  );
}
