'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, Chip, TextField, Button, Alert } from '@mui/material';
import { Refresh } from '@mui/icons-material';

interface WorkspaceRow {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  owner?: { id: string; fullName: string; email: string } | null;
  createdAt: string;
}

export default function AdminWorkspacesPage() {
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

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

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={800}>Workspaces</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Search by name, subdomain, or owner email" value={q} onChange={(e) => setQ(e.target.value)} />
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}


