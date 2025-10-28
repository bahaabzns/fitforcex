'use client';

import { useState, useEffect, useRef } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Button,
  Chip,
  Stack,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
  Paper,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search,
  Send,
  AttachFile,
  Close,
} from '@mui/icons-material';
import api from '@/utils/axios';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '@/hooks/useSocket';
import { useAppSelector } from '@/store';
import { useAppDispatch } from '@/store';
import { setUnreadTotal } from '@/store/slices/messengerSlice';
import { getCookie } from '@/utils/cookies';

interface Thread {
  id: string;
  subject: string | null;
  status: string;
  client: {
    id: string;
    fullName: string;
    email: string | null;
  } | null;
  messages: Array<{
    body: string;
    createdAt: string;
    senderType: string;
  }>;
  unreadCount: number;
  updatedAt: string;
  _count: {
    messages: number;
  };
}

interface Message {
  id: string;
  body: string;
  senderType: string;
  senderName: string;
  createdAt: string;
  readByTeamAt: string | null;
  readByClientAt: string | null;
  attachments?: Array<{
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
  }>;
}

export default function MessengerPage() {
  const intl = useIntl();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const dispatch = useAppDispatch();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Status removed; threads are always open for chat
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Array<{ id: string; fullName: string; email: string | null }>>([]);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Get auth token for Socket.IO (from cookies)
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    const token = getCookie('authToken');
    setAuthToken(token);
    console.log('[Messenger] Auth token:', token ? 'Found' : 'Not found');
  }, []);

  // Initialize Socket.IO (cookie-based auth supported; keep enabled true)
  const { socket, isConnected } = useSocket({ token: authToken || undefined, enabled: true, workspaceId: workspaceId || undefined });

  // Setup Socket.IO event listeners
  useEffect(() => {
    if (!socket) return;

    // Join workspace room (happens automatically on connection)
    
    // Listen for new messages
    socket.on('new_message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
      
      // Update thread list
      fetchThreads();
    });

    // Listen for thread updates
    socket.on('thread_updated', (thread: Thread) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? thread : t))
      );
    });

    // Listen for new threads
    socket.on('new_thread', (thread: Thread) => {
      setThreads((prev) => [thread, ...prev]);
    });

    // Listen for typing indicators
    socket.on('user_typing', (data: { threadId: string; senderName: string; userType: string }) => {
      if (selectedThread?.id === data.threadId && data.userType === 'client') {
        setTypingUser(data.senderName);
      }
    });

    socket.on('user_stopped_typing', (data: { threadId: string; userType: string }) => {
      if (selectedThread?.id === data.threadId && data.userType === 'client') {
        setTypingUser(null);
      }
    });

    return () => {
      socket.off('new_message');
      socket.off('thread_updated');
      socket.off('new_thread');
      socket.off('user_typing');
      socket.off('user_stopped_typing');
    };
  }, [socket, selectedThread]);

  // Join/leave thread rooms
  useEffect(() => {
    if (!socket || !selectedThread) return;
    (async () => {
      socket.emit('join_thread', selectedThread.id);
      // Load messages (marks as read on server) then refresh threads to clear unread counters
      await fetchMessages(selectedThread.id);
      await fetchThreads();
      // Ensure we land at the latest message
      scrollToBottom();
    })();

    return () => {
      socket.emit('leave_thread', selectedThread.id);
    };
  }, [socket, selectedThread]);

  useEffect(() => {
    fetchThreads();
  }, [searchQuery]);
  
  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread.id);
    }
  }, [selectedThread]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThreads = async () => {
    try {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;

      const { data } = await api.get('/api/messenger/inbox', { params });
      setThreads(data.threads || []);
      // Update unread total for sidebar badge
      const unread = Array.isArray(data.threads) ? data.threads.reduce((acc: number, t: any) => acc + (t.unreadCount || 0), 0) : 0;
      dispatch(setUnreadTotal(unread));
    } catch (err) {
      console.error('Failed to fetch threads:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchClients = async () => {
    try {
      const { data } = await api.get('/api/clients');
      setClients((data.clients || []).map((c: any) => ({ id: c.id, fullName: c.fullName, email: c.email })));
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const fetchMessages = async (threadId: string) => {
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/api/messenger/threads/${threadId}/messages`);
      setMessages(data.messages || []);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachments([file]); // Only allow one file
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<any[]> => {
    if (attachments.length === 0) return [];

    const formData = new FormData();
    attachments.forEach((file) => {
      formData.append('files', file);
    });

    try {
      setUploading(true);
      const { data } = await api.post('/api/messenger/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.files || [];
    } catch (err) {
      console.error('Failed to upload files:', err);
      return [];
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThread || (!messageBody.trim() && attachments.length === 0)) return;

    setSending(true);
    try {
      // Upload files first
      const uploadedFiles = await uploadFiles();

      // Send message
      await api.post(`/api/messenger/threads/${selectedThread.id}/messages`, {
        body: messageBody.trim() || '(attachment)',
        attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      });

      setMessageBody('');
      setAttachments([]);
      
      // Stop typing indicator
      if (socket) {
        socket.emit('typing_stop', { threadId: selectedThread.id });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const startChatWithClient = async (clientId: string) => {
    try {
      const { data } = await api.post('/api/messenger/threads', { clientId });
      if (data.thread) {
        setSelectedThread(data.thread);
        fetchMessages(data.thread.id);
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const handleTyping = () => {
    if (!socket || !selectedThread) return;

    // Emit typing start
    socket.emit('typing_start', { threadId: selectedThread.id });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { threadId: selectedThread.id });
    }, 3000);
  };

  const handleUpdateStatus = async (threadId: string, status: string) => {
    try {
      await api.patch(`/api/messenger/threads/${threadId}/status`, { status });
      fetchThreads();
      if (selectedThread?.id === threadId) {
        setSelectedThread({ ...selectedThread, status });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'success';
      case 'pending':
        return 'warning';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <CheckCircle fontSize="small" />;
      case 'pending':
        return <PendingActions fontSize="small" />;
      case 'closed':
        return <Cancel fontSize="small" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getThreadPreview = (t: Thread): string => {
    const body = t.messages && t.messages[0] && t.messages[0].body ? t.messages[0].body : '';
    if (body) {
      return body.length > 50 ? body.substring(0, 50) + '...' : body;
    }
    return intl.formatMessage({ id: 'messenger.startConversation', defaultMessage: 'Start a conversation' });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        <FormattedMessage id="messenger.title" defaultMessage="Messenger" />
        {isConnected && (
          <Chip
            label={intl.formatMessage({ id: 'messenger.live', defaultMessage: 'Live' })}
            color="success"
            size="small"
            sx={{ ml: 2 }}
          />
        )}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, height: 'calc(100vh - 200px)' }}>
        {/* Thread List */}
        <Box sx={{ width: { xs: '100%', md: '35%' } }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 0 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={intl.formatMessage({ id: 'messenger.search.placeholder', defaultMessage: 'Search conversations...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2"><FormattedMessage id="messenger.conversations" defaultMessage="Conversations" /></Typography>
                <Button size="small" variant="contained" onClick={() => setClientPickerOpen(true)}><FormattedMessage id="messenger.startChat" defaultMessage="Start chat" /></Button>
              </Stack>
            </CardContent>

            <Divider />

            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : threads.length === 0 ? (
                <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  <FormattedMessage id="messenger.noConversations" defaultMessage="No conversations found" />
                </Typography>
              ) : (
                <List>
                  {threads.map((thread) => (
                    <ListItem key={thread.id} disablePadding>
                      <ListItemButton
                        selected={selectedThread?.id === thread.id}
                        onClick={() => setSelectedThread(thread)}
                      >
                        <Badge
                          badgeContent={thread.unreadCount || 0}
                          color="error"
                          sx={{ width: '100%' }}
                        >
                          <ListItemText
                            primaryTypographyProps={{ component: 'div' }}
                            secondaryTypographyProps={{ component: 'div' }}
                            primary={
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" component="span">
                                  {thread.client?.fullName || intl.formatMessage({ id: 'messenger.unknownClient', defaultMessage: 'Unknown Client' })}
                                </Typography>
                                {/* Status chip removed */}
                              </Stack>
                            }
                            secondary={
                              <Stack spacing={0.5}>
                                <Typography variant="body2" noWrap component="span">
                                  {thread.subject || intl.formatMessage({ id: 'messenger.supportRequest', defaultMessage: 'Support Request' })}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" component="span">
                                  {getThreadPreview(thread)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" component="span">
                                  {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                                </Typography>
                              </Stack>
                            }
                          />
                        </Badge>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Card>
        </Box>

        {/* Message Pane */}
        <Box sx={{ flex: 1, width: { xs: '100%', md: '65%' } }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedThread ? (
              <>
                {/* Header */}
                <CardContent sx={{ flexGrow: 0, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">
                        {selectedThread.client?.fullName || 'Unknown Client'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedThread.client?.email}
                      </Typography>
                    </Box>
                    {/* Status actions removed */}
                  </Stack>
                </CardContent>

                {/* Messages */}
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                  {loadingMessages ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <Stack spacing={2}>
                      {messages.map((message) => (
                        <Paper
                          key={message.id}
                          sx={{
                            p: 2,
                            alignSelf: message.senderType === 'team' ? 'flex-end' : 'flex-start',
                            maxWidth: '70%',
                            bgcolor: message.senderType === 'team' ? 'primary.light' : 'grey.100',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {message.senderName} • {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </Typography>
                          <Typography variant="body1">{message.body}</Typography>
                          
                          {message.attachments && message.attachments.length > 0 && (
                            <Stack spacing={1} sx={{ mt: 1 }}>
                              {message.attachments.map((file, idx) => (
                                <Button
                                  key={idx}
                                  size="small"
                                  startIcon={<AttachFile />}
                                  href={file.url}
                                  target="_blank"
                                  sx={{ justifyContent: 'flex-start' }}
                                >
                                  {file.originalName} ({formatFileSize(file.size)})
                                </Button>
                              ))}
                            </Stack>
                          )}
                        </Paper>
                      ))}
                      {typingUser && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          {typingUser} is typing...
                        </Typography>
                      )}
                      <div ref={messagesEndRef} />
                    </Stack>
                  )}
                </Box>

                {/* Message Input */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                  {attachments.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                      {attachments.map((file, idx) => (
                        <Chip
                          key={idx}
                          label={`${file.name} (${formatFileSize(file.size)})`}
                          onDelete={() => handleRemoveAttachment(idx)}
                          size="small"
                        />
                      ))}
                    </Stack>
                  )}
                  
                  <Stack direction="row" spacing={1}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    />
                    <IconButton
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || sending}
                    >
                      <AttachFile />
                    </IconButton>
                    
                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      placeholder="Type your message..."
                      value={messageBody}
                      onChange={(e) => {
                        setMessageBody(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sending || uploading}
                    />
                    
                    <Button
                      variant="contained"
                      endIcon={<Send />}
                      onClick={handleSendMessage}
                      disabled={(!messageBody.trim() && attachments.length === 0) || sending || uploading}
                    >
                      {uploading ? 'Uploading...' : sending ? 'Sending...' : 'Send'}
                    </Button>
                  </Stack>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography variant="h6" color="text.secondary">
                  Select a conversation to start messaging
                </Typography>
              </Box>
            )}
          </Card>
        </Box>
      </Box>
      {/* Client Picker Dialog */}
      <Dialog open={clientPickerOpen} onClose={() => setClientPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle><FormattedMessage id="messenger.selectClient" defaultMessage="Select client" /></DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            size="small"
            placeholder={intl.formatMessage({ id: 'messenger.searchClients', defaultMessage: 'Search clients by name or email...' })}
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <Stack spacing={1} sx={{ maxHeight: 360, overflow: 'auto' }}>
            {clients
              .filter((c) => {
                const q = clientSearch.trim().toLowerCase();
                if (!q) return true;
                return c.fullName.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
              })
              .map((c) => (
                <Stack key={c.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  <Box>
                    <Typography variant="subtitle2">{c.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.email}</Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={async () => {
                    await startChatWithClient(c.id);
                    setClientPickerOpen(false);
                  }}><FormattedMessage id="open" defaultMessage="Open" /></Button>
                </Stack>
              ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClientPickerOpen(false)}><FormattedMessage id="close" defaultMessage="Close" /></Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}