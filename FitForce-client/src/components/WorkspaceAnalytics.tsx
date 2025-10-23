'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Link,
} from '@mui/material';
import {
  Visibility,
  People,
  Dashboard,
  TrendingUp,
  OpenInNew,
} from '@mui/icons-material';
import api from '@/utils/axios';

interface WorkspaceAnalytics {
  period: string;
  timestamp: string;
  landingPageVisits: Array<{
    workspaceId: string;
    name: string;
    subdomain: string;
    visits: number;
    lastVisit: string;
  }>;
  mostClientVisits: Array<{
    workspaceId: string;
    name: string;
    subdomain: string;
    clientCount: number;
  }>;
  mostTeamVisits: Array<{
    workspaceId: string;
    name: string;
    subdomain: string;
    teamMemberCount: number;
  }>;
  recentActivity: Array<{
    workspaceId: string;
    name: string;
    subdomain: string;
    memberCount: number;
    clientCount: number;
    updatedAt: string;
  }>;
}

export default function WorkspaceAnalytics() {
  const [analytics, setAnalytics] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('week');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await api.get(`/api/admin/analytics/workspace-visits?period=${period}&limit=10`);
      setAnalytics(data);
    } catch (err) {
      setError('Failed to fetch workspace analytics');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const handlePeriodChange = (event: any) => {
    setPeriod(event.target.value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading workspace analytics...
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

  if (!analytics) {
    return null;
  }

  // Safety check to prevent errors if API response structure changes
  if (!analytics.landingPageVisits || !Array.isArray(analytics.landingPageVisits) ||
      !analytics.mostClientVisits || !Array.isArray(analytics.mostClientVisits) ||
      !analytics.mostTeamVisits || !Array.isArray(analytics.mostTeamVisits) ||
      !analytics.recentActivity || !Array.isArray(analytics.recentActivity)) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Analytics data format has changed. Please refresh the page.
      </Alert>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          📊 Workspace Analytics
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              onChange={handlePeriodChange}
              label="Period"
            >
              <MenuItem value="day">Last 24h</MenuItem>
              <MenuItem value="week">Last 7 days</MenuItem>
              <MenuItem value="month">Last 30 days</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            onClick={fetchAnalytics}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Most Landing Page Visits */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Visibility color="primary" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Most Landing Page Visits
                </Typography>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Workspace</TableCell>
                      <TableCell align="right">Visits</TableCell>
                      <TableCell align="center">URL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.landingPageVisits.map((workspace) => (
                      <TableRow key={workspace.workspaceId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {workspace.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {workspace.subdomain}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={workspace.visits.toLocaleString()}
                            size="small"
                            color="primary"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Link
                            href={`https://${workspace.subdomain}.nano.com`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ textDecoration: 'none' }}
                          >
                            <Button
                              size="small"
                              startIcon={<OpenInNew />}
                              sx={{ fontSize: '0.75rem' }}
                            >
                              Visit
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Most Client Visits */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <People color="success" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Most Client Visits
                </Typography>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Workspace</TableCell>
                      <TableCell align="right">Clients</TableCell>
                      <TableCell align="center">URL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.mostClientVisits.map((workspace) => (
                      <TableRow key={workspace.workspaceId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {workspace.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {workspace.subdomain}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={workspace.clientCount}
                            size="small"
                            color="success"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Link
                            href={`https://${workspace.subdomain}.nano.com/client`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ textDecoration: 'none' }}
                          >
                            <Button
                              size="small"
                              startIcon={<OpenInNew />}
                              sx={{ fontSize: '0.75rem' }}
                            >
                              Visit
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Most Team Visits */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Dashboard color="warning" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Most Team Visits
                </Typography>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Workspace</TableCell>
                      <TableCell align="right">Team Members</TableCell>
                      <TableCell align="center">URL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.mostTeamVisits.map((workspace) => (
                      <TableRow key={workspace.workspaceId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {workspace.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {workspace.subdomain}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={workspace.teamMemberCount}
                            size="small"
                            color="warning"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Link
                            href={`https://${workspace.subdomain}.nano.com/dashboard`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ textDecoration: 'none' }}
                          >
                            <Button
                              size="small"
                              startIcon={<OpenInNew />}
                              sx={{ fontSize: '0.75rem' }}
                            >
                              Visit
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp color="info" />
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Recent Activity
                </Typography>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Workspace</TableCell>
                      <TableCell align="right">Members</TableCell>
                      <TableCell align="right">Clients</TableCell>
                      <TableCell align="center">Last Updated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.recentActivity.map((workspace) => (
                      <TableRow key={workspace.workspaceId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {workspace.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {workspace.subdomain}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={workspace.memberCount}
                            size="small"
                            color="info"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={workspace.clientCount}
                            size="small"
                            color="secondary"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="caption" color="text.secondary">
                            {new Date(workspace.updatedAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Summary Stats */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Period:</strong> {analytics.period} | 
          <strong> From:</strong> {new Date(analytics.startDate).toLocaleDateString()} | 
          <strong> To:</strong> {new Date(analytics.endDate).toLocaleDateString()}
        </Typography>
      </Box>
    </Box>
  );
}
