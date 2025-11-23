'use client';

import React, { useState, useEffect } from 'react';
import api from '@/utils/axios';
import {
  Box,
  Typography,
  Button,
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Analytics,
  Refresh,
} from '@mui/icons-material';
import { PackageCard } from '@/components/payment';

interface Package {
  id: string;
  name: string;
  description?: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  features?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PackageFormData {
  name: string;
  description: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  features: any;
  teamMembersEnabled?: boolean;
  teamMembersLimit?: number | null;
  isActive: boolean;
}

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState<PackageFormData>({
    name: '',
    description: '',
    durationMonths: 1,
    priceCents: 100,
    currency: 'EGP',
    features: {},
    teamMembersEnabled: true,
    teamMembersLimit: null,
    isActive: true,
  });
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data } = await api.get('/api/admin/workspace-packages');
      setPackages(data.packages || []);
    } catch (err) {
      setError('Failed to fetch packages');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = () => {
    setEditingPackage(null);
    setFormData({
      name: '',
      description: '',
      durationMonths: 1,
      priceCents: 100,
      currency: 'EGP',
      features: {},
      teamMembersEnabled: true,
      teamMembersLimit: null,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleEditPackage = (packageData: Package) => {
    setEditingPackage(packageData);
    setFormData({
      name: packageData.name,
      description: packageData.description || '',
      durationMonths: packageData.durationMonths,
      priceCents: packageData.priceCents,
      currency: packageData.currency,
      features: packageData.features || {},
      teamMembersEnabled: (packageData as any).teamMembersEnabled ?? true,
      teamMembersLimit: (packageData as any).teamMembersLimit ?? null,
      isActive: packageData.isActive,
    });
    setDialogOpen(true);
  };

  const handleSavePackage = async () => {
    try {
      if (!formData.name?.trim()) {
        setError('Name is required');
        return;
      }
      if (!formData.durationMonths || formData.durationMonths < 1) {
        setError('Duration must be at least 1 month');
        return;
      }
      if (!formData.priceCents || formData.priceCents < 1) {
        setError('Price (cents) must be at least 1');
        return;
      }
      if (editingPackage) {
        await api.put(`/api/admin/workspace-packages/${editingPackage.id}`, formData);
      } else {
        await api.post('/api/admin/workspace-packages', formData);
      }
      setDialogOpen(false);
      fetchPackages();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save package');
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      await api.delete(`/api/admin/workspace-packages/${packageId}`);
      fetchPackages();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete package');
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  };

  const getDurationText = (months: number) => {
    if (months === 1) return '1 Month';
    if (months === 3) return '3 Months';
    if (months === 6) return '6 Months';
    if (months === 12) return '1 Year';
    return `${months} Months`;
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
          Workspace Packages
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreatePackage}
        >
          Create Package
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label="Grid View" />
        <Tab label="Table View" />
      </Tabs>

      {tabValue === 0 && (
        <Grid container spacing={3}>
          {packages.map((packageData) => (
            <Grid item xs={12} md={6} lg={4} key={packageData.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6">
                      {packageData.name}
                    </Typography>
                    <Chip
                      label={packageData.isActive ? 'Active' : 'Inactive'}
                      color={packageData.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="h4" color="primary" gutterBottom>
                    {formatPrice(packageData.priceCents, packageData.currency)}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {getDurationText(packageData.durationMonths)}
                  </Typography>
                  
                  {packageData.description && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {packageData.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleEditPackage(packageData)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeletePackage(packageData.id)}
                    >
                      <Delete />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {/* TODO: Implement analytics */}}
                    >
                      <Analytics />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {packages.map((packageData) => (
                <TableRow key={packageData.id}>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {packageData.name}
                    </Typography>
                    {packageData.description && (
                      <Typography variant="body2" color="text.secondary">
                        {packageData.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {getDurationText(packageData.durationMonths)}
                  </TableCell>
                  <TableCell>
                    {formatPrice(packageData.priceCents, packageData.currency)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={packageData.isActive ? 'Active' : 'Inactive'}
                      color={packageData.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(packageData.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditPackage(packageData)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeletePackage(packageData.id)}
                      >
                        <Delete />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {/* TODO: Implement analytics */}}
                      >
                        <Analytics />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPackage ? 'Edit Package' : 'Create Package'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Package Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (Months)"
                type="number"
                value={formData.durationMonths}
                onChange={(e) => setFormData(prev => ({ ...prev, durationMonths: parseInt(e.target.value) }))}
                inputProps={{ min: 1 }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Price (Cents)"
                type="number"
                value={formData.priceCents}
                onChange={(e) => setFormData(prev => ({ ...prev, priceCents: parseInt(e.target.value) }))}
                inputProps={{ min: 1 }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  label="Currency"
                >
                  <MenuItem value="EGP">EGP</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!formData.teamMembersEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, teamMembersEnabled: e.target.checked }))}
                  />
                }
                label="Team members enabled"
              />
            </Grid>
            {formData.teamMembersEnabled && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Team Members Limit"
                  type="number"
                  value={formData.teamMembersLimit ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      teamMembersLimit: value === '' ? null : parseInt(value) || null 
                    }));
                  }}
                  inputProps={{ min: 1 }}
                  helperText="Leave empty for unlimited team members"
                  placeholder="Unlimited"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePackage} variant="contained">
            {editingPackage ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
