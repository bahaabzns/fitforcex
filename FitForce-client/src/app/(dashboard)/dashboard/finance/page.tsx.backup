'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Stack,
  Avatar,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  TrendUp,
  User,
  CardSend,
  Refresh,
  DollarCircle,
  Eye
} from '@wandersonalwes/iconsax-react';
import api from '@/utils/axios';
import MainCard from '@/components/MainCard';

interface FinanceMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalRevenueCents: number;
  paymentMethods: Record<string, number>;
}

interface Subscription {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  status: string;
  renewalDate: string;
  createdAt: string;
  paymentMethod: string;
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    provider: string;
    status: string;
    providerRef: string;
    createdAt: string;
  }>;
}

interface FinanceDashboardData {
  metrics: FinanceMetrics;
  subscriptions: Subscription[];
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/finance/dashboard');
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load finance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 2
    }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'expired':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'Gateway Payment':
        return <CardSend size={20} />;
      case 'Manual Activation':
        return <User size={20} />;
      default:
        return <DollarCircle size={20} />;
    }
  };

  const handleViewSubscriptionDetails = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchFinanceData} startIcon={<Refresh size={16} />}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4">No finance data available</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Finance Dashboard</Typography>
        <Button 
          startIcon={<Refresh size={16} />} 
          onClick={fetchFinanceData}
          variant="outlined"
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MainCard>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4">{data.metrics.totalSubscriptions}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Subscriptions
                  </Typography>
                </Box>
                <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                  <User size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </MainCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MainCard>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4">{data.metrics.activeSubscriptions}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Subscriptions
                  </Typography>
                </Box>
                <Avatar variant="rounded" sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                  <TrendUp size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </MainCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MainCard>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4">{formatCurrency(data.metrics.totalRevenueCents)}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Revenue
                  </Typography>
                </Box>
                <Avatar variant="rounded" sx={{ bgcolor: 'info.main', width: 56, height: 56 }}>
                  <DollarCircle size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </MainCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MainCard>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4">
                    {Object.keys(data.metrics.paymentMethods).length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Payment Methods
                  </Typography>
                </Box>
                <Avatar variant="rounded" sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                  <CardSend size={24} />
                </Avatar>
              </Stack>
            </CardContent>
           </MainCard>
        </Grid>
      </Grid>

      {/* Payment Methods Distribution */}
      <MainCard sx={{ mb: 3 }} title="Payment Methods Distribution">
        <CardContent>
          <Grid container spacing={2}>
            {Object.entries(data.metrics.paymentMethods).map(([method, count]) => (
              <Grid item xs={12} sm={6} key={method}>
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, height: '100%' }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    {getPaymentMethodIcon(method)}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6">{count}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {method}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
          {Object.keys(data.metrics.paymentMethods).length === 0 && (
            <Typography align="center" color="textSecondary" sx={{ py: 4 }}>
              No payment data available
            </Typography>
          )}
        </CardContent>
      </MainCard>

      {/* Subscriptions Table */}
      <MainCard title="All Subscriptions">
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Payment Method</TableCell>
                  <TableCell>Revenue</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Renewal Date</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">{subscription.clientName}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {subscription.clientEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={subscription.status} 
                        color={getStatusColor(subscription.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {getPaymentMethodIcon(subscription.paymentMethod)}
                        <Typography variant="body2">{subscription.paymentMethod}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {subscription.payments.length > 0 
                          ? formatCurrency(subscription.payments.reduce((sum, p) => sum + (p.status === 'succeeded' ? p.amountCents : 0), 0))
                          : 'No Payment'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(subscription.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {subscription.renewalDate 
                          ? new Date(subscription.renewalDate).toLocaleDateString()
                          : 'N/A'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          onClick={() => handleViewSubscriptionDetails(subscription)}
                          color="primary"
                        >
                          <Eye size={16} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {data.subscriptions.length === 0 && (
            <Typography align="center" color="textSecondary" sx={{ py: 4 }}>
              No subscriptions found
            </Typography>
          )}
        </CardContent>
      </MainCard>

      {/* Subscription Details Dialog */}
      <Dialog 
        open={detailDialogOpen} 
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Subscription Details</DialogTitle>
        <DialogContent>
          {selectedSubscription && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>Client Information</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Name" 
                      secondary={selectedSubscription.clientName}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Email" 
                      secondary={selectedSubscription.clientEmail}
                    />
                  </ListItem>
                  {selectedSubscription.clientPhone && (
                    <ListItem>
                      <ListItemText 
                        primary="Phone" 
                        secondary={selectedSubscription.clientPhone}
                      />
                    </ListItem>
                  )}
                </List>
                <Stack direction="row" spacing={3} sx={{ ml: 2, mt: 1 }}>
                  <Chip 
                    label={selectedSubscription.status} 
                    color={getStatusColor(selectedSubscription.status) as any}
                    size="small"
                  />
                  <Typography variant="body2" color="textSecondary">
                    Payment: {selectedSubscription.paymentMethod}
                  </Typography>
                </Stack>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>Payment History</Typography>
                {selectedSubscription.payments.length > 0 ? (
                  <List dense>
                    {selectedSubscription.payments.map((payment) => (
                      <ListItem key={payment.id}>
                        <ListItemText 
                          primary={
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Typography variant="body2">
                                {formatCurrency(payment.amountCents)}
                              </Typography>
                              <Chip 
                                label={payment.status} 
                                color={payment.status === 'succeeded' ? 'success' : 'error'}
                                size="small"
                              />
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" color="textSecondary">
                              Provider: {payment.provider}
                              {payment.providerRef && ` | Ref: ${payment.providerRef}`}
                              <br />
                              Date: {new Date(payment.createdAt).toLocaleString()}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No payment information available
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>Subscription Timeline</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Created" 
                      secondary={new Date(selectedSubscription.createdAt).toLocaleString()}
                    />
                  </ListItem>
                  {selectedSubscription.renewalDate && (
                    <ListItem>
                      <ListItemText 
                        primary="Renewal Date" 
                        secondary={new Date(selectedSubscription.renewalDate).toLocaleString()}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
