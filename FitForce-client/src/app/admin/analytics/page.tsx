'use client';

import React, { useState, useEffect } from 'react';
import api from '@/utils/axios';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Refresh,
  TrendingUp,
  People,
  AttachMoney,
  Receipt,
} from '@mui/icons-material';

interface AnalyticsData {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalRevenueCents: number;
  monthlyRevenue: Record<string, number>;
  subscriptions: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    workspaceSubdomain: string;
    status: string;
    startDate: string;
    endDate: string;
    autoRenew: boolean;
  }>;
}

interface PackageAnalytics {
  package: {
    id: string;
    name: string;
    durationMonths: number;
    priceCents: number;
  };
  analytics: {
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalRevenueCents: number;
    monthlyRevenue: Record<string, number>;
  };
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [packageAnalytics, setPackageAnalytics] = useState<PackageAnalytics[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchAnalytics();
    fetchPackages();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch overall analytics from finance dashboard
      const { data } = await api.get('/api/admin/finance/overview');
      if (data) {
        setAnalytics({
          totalSubscriptions: data.metrics?.totalSubscriptions || 0,
          activeSubscriptions: data.metrics?.activeSubscriptions || 0,
          totalRevenueCents: data.metrics?.totalRevenueCents || 0,
          monthlyRevenue: {},
          subscriptions: data.subscriptions || [],
        });
      } else {
        setError('Failed to fetch analytics');
      }
    } catch (err) {
      setError('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const { data } = await api.get('/api/admin/workspace-packages');
      setPackages(data.packages || []);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
    }
  };

  const fetchPackageAnalytics = async (packageId: string) => {
    try {
      const { data } = await api.get(`/api/admin/workspace-packages/${packageId}/analytics`);
        setPackageAnalytics(prev => {
          const existing = prev.find(p => p.package.id === packageId);
          if (existing) {
            return prev.map(p => p.package.id === packageId ? data : p);
          }
          return [...prev, data];
        });
    } catch (err) {
      console.error('Failed to fetch package analytics:', err);
    }
  };

  const handlePackageSelect = (packageId: string) => {
    setSelectedPackage(packageId);
    if (packageId && !packageAnalytics.find(p => p.package.id === packageId)) {
      fetchPackageAnalytics(packageId);
    }
  };

  const formatPrice = (cents: number, currency: string = 'EGP') => {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'expired':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Payment Analytics
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchAnalytics}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Package Analytics" />
        <Tab label="Subscriptions" />
      </Tabs>

      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <People color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4">
                      {analytics?.totalSubscriptions || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Subscriptions
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingUp color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4">
                      {analytics?.activeSubscriptions || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Subscriptions
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AttachMoney color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4">
                      {formatPrice(analytics?.totalRevenueCents || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Revenue
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Receipt color="info" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="h4">
                      {analytics?.subscriptions?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Workspaces
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <Box>
          <Box sx={{ mb: 3 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Select Package</InputLabel>
              <Select
                value={selectedPackage}
                onChange={(e) => handlePackageSelect(e.target.value)}
                label="Select Package"
              >
                {packages.map((pkg) => (
                  <MenuItem key={pkg.id} value={pkg.id}>
                    {pkg.name} - {formatPrice(pkg.priceCents, pkg.currency)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {selectedPackage && (
            <Grid container spacing={3}>
              {packageAnalytics
                .filter(p => p.package.id === selectedPackage)
                .map((pkgAnalytics) => (
                  <React.Fragment key={pkgAnalytics.package.id}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {pkgAnalytics.package.name}
                          </Typography>
                          <Typography variant="h4" color="primary">
                            {pkgAnalytics.analytics.totalSubscriptions}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Total Subscriptions
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Active
                          </Typography>
                          <Typography variant="h4" color="success.main">
                            {pkgAnalytics.analytics.activeSubscriptions}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Active Subscriptions
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Revenue
                          </Typography>
                          <Typography variant="h4" color="primary">
                            {formatPrice(pkgAnalytics.analytics.totalRevenueCents)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Total Revenue
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Avg. Revenue
                          </Typography>
                          <Typography variant="h4" color="info.main">
                            {pkgAnalytics.analytics.totalSubscriptions > 0
                              ? formatPrice(pkgAnalytics.analytics.totalRevenueCents / pkgAnalytics.analytics.totalSubscriptions)
                              : formatPrice(0)
                            }
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Per Subscription
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </React.Fragment>
                ))}
            </Grid>
          )}
        </Box>
      )}

      {tabValue === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Workspace</TableCell>
                <TableCell>Subdomain</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Auto Renew</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {analytics?.subscriptions?.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {subscription.workspaceName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {subscription.workspaceSubdomain}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={subscription.status}
                      color={getStatusColor(subscription.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {formatDate(subscription.startDate)}
                  </TableCell>
                  <TableCell>
                    {formatDate(subscription.endDate)}
                  </TableCell>
                  <TableCell>
                    {subscription.autoRenew ? 'Yes' : 'No'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
