'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Grid,
  Stack,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Box,
  Chip,
  Paper,
  Avatar,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  LinearProgress,
  IconButton,
  Container,
  Tooltip,
  Badge
} from '@mui/material';
import {
  User,
  CardSend,
  Refresh,
  DollarCircle,
  DocumentText,
  Apple,
  Activity,
  TrendUp,
  Calendar,
  ArrowUp,
  ArrowDown,
  InfoCircle,
  Setting2,
  Chart,
  Profile2User,
  FavoriteChart,
  Eye
} from '@wandersonalwes/iconsax-react';
import api from '@/utils/axios';
import MainCard from '@/components/MainCard';
import OnboardingWizard from '@/components/OnboardingWizard';
import { useAppSelector } from '@/store';

interface WorkspaceInfo {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
}

interface DashboardMetrics {
  clients: {
    total: number;
    active: number;
    newThisMonth: number;
    growthPercentage: number;
  };
  subscriptions: {
    total: number;
    active: number;
    expiring: number;
  };
  forms: {
    total: number;
    pending: number;
    completed: number;
  };
  plans: {
    nutrition: number;
    workout: number;
  };
  team: {
    members: number;
  };
  revenue: {
    totalCents: number;
    monthlyCents: number;
  };
}

interface ActivityItem {
  type: string;
  id: string;
  title: string;
  description: string;
  createdAt: string;
  icon: string;
}

interface DashboardData {
  workspace: WorkspaceInfo;
  metrics: DashboardMetrics;
  activities: ActivityItem[];
  quickStats: {
    conversionRate: number;
    averagePlansPerClient: number;
    retentionRate: number;
  };
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'primary',
  trend = null,
  isCurrency = false,
  action = null
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  trend?: { value: number; type: 'increase' | 'decrease' };
  isCurrency?: boolean;
  action?: React.ReactNode;
}) {
  const theme = useTheme();
  
  const formatValue = (val: number | string) => {
    if (isCurrency && typeof val === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'EGP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val / 100);
    }
    return val.toLocaleString();
  };

  return (
    <MainCard sx={{ height: '100%', position: 'relative' }}>
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
            {action}
          </Stack>
        }
        action={
          <IconButton size="small" color="primary">
            <Eye size={16} />
          </IconButton>
        }
      />
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: trend ? 1 : 0 }}>
              {formatValue(value)}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              {trend && (
                <Chip
                  icon={
                    trend.type === 'increase' ? (
                      <ArrowUp size={16} />
                    ) : (
                      <ArrowDown size={16} />
                    )
                  }
                  label={`${Math.abs(trend.value)}%`}
                  color={trend.type === 'increase' ? 'success' : 'error'}
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                />
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Stack>
          </Box>
          <Avatar
            variant="rounded"
            sx={{
              bgcolor: `${theme.palette[color as keyof typeof theme.palette].main}20`,
              width: 64,
              height: 64,
              color: theme.palette[color as keyof typeof theme.palette].main
            }}
          >
            {icon}
          </Avatar>
        </Stack>
      </CardContent>
    </MainCard>
  );
}

function ChartCard({ 
  title, 
  data, 
  type = 'bar',
  children 
}: {
  title: string;
  data?: any[];
  type?: 'bar' | 'line' | 'pie';
  children?: React.ReactNode;
}) {
  return (
    <MainCard title={title}>
      <CardContent>
        {children || (
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stack alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>
                <Chart size={24} />
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                Chart visualization will be displayed here
              </Typography>
            </Stack>
          </Box>
        )}
      </CardContent>
    </MainCard>
  );
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'user':
        return <User size={20} />;
      case 'form':
        return <DocumentText size={20} />;
      case 'nutrition':
        return <Apple size={20} />;
      case 'workout':
        return <Activity size={20} />;
      default:
        return <InfoCircle size={20} />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <ListItem sx={{ px: 0, py: 1 }}>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 36, height: 36 }}>
          {getIcon(activity.icon)}
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
        secondaryTypographyProps={{ component: 'div' }}
      />
    </ListItem>
  );
}

function QuickActionCard({ 
  title, 
  description, 
  icon, 
  color = 'primary',
  action 
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  color?: string;
  action: () => void;
}) {
  return (
    <MainCard sx={{ cursor: 'pointer', height: '100%' }} onClick={action}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar 
            sx={{ 
              bgcolor: `${color}.light`, 
              color: `${color}.main`,
              width: 48,
              height: 48
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </MainCard>
  );
}

export default function DashboardEnhanced() {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');
  const [onboardingStatus, setOnboardingStatus] = useState<{ isOnboarded: boolean } | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const checkOnboarding = async () => {
    try {
      setCheckingOnboarding(true);
      const response = await api.get('/api/workspaces/onboarding/status');
      setOnboardingStatus(response.data);
    } catch (err) {
      console.error('Error checking onboarding status:', err);
      // If there's an error, assume onboarded to not block access
      setOnboardingStatus({ isOnboarded: true });
    } finally {
      setCheckingOnboarding(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/workspaces/dashboard');
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (onboardingStatus?.isOnboarded) {
      fetchDashboardData();
    }
  }, [onboardingStatus]);

  const handleQuickAction = (actionType: string) => {
    // Implement quick actions
    console.log('Quick action:', actionType);
  };

  // Check onboarding status first
  if (checkingOnboarding) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Dashboard</Typography>
        <LinearProgress />
      </Container>
    );
  }

  // Show onboarding wizard if not onboarded
  if (onboardingStatus && !onboardingStatus.isOnboarded) {
    return <OnboardingWizard workspaceId={workspaceId} />;
  }

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Dashboard</Typography>
        <LinearProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Dashboard</Typography>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={fetchDashboardData} startIcon={<Refresh size={16} />}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4">No dashboard data available</Typography>
      </Container>
    );
  }

  return (
    <Box sx={{ py: 4 }}>
      {/* Enhanced Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Workspace Analytics
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {data.workspace.name} • Comprehensive Insights & Performance Metrics
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip 
              label={viewMode === 'overview' ? 'Overview' : 'Detailed'}
              onClick={() => setViewMode(viewMode === 'overview' ? 'detailed' : 'overview')}
              color="primary"
              variant="outlined"
              icon={<Setting2 size={16} />}
            />
            <IconButton onClick={fetchDashboardData} disabled={loading} color="primary">
              <Refresh size={24} />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {/* Key Performance Indicators */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          🔑 Key Performance Indicators
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Active Clients"
              value={data.metrics.clients.active}
              />
            <Tooltip title="Total active clients in your workspace">
              <span>
                <Chip 
                  label={`${data.metrics.clients.newThisMonth} new this month`}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              </span>
            </Tooltip>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Monthly Revenue"
              value={data.metrics.revenue.monthlyCents}
              />
            <Tooltip title="Revenue generated in the current month">
              <span>
                <Chip 
                  label={`${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP' }).format(data.metrics.revenue.totalCents / 100)} total`}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              </span>
            </Tooltip>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Active Subscriptions"
              value={data.metrics.subscriptions.active}
              />
            <Tooltip title="Currently active subscription plans">
              <span>
                <Badge badgeContent={data.metrics.subscriptions.expiring} color="warning">
                  <Chip 
                    label={`${data.metrics.subscriptions.expiring} expiring`}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ mt: 1 }}
                  />
                </Badge>
              </span>
            </Tooltip>
          </Grid>
          
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricCard
              title="Team Capacity"
              value={`${data.metrics.team.members} members`}
              />
            <Tooltip title="Number of team members in your workspace">
              <Chip 
                label="All active"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </Tooltip>
          </Grid>
        </Grid>
      </Box>

      {/* Business Intelligence Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          📊 Business Intelligence
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title="Revenue Trends">
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 1 }}>
                <Stack alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.light', color: 'success.main', width: 64, height: 64 }}>
                    <TrendUp size={32} />
                  </Avatar>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Revenue Growth
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Monthly revenue trend visualization
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </ChartCard>
          </Grid>
          
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title="Client Growth">
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 1 }}>
                <Stack alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 64, height: 64 }}>
                    <Profile2User size={32} />
                  </Avatar>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Client Analytics
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Growth trends and engagement metrics
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </ChartCard>
          </Grid>
        </Grid>
      </Box>

      {/* Quick Actions & Recent Activity */}
      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <MainCard title="Quick Actions">
            <CardContent>
              <Stack spacing={2}>
                <QuickActionCard
                  title="Invite Client"
                  description="Add a new client to your workspace"
                  icon={<User size={24} />}
                  color="primary"
                  action={() => handleQuickAction('invite_client')}
                />
                <QuickActionCard
                  title="Create Form"
                  description="Design a new form template"
                  icon={<DocumentText size={24} />}
                  color="info"
                  action={() => handleQuickAction('create_form')}
                />
                <QuickActionCard
                  title="Generate Report"
                  description="Create analytics report"
                  icon={<FavoriteChart size={24} />}
                  color="success"
                  action={() => handleQuickAction('generate_report')}
                />
              </Stack>
            </CardContent>
          </MainCard>
        </Grid>

        {/* Enhanced Performance Indicators */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <MainCard title="Performance Indicators">
            <CardContent>
              <Stack spacing={3}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Conversion Rate
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {data.quickStats.conversionRate}%
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={data.quickStats.conversionRate}
                    sx={{ 
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
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
                      {data.quickStats.retentionRate}%
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={data.quickStats.retentionRate}
                    sx={{ 
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: 'primary.main'
                      }
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Plan Engagement
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {data.quickStats.averagePlansPerClient}
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(data.quickStats.averagePlansPerClient * 20, 100)}
                    sx={{ 
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: 'warning.main'
                      }
                    }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </MainCard>
        </Grid>

        {/* Enhanced Recent Activity */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <MainCard 
            title="Recent Activity" 
            secondary={
              <Button size="small" color="primary">
                View All
              </Button>
            }
          >
            <CardContent>
              {data.activities.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {data.activities.map((activity, index) => (
                    <Box key={activity.id}>
                      <ActivityCard activity={activity} />
                      {index < data.activities.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Avatar sx={{ bgcolor: 'grey.100', color: 'grey.600', mx: 'auto', mb: 2 }}>
                    <InfoCircle size={24} />
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">
                    No recent activity to show
                  </Typography>
                </Box>
              )}
            </CardContent>
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
