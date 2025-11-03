'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/utils/axios';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Skeleton,
  Stack,
} from '@mui/material';
import { ArrowBack, Settings, Add } from '@mui/icons-material';
import Snackbar from '@mui/material/Snackbar';

interface User {
  id: string;
  email: string;
  fullName: string;
  lastName?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  workspacesOwned: Array<{
    id: string;
    name: string;
    subdomain: string;
    customDomain?: string | null;
    createdAt: string;
  }>;
  memberships: Array<{
    id: string;
    workspace: {
      id: string;
      name: string;
      subdomain: string;
      customDomain?: string | null;
    };
    role: {
      id: string;
      name: string;
    };
  }>;
  _count: {
    workspacesOwned: number;
    memberships: number;
  };
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string}>({open: false, message: ''});

  // Create workspace form state
  const [workspaceName, setWorkspaceName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/admin/users/${userId}`);
      setUser(data.user);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to fetch user');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName || !subdomain) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreateLoading(true);
      setError(null);

      await api.post('/api/admin/workspaces', {
        name: workspaceName,
        subdomain,
        customDomain: customDomain || undefined,
        ownerEmail: user?.email,
      });

      setIsCreateDialogOpen(false);
      setWorkspaceName('');
      setSubdomain('');
      setCustomDomain('');
      fetchUser(); // Refresh user data
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create workspace');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetCreateForm = () => {
    setWorkspaceName('');
    setSubdomain('');
    setCustomDomain('');
    setError(null);
  };

  if (loading) {
    return (
      <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
        <Alert severity="error">User not found</Alert>
        <Button onClick={() => router.push('/admin/users')}>Back to Users</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => router.push('/admin/users')}
          variant="outlined"
          size="small"
        >
          Back to Users
        </Button>
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }}>
          {user.fullName} {user.lastName || ''}
        </Typography>
        <Button
          variant="outlined"
          color="warning"
          size="small"
          onClick={async () => {
            try {
              await api.post(`/api/admin/users/${user.id}/reset-password`);
              setSnackbar({ open: true, message: 'Reset email sent' });
            } catch (e:any) {
              setSnackbar({ open: true, message: e?.response?.data?.error || 'Failed to send reset email' });
            }
          }}
        >
          Reset Password
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* User Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>User Information</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Email</Typography>
              <Typography variant="body1">{user.email}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Phone</Typography>
              <Typography variant="body1">{user.phoneNumber || '-'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Created</Typography>
              <Typography variant="body1">{new Date(user.createdAt).toLocaleDateString()}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Last Updated</Typography>
              <Typography variant="body1">{new Date(user.updatedAt).toLocaleDateString()}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label={`Owned Workspaces (${user.workspacesOwned.length})`} />
          <Tab label={`Memberships (${user.memberships.length})`} />
        </Tabs>
      </Box>

      {/* Content */}
      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Workspaces Owned</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setIsCreateDialogOpen(true)}
            >
              Create Workspace
            </Button>
          </Box>

          <Card>
            <CardContent>
              {user.workspacesOwned.length === 0 ? (
                <Typography color="text.secondary">No owned workspaces</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Subdomain</TableCell>
                      <TableCell>Custom Domain</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {user.workspacesOwned.map((ws) => (
                      <TableRow key={ws.id}>
                        <TableCell>{ws.name}</TableCell>
                        <TableCell>{ws.subdomain}</TableCell>
                        <TableCell>{ws.customDomain || '-'}</TableCell>
                        <TableCell>{new Date(ws.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            startIcon={<Settings />}
                            onClick={() => router.push(`/admin/workspaces/${ws.id}`)}
                          >
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>Workspace Memberships</Typography>
          <Card>
            <CardContent>
              {user.memberships.length === 0 ? (
                <Typography color="text.secondary">No memberships</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Workspace</TableCell>
                      <TableCell>Subdomain</TableCell>
                      <TableCell>Custom Domain</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {user.memberships.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.workspace.name}</TableCell>
                        <TableCell>{m.workspace.subdomain}</TableCell>
                        <TableCell>{m.workspace.customDomain || '-'}</TableCell>
                        <TableCell>
                          <Chip label={m.role.name} size="small" color="primary" />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            startIcon={<Settings />}
                            onClick={() => router.push(`/admin/workspaces/${m.workspace.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Workspace for {user.fullName}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Workspace Name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="myworkspace"
              helperText="Will be accessible at myworkspace.fitforce.io"
              required
            />
            <TextField
              fullWidth
              label="Custom Domain (Optional)"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="myworkspace.com"
              helperText="Custom domain for the workspace"
            />
            <TextField
              fullWidth
              label="Owner Email"
              value={user.email}
              disabled
              helperText="This user will be the workspace owner"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setIsCreateDialogOpen(false);
            resetCreateForm();
          }}>Cancel</Button>
          <Button
            onClick={handleCreateWorkspace}
            variant="contained"
            disabled={createLoading}
          >
            Create Workspace
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({...s, open: false}))}
        message={snackbar.message}
      />
    </Box>
  );
}

