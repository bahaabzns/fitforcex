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
  Container
} from '@mui/material';
import {
  User,
  CardSend,
  Refresh,
  DollarCircle,
  DocumentText,
  Apple,
  Activity,
  TrendingUp,
  Calendar,
  ArrowUp,
  ArrowDown,
  InfoCircle
} from '@wandersonalwes/iconsax-react';
import api from '@/utils/axios';
import MainCard from '@/components/MainCard';

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
  isCurrency = false 
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  trend?: { value: number; type: 'increase' | 'decrease' };
  isCurrency?: boolean;
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
    <MainCard>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
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
              bgcolor: theme.palette[color as keyof typeof theme.palette].main,
              width: 56,
              height: 56,
              color: 'white'
            }}
          >
            {icon}
          </Avatar>
        </Stack>
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
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <ListItem sx={{ px: 0 }}>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>
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
      />
    </ListItem>
  );
}

export default function DashboardDefault() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Container sx={{ py: 4 }}>
          <Typography variant="h4" gutterBottom>Dashboard</Typography>
          <LinearProgress />
        </Container>
      </Box>
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

  const theme = useTheme();

  return (
    <Box sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Welcome to {data.workspace.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Here's what's happening in your workspace
            </Typography>
          </Box>
          <IconButton onClick={fetchDashboardData} disabled={loading} color="primary">
            <Refresh size={24} />
          </IconButton>
        </Stack>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Active Clients"
            value={data.metrics.clients.active}
            subtitle={`${data.metrics.clients.total} total`}
            icon={<User size={24} />}
            color="primary"
            trend={{
              value: data.metrics.clients.growthPercentage,
              type: data.metrics.clients.growthPercentage >= 0 ? 'increase' : 'decrease'
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Monthly Revenue"
            value={data.metrics.revenue.monthlyCents}
            subtitle="This month"
            icon={<DollarCircle size={24} />}
            color="success"
            isCurrency={true}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Active Subscriptions"
            value={data.metrics.subscriptions.active}
            subtitle={`${data.metrics.subscriptions.expiring} expiring`}
            icon={<Calendar size={24} />}
            color="warning"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Team Members"
            value={data.metrics.team.members}
            subtitle="Currently active"
            icon={<Activity size={24} />}
            color="info"
          />
      </Grid>
      </Grid>

      {/* Secondary Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Forms Submitted"
            value={data.metrics.forms.total}
            subtitle={`${data.metrics.forms.pending} pending`}
            icon={<DocumentText size={24} />}
            color="secondary"
          />
      </Grid>
        
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Nutrition Plans"
            value={data.metrics.plans.nutrition}
            subtitle="Plans created"
            icon={<Apple size={24} />}
            color="info"
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <MetricCard
            title="Workout Plans"
            value={data.metrics.plans.workout}
            subtitle="Programs created"
            icon={<Activity size={24} />}
            color="success"
          />
        </Grid>
      </Grid>

      {/* Quick Stats & Recent Activity */}
      <Grid container spacing={3}>
        {/* Performance Indicators */}
        <Grid item xs={12} lg={4}>
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
                      {data.quickStats.retentionRate}%
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={data.quickStats.retentionRate}
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
                      {data.quickStats.averagePlansPerClient}
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(data.quickStats.averagePlansPerClient * 20, 100)}
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
        </Stack>
            </CardContent>
          </MainCard>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} lg={8}>
          <MainCard title="Recent Activity">
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