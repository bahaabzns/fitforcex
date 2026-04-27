'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspaceBranding } from '@/hooks/useWorkspaceBranding';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  CircularProgress,
  IconButton,
  Chip,
  Avatar,
  Divider,
  Alert
} from '@mui/material';
import { 
  Send, 
  AttachFile, 
  SupportAgent,
  Close,
  Refresh,
  CheckCircle
} from '@mui/icons-material';
import api from '@/utils/axios';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '@/hooks/useSocket';
import { getCookie } from '@/utils/cookies';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

interface Message {
  id: string;
  body: string;
  senderType: string;
  senderName: string;
  createdAt: string;
  attachments?: Array<{
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
  }>;
}

export default function ClientSupportPage() {
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const { logoUrl, primaryColor, workspaceName } = useWorkspaceBranding();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get client auth token for Socket.IO
  const [clientToken, setClientToken] = useState<string | null>(null);
  useEffect(() => {
    const token = getCookie('clientAuthToken');
    setClientToken(token);
    console.log('[Client Support] Client token:', token ? 'Found' : 'Not found');
  }, []);

  // Initialize Socket.IO (cookie-based auth supported; keep enabled true)
  const { socket, isConnected } = useSocket({ token: clientToken || undefined, enabled: true });

  // Setup Socket.IO event listeners
  useEffect(() => {
    if (!socket || !threadId) return;

    // Join thread room
    socket.emit('join_thread', threadId);

    // Listen for new messages
    socket.on('new_message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    // Listen for typing indicators
    socket.on('user_typing', (data: { threadId: string; senderName: string; userType: string }) => {
      if (data.threadId === threadId && data.userType === 'team') {
        setTypingUser('Support Team');
      }
    });

    socket.on('user_stopped_typing', (data: { threadId: string; userType: string }) => {
      if (data.threadId === threadId && data.userType === 'team') {
        setTypingUser(null);
      }
    });

    return () => {
      socket.emit('leave_thread', threadId);
      socket.off('new_message');
      socket.off('user_typing');
      socket.off('user_stopped_typing');
    };
  }, [socket, threadId]);

  useEffect(() => {
    fetchOrCreateThread();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchOrCreateThread = async () => {
    try {
      // Try to get existing threads
      const { data } = await api.get('/api/messenger/client/threads');
      
      if (data.threads && data.threads.length > 0) {
        // Use the first open thread
        const openThread = data.threads.find((t: any) => t.status === 'open') || data.threads[0];
        setThreadId(openThread.id);
        fetchMessages(openThread.id);
      } else {
        // No threads exist, will create on first message
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch threads:', err);
      setLoading(false);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const { data } = await api.get(`/api/messenger/client/threads/${id}/messages`);
      setMessages(data.messages || []);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
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
      const { data } = await api.post('/api/messenger/client/upload', formData, {
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
    if (!messageBody.trim() && attachments.length === 0) return;

    setSending(true);
    try {
      // Upload files first
      const uploadedFiles = await uploadFiles();

      if (!threadId) {
        // Create new thread with initial message
        const { data } = await api.post('/api/messenger/client/threads', {
          subject: 'Support Request',
          initialMessage: messageBody.trim() || '(attachment)',
        });
        setThreadId(data.thread.id);
        fetchMessages(data.thread.id);
      } else {
        // Send message to existing thread
        await api.post(`/api/messenger/client/threads/${threadId}/messages`, {
          body: messageBody.trim() || '(attachment)',
          attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        });
      }

      setMessageBody('');
      setAttachments([]);
      
      // Stop typing indicator
      if (socket && threadId) {
        socket.emit('typing_stop', { threadId });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (!socket || !threadId) return;

    // Emit typing start
    socket.emit('typing_start', { threadId });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { threadId });
    }, 3000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}CC 100%)`,
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            {logoUrl ? (
              <Box sx={{ width: 56, height: 56, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={`${workspaceName} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
            ) : (
              <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
                <SupportAgent sx={{ fontSize: 32 }} />
              </Avatar>
            )}
            <Box>
              <Typography variant="h4" fontWeight={700}>
                {t('client.support.title')}
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
                {t('client.support.subtitle')}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {isConnected ? (
              <Chip 
                icon={<CheckCircle sx={{ fontSize: 18 }} />}
                label={t('client.support.connected')} 
                sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontWeight: 600
                }}
                size="small"
              />
            ) : (
              <Chip 
                label={t('client.support.offline')} 
                sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white'
                }}
                size="small"
              />
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Main Chat Card */}
      <Card 
        sx={{ 
          borderRadius: 3,
          height: 'calc(100vh - 300px)', 
          minHeight: 500,
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Messages Area */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3, bgcolor: 'background.default' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Stack alignItems="center" spacing={2}>
                <CircularProgress size={60} />
                <Typography color="text.secondary">{t('client.support.loading')}</Typography>
              </Stack>
            </Box>
          ) : messages.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', mx: 'auto', mb: 2 }}>
                <SupportAgent sx={{ fontSize: 48 }} />
              </Avatar>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {t('client.support.welcome')}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {t('client.support.welcomeDesc')}
              </Typography>
              <Alert severity="info" sx={{ maxWidth: 500, mx: 'auto' }}>
                {t('client.support.responseTime')}
              </Alert>
            </Box>
          ) : (
            <Stack spacing={2}>
              {messages.map((message) => {
                const isClient = message.senderType === 'client';
                return (
                  <Stack
                    key={message.id}
                    direction="row"
                    justifyContent={isClient ? 'flex-end' : 'flex-start'}
                    sx={{ width: '100%' }}
                  >
                    {!isClient && (
                      <Avatar sx={{ bgcolor: 'success.main', mr: 1 }}>
                        <SupportAgent />
                      </Avatar>
                    )}
                    <Paper
                      elevation={2}
                      sx={{
                        p: 2,
                        maxWidth: '75%',
                        bgcolor: isClient ? 'primary.main' : 'background.paper',
                        color: isClient ? 'white' : 'text.primary',
                        borderRadius: 3,
                        borderBottomRightRadius: isClient ? 0 : 3,
                        borderBottomLeftRadius: isClient ? 3 : 0,
                      }}
                    >
                      <Typography variant="caption" sx={{ 
                        display: 'block', 
                        mb: 0.5,
                        opacity: 0.8,
                        fontWeight: 600
                      }}>
                        {isClient ? t('you') : t('client.support.team')} •{' '}
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </Typography>
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message.body}
                      </Typography>
                      
                      {message.attachments && message.attachments.length > 0 && (
                        <Stack spacing={1} sx={{ mt: 2 }}>
                          {message.attachments.map((file, idx) => (
                            <Button
                              key={idx}
                              size="small"
                              variant="outlined"
                              startIcon={<AttachFile />}
                              href={file.url}
                              target="_blank"
                              sx={{ 
                                justifyContent: 'flex-start',
                                color: isClient ? 'white' : 'primary.main',
                                borderColor: isClient ? 'rgba(255, 255, 255, 0.5)' : 'primary.main',
                                '&:hover': {
                                  borderColor: isClient ? 'white' : 'primary.dark',
                                }
                              }}
                            >
                              {file.originalName} ({formatFileSize(file.size)})
                            </Button>
                          ))}
                        </Stack>
                      )}
                    </Paper>
                    {isClient && (
                      <Avatar sx={{ bgcolor: 'primary.main', ml: 1 }}>
                        {message.senderName.charAt(0).toUpperCase()}
                      </Avatar>
                    )}
                  </Stack>
                );
              })}
              
              {typingUser && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                    <SupportAgent sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Paper 
                    elevation={1}
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'action.hover' : 'grey.100'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {typingUser} is typing...
                    </Typography>
                  </Paper>
                </Stack>
              )}
              <div ref={messagesEndRef} />
            </Stack>
          )}
        </Box>

        <Divider />

        {/* Message Input Area */}
        <Box sx={{ p: 2.5, bgcolor: 'background.paper' }}>
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
              {attachments.map((file, idx) => (
                <Chip
                  key={idx}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  onDelete={() => handleRemoveAttachment(idx)}
                  deleteIcon={<Close />}
                  size="small"
                  sx={{ 
                    maxWidth: 200,
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }
                  }}
                />
              ))}
            </Stack>
          )}
          
          {/* Input Row */}
          <Stack direction="row" spacing={1} alignItems="flex-end">
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
              sx={{ 
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'action.hover' : 'grey.100',
                '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'action.selected' : 'grey.200' }
              }}
            >
              <AttachFile />
            </IconButton>
            
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder={t('client.support.typeMessage')}
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
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                }
              }}
            />
            
            <Button
              variant="contained"
              size="large"
              endIcon={<Send />}
              onClick={handleSendMessage}
              disabled={(!messageBody.trim() && attachments.length === 0) || sending || uploading}
              sx={{ 
                minWidth: 120,
                borderRadius: 3,
                py: 1.75
              }}
            >
              {uploading ? t('uploading') : sending ? t('sending') : t('send')}
            </Button>
          </Stack>

          {/* Connection Status */}
          {!isConnected && (
            <Alert 
              severity="warning" 
              sx={{ mt: 2, borderRadius: 2 }}
              action={
                <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                  {t('client.support.reconnect')}
                </Button>
              }
            >
              {t('client.support.connectionLost')}
            </Alert>
          )}
        </Box>
      </Card>

    </Box>
  );
}
