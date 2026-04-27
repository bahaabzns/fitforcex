'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { format } from 'date-fns';
import { Add, Edit, PauseCircleOutline, PlayCircleOutline, Refresh } from '@mui/icons-material';

import api, { fetcher } from '@/utils/axios';
import MainCard from 'components/MainCard';

interface PromoCodeRow {
  id: string;
  code: string;
  discountPercentage: number;
  commissionPercentage: number;
  allowDiscount: boolean;
  allowCommission: boolean;
  isActive: boolean;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  stats: {
    usageCount: number;
    totalDiscount: number;
    totalCommission: number;
    unpaidCommission: number;
    lastUsedAt: string | null;
  };
}

interface PromoCodesResponse {
  promoCodes: PromoCodeRow[];
}

interface CommissionRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  note?: string | null;
  promoCode: {
    id: string;
    code: string;
    owner: { id: string; fullName: string; email: string };
  };
  owner: { id: string; fullName: string; email: string };
  referralUser: { id: string; fullName: string; email: string };
  workspace: { id: string; name: string };
}

interface CommissionResponse {
  summary: {
    total: number;
    unpaid: number;
    paid: number;
    currency: string;
    count: number;
    unpaidCount: number;
  };
  commissions: CommissionRow[];
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EGP'
});

export default function AdminPromoCodesPage() {
  const { data, error, isLoading, mutate } = useSWR<PromoCodesResponse>('/api/admin/promo-codes', fetcher, {
    revalidateOnFocus: false,
  });

  const promoCodes = data?.promoCodes ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [commissionsOpen, setCommissionsOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<PromoCodeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerOptions, setOwnerOptions] = useState<UserOption[]>([]);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<UserOption | null>(null);

  const [createForm, setCreateForm] = useState({
    code: '',
    autoGenerate: true,
    discountPercentage: 0,
    commissionPercentage: 0,
    allowDiscount: true,
    allowCommission: true,
    isActive: true,
    maxRedemptions: '',
    expiresAt: '',
  });

  const [editForm, setEditForm] = useState({
    code: '',
    discountPercentage: 0,
    commissionPercentage: 0,
    allowDiscount: true,
    allowCommission: true,
    maxRedemptions: '',
    expiresAt: '',
  });

  const [commissions, setCommissions] = useState<CommissionResponse | null>(null);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  useEffect(() => {
    if (!createOpen && !editOpen) {
      return;
    }
    let active = true;

    setOwnerLoading(true);
    const fetchOwners = async () => {
      try {
        const params: Record<string, any> = { limit: 5, page: 1 };
        if (ownerQuery) params.search = ownerQuery;
        const { data } = await api.get('/api/admin/users', {
          params,
        });
        if (!active) return;
        const results = (data.users || []).map((user: any) => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        }));
        setOwnerOptions(results);
      } catch {
        if (active) setOwnerOptions([]);
      } finally {
        if (active) setOwnerLoading(false);
      }
    };

    const timer = setTimeout(fetchOwners, ownerQuery ? 300 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ownerQuery, createOpen, editOpen]);

  const openCreateDialog = () => {
    setCreateForm({
      code: '',
      autoGenerate: true,
      discountPercentage: 0,
      commissionPercentage: 0,
      allowDiscount: true,
      allowCommission: true,
      isActive: true,
      maxRedemptions: '',
      expiresAt: '',
    });
    setSelectedOwner(null);
    setOwnerQuery('');
    setOwnerOptions([]);
    setCreateOpen(true);
  };

  const openEditDialog = (promo: PromoCodeRow) => {
    setSelectedPromo(promo);
    setEditForm({
      code: promo.code,
      discountPercentage: promo.discountPercentage,
      commissionPercentage: promo.commissionPercentage,
      allowDiscount: promo.allowDiscount,
      allowCommission: promo.allowCommission,
      maxRedemptions: promo.maxRedemptions ? String(promo.maxRedemptions) : '',
      expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 10) : '',
    });
    setEditOpen(true);
  };

  const handleCreate = async () => {
    if (!selectedOwner) {
      setFeedback({ type: 'error', message: 'Please select an owner' });
      return;
    }
    if (!createForm.autoGenerate && !createForm.code.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a promo code or enable auto-generation' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/admin/promo-codes', {
        ownerId: selectedOwner.id,
        code: createForm.autoGenerate ? undefined : createForm.code.trim().toUpperCase(),
        discountPercentage: createForm.discountPercentage,
        commissionPercentage: createForm.commissionPercentage,
        allowDiscount: createForm.allowDiscount,
        allowCommission: createForm.allowCommission,
        isActive: createForm.isActive,
        maxRedemptions: createForm.maxRedemptions ? Number(createForm.maxRedemptions) : undefined,
        expiresAt: createForm.expiresAt || undefined,
      });
      setCreateOpen(false);
      setFeedback({ type: 'success', message: 'Promo code created successfully' });
      mutate();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.response?.data?.error || 'Failed to create promo code',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPromo) return;
    if (!editForm.code.trim()) {
      setFeedback({ type: 'error', message: 'Promo code cannot be empty' });
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/api/admin/promo-codes/${selectedPromo.id}`, {
        code: editForm.code.trim().toUpperCase(),
        discountPercentage: editForm.discountPercentage,
        commissionPercentage: editForm.commissionPercentage,
        allowDiscount: editForm.allowDiscount,
        allowCommission: editForm.allowCommission,
        maxRedemptions: editForm.maxRedemptions ? Number(editForm.maxRedemptions) : null,
        expiresAt: editForm.expiresAt || null,
      });
      setEditOpen(false);
      setFeedback({ type: 'success', message: 'Promo code updated successfully' });
      mutate();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.response?.data?.error || 'Failed to update promo code',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (promo: PromoCodeRow, nextActive: boolean) => {
    try {
      if (nextActive) {
        await api.post(`/api/admin/promo-codes/${promo.id}/activate`);
      } else {
        await api.post(`/api/admin/promo-codes/${promo.id}/deactivate`);
      }
      mutate();
      setFeedback({
        type: 'success',
        message: nextActive ? 'Promo code activated' : 'Promo code deactivated',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.response?.data?.error || 'Failed to update promo code status',
      });
    }
  };

  const handleToggleFlag = async (promo: PromoCodeRow, field: 'allowDiscount' | 'allowCommission', value: boolean) => {
    try {
      await api.patch(`/api/admin/promo-codes/${promo.id}`, {
        [field]: value,
      });
      mutate();
      setFeedback({
        type: 'success',
        message: 'Promo code updated',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.response?.data?.error || 'Failed to update promo code',
      });
    }
  };

  const loadCommissions = useCallback(async (promoId: string) => {
    setCommissionsLoading(true);
    try {
      const { data } = await api.get('/api/admin/promo-codes/commissions', {
        params: { promoCodeId: promoId },
      });
      setCommissions(data);
    } catch (err) {
      setCommissions(null);
    } finally {
      setCommissionsLoading(false);
    }
  }, []);

  const openCommissionsDialog = (promo: PromoCodeRow) => {
    setSelectedPromo(promo);
    setCommissions(null);
    setCommissionsOpen(true);
    loadCommissions(promo.id);
  };

  const handleCommissionStatus = async (commissionId: string, status: 'pending' | 'paid') => {
    try {
      await api.post(`/api/admin/promo-codes/commissions/${commissionId}/mark`, { status });
      if (selectedPromo) {
        loadCommissions(selectedPromo.id);
      } else {
        loadCommissions('');
      }
      mutate();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.response?.data?.error || 'Failed to update commission',
      });
    }
  };

  const totalStats = useMemo(() => {
    return promoCodes.reduce(
      (acc, promo) => {
        acc.totalDiscount += promo.stats.totalDiscount;
        acc.totalCommission += promo.stats.totalCommission;
        acc.unpaidCommission += promo.stats.unpaidCommission;
        acc.usageCount += promo.stats.usageCount;
        return acc;
      },
      { totalDiscount: 0, totalCommission: 0, unpaidCommission: 0, usageCount: 0 },
    );
  }, [promoCodes]);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Promo Codes</Typography>
          <Typography color="text.secondary">
            Manage referral promo codes, owner commissions, and discounts.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => mutate()}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openCreateDialog}
          >
            Assign Promo Code
          </Button>
        </Stack>
      </Stack>

      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{ mb: 2 }}
        >
          {feedback.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <MainCard title="Summary" contentSX={{ p: 3 }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Total Promo Codes</Typography>
                <Typography variant="h6" fontWeight={700}>{promoCodes.length}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Total Redemptions</Typography>
                <Typography variant="h6" fontWeight={700}>{totalStats.usageCount}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Total Discount Given</Typography>
                <Typography variant="h6" fontWeight={700}>{currencyFormatter.format(totalStats.totalDiscount)}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Total Commission Owed</Typography>
                <Typography variant="h6" fontWeight={700}>{currencyFormatter.format(totalStats.totalCommission)}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Unpaid Commission</Typography>
                <Typography variant="h6" fontWeight={700}>{currencyFormatter.format(totalStats.unpaidCommission)}</Typography>
              </Box>
            </Stack>
          </MainCard>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ pl: 3 }}>Promo Code</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell align="right">Discount %</TableCell>
                    <TableCell align="right">Commission %</TableCell>
                    <TableCell align="center">Flags</TableCell>
                    <TableCell align="right">Stats</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center' }}>
                        <CircularProgress size={32} />
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 4 }}>
                        <Alert severity="error">Failed to load promo codes.</Alert>
                      </TableCell>
                    </TableRow>
                  ) : promoCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">No promo codes assigned yet.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    promoCodes.map((promo) => (
                      <TableRow key={promo.id} hover>
                        <TableCell sx={{ pl: 3 }}>
                          <Typography variant="subtitle1" fontWeight={700}>{promo.code}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Created {format(new Date(promo.createdAt), 'PP')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{promo.owner.fullName}</Typography>
                          <Typography variant="caption" color="text.secondary">{promo.owner.email}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{promo.discountPercentage}%</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{promo.commissionPercentage}%</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title="Active">
                              <Switch
                                size="small"
                                checked={promo.isActive}
                                onChange={(_, checked) => handleToggleActive(promo, checked)}
                              />
                            </Tooltip>
                            <Tooltip title="Allow Discount">
                              <Switch
                                size="small"
                                color="success"
                                checked={promo.allowDiscount}
                                onChange={(_, checked) => handleToggleFlag(promo, 'allowDiscount', checked)}
                              />
                            </Tooltip>
                            <Tooltip title="Allow Commission">
                              <Switch
                                size="small"
                                color="info"
                                checked={promo.allowCommission}
                                onChange={(_, checked) => handleToggleFlag(promo, 'allowCommission', checked)}
                              />
                            </Tooltip>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Stack spacing={0.5} alignItems="flex-end">
                            <Typography variant="caption" color="text.secondary">
                              Uses: {promo.stats.usageCount}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Discount: {currencyFormatter.format(promo.stats.totalDiscount)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Commission: {currencyFormatter.format(promo.stats.totalCommission)}
                            </Typography>
                            <Typography variant="caption" color={promo.stats.unpaidCommission > 0 ? 'warning.main' : 'text.secondary'}>
                              Unpaid: {currencyFormatter.format(promo.stats.unpaidCommission)}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="View Commissions">
                              <Button size="small" variant="outlined" onClick={() => openCommissionsDialog(promo)}>
                                Commissions
                              </Button>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => openEditDialog(promo)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={promo.isActive ? 'Deactivate' : 'Activate'}>
                              <IconButton
                                size="small"
                                onClick={() => handleToggleActive(promo, !promo.isActive)}
                              >
                                {promo.isActive ? <PauseCircleOutline fontSize="small" /> : <PlayCircleOutline fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Assign Promo Code</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={ownerOptions}
              getOptionLabel={(option) => `${option.fullName} (${option.email})`}
              loading={ownerLoading}
              value={selectedOwner}
              onChange={(_, value) => setSelectedOwner(value)}
              onInputChange={(_, value) => setOwnerQuery(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Promo Owner"
                  placeholder="Search by name or email"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {ownerLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={createForm.autoGenerate}
                onChange={(_, checked) => setCreateForm((prev) => ({ ...prev, autoGenerate: checked, code: checked ? '' : prev.code }))}
              />
              <Typography variant="body2">Auto-generate promo code</Typography>
            </Stack>
            {!createForm.autoGenerate && (
              <TextField
                label="Promo Code"
                value={createForm.code}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                placeholder="Enter custom promo code"
                helperText="Alphanumeric only, 4-32 characters"
                required
                inputProps={{ maxLength: 32 }}
              />
            )}
            <TextField
              label="Discount Percentage"
              type="number"
              value={createForm.discountPercentage}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, discountPercentage: Number(e.target.value) }))}
              inputProps={{ min: 0, max: 100 }}
            />
            <TextField
              label="Commission Percentage"
              type="number"
              value={createForm.commissionPercentage}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, commissionPercentage: Number(e.target.value) }))}
              inputProps={{ min: 0, max: 100 }}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Max Redemptions"
                type="number"
                value={createForm.maxRedemptions}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, maxRedemptions: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Expires At"
                type="date"
                value={createForm.expiresAt}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Stack direction="row" spacing={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
                  checked={createForm.allowDiscount}
                  onChange={(_, checked) => setCreateForm((prev) => ({ ...prev, allowDiscount: checked }))}
                />
                <Typography variant="body2">Allow Discount</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
                  checked={createForm.allowCommission}
                  onChange={(_, checked) => setCreateForm((prev) => ({ ...prev, allowCommission: checked }))}
                />
                <Typography variant="body2">Allow Commission</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
                  checked={createForm.isActive}
                  onChange={(_, checked) => setCreateForm((prev) => ({ ...prev, isActive: checked }))}
                />
                <Typography variant="body2">Active</Typography>
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={loading}>
            {loading ? 'Saving...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Promo Code</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Promo Code"
              value={editForm.code}
              onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
              placeholder="Enter promo code"
              helperText="Alphanumeric only, 4-32 characters"
              required
              inputProps={{ maxLength: 32 }}
            />
            <TextField
              label="Discount Percentage"
              type="number"
              value={editForm.discountPercentage}
              onChange={(e) => setEditForm((prev) => ({ ...prev, discountPercentage: Number(e.target.value) }))}
              inputProps={{ min: 0, max: 100 }}
            />
            <TextField
              label="Commission Percentage"
              type="number"
              value={editForm.commissionPercentage}
              onChange={(e) => setEditForm((prev) => ({ ...prev, commissionPercentage: Number(e.target.value) }))}
              inputProps={{ min: 0, max: 100 }}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Max Redemptions"
                type="number"
                value={editForm.maxRedemptions}
                onChange={(e) => setEditForm((prev) => ({ ...prev, maxRedemptions: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Expires At"
                type="date"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Stack direction="row" spacing={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
                  checked={editForm.allowDiscount}
                  onChange={(_, checked) => setEditForm((prev) => ({ ...prev, allowDiscount: checked }))}
                />
                <Typography variant="body2">Allow Discount</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
                  checked={editForm.allowCommission}
                  onChange={(_, checked) => setEditForm((prev) => ({ ...prev, allowCommission: checked }))}
                />
                <Typography variant="body2">Allow Commission</Typography>
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Commissions Dialog */}
      <Dialog open={commissionsOpen} onClose={() => setCommissionsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Promo Commissions — {selectedPromo?.code}</DialogTitle>
        <DialogContent dividers>
          {commissionsLoading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : !commissions ? (
            <Typography color="text.secondary">No commissions found.</Typography>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>Summary</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total: {currencyFormatter.format(commissions.summary.total)} | Unpaid: {currencyFormatter.format(commissions.summary.unpaid)} | Paid: {currencyFormatter.format(commissions.summary.paid)}
                </Typography>
              </Box>
              <Divider />
              {commissions.commissions.length === 0 ? (
                <Typography color="text.secondary">No commission records yet.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Workspace</TableCell>
                      <TableCell>Referral User</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {commissions.commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{commission.workspace.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{commission.referralUser.fullName}</Typography>
                          <Typography variant="caption" color="text.secondary">{commission.referralUser.email}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          {currencyFormatter.format(commission.amount)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={commission.status === 'paid' ? 'Paid' : 'Pending'}
                            color={commission.status === 'paid' ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{format(new Date(commission.createdAt), 'PP')}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          {commission.status !== 'paid' ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleCommissionStatus(commission.id, 'paid')}
                            >
                              Mark Paid
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleCommissionStatus(commission.id, 'pending')}
                            >
                              Reset
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommissionsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

