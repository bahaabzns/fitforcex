'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, Chip, Alert, Button, Pagination, CircularProgress } from '@mui/material';
import { Refresh } from '@mui/icons-material';

interface Subscription {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  workspaceSubdomain?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  package?: { id: string; name: string; durationMonths: number };
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  paymentMethod?: string;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function WorkspaceSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const fetchSubs = async (page: number = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/admin/finance/overview?page=${page}&limit=20`);
      setSubs((data.subscriptions || []) as Subscription[]);
      setPagination(data.pagination || pagination);
    } catch (e) {
      setError('Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    fetchSubs(page);
  };

  useEffect(() => { fetchSubs(); }, []);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={800}>Workspace Subscriptions</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Total: {pagination.totalCount} subscriptions
        </Typography>
        <Button variant="outlined" startIcon={<Refresh />} onClick={() => fetchSubs(pagination.page)}>Refresh</Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Workspace</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payment Method</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Renewal Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {s.workspaceName || 'Unknown Workspace'}
                          </Typography>
                          {s.workspaceSubdomain && (
                            <Typography variant="caption" color="text.secondary">
                              {s.workspaceSubdomain}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {s.clientName || 'Unknown Client'}
                          </Typography>
                          {s.clientEmail && (
                            <Typography variant="caption" color="text.secondary">
                              {s.clientEmail}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={s.status} 
                          color={
                            s.status === 'active' ? 'success' : 
                            s.status === 'expired' ? 'error' : 
                            s.status === 'frozen' ? 'warning' : 'default'
                          } 
                        />
                      </TableCell>
                      <TableCell>{s.paymentMethod || 'N/A'}</TableCell>
                      <TableCell>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{s.renewalDate ? new Date(s.renewalDate).toLocaleDateString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {pagination.totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={pagination.totalPages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}


