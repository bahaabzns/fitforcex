'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
  TextField
} from '@mui/material';
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
      try {
        setLoadingSubscriptions(true);
        const response = await api.get(`/api/clients/${clientId}/subscriptions`);
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
  }, [clientId]);

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
          title="Current Subscriptions"
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
                    {subscription.status === 'active' && (
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
          ) : (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No subscriptions found
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader title="Available Subscription Plans" />
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
            label="Start Date"
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
