'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Chip,
  Grid,
  Stack,
  CircularProgress,
  Alert,
  Avatar,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import {
  ArrowLeft2,
  User,
  Calendar,
  Crown,
  Refresh,
  TrendUp,
  TrendDown,
  Activity,
  Clock,
  TickCircle,
  Pending,
  Danger,
  InfoCircle,
  DocumentDownload,
  FilterEdit
} from '@wandersonalwes/iconsax-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import api from '@/utils/axios';

interface ClientOverviewData {
  client: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  metrics: {
    totalFormSubmissions: number;
    nutritionPlansCount: number;
    workoutPlansCount: number;
    subscriptionsCount: number;
    pendingFormsCount: number;
    completedFormsCount: number;
    activePlansCount: number;
    totalRevenue: number;
    averageResponseTime: number;
    engagementScore: number;
  };
  activities: Array<{
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    type: string;
  }>;
  trends: {
    formSubmissionsOverTime: Array<{
      date: string;
      count: number;
    }>;
    planCompletionsOverTime: Array<{
      date: string;
      nutrition: number;
      workout: number;
    }>;
    revenueOverTime: Array<{
      date: string;
      amount: number;
    }>;
    engagementOverTime: Array<{
      date: string;
      score: number;
    }>;
  };
  performance: {
    formCompletionRate: number;
    planAdherenceRate: number;
    averageSessionDuration: number;
    lastActiveDate: string;
    streakDays: number;
  };
}

export default function ClientOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const id = params?.id as string;
  const [data, setData] = useState<ClientOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [dateRange, setDateRange] = useState('30');
  const [refreshing, setRefreshing] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/clients/${id}/overview`, {
        params: { dateRange }
      });
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load client overview');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleExport = async (format: string) => {
    try {
      setExportLoading(true);
      
      const exportData = {
        format,
        clientId: id,
        dateRange,
        data: data,
        timestamp: new Date().toISOString(),
      };

      const response = await api.post(`/api/clients/${id}/export`, exportData, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `client-report-${client?.fullName?.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      // Fallback: export as JSON
      const exportData = {
        timestamp: new Date().toISOString(),
        clientId: id,
        dateRange,
        data: data,
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `client-data-${client?.fullName?.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, dateRange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pre_start':
        return 'warning';
      case 'pending':
        return 'warning';
      case 'no_subscription':
        return 'default';
      case 'frozen':
        return 'warning';
      case 'expired':
        return 'error';
      case 'refunded':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading client overview...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Stack spacing={3}>
        <Button
          variant="outlined"
          startIcon={<ArrowLeft2 size={16} />}
          onClick={() => router.push('/dashboard/clients')}
        >
          Back to Clients
        </Button>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Failed to load client overview
          </Typography>
          <Typography color="text.secondary">
            The client may not exist or you may not have access.
          </Typography>
        </Alert>
      </Stack>
    );
  }

  const { client, metrics, activities, trends, performance } = data;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const MetricCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    trend, 
    subtitle 
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    trend?: { value: number; isPositive: boolean };
    subtitle?: string;
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
                {trend.isPositive ? (
                  <TrendUp size={14} color="#4caf50" />
                ) : (
                  <TrendDown size={14} color="#f44336" />
                )}
                <Typography 
                  variant="caption" 
                  color={trend.isPositive ? 'success.main' : 'error.main'}
                  sx={{ fontWeight: 'bold' }}
                >
                  {Math.abs(trend.value)}%
                </Typography>
              </Stack>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Stack>
      </CardContent>
    </Card>
  );

  const PerformanceIndicator = ({ 
    label, 
    value, 
    max = 100, 
    color = 'primary' 
  }: {
    label: string;
    value: number;
    max?: number;
    color?: string;
  }) => (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {value}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={(value / max) * 100}
        color={color as any}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowLeft2 size={16} />}
            onClick={() => router.push('/dashboard/clients')}
            fullWidth={isMobile}
          >
            Back to Clients
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              <User size={24} />
            </Avatar>
            <Box>
              <Typography variant="h4" gutterBottom>
                {client.fullName}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                {client.email && (
                  <Typography variant="body2" color="text.secondary">
                    {client.email}
                  </Typography>
                )}
                {client.phone && (
                  <Typography variant="body2" color="text.secondary">
                    {client.phone}
                  </Typography>
                )}
                <Chip
                  label={client.status}
                  color={getStatusColor(client.status) as any}
                  variant="outlined"
                  size="small"
                />
              </Stack>
            </Box>
          </Box>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
          <FormControl size="small" sx={{ minWidth: 120, width: { xs: '100%', sm: 'auto' } }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              label="Date Range"
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="7">Last 7 days</MenuItem>
              <MenuItem value="30">Last 30 days</MenuItem>
              <MenuItem value="90">Last 90 days</MenuItem>
              <MenuItem value="365">Last year</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <Refresh size={20} className={refreshing ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
          <FormControl size="small" sx={{ minWidth: 100, width: { xs: '100%', sm: 'auto' } }}>
            <InputLabel>Export</InputLabel>
            <Select
              value="pdf"
              label="Export"
              onChange={(e) => handleExport(e.target.value)}
              disabled={exportLoading}
            >
              <MenuItem value="pdf">PDF Report</MenuItem>
              <MenuItem value="excel">Excel File</MenuItem>
              <MenuItem value="csv">CSV Data</MenuItem>
              <MenuItem value="json">JSON Data</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Export Report">
            <IconButton 
              onClick={() => handleExport('pdf')}
              disabled={exportLoading || !data}
            >
              {exportLoading ? <CircularProgress size={20} /> : <DocumentDownload size={20} />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Forms"
            value={metrics.totalFormSubmissions}
            icon={<Calendar size={24} />}
            color="#1976d2"
            trend={{ value: 12, isPositive: true }}
            subtitle={`${metrics.completedFormsCount} completed`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Plans"
            value={metrics.activePlansCount}
            icon={<Activity size={24} />}
            color="#2e7d32"
            trend={{ value: 8, isPositive: true }}
            subtitle={`${metrics.nutritionPlansCount} nutrition, ${metrics.workoutPlansCount} workout`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Revenue"
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            icon={<Crown size={24} />}
            color="#ed6c02"
            trend={{ value: 15, isPositive: true }}
            subtitle={`${metrics.subscriptionsCount} subscriptions`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Engagement Score"
            value={metrics.engagementScore}
            icon={<TrendUp size={24} />}
            color="#9c27b0"
            trend={{ value: 5, isPositive: true }}
            subtitle={`${performance.streakDays} day streak`}
          />
        </Grid>
      </Grid>

      {/* Performance Indicators */}
      <Card>
        <CardHeader title="Performance Metrics" />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <PerformanceIndicator
                label="Form Completion Rate"
                value={performance.formCompletionRate}
                color="primary"
              />
              <PerformanceIndicator
                label="Plan Adherence Rate"
                value={performance.planAdherenceRate}
                color="success"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <PerformanceIndicator
                label="Average Response Time"
                value={metrics.averageResponseTime}
                max={24}
                color="warning"
              />
              <PerformanceIndicator
                label="Session Duration"
                value={performance.averageSessionDuration}
                max={60}
                color="info"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs for detailed views */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Activity Trends" />
            <Tab label="Performance Analytics" />
            <Tab label="Recent Activity" />
            <Tab label="Revenue Analysis" />
          </Tabs>
        </Box>

        <CardContent>
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={12} sx={{ minWidth: 0 }}>
                <Typography variant="h6" gutterBottom>
                  Form Submissions Over Time
                </Typography>
                <Box sx={{ height: 360, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends.formSubmissionsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
                      />
                      <YAxis />
                      <RechartsTooltip 
                        labelFormatter={(value) => format(parseISO(value), 'MMM dd, yyyy')}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#1976d2" 
                        fill="#1976d2" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12} md={12} sx={{ minWidth: 0 }}>
                <Typography variant="h6" gutterBottom>
                  Plan Completions Over Time
                </Typography>
                <Box sx={{ height: 360, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.planCompletionsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
                      />
                      <YAxis />
                      <RechartsTooltip 
                        labelFormatter={(value) => format(parseISO(value), 'MMM dd, yyyy')}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="nutrition" 
                        stroke="#2e7d32" 
                        strokeWidth={2}
                        name="Nutrition Plans"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="workout" 
                        stroke="#1976d2" 
                        strokeWidth={2}
                        name="Workout Plans"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          )}

          {activeTab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={12} sx={{ minWidth: 0 }}>
                <Typography variant="h6" gutterBottom>
                  Engagement Score Trend
                </Typography>
                <Box sx={{ height: 360, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.engagementOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
                      />
                      <YAxis />
                      <RechartsTooltip 
                        labelFormatter={(value) => format(parseISO(value), 'MMM dd, yyyy')}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#9c27b0" 
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12} md={12} sx={{ minWidth: 0 }}>
                <Typography variant="h6" gutterBottom>
                  Activity Distribution
                </Typography>
                <Box sx={{ height: 360, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Forms', value: metrics.totalFormSubmissions, color: '#1976d2' },
                          { name: 'Nutrition Plans', value: metrics.nutritionPlansCount, color: '#2e7d32' },
                          { name: 'Workout Plans', value: metrics.workoutPlansCount, color: '#ed6c02' },
                          { name: 'Subscriptions', value: metrics.subscriptionsCount, color: '#9c27b0' },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'Forms', value: metrics.totalFormSubmissions, color: '#1976d2' },
                          { name: 'Nutrition Plans', value: metrics.nutritionPlansCount, color: '#2e7d32' },
                          { name: 'Workout Plans', value: metrics.workoutPlansCount, color: '#ed6c02' },
                          { name: 'Subscriptions', value: metrics.subscriptionsCount, color: '#9c27b0' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          )}

          {activeTab === 2 && (
            <Stack spacing={2}>
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <Paper key={activity.id} sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar sx={{ 
                        bgcolor: activity.type === 'form' ? 'primary.main' : 
                                activity.type === 'nutrition' ? 'success.main' :
                                activity.type === 'workout' ? 'warning.main' : 'secondary.main',
                        width: 40,
                        height: 40
                      }}>
                        {activity.type === 'form' ? <Calendar size={20} /> :
                         activity.type === 'nutrition' ? <TickCircle size={20} /> :
                         activity.type === 'workout' ? <Activity size={20} /> : <InfoCircle size={20} />}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          {activity.title}
                        </Typography>
                        {activity.description && (
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {activity.description}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {format(parseISO(activity.createdAt), 'MMM dd, yyyy • h:mm a')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    No recent activities
                  </Typography>
                </Box>
              )}
            </Stack>
          )}

          {activeTab === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Revenue Over Time
                </Typography>
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends.revenueOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => format(parseISO(value), 'MMM dd')}
                      />
                      <YAxis />
                      <RechartsTooltip 
                        labelFormatter={(value) => format(parseISO(value), 'MMM dd, yyyy')}
                        formatter={(value) => [`$${value}`, 'Revenue']}
                      />
                      <Bar dataKey="amount" fill="#ed6c02" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
