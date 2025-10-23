'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, Chip, TextField, Button, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Refresh, Settings, Add } from '@mui/icons-material';

interface WorkspaceRow {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  owner?: { id: string; fullName: string; email: string } | null;
  createdAt: string;
}

export default function AdminWorkspacesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  // Create workspace form state
  const [workspaceName, setWorkspaceName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const fetchRows = async () => {
    try {
      const { data } = await api.get('/api/admin/workspaces');
      setRows(data.workspaces || []);
    } catch (e) {
      setError('Failed to fetch workspaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  const filtered = rows.filter(r =>
    r.name.toLowerCase().includes(q.toLowerCase()) ||
    r.subdomain.toLowerCase().includes(q.toLowerCase()) ||
    (r.owner?.email?.toLowerCase() || '').includes(q.toLowerCase())
  );

  const handleManageWorkspace = (workspaceId: string) => {
    router.push(`/admin/workspaces/${workspaceId}`);
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName || !subdomain || !ownerEmail) {
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
        ownerEmail,
      });

      setIsCreateDialogOpen(false);
      setWorkspaceName('');
      setSubdomain('');
      setCustomDomain('');
      setOwnerEmail('');
      fetchRows(); // Refresh the list
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
    setOwnerEmail('');
    setError(null);
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={800}>Workspaces</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Search by name, subdomain, or owner email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="contained" startIcon={<Add />} onClick={() => setIsCreateDialogOpen(true)}>Create Workspace</Button>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchRows}>Refresh</Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      <Card>
        <CardContent>
          {loading ? (
            <Typography>Loading…</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Subdomain</TableCell>
                  <TableCell>Custom Domain</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Owner Email</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.subdomain}</TableCell>
                    <TableCell>{r.customDomain || '-'}</TableCell>
                    <TableCell>{r.owner?.fullName || '-'}</TableCell>
                    <TableCell>{r.owner?.email || '-'}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleManageWorkspace(r.id)}
                        title="Manage Workspace"
                      >
                        <Settings />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Workspace</DialogTitle>
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
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
              helperText="Email of the workspace owner (will create user if doesn't exist)"
              required
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
    </Box>
  );
}


