'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, Chip, Alert, Button } from '@mui/material';
import { Refresh } from '@mui/icons-material';

interface Subscription {
  id: string;
  workspaceId: string;
  status: string;
  startDate?: string;
  endDate?: string;
  package?: { id: string; name: string; durationMonths: number };
}

export default function WorkspaceSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubs = async () => {
    try {
      const { data } = await api.get('/api/admin/finance/overview');
      setSubs((data.subscriptions || []) as Subscription[]);
    } catch (e) {
      setError('Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubs(); }, []);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={800}>Workspace Subscriptions</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchSubs}>Refresh</Button>
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
                  <TableCell>ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Package</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.id}</TableCell>
                    <TableCell>
                      <Chip size="small" label={s.status} color={s.status === 'active' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>{s.package ? `${s.package.name} (${s.package.durationMonths}m)` : '-'}</TableCell>
                    <TableCell>{s.startDate ? new Date(s.startDate).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{s.endDate ? new Date(s.endDate).toLocaleDateString() : '-'}</TableCell>
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


