'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Error,
  Speed,
  Memory,
  Storage,
  People,
  AttachMoney,
} from '@mui/icons-material';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  database: {
    status: string;
    responseTime: number;
  };
  memory: {
    used: number;
    total: number;
    external: number;
  };
  version: string;
}

interface MetricsData {
  uptime: number;
  totalRequests: number;
  recentRequests: number;
  avgResponseTime: number;
  errorCount: number;
  errorRate: number;
  slowRequestCount: number;
  requestsPerMinute: number;
  methodStats: Record<string, number>;
  statusStats: Record<number, number>;
  pathStats: Array<[string, number]>;
  timestamp: string;
}

interface BusinessMetricsData {
  users: { total: number };
  workspaces: { total: number };
  clients: { total: number };
  subscriptions: {
    total: number;
    active: number;
    conversionRate: number;
  };
  payments: {
    total: number;
    recent: number;
  };
  revenue: {
    totalEGP: number;
    recentEGP: number;
  };
  timestamp: string;
}

interface AlertData {
  type: string;
  message: string;
  severity: string;
  timestamp: string;
  resolved: boolean;
}

export default function MonitoringDashboard() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetricsData | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all monitoring data
      const [healthRes, metricsRes, businessRes, alertsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/metrics', {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`,
          },
        }),
        fetch('/api/metrics/business', {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`,
          },
        }),
        fetch('/api/metrics/alerts', {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`,
          },
        }),
      ]);

      if (healthRes.ok) {
        const health = await healthRes.json();
        setHealthData(health);
      }

      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        setMetricsData(metrics);
      }

      if (businessRes.ok) {
        const business = await businessRes.json();
        setBusinessMetrics(business);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }
    } catch (err) {
      setError('Failed to fetch monitoring data');
      console.error('Monitoring data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'connected':
        return 'success';
      case 'unhealthy':
      case 'disconnected':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading monitoring data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📊 System Monitoring Dashboard
      </Typography>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            🚨 Active Alerts
          </Typography>
          {alerts.map((alert, index) => (
            <Alert 
              key={index} 
              severity={getSeverityColor(alert.severity) as any}
              sx={{ mb: 1 }}
            >
              <strong>{alert.type}:</strong> {alert.message}
              <br />
              <small>{new Date(alert.timestamp).toLocaleString()}</small>
            </Alert>
          ))}
        </Box>
      )}

      {/* Health Status */}
      {healthData && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <CheckCircle color={getStatusColor(healthData.status) as any} />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    System Health
                  </Typography>
                </Box>
                <Chip 
                  label={healthData.status.toUpperCase()} 
                  color={getStatusColor(healthData.status) as any}
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Uptime: {formatUptime(healthData.uptime)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Version: {healthData.version}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Storage color={getStatusColor(healthData.database.status) as any} />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Database
                  </Typography>
                </Box>
                <Chip 
                  label={healthData.database.status.toUpperCase()} 
                  color={getStatusColor(healthData.database.status) as any}
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Response Time: {healthData.database.responseTime}ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Memory />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Memory Usage
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {healthData.memory.used}MB / {healthData.memory.total}MB
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={(healthData.memory.used / healthData.memory.total) * 100}
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {Math.round((healthData.memory.used / healthData.memory.total) * 100)}% used
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Performance Metrics */}
      {metricsData && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Speed />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Avg Response Time
                  </Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {metricsData.avgResponseTime}ms
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metricsData.totalRequests} total requests
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <TrendingUp />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Requests/Minute
                  </Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {metricsData.requestsPerMinute}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metricsData.recentRequests} in last minute
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Error />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Error Rate
                  </Typography>
                </Box>
                <Typography variant="h4" color={metricsData.errorRate > 5 ? 'error' : 'primary'}>
                  {metricsData.errorRate}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metricsData.errorCount} total errors
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Warning />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Slow Requests
                  </Typography>
                </Box>
                <Typography variant="h4" color="warning.main">
                  {metricsData.slowRequestCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  &gt; 1 second response time
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Business Metrics */}
      {businessMetrics && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={2}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <People />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Users
                  </Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {businessMetrics.users.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={2}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Storage />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Workspaces
                  </Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {businessMetrics.workspaces.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={2}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <People />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Clients
                  </Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {businessMetrics.clients.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={2}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <TrendingUp />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Active Subs
                  </Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  {businessMetrics.subscriptions.active}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {businessMetrics.subscriptions.conversionRate}% conversion
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={2}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <AttachMoney />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    Total Revenue
                  </Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  {businessMetrics.revenue.totalEGP.toLocaleString()} EGP
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={2}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <TrendingUp />
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    24h Revenue
                  </Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  {businessMetrics.revenue.recentEGP.toLocaleString()} EGP
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Request Statistics */}
      {metricsData && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📈 Top Request Paths
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Path</TableCell>
                        <TableCell align="right">Requests</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metricsData.pathStats.slice(0, 10).map(([path, count], index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {path}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 HTTP Methods
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Method</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(metricsData.methodStats).map(([method, count]) => (
                        <TableRow key={method}>
                          <TableCell>
                            <Chip 
                              label={method} 
                              size="small"
                              color={method === 'GET' ? 'primary' : method === 'POST' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="right">{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Refresh Button */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button 
          variant="contained" 
          onClick={fetchData}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <TrendingUp />}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </Box>

      {/* Last Updated */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Last updated: {new Date().toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
}
