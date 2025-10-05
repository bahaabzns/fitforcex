'use client';

import { useState, useEffect, useRef } from 'react';
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
} from '@mui/material';
import { Send, AttachFile } from '@mui/icons-material';
import api from '@/utils/axios';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '@/hooks/useSocket';
import { getCookie } from '@/utils/cookies';

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

  // Initialize Socket.IO
  const { socket, isConnected } = useSocket({ token: clientToken || undefined, enabled: !!clientToken });

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
        setTypingUser(data.senderName);
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
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...files]);
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
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Workspace Support</Typography>
        {isConnected && (
          <Chip label="Live" color="success" size="small" />
        )}
      </Stack>

      <Card sx={{ height: 'calc(100vh - 250px)', display: 'flex', flexDirection: 'column' }}>
        {/* Messages */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : messages.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Welcome to Support
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Send us a message and we'll get back to you as soon as possible.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {messages.map((message) => (
                <Paper
                  key={message.id}
                  sx={{
                    p: 2,
                    alignSelf: message.senderType === 'client' ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                    bgcolor: message.senderType === 'client' ? 'primary.light' : 'grey.100',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {message.senderType === 'client' ? 'You' : message.senderName} •{' '}
                    {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
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
              multiple
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
      </Card>
    </Box>
  );
}