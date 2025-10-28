'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, Chip, TextField, Button, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TablePagination, Stack } from '@mui/material';
import { Refresh, Add, Visibility, ArrowUpward, ArrowDownward } from '@mui/icons-material';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  lastName?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  _count: {
    workspacesOwned: number;
    memberships: number;
  };
  workspacesOwned: Array<{
    id: string;
    name: string;
    subdomain: string;
  }>;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, totalPages: 0 });
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Create user form state
  const [fullName, setFullName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const fetchRows = async () => {
    try {
      setLoading(true);
      const params: any = { 
        page: pagination.page + 1, // API uses 1-based page, component uses 0-based
        limit: pagination.limit,
        sortBy,
        sortOrder,
      };
      if (q) params.search = q;
      
      const { data } = await api.get('/api/admin/users', { params });
      setRows(data.users || []);
      setPagination({
        ...data.pagination,
        page: data.pagination.page - 1, // Convert back to 0-based for component
      });
    } catch (e) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch rows when pagination, sort, or limit changes
  useEffect(() => { 
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, sortBy, sortOrder]);

  // Fetch rows when search term changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page !== 0) {
        setPagination(prev => ({ ...prev, page: 0 }));
      } else {
        fetchRows();
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 0 }));
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPagination({ ...pagination, limit: parseInt(event.target.value, 10), page: 0 });
  };

  const handleCreateUser = async () => {
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreateLoading(true);
      setError(null);
      
      await api.post('/api/admin/users', {
        fullName,
        lastName: lastName || undefined,
        phoneNumber: phoneNumber || undefined,
        email,
        password,
      });

      setIsCreateDialogOpen(false);
      setFullName('');
      setLastName('');
      setPhoneNumber('');
      setEmail('');
      setPassword('');
      await fetchRows();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleViewUser = (userId: string) => {
    router.push(`/admin/users/${userId}`);
  };

  const resetCreateForm = () => {
    setFullName('');
    setLastName('');
    setPhoneNumber('');
    setEmail('');
    setPassword('');
    setError(null);
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={800}>System Users</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField 
          size="small" 
          placeholder="Search by name or email" 
          value={q} 
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outlined" onClick={handleSearch}>Search</Button>
        <Button variant="contained" startIcon={<Add />} onClick={() => setIsCreateDialogOpen(true)}>Create User</Button>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchRows}>Refresh</Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        This page shows <strong>System Users</strong> (workspace owners and team members who can log in to manage workspaces).
        Gym clients are managed within each workspace, not here.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {rows.length} of {pagination.total} users
        </Typography>
      </Box>

      <Card>
        <CardContent>
          {loading ? (
            <Typography>Loading…</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell 
                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    onClick={() => handleSort('fullName')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Name
                      {sortBy === 'fullName' && (sortOrder === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    onClick={() => handleSort('email')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Email
                      {sortBy === 'email' && (sortOrder === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                    </Box>
                  </TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    onClick={() => handleSort('workspacesCount')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Workspaces
                      {sortBy === 'workspacesCount' && (sortOrder === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    onClick={() => handleSort('membershipsCount')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Memberships
                      {sortBy === 'membershipsCount' && (sortOrder === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    onClick={() => handleSort('createdAt')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Created
                      {sortBy === 'createdAt' && (sortOrder === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                    </Box>
                  </TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.fullName} {r.lastName || ''}
                    </TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.phoneNumber || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={r._count.workspacesOwned} 
                        color="primary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={r._count.memberships} 
                        color="secondary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewUser(r.id)}
                        title="View User Details"
                      >
                        <Visibility />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TablePagination
        component="div"
        count={pagination.total}
        page={pagination.page}
        onPageChange={handleChangePage}
        rowsPerPage={pagination.limit}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="First Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Last Name (Optional)"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
            <TextField
              fullWidth
              label="Phone Number (Optional)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              required
              helperText="Minimum 6 characters"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setIsCreateDialogOpen(false);
            resetCreateForm();
          }}>Cancel</Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            disabled={createLoading}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

