'use client';

import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { CalendarToday, Person, Domain, Email, Edit, CheckCircle, Cancel } from '@mui/icons-material';
import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/axios';

interface Workspace {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  members: Array<{
    id: string;
    user: {
      id: string;
      fullName: string;
      email: string;
    };
    role: {
      id: string;
      name: string;
    };
    createdAt: string;
  }>;
  workspaceSubscription?: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    package: {
      id: string;
      name: string;
      durationMonths: number;
      priceCents: number;
    };
  };
  roles: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
}

interface OverviewTabProps {
  workspace: Workspace;
  onRefresh: () => void;
}

export default function OverviewTab({ workspace, onRefresh }: OverviewTabProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edit form state
  const [editName, setEditName] = useState(workspace.name);
  const [editSubdomain, setEditSubdomain] = useState(workspace.subdomain);
  const [editCustomDomain, setEditCustomDomain] = useState(workspace.customDomain || '');
  
  // Subdomain availability checking
  const [subdomainAvailability, setSubdomainAvailability] = useState<{
    checking: boolean;
    available: boolean | null;
    reason?: string;
  }>({ checking: false, available: null });
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pre_active':
        return 'info';
      case 'expired':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleEditWorkspace = async () => {
    if (!editName || !editSubdomain) {
      setError('Name and subdomain are required');
      return;
    }

    // Check if subdomain is available before submitting
    if (editSubdomain !== workspace.subdomain) {
      if (subdomainAvailability.checking) {
        setError('Please wait while we check subdomain availability');
        return;
      }
      if (subdomainAvailability.available === false) {
        setError(subdomainAvailability.reason || 'Subdomain is not available');
        return;
      }
    }

    try {
      setEditLoading(true);
      setError(null);
      
      await api.put(`/api/admin/workspaces/${workspace.id}`, {
        name: editName,
        subdomain: editSubdomain.trim(),
        customDomain: editCustomDomain || null,
      });

      setIsEditDialogOpen(false);
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update workspace');
    } finally {
      setEditLoading(false);
    }
  };

  // Check subdomain availability with debouncing
  const checkSubdomainAvailability = useCallback(async (subdomain: string) => {
    if (!subdomain || subdomain.trim() === '') {
      setSubdomainAvailability({ checking: false, available: null });
      return;
    }

    // If subdomain hasn't changed, don't check
    if (subdomain === workspace.subdomain) {
      setSubdomainAvailability({ checking: false, available: true });
      return;
    }

    setSubdomainAvailability({ checking: true, available: null });

    try {
      const response = await api.get('/api/admin/workspaces/check-subdomain', {
        params: {
          subdomain: subdomain.trim(),
          workspaceId: workspace.id,
        },
      });

      setSubdomainAvailability({
        checking: false,
        available: response.data.available,
        reason: response.data.reason,
      });
    } catch (err: any) {
      setSubdomainAvailability({
        checking: false,
        available: false,
        reason: err.response?.data?.error || 'Failed to check availability',
      });
    }
  }, [workspace.id, workspace.subdomain]);

  // Debounce subdomain checking
  useEffect(() => {
    if (!isEditDialogOpen) return;

    const timer = setTimeout(() => {
      if (editSubdomain) {
        checkSubdomainAvailability(editSubdomain);
      } else {
        setSubdomainAvailability({ checking: false, available: null });
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [editSubdomain, isEditDialogOpen, checkSubdomainAvailability]);

  const openEditDialog = () => {
    setEditName(workspace.name);
    setEditSubdomain(workspace.subdomain);
    setEditCustomDomain(workspace.customDomain || '');
    setError(null);
    setSubdomainAvailability({ checking: false, available: true }); // Current subdomain is always available
    setIsEditDialogOpen(true);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Workspace Overview
      </Typography>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Basic Information
                </Typography>
                <Button
                  size="small"
                  startIcon={<Edit />}
                  onClick={openEditDialog}
                >
                  Edit
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Domain fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Name:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {workspace.name}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Domain fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Subdomain:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {workspace.subdomain}.fitforce.io
                  </Typography>
                </Box>
                {workspace.customDomain && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Domain fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Custom Domain:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {workspace.customDomain}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarToday fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Created:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {new Date(workspace.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Owner Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Owner Information
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Name:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {workspace.owner.fullName}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Email fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Email:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {workspace.owner.email}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Subscription Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Subscription Status
              </Typography>
              {workspace.workspaceSubscription ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Status:
                    </Typography>
                    <Chip
                      label={workspace.workspaceSubscription.status}
                      color={getStatusColor(workspace.workspaceSubscription.status) as any}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Package:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {workspace.workspaceSubscription.package.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Duration:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {workspace.workspaceSubscription.package.durationMonths} months
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Price:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {(workspace.workspaceSubscription.package.priceCents / 100).toFixed(2)} EGP
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Start Date:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {new Date(workspace.workspaceSubscription.startDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      End Date:
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {new Date(workspace.workspaceSubscription.endDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active subscription
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Team Statistics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Team Statistics
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Members:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {workspace.members.length}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Available Roles:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {workspace.roles.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Role Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Role Distribution
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {workspace.roles.map((role) => {
                  const memberCount = workspace.members.filter(
                    (member) => member.role.name === role.name
                  ).length;
                  return (
                    <Box key={role.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        {role.name}:
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {memberCount}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Workspace Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Workspace</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Workspace Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Subdomain"
              value={editSubdomain}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                setEditSubdomain(value);
                setError(null);
              }}
              helperText={
                subdomainAvailability.checking
                  ? 'Checking availability...'
                  : subdomainAvailability.available === false
                  ? subdomainAvailability.reason || 'Subdomain is not available'
                  : subdomainAvailability.available === true
                  ? 'Subdomain is available'
                  : 'Will be accessible at {subdomain}.fitforce.io'
              }
              error={subdomainAvailability.available === false}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {subdomainAvailability.checking ? (
                      <CircularProgress size={20} />
                    ) : editSubdomain && editSubdomain !== workspace.subdomain ? (
                      subdomainAvailability.available === true ? (
                        <CheckCircle color="success" fontSize="small" />
                      ) : subdomainAvailability.available === false ? (
                        <Cancel color="error" fontSize="small" />
                      ) : null
                    ) : null}
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Custom Domain (Optional)"
              value={editCustomDomain}
              onChange={(e) => setEditCustomDomain(e.target.value)}
              placeholder="myworkspace.com"
              helperText="Custom domain for the workspace"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditWorkspace}
            variant="contained"
            disabled={
              editLoading ||
              subdomainAvailability.checking ||
              (editSubdomain !== workspace.subdomain && subdomainAvailability.available === false)
            }
          >
            {editLoading ? 'Updating...' : 'Update Workspace'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
