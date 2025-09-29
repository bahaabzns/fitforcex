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
  Avatar
} from '@mui/material';
import {
  ArrowLeft2,
  User,
  Calendar,
  Crown
} from '@wandersonalwes/iconsax-react';
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
  };
  activities: Array<{
    id: string;
    title: string;
    description?: string;
    createdAt: string;
  }>;
}

export default function ClientOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [data, setData] = useState<ClientOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/clients/${id}/overview`);
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load client overview');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'expired':
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

  const { client, metrics, activities } = data;

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <User size={24} />
          </Avatar>
          <Box>
            <Typography variant="h4" gutterBottom>
              {client.fullName}
            </Typography>
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
            </Stack>
          </Box>
        </Box>
        <Chip
          label={client.status}
          color={getStatusColor(client.status) as any}
          variant="outlined"
        />
      </Box>

      {/* Metrics */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <Calendar size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h4">{metrics.totalFormSubmissions}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Form Submissions
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <Calendar size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h4">{metrics.nutritionPlansCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nutrition Plans
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <Calendar size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h4">{metrics.workoutPlansCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Workout Plans
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <Crown size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h4">{metrics.subscriptionsCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Subscriptions
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <Calendar size={20} />
                </Avatar>
                <Box>
                  <Typography variant="h4">{metrics.pendingFormsCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Forms
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <Typography variant="h6">Recent Activities</Typography>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <Stack spacing={2}>
              {activities.map((activity) => (
                <Box
                  key={activity.id}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1
                  }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    {activity.title}
                  </Typography>
                  {activity.description && (
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {activity.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No recent activities
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
