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
  Trash
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
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('');
  
  const [saving, setSaving] = useState(false);

  // Load subscriptions
  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!workspaceId) return;
      
      try {
        setLoadingSubscriptions(true);
        const response = await api.get(`/api/clients/${workspaceId}/subscriptions?clientId=${clientId}`);
        setSubscriptions(response.data.subscriptions || []);
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
    loadSubscriptions();
  }, [clientId, workspaceId]);

  // Load subscription plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await api.get('/api/subscription-plans');
        setSubscriptionPlans(response.data.plans || []);
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
  }, []);

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
    if (!selectedPlanId || !subscriptionStartDate) return;
    
    try {
      setSaving(true);
      const response = await api.post(`/api/clients/${clientId}/subscriptions`, {
        planId: selectedPlanId,
        startDate: subscriptionStartDate
      });
      
      setSubscriptions(prev => [...prev, response.data.subscription]);
      setSelectedPlanId('');
      setSubscriptionStartDate('');
      setIsCreateSubscriptionDialogOpen(false);
      
      openSnackbar({
        open: true,
        message: 'Subscription created successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to create subscription',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      await api.delete(`/api/clients/${clientId}/subscriptions/${subscriptionId}`);
      
      setSubscriptions(prev => 
        prev.map(sub => 
          sub.id === subscriptionId 
            ? { ...sub, status: 'cancelled' }
            : sub
        )
      );
      
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
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleCancelSubscription(subscription.id)}
                        >
                          <Trash size={16} />
                        </IconButton>
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
          <TextField
            fullWidth
            label={intl.formatMessage({ id: 'start-date' })}
            type="date"
            value={subscriptionStartDate}
            onChange={(e) => setSubscriptionStartDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateSubscriptionDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateSubscription} disabled={saving || !selectedPlanId || !subscriptionStartDate}>
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
