'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  TextField,
  Typography,
  Stack,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
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
}

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: string;
  message: string;
  attachments: string[];
  createdAt: string;
}

interface TicketActivity {
  id: string;
  ticketId: string;
  userId: string;
  changeType: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
}

const statusColors: Record<string, string> = {
  open: '#2196F3',
  pending: '#FF9800',
  in_progress: '#9C27B0',
  resolved: '#4CAF50',
  closed: '#9E9E9E',
};

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${APP_CONFIG.apiUrl}/api/tickets/${ticketId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ticket');
      }

      const data = await response.json();
      setTicket(data);
      setMessages(data.messages || []);
      setActivities(data.activities || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      setSending(true);
      const response = await fetch(`${APP_CONFIG.apiUrl}/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setMessageText('');
      await fetchTicket(); // Refresh to get new message
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !ticket) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Ticket not found'}</Alert>
        <Button onClick={() => router.back()} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.back()}
        sx={{ mb: 3 }}
      >
        Back
      </Button>

      {/* Ticket Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box flex={1}>
              <Typography variant="h4" component="h1" gutterBottom>
                {ticket.title}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
                <Chip
                  label={ticket.status}
                  sx={{
                    bgcolor: statusColors[ticket.status] || '#9E9E9E',
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
                <Chip label={ticket.category} variant="outlined" />
                <Chip label={ticket.priority} variant="outlined" />
              </Stack>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Created {formatDate(ticket.createdAt)}
            </Typography>
          </Stack>
          <Typography variant="body1" paragraph>
            {ticket.description}
          </Typography>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Messages ({messages.length})
          </Typography>
          <Divider sx={{ my: 2 }} />
          {messages.length === 0 ? (
            <Typography color="text.secondary" align="center" py={4}>
              No messages yet
            </Typography>
          ) : (
            <Stack spacing={2}>
              {messages.map((message) => {
                const isUser = message.senderType === 'user';
                return (
                  <Box
                    key={message.id}
                    sx={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Card
                      sx={{
                        maxWidth: '70%',
                        bgcolor: isUser ? 'primary.main' : 'grey.100',
                        color: isUser ? 'white' : 'text.primary',
                      }}
                    >
                      <CardContent>
                        <Typography variant="body1">{message.message}</Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: isUser ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                            display: 'block',
                            mt: 1,
                          }}
                        >
                          {formatDate(message.createdAt)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      {activities.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Activity Log
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              {activities.map((activity) => (
                <Box key={activity.id} sx={{ py: 1 }}>
                  <Typography variant="body2">
                    <strong>{activity.changeType.replace(/_/g, ' ').toUpperCase()}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activity.oldValue || 'N/A'} → {activity.newValue || 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formatDate(activity.createdAt)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Message Input */}
      <Card>
        <CardContent>
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Type your message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={sending}
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sending}
              sx={{ alignSelf: 'flex-end' }}
            >
              {sending ? <CircularProgress size={24} /> : <SendIcon />}
            </IconButton>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}

