'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Stack,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { APP_CONFIG } from '@/lib/config';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  attachments: string[];
  createdBy?: {
    id: string;
    email: string;
    fullName: string;
  };
  _count?: {
    messages: number;
  };
}

const statusColors: Record<string, string> = {
  open: '#2196F3',
  pending: '#FF9800',
  in_progress: '#9C27B0',
  resolved: '#4CAF50',
  closed: '#9E9E9E',
};

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const response = await fetch(
        `${APP_CONFIG.apiUrl}/api/tickets/my${params.toString() ? `?${params.toString()}` : ''}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }

      const data = await response.json();
      setTickets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, categoryFilter]);

  const getStatusColor = (status: string) => {
    return statusColors[status] || '#9E9E9E';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Support Tickets
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/dashboard/tickets/new')}
          >
            New Ticket
          </Button>
          <IconButton onClick={fetchTickets} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="">All Categories</MenuItem>
                <MenuItem value="billing">Billing</MenuItem>
                <MenuItem value="technical">Technical Support</MenuItem>
                <MenuItem value="account">Account Issues</MenuItem>
                <MenuItem value="workspace_report">Workspace Report</MenuItem>
                <MenuItem value="feature_request">Feature Request</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Tickets List */}
      {!loading && !error && (
        <>
          {tickets.length === 0 ? (
            <Card>
              <CardContent>
                <Box textAlign="center" py={4}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No tickets found
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => router.push('/dashboard/tickets/new')}
                    sx={{ mt: 2 }}
                  >
                    Create Your First Ticket
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={2}>
              {tickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}
                  onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                >
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1}>
                        <Typography variant="h6" gutterBottom>
                          {ticket.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2 }}
                          noWrap
                        >
                          {ticket.description}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip
                            label={ticket.status}
                            size="small"
                            sx={{
                              bgcolor: getStatusColor(ticket.status),
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                          <Chip label={ticket.category} size="small" variant="outlined" />
                          <Chip label={ticket.priority} size="small" variant="outlined" />
                          {ticket._count && ticket._count.messages > 0 && (
                            <Chip
                              label={`${ticket._count.messages} messages`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(ticket.createdAt)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}
    </Container>
  );
}

