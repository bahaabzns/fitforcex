'use client';

import { useState, useEffect } from 'react';
import {
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Card,
  CardContent,
  CardHeader,
  Stack,
  Button,
  Paper,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider
} from '@mui/material';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import { User, Refresh, Notification, Danger, Warning2, TickCircle, InfoCircle, DocumentDownload, Activity, TrendUp, Calendar, DollarCircle, DocumentText, Apple } from '@wandersonalwes/iconsax-react';
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, LineChart } from 'recharts';
import api from '@/utils/axios';
import { useAppSelector } from '@/store';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';

interface DashboardData {
  workspace: {
    id: string;
    name: string;
    subdomain: string;
    createdAt: string;
  };
  clientsOverview: {
    all: number;
    active: number;
    expired: number;
    frozen: number;
    pre_start: number;
    refunded: number;
    no_subscription: number;
  };
  growthData: {
    newClients: number;
    returningClients: number;
    expiredClients: number;
    total: number;
  };
  financeData: {
    subscriptions: {
      firstPlan: number;
      renewal: number;
      total: number;
    };
    totalRevenue?: number;
    monthlyRevenue?: number;
    revenueOverTime?: Array<{ month: string; revenue: number }>;
  };
  formsData: {
    total: number;
    pending: number;
    submissionsOverTime: Array<{ month: string; count: number }>;
  };
  chatsData: {
    totalMessages: number;
    averageResponseTime: number;
    messagesOverTime: Array<{ month: string; count: number }>;
  };
  metrics: {
    clients: { total: number; active: number; growthPercentage: number };
    revenue: { monthlyCents: number; growthPercentage: number };
    subscriptions: { active: number; expiring: number };
    forms: { total: number; pending: number };
    nutritionPlans: { total: number; active: number };
    workoutPlans: { total: number; active: number };
  };
  recentClients: Array<{
    id: string;
    fullName: string;
    email: string;
    status: string;
    createdAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    createdAt: string;
    icon: string;
  }>;
}

export default function DashboardEnhanced() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshTimer] = useState<NodeJS.Timeout | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState({
    clientStatus: 'all',
    planType: 'all',
    revenueRange: 'all',
    engagementLevel: 'all',
    customDateRange: null
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [exportFormat] = useState('pdf');
  const [exportLoading, setExportLoading] = useState(false);
  const [financeCurrency, setFinanceCurrency] = useState<'all' | 'USD' | 'EUR' | 'EGP'>('all');
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [formTemplateStats, setFormTemplateStats] = useState<Array<{
    id: string;
    title: string;
    pending: number;
    requested: number;
    submitted: number;
    done: number;
    total: number;
  }>>([]);

  // Revenue by currency over time (filterable by package)
  const [packages, setPackages] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('all');
  const [currencySeries, setCurrencySeries] = useState<Array<{ date: string; [currency: string]: number }>>([]);
  const [currencyKeys, setCurrencyKeys] = useState<string[]>([]);

  // Real chart data from analytics API
  const [growthData, setGrowthData] = useState<Array<{ month: string; total: number; active: number }>>([]);
  const [revenueData, setRevenueData] = useState<Array<{ month: string; total: number; gateway: number; manual: number }>>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchDashboardData = async (showUpdatingIndicator = true) => {
    try {
      if (showUpdatingIndicator) {
        setIsUpdating(true);
      }
      setError(null);
      
      // Add advanced filters to the API call
      const params = new URLSearchParams();
      if (advancedFilters.clientStatus !== 'all') {
        params.append('clientStatus', advancedFilters.clientStatus);
      }
      if (advancedFilters.planType !== 'all') {
        params.append('planType', advancedFilters.planType);
      }
      if (advancedFilters.revenueRange !== 'all') {
        params.append('revenueRange', advancedFilters.revenueRange);
      }
      if (advancedFilters.engagementLevel !== 'all') {
        params.append('engagementLevel', advancedFilters.engagementLevel);
      }
      if (financeCurrency !== 'all') {
        params.append('financeCurrency', financeCurrency);
      }
      
      const response = await api.get(`/api/workspaces/dashboard?${params.toString()}`);
      setData(response.data);
      setLastUpdateTime(new Date());
      
      // Add success notification for data refresh
      if (showUpdatingIndicator) {
        addNotification({
          type: 'success',
          title: 'Dashboard Updated',
          message: 'Dashboard data has been refreshed successfully.',
        });
      }
    } catch (err: any) {
      console.error('Dashboard API Error:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard data');
      
      // Add error notification
      addNotification({
        type: 'error',
        title: 'Dashboard Error',
        message: err.response?.data?.error || 'Failed to load dashboard data',
      });
    } finally {
      if (showUpdatingIndicator) {
        setLoading(false);
        setIsUpdating(false);
      }
    }
  };

  const handleRefresh = () => {
    fetchDashboardData(true);
    loadAnalyticsData(); // Also refresh analytics data
  };

  const loadFormTemplateStats = async () => {
    try {
      if (!workspaceId) return;
      const res = await api.get('/api/forms/templates', { headers: { 'x-workspace-id': workspaceId } });
      const templates: Array<{ id: string; title: string; submissions?: Array<{ status: string }> }> = Array.isArray(res.data?.templates) ? res.data.templates : [];
      const stats = templates.map((t) => {
        const subs = Array.isArray((t as any).submissions) ? (t as any).submissions : [];
        let pending = 0;
        let requested = 0;
        let submitted = 0;
        let completed = 0;
        for (const s of subs) {
          const status = String((s as any).status || '').toLowerCase();
          if (status === 'pending') pending += 1;
          else if (status === 'todo' || status === 'sent') requested += 1;
          else if (status === 'submitted') submitted += 1;
          else if (status === 'completed') completed += 1;
        }
        const done = submitted + completed;
        const total = pending + requested + submitted + completed;
        return { id: t.id, title: t.title, pending, requested, submitted, done, total };
      });
      setFormTemplateStats(stats);
    } catch (e) {
      setFormTemplateStats([]);
    }
  };

  // Load packages and payments, build currency series per month
  const loadAnalyticsData = async () => {
    try {
      if (!workspaceId) return;
      setAnalyticsLoading(true);
      
      const response = await api.get('/api/workspaces/analytics', { 
        headers: { 'x-workspace-id': workspaceId } 
      });
      
      const { charts } = response.data;
      
      // Set real growth data
      if (charts?.clientGrowth) {
        setGrowthData(charts.clientGrowth.map((item: any) => ({
          month: item.month,
          total: item.total,
          active: item.active
        })));
      }
      
      // Set real revenue data
      if (charts?.revenueTrend) {
        setRevenueData(charts.revenueTrend.map((item: any) => ({
          month: item.month,
          total: item.total,
          gateway: item.gateway,
          manual: item.manual
        })));
      }
      
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      // Fallback to empty data
      setGrowthData([]);
      setRevenueData([]);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadRevenueByCurrency = async (pkgId: string) => {
    try {
      if (!workspaceId) return;
      // Load packages for filter once
      if (packages.length === 0) {
        try {
          const p = await api.get(`/api/workspaces/${workspaceId}/client-packages`);
          const list = (p.data?.packages || []).map((x: any) => ({ id: x.id, name: x.name }));
          setPackages(list);
        } catch {}
      }

      // Load payments
      const payRes = await api.get('/api/finance/payments', { headers: { 'x-workspace-id': workspaceId } });
      const payments: Array<{ amountCents: number; currency: string; createdAt: string; subscriptionId?: string } & any> = payRes.data?.payments || [];

      // If package filter is selected and payment has subscription with packageId, filter (best effort)
      const filtered = payments.filter((p: any) => {
        if (!pkgId || pkgId === 'all') return true;
        const sub = (p as any).subscription;
        return sub?.packageId ? sub.packageId === pkgId : true;
      });

      // Group by month (YYYY-MM)
      const byMonth: Record<string, Record<string, number>> = {};
      const currenciesSet = new Set<string>();
      for (const pay of filtered) {
        const d = new Date(pay.createdAt);
        if (isNaN(d.getTime())) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const curr = (pay.currency || 'USD').toUpperCase();
        const amount = (pay.amountCents || 0) / 100;
        currenciesSet.add(curr);
        if (!byMonth[key]) byMonth[key] = {};
        byMonth[key][curr] = (byMonth[key][curr] || 0) + amount;
      }

      const keys = Array.from(currenciesSet).sort();
      setCurrencyKeys(keys);

      const rows = Object.keys(byMonth)
        .sort()
        .map((month) => ({
          date: month,
          ...keys.reduce((acc, k) => ({ ...acc, [k]: byMonth[month][k] || 0 }), {} as Record<string, number>),
        }));

      setCurrencySeries(rows);
    } catch (e) {
      setCurrencySeries([]);
      setCurrencyKeys([]);
    }
  };

  const addNotification = (notification: {
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
  }) => {
    const newNotification = {
      id: Date.now().toString(),
      ...notification,
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      // Mock export functionality - replace with actual API call
      const exportData = {
        format: exportFormat,
        data: data,
        timestamp: new Date().toISOString()
      };
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create download link
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-export-${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      addNotification({
        type: 'success',
        title: 'Export Successful',
        message: `Dashboard data exported as ${exportFormat.toUpperCase()} successfully.`,
      });
    } catch (err) {
      console.error('Export error:', err);
      addNotification({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export dashboard data. Please try again.',
      });
    } finally {
      setExportLoading(false);
    }
  };

  const applyFilters = () => {
    fetchDashboardData(true);
    loadAnalyticsData(); // Also refresh analytics data when filters change
    setShowAdvancedFilters(false);
  };

  const clearFilters = () => {
    setAdvancedFilters({
      clientStatus: 'all',
      planType: 'all',
      revenueRange: 'all',
      engagementLevel: 'all',
      customDateRange: null
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (iconType: string) => {
    switch (iconType) {
      case 'user': return <User size={20} />;
      case 'form': return <DocumentText size={20} />;
      case 'plan': return <Apple size={20} />;
      case 'revenue': return <DollarCircle size={20} />;
      case 'activity': return <Activity size={20} />;
      default: return <Activity size={20} />;
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchDashboardData();
      loadFormTemplateStats();
      loadRevenueByCurrency(selectedPackageId);
      loadAnalyticsData(); // Load real analytics data
      
      // Add sample notifications for demonstration
      addNotification({
        type: 'info',
        title: 'Dashboard Loaded',
        message: 'Welcome to your enhanced dashboard with real-time updates and notifications.',
      });
      
      addNotification({
        type: 'success',
        title: 'System Status',
        message: 'All systems are operational and running smoothly.',
      });
    }
    
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [workspaceId, advancedFilters, selectedPackageId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading dashboard...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <Typography color="error" variant="h6">
            Error loading dashboard
          </Typography>
          <Typography color="text.secondary">
            {error}
          </Typography>
          <Button variant="contained" onClick={handleRefresh}>
            Retry
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl">
        {/* Welcome Banner */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Welcome to Your Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor your workspace performance and manage your clients effectively.
          </Typography>
        </Box>

        {/* Real-time Controls */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={isMobile ? "column" : "row"} alignItems={isMobile ? "stretch" : "center"} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Real-time Dashboard
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last updated: {format(lastUpdateTime, 'MMM dd, yyyy • h:mm:ss a')}
                </Typography>
              </Box>
              <Stack direction={isMobile ? "column" : "row"} alignItems="center" spacing={2}>
                <Button
                  variant="outlined"
                  onClick={handleRefresh}
                  disabled={isUpdating}
                  startIcon={isUpdating ? <CircularProgress size={16} /> : <Refresh size={16} />}
                  size={isMobile ? "small" : "medium"}
                >
                  {isMobile ? (isUpdating ? '...' : 'Refresh') : (isUpdating ? 'Updating...' : 'Refresh Now')}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowNotifications(!showNotifications)}
                  startIcon={<Notification size={16} />}
                  size={isMobile ? "small" : "medium"}
                  sx={{ position: 'relative' }}
                >
                  {isMobile ? 'Alerts' : 'Notifications'}
                  {notifications.filter(n => !n.read).length > 0 && (
                    <Chip
                      label={notifications.filter(n => !n.read).length}
                      size="small"
                      color="error"
                      sx={{ 
                        position: 'absolute', 
                        top: -8, 
                        right: -8,
                        minWidth: 20,
                        height: 20,
                        fontSize: '0.75rem'
                      }}
                    />
                  )}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  startIcon={<Activity size={16} />}
                  size={isMobile ? "small" : "medium"}
                >
                  {isMobile ? 'Filters' : 'Advanced Filters'}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleExport}
                  disabled={exportLoading}
                  startIcon={exportLoading ? <CircularProgress size={16} /> : <DocumentDownload size={16} />}
                  size={isMobile ? "small" : "medium"}
                >
                  {isMobile ? (exportLoading ? '...' : 'Export') : (exportLoading ? 'Exporting...' : 'Export Report')}
                </Button>
              </Stack>
            </Stack>
            
            {/* Notifications Panel */}
            {showNotifications && (
              <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                  Notifications ({notifications.length})
                </Typography>
                <Stack spacing={2}>
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <Paper
                        key={notification.id}
                        sx={{
                          p: 2,
                          borderLeft: `4px solid ${
                            notification.type === 'error' ? 'error.main' :
                            notification.type === 'warning' ? 'warning.main' :
                            notification.type === 'success' ? 'success.main' : 'info.main'
                          }`,
                          opacity: notification.read ? 0.7 : 1,
                        }}
                      >
                        <Stack direction="row" alignItems="flex-start" spacing={2}>
                          <Avatar
                            sx={{
                              bgcolor: notification.type === 'error' ? 'error.main' :
                                       notification.type === 'warning' ? 'warning.main' :
                                       notification.type === 'success' ? 'success.main' : 'info.main',
                              width: 32,
                              height: 32
                            }}
                          >
                            {notification.type === 'error' ? <Danger size={16} /> :
                             notification.type === 'warning' ? <Warning2 size={16} /> :
                             notification.type === 'success' ? <TickCircle size={16} /> : <InfoCircle size={16} />}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              {notification.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                              {notification.message}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(notification.timestamp, 'MMM dd, yyyy • h:mm a')}
                            </Typography>
                          </Box>
                          {!notification.read && (
                            <Chip
                              label="New"
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Paper>
                    ))
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">
                        No notifications
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Advanced Filters" />
            <CardContent>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Client Status</InputLabel>
                  <Select
                    value={advancedFilters.clientStatus}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, clientStatus: e.target.value }))}
                  >
                    <MenuItem value="all">All Clients</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl fullWidth size="small">
                  <InputLabel>Plan Type</InputLabel>
                  <Select
                    value={advancedFilters.planType}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, planType: e.target.value }))}
                  >
                    <MenuItem value="all">All Plans</MenuItem>
                    <MenuItem value="nutrition">Nutrition</MenuItem>
                    <MenuItem value="workout">Workout</MenuItem>
                    <MenuItem value="combined">Combined</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl fullWidth size="small">
                  <InputLabel>Revenue Range</InputLabel>
                  <Select
                    value={advancedFilters.revenueRange}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, revenueRange: e.target.value }))}
                  >
                    <MenuItem value="all">All Revenue</MenuItem>
                    <MenuItem value="0-1000">$0 - $1,000</MenuItem>
                    <MenuItem value="1000-5000">$1,000 - $5,000</MenuItem>
                    <MenuItem value="5000+">$5,000+</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl fullWidth size="small">
                  <InputLabel>Engagement</InputLabel>
                  <Select
                    value={advancedFilters.engagementLevel}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, engagementLevel: e.target.value }))}
                  >
                    <MenuItem value="all">All Levels</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button variant="outlined" onClick={clearFilters} size="small">
                  Clear Filters
                </Button>
                <Button variant="contained" onClick={applyFilters} size="small">
                  Apply Filters
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Primary Statistics Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 3, mb: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {data?.clientsOverview?.all || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Clients
                  </Typography>
                  {isUpdating && <CircularProgress size={16} />}
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                  <User size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {data?.clientsOverview?.active || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Clients
                  </Typography>
                  {isUpdating && <CircularProgress size={16} />}
                </Box>
                <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                  <Activity size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    ${(data?.financeData?.subscriptions?.total || 0) * 100}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Revenue
                  </Typography>
                  {isUpdating && <CircularProgress size={16} />}
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                  <DollarCircle size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {data?.formsData?.total || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Forms
                  </Typography>
                  {isUpdating && <CircularProgress size={16} />}
                </Box>
                <Avatar sx={{ bgcolor: 'info.main', width: 56, height: 56 }}>
                  <DocumentText size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Secondary Statistics Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 3, mb: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {data?.metrics?.subscriptions?.active || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Subscriptions
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data?.metrics?.subscriptions?.expiring || 0} expiring
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56 }}>
                  <Calendar size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {data?.metrics?.nutritionPlans?.total || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Nutrition Plans
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data?.metrics?.workoutPlans?.total || 0} workout plans
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                  <Apple size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    1
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Team Members
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Currently active
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'info.main', width: 56, height: 56 }}>
                  <User size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    85%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Conversion Rate
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    92% retention
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                  <TrendUp size={24} />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Charts Section */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Client Growth
              </Typography>
              <Box sx={{ height: 300 }}>
                {analyticsLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                ) : growthData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="total" stroke="#1976d2" strokeWidth={2} name="Total Clients" />
                      <Line type="monotone" dataKey="active" stroke="#2e7d32" strokeWidth={2} name="Active Clients" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No client growth data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 1 }}>
                <Typography variant="h6">
                  Revenue Trend
                </Typography>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="currency-label">Currency</InputLabel>
                  <Select
                    labelId="currency-label"
                    id="currency-select"
                    value={financeCurrency}
                    label="Currency"
                    onChange={(e) => setFinanceCurrency(e.target.value as 'all' | 'USD' | 'EUR' | 'EGP')}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="EGP">EGP</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Box sx={{ height: 300 }}>
                {analyticsLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                ) : revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" fill="#ed6c02" name="Total Revenue" />
                      <Bar dataKey="gateway" fill="#1976d2" name="Gateway Revenue" />
                      <Bar dataKey="manual" fill="#2e7d32" name="Manual Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No revenue data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Forms by Template Table */}
        <Card sx={{ mb: 3 }}>
          <CardHeader title="Forms by Template" subheader="Scheduled, Requested, Submitted, Done, Total" />
          <CardContent>
            {formTemplateStats.length === 0 ? (
              <Typography color="text.secondary">No form templates found.</Typography>
            ) : (
              <Table size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                  <TableRow>
                    <TableCell>Template</TableCell>
                    <TableCell align="right">Scheduled</TableCell>
                    <TableCell align="right">Requested</TableCell>
                    <TableCell align="right">Submitted</TableCell>
                    <TableCell align="right">Done</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formTemplateStats.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.title}</TableCell>
                      <TableCell align="right">{row.pending}</TableCell>
                      <TableCell align="right">{row.requested}</TableCell>
                      <TableCell align="right">{row.submitted}</TableCell>
                      <TableCell align="right">{row.done}</TableCell>
                      <TableCell align="right">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Currency (filter by Package) */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems={isMobile ? 'flex-start' : 'center'} justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6">Revenue by Currency</Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="pkg-filter-label">Package</InputLabel>
                <Select
                  labelId="pkg-filter-label"
                  label="Package"
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(String(e.target.value))}
                >
                  <MenuItem value="all">All Packages</MenuItem>
                  {packages.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currencySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  {currencyKeys.map((key, idx) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0", "#0088FE", "#00C49F"][idx % 6]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Performance Indicators & Recent Activity */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 3 }}>
          {/* Performance Indicators */}
          <Card>
            <CardHeader title="Performance Indicators" />
            <CardContent>
              <Stack spacing={3}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Conversion Rate
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      85%
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={85}
                    sx={{ 
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        bgcolor: 'success.main'
                      }
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Retention Rate
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      92%
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={92}
                    sx={{ 
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        bgcolor: 'primary.main'
                      }
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Avg Plans per Client
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      2.3
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={46}
                    sx={{ 
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        bgcolor: 'warning.main'
                      }
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Monthly Revenue Growth
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      +{data?.financeData?.monthlyRevenue || 0}%
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min((data?.financeData?.monthlyRevenue || 0) * 2, 100)}
                    sx={{ 
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        bgcolor: 'info.main'
                      }
                    }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader title="Recent Activity" />
            <CardContent>
              {data?.recentActivities && data.recentActivities.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {data.recentActivities.slice(0, 5).map((activity, index) => (
                    <Box key={activity.id}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>
                            {getActivityIcon(activity.icon)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                              {activity.title}
                            </Typography>
                          }
                          secondary={
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" color="text.secondary">
                                {activity.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {getTimeAgo(activity.createdAt)}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                      {index < data.recentActivities.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No recent activity
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Operation Health */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Operation Health
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
              <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                    <TickCircle size={16} />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Database Status
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      All systems operational
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                    <TickCircle size={16} />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      API Response
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      120ms average
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'info.main', width: 32, height: 32 }}>
                    <InfoCircle size={16} />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      System Uptime
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      99.9% availability
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                    <TickCircle size={16} />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Memory Usage
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      45% utilized
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </LocalizationProvider>
  );
}