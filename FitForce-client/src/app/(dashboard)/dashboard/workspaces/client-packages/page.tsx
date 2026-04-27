'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
  Alert,
  Chip,
  Divider,
  IconButton,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '@/utils/axios';
import { useAppSelector } from '@/store';
import WorkspaceSubscriptionGuard from '@/components/WorkspaceSubscriptionGuard';

type ClientPackage = {
  id: string;
  name: string;
  description?: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
};

export default function WorkspaceClientPackagesPage() {
  const intl = useIntl();
  const params = useMemo(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('')), []);
  const workspaceId = params.get('workspaceId') || '';
  const reduxWorkspaceId = useAppSelector((s) => s.workspace.id);
  const effectiveWorkspaceId = workspaceId || reduxWorkspaceId || '';

  const [packages, setPackages] = useState<ClientPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [priceEgp, setPriceEgp] = useState<number>(100);
  const [currency, setCurrency] = useState('EGP');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit package state
  const [editingPackage, setEditingPackage] = useState<ClientPackage | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDurationMonths, setEditDurationMonths] = useState<number>(1);
  const [editPriceEgp, setEditPriceEgp] = useState<number>(100);
  const [editCurrency, setEditCurrency] = useState('EGP');
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<ClientPackage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPackages = async () => {
    try {
      setError(null);
      const { data } = await api.get(`/api/workspaces/${effectiveWorkspaceId}/client-packages`);
      setPackages(data.packages || []);
    } catch (e) {
      setError(intl.formatMessage({ id: 'pkgs.failedToFetch', defaultMessage: 'Failed to fetch client packages' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveWorkspaceId) return;
    fetchPackages();
  }, [effectiveWorkspaceId]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);
      if (!name.trim()) {
        setError(intl.formatMessage({ id: 'pkgs.nameRequired', defaultMessage: 'Name is required' }));
        return;
      }
      if (durationMonths < 1) {
        setError(intl.formatMessage({ id: 'pkgs.durationMin', defaultMessage: 'Duration must be at least 1 month' }));
        return;
      }
      if (priceEgp < 1) {
        setError(intl.formatMessage({ id: 'pkgs.priceMin', defaultMessage: 'Price must be at least 1 EGP' }));
        return;
      }
      const priceCents = Math.round(Number(priceEgp) * 100);
      await api.post(`/api/workspaces/${effectiveWorkspaceId}/client-packages`, {
        name,
        description: description || undefined,
        durationMonths: Number(durationMonths),
        priceCents: Number(priceCents),
        currency,
        features: {}
      });
      setName('');
      setDescription('');
      setDurationMonths(1);
      setPriceEgp(100);
      await fetchPackages();
      setSuccessMsg('Package created');
    } catch (e) {
      setError(intl.formatMessage({ id: 'pkgs.failedToCreate', defaultMessage: 'Failed to create package' }));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (pkg: ClientPackage) => {
    try {
      setError(null);
      await api.put(`/api/workspaces/${effectiveWorkspaceId}/client-packages/${pkg.id}`, {
        isActive: !pkg.isActive
      });
      await fetchPackages();
    } catch (e) {
      setError(intl.formatMessage({ id: 'pkgs.failedToUpdate', defaultMessage: 'Failed to update package' }));
    }
  };

  const handleDeleteClick = (pkg: ClientPackage) => {
    setPackageToDelete(pkg);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!packageToDelete) return;

    try {
      setDeleteLoading(true);
      setError(null);
      await api.delete(`/api/workspaces/${effectiveWorkspaceId}/client-packages/${packageToDelete.id}`);
      await fetchPackages();
      setDeleteDialogOpen(false);
      setPackageToDelete(null);
      setSuccessMsg(intl.formatMessage({ id: 'pkgs.deletedSuccessfully', defaultMessage: 'Package deleted successfully' }));
    } catch (e) {
      setError(intl.formatMessage({ id: 'pkgs.failedToDelete', defaultMessage: 'Failed to delete package' }));
    } finally {
      setDeleteLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setPackageToDelete(null);
  };

  const handleEditPackage = (pkg: ClientPackage) => {
    setEditingPackage(pkg);
    setEditName(pkg.name);
    setEditDescription(pkg.description || '');
    setEditDurationMonths(pkg.durationMonths);
    setEditPriceEgp(pkg.priceCents / 100);
    setEditCurrency(pkg.currency);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPackage) return;

    try {
      setEditSaving(true);
      setError(null);
      setSuccessMsg(null);
      
      if (!editName.trim()) {
        setError(intl.formatMessage({ id: 'pkgs.nameRequired', defaultMessage: 'Name is required' }));
        return;
      }
      if (editDurationMonths < 1) {
        setError(intl.formatMessage({ id: 'pkgs.durationMin', defaultMessage: 'Duration must be at least 1 month' }));
        return;
      }
      if (editPriceEgp < 1) {
        setError(intl.formatMessage({ id: 'pkgs.priceMin', defaultMessage: 'Price must be at least 1 EGP' }));
        return;
      }

      const priceCents = Math.round(Number(editPriceEgp) * 100);
      await api.put(`/api/workspaces/${effectiveWorkspaceId}/client-packages/${editingPackage.id}`, {
        name: editName,
        description: editDescription || undefined,
        durationMonths: Number(editDurationMonths),
        priceCents: Number(priceCents),
        currency: editCurrency,
        features: {}
      });

      setEditDialogOpen(false);
      await fetchPackages();
      setSuccessMsg(intl.formatMessage({ id: 'pkgs.updatedSuccessfully', defaultMessage: 'Package updated successfully' }));
    } catch (e) {
      setError(intl.formatMessage({ id: 'pkgs.failedToUpdate', defaultMessage: 'Failed to update package' }));
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingPackage(null);
    setEditName('');
    setEditDescription('');
    setEditDurationMonths(1);
    setEditPriceEgp(100);
    setEditCurrency('EGP');
  };

  return (
    <WorkspaceSubscriptionGuard description="Activate a plan to manage client packages for this workspace.">
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          <FormattedMessage id="pkgs.title" defaultMessage="Client Packages" />
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          <FormattedMessage id="pkgs.subtitle" defaultMessage="Create and manage packages that clients can subscribe to for this workspace." />
        </Typography>

        {(!effectiveWorkspaceId) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <FormattedMessage id="pkgs.missingWorkspace" defaultMessage="Missing workspaceId. Open this page with ?workspaceId=... or select a workspace first." />
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchPackages} disabled={loading}>
            <FormattedMessage id="refresh" defaultMessage="Refresh" />
          </Button>
        </Stack>

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
            {successMsg}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage id="pkgs.createPackage" defaultMessage="Create Package" />
            </Typography>
            <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-end' }}>
              <TextField 
                label={intl.formatMessage({ id: 'pkgs.name', defaultMessage: 'Name' })} 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                fullWidth 
                required 
                size="medium"
                sx={{ minWidth: 200 }}
              />
              <TextField 
                label={intl.formatMessage({ id: 'pkgs.description', defaultMessage: 'Description' })} 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                fullWidth 
                size="medium"
                sx={{ minWidth: 200 }}
              />
              <TextField
                label={intl.formatMessage({ id: 'pkgs.durationMonths', defaultMessage: 'Duration (months)' })}
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                inputProps={{ min: 1, max: 120 }}
                size="medium"
                sx={{ minWidth: 150 }}
              />
              <TextField
                label={intl.formatMessage({ id: 'pkgs.price', defaultMessage: 'Price' })}
                type="number"
                value={priceEgp}
                onChange={(e) => setPriceEgp(Number(e.target.value))}
                inputProps={{ min: 1, step: 1 }}
                size="medium"
                sx={{ minWidth: 150 }}
              />
              <FormControl sx={{ minWidth: 120 }} size="medium">
                <InputLabel><FormattedMessage id="pkgs.currency" defaultMessage="Currency" /></InputLabel>
                <Select
                  value={currency}
                  label={intl.formatMessage({ id: 'pkgs.currency', defaultMessage: 'Currency' })}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <MenuItem value="EGP">EGP</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                  <MenuItem value="SAR">SAR</MenuItem>
                  <MenuItem value="AED">AED</MenuItem>
                </Select>
              </FormControl>
              <Button 
                variant="contained" 
                onClick={handleCreate} 
                disabled={saving || !name}
                size="large"
                sx={{ minWidth: 120, height: 56 }}
              >
                {saving ? intl.formatMessage({ id: 'pkgs.saving', defaultMessage: 'Saving...' }) : intl.formatMessage({ id: 'pkgs.create', defaultMessage: 'Create' })}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          {packages.map((pkg) => (
            <Grid item xs={12} md={6} lg={4} key={pkg.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{pkg.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pkg.description}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <Chip size="small" label={intl.formatMessage({ id: 'pkgs.duration', defaultMessage: 'Duration: {months} mo' }, { months: pkg.durationMonths })} />
                    <Chip size="small" color="primary" label={intl.formatMessage({ id: 'pkgs.priceLabel', defaultMessage: 'Price: {price} {currency}' }, { price: (pkg.priceCents / 100).toFixed(2), currency: pkg.currency })} />
                    <Chip size="small" color={pkg.isActive ? 'success' : 'default'} label={pkg.isActive ? intl.formatMessage({ id: 'pkgs.active', defaultMessage: 'Active' }) : intl.formatMessage({ id: 'pkgs.inactive', defaultMessage: 'Inactive' })} />
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Switch
                        checked={pkg.isActive}
                        onChange={() => toggleActive(pkg)}
                        inputProps={{ 'aria-label': 'toggle active' }}
                      />
                      <Typography variant="body2">
                        <FormattedMessage id="pkgs.active" defaultMessage="Active" />
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <IconButton aria-label="edit" color="primary" onClick={() => handleEditPackage(pkg)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton aria-label="delete" color="error" onClick={() => handleDeleteClick(pkg)}>
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Edit Package Dialog */}
        <Dialog open={editDialogOpen} onClose={handleCancelEdit} maxWidth="sm" fullWidth>
          <DialogTitle>
            <FormattedMessage id="pkgs.editPackage" defaultMessage="Edit Package" />
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label={intl.formatMessage({ id: 'pkgs.name', defaultMessage: 'Name' })}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                fullWidth
                required
                size="medium"
              />
              <TextField
                label={intl.formatMessage({ id: 'pkgs.description', defaultMessage: 'Description' })}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                size="medium"
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label={intl.formatMessage({ id: 'pkgs.durationMonths', defaultMessage: 'Duration (months)' })}
                  type="number"
                  value={editDurationMonths}
                  onChange={(e) => setEditDurationMonths(Number(e.target.value))}
                  inputProps={{ min: 1, max: 120 }}
                  size="medium"
                  sx={{ flex: 1, minWidth: 150 }}
                />
                <TextField
                  label={intl.formatMessage({ id: 'pkgs.price', defaultMessage: 'Price' })}
                  type="number"
                  value={editPriceEgp}
                  onChange={(e) => setEditPriceEgp(Number(e.target.value))}
                  inputProps={{ min: 1, step: 1 }}
                  size="medium"
                  sx={{ flex: 1, minWidth: 150 }}
                />
                <FormControl sx={{ minWidth: 120 }} size="medium">
                  <InputLabel><FormattedMessage id="pkgs.currency" defaultMessage="Currency" /></InputLabel>
                  <Select
                    value={editCurrency}
                    label={intl.formatMessage({ id: 'pkgs.currency', defaultMessage: 'Currency' })}
                    onChange={(e) => setEditCurrency(e.target.value)}
                  >
                    <MenuItem value="EGP">EGP</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="GBP">GBP</MenuItem>
                    <MenuItem value="SAR">SAR</MenuItem>
                    <MenuItem value="AED">AED</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={handleCancelEdit} 
              disabled={editSaving}
              size="large"
              sx={{ minWidth: 100 }}
            >
              <FormattedMessage id="cancel" defaultMessage="Cancel" />
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              variant="contained" 
              disabled={editSaving || !editName.trim()}
              size="large"
              sx={{ minWidth: 140 }}
            >
              {editSaving ? intl.formatMessage({ id: 'pkgs.saving', defaultMessage: 'Saving...' }) : intl.formatMessage({ id: 'pkgs.saveChanges', defaultMessage: 'Save Changes' })}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={cancelDelete} maxWidth="sm" fullWidth>
          <DialogTitle>
            <FormattedMessage id="pkgs.deletePackage" defaultMessage="Delete Package" />
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <FormattedMessage id="pkgs.deleteConfirm" defaultMessage="Are you sure you want to delete this package? This action cannot be undone." />
            </Typography>
            {packageToDelete && (
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>{packageToDelete.name}</Typography>
                {packageToDelete.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {packageToDelete.description}
                  </Typography>
                )}
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={intl.formatMessage({ id: 'pkgs.duration', defaultMessage: 'Duration: {months} mo' }, { months: packageToDelete.durationMonths })} />
                  <Chip size="small" color="primary" label={intl.formatMessage({ id: 'pkgs.priceLabel', defaultMessage: 'Price: {price} {currency}' }, { price: (packageToDelete.priceCents / 100).toFixed(2), currency: packageToDelete.currency })} />
                  <Chip size="small" color={packageToDelete.isActive ? 'success' : 'default'} label={packageToDelete.isActive ? intl.formatMessage({ id: 'pkgs.active', defaultMessage: 'Active' }) : intl.formatMessage({ id: 'pkgs.inactive', defaultMessage: 'Inactive' })} />
                </Stack>
              </Card>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={cancelDelete} 
              disabled={deleteLoading}
              size="large"
              sx={{ minWidth: 100 }}
            >
              <FormattedMessage id="cancel" defaultMessage="Cancel" />
            </Button>
            <Button 
              onClick={confirmDelete} 
              variant="contained" 
              color="error"
              disabled={deleteLoading}
              size="large"
              sx={{ minWidth: 100 }}
            >
              {deleteLoading ? intl.formatMessage({ id: 'pkgs.deleting', defaultMessage: 'Deleting...' }) : intl.formatMessage({ id: 'pkgs.delete', defaultMessage: 'Delete' })}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
    </WorkspaceSubscriptionGuard>
  );
}


