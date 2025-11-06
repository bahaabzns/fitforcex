import React, { useState, useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Box,
  Typography,
  Button,
  Alert,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import { PaymentModal } from './PaymentModal';
import api from '@/utils/axios';
import { PaymentComponent } from './PaymentComponent';
import { useAppSelector } from '@/store';
// Meta Pixel removed

interface SubscriptionData {
  id: string;
  status: string;
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  createdAt?: string;
  autoRenew: boolean;
  package: {
    id: string;
    name: string;
    description?: string;
    durationMonths: number;
    priceCents: number;
    currency: string;
    features?: any;
  };
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    providerRef?: string;
    createdAt: string;
  }>;
}

interface SubscriptionManagerProps {
  workspaceId: string;
  type: 'workspace' | 'client';
  clientId?: string;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  workspaceId,
  type,
  clientId,
}) => {
  const intl = useIntl();
  const reduxWorkspaceId = useAppSelector((s) => s.workspace.id);
  const effectiveWorkspaceId = workspaceId || reduxWorkspaceId || '';
  
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [paymentIframeData, setPaymentIframeData] = useState<any>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    fetchSubscription();
    fetchPackages();
  }, [workspaceId, type, clientId]);

  // No pixel tracking

  const fetchSubscription = async () => {
    try {
      const endpoint = type === 'workspace'
        ? `/api/workspaces/${effectiveWorkspaceId}/subscription`
        : `/api/clients/${workspaceId}/subscriptions${clientId ? `?clientId=${clientId}` : ''}`;
      const { data } = await api.get(endpoint);

      if (type === 'workspace') {
        setSubscription(data.subscription || null);
      } else {
        // For client subscriptions, consider both 'active' and 'pre_start' as valid subscriptions
        // 'pre_start' means payment succeeded but waiting for first plan delivery
        const validSubscription = data.subscriptions?.find((sub: any) => 
          sub.status === 'active' || sub.status === 'pre_start'
        );
        setSubscription(validSubscription || null);
      }
    } catch (err: any) {
      // Treat 404/402 as no subscription instead of hard error
      const status = err?.response?.status;
      if (status === 404 || status === 402) {
        setSubscription(null);
        return;
      }
      setError('Failed to fetch subscription');
    }
  };

  const fetchPackages = async () => {
    try {
      const endpoint = type === 'workspace'
        ? '/api/workspace-packages'
        : `/api/workspaces/${effectiveWorkspaceId}/client-packages`;
      const { data } = await api.get(endpoint);
      setPackages(data.packages || []);
    } catch (err) {
      setError('Failed to fetch packages');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = (packageData: any) => {
    // No pixel tracking
    setSelectedPackage(packageData);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (paymentData: any) => {
    setPaymentModalOpen(false);
    setPaymentIframeData(paymentData);
  };

  const handlePaymentComplete = (result: any) => {
    setPaymentIframeData(null);
    fetchSubscription(); // Refresh subscription data
  };

  const handlePaymentError = (error: string) => {
    setPaymentIframeData(null);
    setError(error);
  };

  const handlePaymentCancel = () => {
    setPaymentIframeData(null);
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    try {
      const endpoint = type === 'workspace'
        ? `/api/workspaces/${effectiveWorkspaceId}/subscription/cancel`
        : `/api/clients/${effectiveWorkspaceId}/subscriptions/${subscription.id}/cancel`;
      await api.post(endpoint, {});
      setCancelDialogOpen(false);
      fetchSubscription(); // Refresh subscription data
    } catch (err) {
      setError('Failed to cancel subscription');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pre_start':
        return 'info';
      case 'expired':
        return 'error';
      case 'cancelled':
        return 'warning';
      case 'pending':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon />;
      case 'pre_start':
        return <PendingIcon />;
      case 'expired':
        return <ErrorIcon />;
      case 'cancelled':
        return <CancelIcon />;
      case 'pending':
        return <PendingIcon />;
      default:
        return null;
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  };

  const formatPrice = (cents: number, currency: string) => {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  };

  const calculateSubscriptionProgress = () => {
    if (!subscription) return { progress: 0, daysRemaining: 0, hoursRemaining: 0, totalDays: 0 };
    
    const startDateStr = subscription.startDate || subscription.createdAt;
    const endDateStr = subscription.endDate || subscription.renewalDate;
    
    if (!startDateStr || !endDateStr) return { progress: 0, daysRemaining: 0, hoursRemaining: 0, totalDays: 0 };
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const now = new Date();
    
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    const remaining = endDate.getTime() - now.getTime();
    
    const progress = total > 0 ? Math.max(0, Math.min(100, (elapsed / total) * 100)) : 0;
    const daysRemaining = Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.ceil(remaining / (1000 * 60 * 60)));
    const totalDays = Math.ceil(total / (1000 * 60 * 60 * 24));
    
    return { progress, daysRemaining, hoursRemaining, totalDays };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {subscription ? (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5">
                Current Subscription
              </Typography>
              <Chip
                icon={getStatusIcon(subscription.status)}
                label={subscription.status.toUpperCase()}
                color={getStatusColor(subscription.status) as any}
                variant="outlined"
              />
            </Box>

            {/* Subscription Progress Bar */}
            {subscription.status === 'active' && (subscription.endDate || subscription.renewalDate) ? (
              (() => {
                const progressData = calculateSubscriptionProgress();
                return (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Subscription Progress
                      </Typography>
                      <Typography variant="body2" color="primary" fontWeight={600}>
                        {progressData.daysRemaining > 0 
                          ? `${progressData.daysRemaining} day${progressData.daysRemaining !== 1 ? 's' : ''} remaining`
                          : `${progressData.hoursRemaining} hour${progressData.hoursRemaining !== 1 ? 's' : ''} remaining`}
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={progressData.progress} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          bgcolor: progressData.progress < 20 ? 'error.main' : 'primary.main'
                        }
                      }} 
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {formatDate(subscription.startDate || subscription.createdAt)} → {formatDate(subscription.endDate || subscription.renewalDate)}
                      {progressData.totalDays > 0 && ` (${progressData.totalDays} day${progressData.totalDays !== 1 ? 's' : ''})`}
                    </Typography>
                  </Box>
                );
              })()
            ) : null}

            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  {subscription.package?.name || (() => {
                    // derive current package name by matching last succeeded payment to a known package
                    const lastPayment = (subscription.payments || []).find((p) => p.status === 'succeeded');
                    if (lastPayment) {
                      const matched = packages.find((p) => p.priceCents === lastPayment.amountCents);
                      return matched?.name || 'Current Package';
                    }
                    return 'Current Package';
                  })()}
                </Typography>
                {!!subscription.package?.description && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {subscription.package.description}
                  </Typography>
                )}
                {(() => {
                  const pkg = subscription.package;
                  if (pkg) {
                    return (
                      <Typography variant="h6" color="primary">
                        {formatPrice(pkg.priceCents, pkg.currency)}
                      </Typography>
                    );
                  }
                  // derive price from last succeeded payment if package missing
                  const lastPayment = (subscription.payments || []).find((p) => p.status === 'succeeded');
                  if (lastPayment) {
                    return (
                      <Typography variant="h6" color="primary">
                        {formatPrice(lastPayment.amountCents, lastPayment.currency)}
                      </Typography>
                    );
                  }
                  return null;
                })()}
              </Grid>
              <Grid item xs={12} md={6}>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary={intl.formatMessage({ id: 'start-date' })}
                      secondary={formatDate(subscription.startDate || subscription.createdAt)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={intl.formatMessage({ id: 'end-date' })}
                      secondary={formatDate((subscription as any).endDate || subscription.renewalDate)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Auto Renew"
                      secondary={subscription.autoRenew ? 'Yes' : 'No'}
                    />
                  </ListItem>
                </List>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Payment History
            </Typography>
            <List>
              {(subscription.payments || []).map((payment) => (
                <ListItem key={payment.id}>
                  <ListItemText
                    primary={formatPrice(payment.amountCents, payment.currency)}
                    secondary={`${formatDate(payment.createdAt)} - ${payment.status}`}
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      label={payment.status}
                      color={payment.status === 'succeeded' ? 'success' : 'default'}
                      size="small"
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchSubscription}
              >
                Refresh
              </Button>
              {(subscription.status === 'active' || subscription.status === 'pre_start') && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Cancel Subscription
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          No active subscription found. Choose a package below to get started.
        </Alert>
      )}

      <Typography variant="h5" gutterBottom>
        Available Packages
      </Typography>

      <Grid container spacing={3}>
        {packages.map((packageData) => (
          <Grid item xs={12} md={6} lg={4} key={packageData.id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {packageData.name}
                </Typography>
                <Typography variant="h4" color="primary" gutterBottom>
                  {formatPrice(packageData.priceCents, packageData.currency)}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {packageData.durationMonths} month{packageData.durationMonths > 1 ? 's' : ''}
                </Typography>
                {packageData.description && (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {packageData.description}
                  </Typography>
                )}
              </CardContent>
              <Box sx={{ p: 2, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={() => handleSubscribe(packageData)}
                  disabled={!packageData.isActive}
                >
                  Subscribe
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        packageData={selectedPackage}
        type={type}
        workspaceId={effectiveWorkspaceId}
        clientId={clientId}
      />

      {paymentIframeData && (
        <PaymentComponent
          paymentUrl={paymentIframeData.iframeUrl || paymentIframeData.redirectUrl}
          paymentType={paymentIframeData.iframeUrl ? 'iframe' : 'redirect'}
          onSuccess={handlePaymentComplete}
          onError={handlePaymentError}
          onCancel={handlePaymentCancel}
          amount={paymentIframeData.amount}
          currency={paymentIframeData.currency}
        />
      )}

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel your subscription? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Keep Subscription</Button>
          <Button onClick={handleCancelSubscription} color="error" variant="contained">
            Cancel Subscription
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
