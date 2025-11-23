'use client';

import { useState, useEffect } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
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
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper
} from '@mui/material';
import {
  ArrowLeft2,
  User,
  Calendar,
  Crown,
  Refresh,
  Activity,
  Clock,
  TickCircle,
  Danger,
  InfoCircle
} from '@wandersonalwes/iconsax-react';
import { format } from 'date-fns';
import api from '@/utils/axios';

interface ClientData {
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
  };
  recentActivities: Array<{
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    type: string;
  }>;
}

export default function ClientOverviewPage() {
  const intl = useIntl();
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/clients/${clientId}/overview`);
      setData(response.data);
    } catch (err: any) {
      console.error('Failed to load client data:', err);
      setError(err.response?.data?.message || 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'expired': return 'error';
      case 'frozen': return 'warning';
      default: return 'default';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'nutrition': return <TickCircle size={20} />;
      case 'workout': return <Activity size={20} />;
      case 'form': return <InfoCircle size={20} />;
      default: return <Clock size={20} />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary"><FormattedMessage id="client.overview.loading" defaultMessage="Loading client overview..." /></Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Button onClick={loadClientData} sx={{ ml: 2 }}>
          <Refresh size={16} />
          <FormattedMessage id="retry" defaultMessage="Retry" />
        </Button>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert severity="warning">
        <FormattedMessage id="client.overview.empty" defaultMessage="No client data found" />
      </Alert>
    );
  }

  const { client, metrics, recentActivities } = data;

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', maxWidth: '100vw' }}>
    <Box sx={{ p: { xs: 1, md: 2 }, width: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowLeft2 size={16} />}
          onClick={() => router.push('/dashboard/clients')}
          sx={{ mb: 2 }}
        >
          <FormattedMessage id="client.overview.back" defaultMessage="Back to Clients" />
        </Button>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <User size={24} />
          </Avatar>
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h4">
                {client.fullName}
              </Typography>
              {client.code && (
                <Chip 
                  label={`#${client.code}`} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              )}
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
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

      {/* Metrics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <TickCircle size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h6">{metrics.totalFormSubmissions}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Form Submissions
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <Crown size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h6">{metrics.activePlansCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Plans
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <Activity size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h6">{metrics.nutritionPlansCount + metrics.workoutPlansCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Plans
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <Clock size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h6">{metrics.pendingFormsCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Forms
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activities */}
      <Card>
        <CardHeader
          title="Recent Activities"
          action={
            <Button
              size="small"
              startIcon={<Refresh size={16} />}
              onClick={loadClientData}
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
          {recentActivities && recentActivities.length > 0 ? (
            <List>
              {recentActivities.slice(0, 10).map((activity, index) => (
                <Box key={activity.id}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      {getActivityIcon(activity.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={activity.title}
                      secondary={
                        <Box>
                          {activity.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              {activity.description}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < recentActivities.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No recent activities
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card sx={{ mt: 2 }}>
        <CardHeader title={intl.formatMessage({ id: 'client.quickActions', defaultMessage: 'Quick Actions' })} />
        <CardContent>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard/clients/${clientId}/nutrition`)}
            >
              <FormattedMessage id="client.nutritionPlans" defaultMessage="Nutrition Plans" />
            </Button>
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard/clients/${clientId}/workout`)}
            >
              <FormattedMessage id="client.workoutPlans" defaultMessage="Workout Plans" />
            </Button>
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard/clients/${clientId}/forms`)}
            >
              <FormattedMessage id="Forms" defaultMessage="Forms" />
            </Button>
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard/clients/${clientId}/subscription`)}
            >
              <FormattedMessage id="client.subscription" defaultMessage="Subscription" />
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
    </Box>
  );
}