'use client';

import { useState, useEffect } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Chip,
  Grid,
  Stack,
  CircularProgress,
  Alert,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  ArrowLeft2,
  User,
  Calendar,
  Crown,
  Refresh,
  Activity,
  Clock,
  TickCircle,
  Danger,
  InfoCircle
} from '@wandersonalwes/iconsax-react';
import { AttachFile, CloudUpload, Delete as DeleteIcon, Download as DownloadIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import api from '@/utils/axios';

interface ClientData {
  client: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  metrics: {
    totalFormSubmissions: number;
    nutritionPlansCount: number;
    workoutPlansCount: number;
    subscriptionsCount: number;
    pendingFormsCount: number;
    completedFormsCount: number;
    activePlansCount: number;
  };
  recentActivities: Array<{
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    type: string;
  }>;
}

interface Observation {
  id: string;
  content: string;
  createdAt: string;
  author?: {
    id?: string;
    fullName?: string;
    email?: string | null;
  };
}

interface ClientAttachment {
  id: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy?: {
    id?: string;
    fullName?: string;
    email?: string | null;
  } | null;
}

export default function ClientOverviewPage() {
  const intl = useIntl();
  const params = useParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const clientId = params.id as string;
  
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [observationsLoading, setObservationsLoading] = useState(false);
  const [observationsError, setObservationsError] = useState<string | null>(null);
  const [observationText, setObservationText] = useState('');
  const [savingObservation, setSavingObservation] = useState(false);
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  useEffect(() => {
    loadClientData();
    loadObservations();
    loadAttachments();
  }, [clientId]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/clients/${clientId}/overview`);
      setData(response.data);
    } catch (err: any) {
      console.error('Failed to load client data:', err);
      setError(err.response?.data?.message || 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  const loadObservations = async () => {
    try {
      setObservationsLoading(true);
      setObservationsError(null);

      const response = await api.get(`/api/clients/${clientId}/observations`);
      setObservations(response.data?.observations || []);
    } catch (err: any) {
      console.error('Failed to load observations:', err);
      setObservationsError(err.response?.data?.message || 'Failed to load observations');
    } finally {
      setObservationsLoading(false);
    }
  };

  const handleAddObservation = async () => {
    if (!observationText.trim()) return;

    try {
      setSavingObservation(true);
      setObservationsError(null);

      const response = await api.post(`/api/clients/${clientId}/observations`, {
        content: observationText.trim(),
      });

      if (response.data?.observation) {
        setObservations((prev) => [response.data.observation, ...prev]);
        setObservationText('');
      }
    } catch (err: any) {
      console.error('Failed to save observation:', err);
      setObservationsError(err.response?.data?.message || 'Failed to save observation');
    } finally {
      setSavingObservation(false);
    }
  };

  const loadAttachments = async () => {
    try {
      setAttachmentsLoading(true);
      setAttachmentsError(null);
      const response = await api.get(`/api/clients/${clientId}/attachments`);
      setAttachments(response.data?.attachments || []);
    } catch (err: any) {
      console.error('Failed to load attachments:', err);
      setAttachmentsError(err.response?.data?.message || 'Failed to load attachments');
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPendingFiles((prev) => prev.concat(files).slice(0, 5));
      e.target.value = '';
    }
  };

  const handleUploadAttachments = async () => {
    if (pendingFiles.length === 0) return;
    try {
      setUploadingAttachments(true);
      setAttachmentsError(null);
      const formData = new FormData();
      pendingFiles.forEach((file) => formData.append('files', file));
      const { data } = await api.post(`/api/clients/${clientId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.attachments) {
        setAttachments((prev) => [...data.attachments, ...prev]);
        setPendingFiles([]);
      }
    } catch (err: any) {
      console.error('Failed to upload attachments:', err);
      setAttachmentsError(err.response?.data?.message || 'Failed to upload attachments');
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await api.delete(`/api/clients/${clientId}/attachments/${attachmentId}`);
      setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
    } catch (err: any) {
      console.error('Failed to delete attachment:', err);
      setAttachmentsError(err.response?.data?.message || 'Failed to delete attachment');
    }
  };

  const formatFileSize = (size: number) => {
    if (!size) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const handleRefresh = () => {
    loadClientData();
    loadObservations();
    loadAttachments();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'expired': return 'error';
      case 'frozen': return 'warning';
      default: return 'default';
    }
  };

  const getActivityIcon = (type: string) => {
    const iconSize = isMobile ? 18 : 20;
    switch (type) {
      case 'nutrition': return <TickCircle size={iconSize} />;
      case 'workout': return <Activity size={iconSize} />;
      case 'form': return <InfoCircle size={iconSize} />;
      default: return <Clock size={iconSize} />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        py: { xs: 4, sm: 8 },
        px: { xs: 2, sm: 0 }
      }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={isMobile ? 32 : 40} />
          <Typography 
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, textAlign: 'center' }}
          >
            <FormattedMessage id="client.overview.loading" defaultMessage="Loading client overview..." />
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        <Alert 
          severity="error" 
          sx={{ 
            mb: 2,
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}
          action={
            <Button 
              onClick={loadClientData} 
              size={isMobile ? "small" : "medium"}
              sx={{ 
                ml: { xs: 1, sm: 2 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }}
            >
              <Refresh size={isMobile ? 14 : 16} />
              {!isMobile && <FormattedMessage id="retry" defaultMessage="Retry" />}
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: { xs: 1, sm: 2 } }}>
        <Alert severity="warning" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          <FormattedMessage id="client.overview.empty" defaultMessage="No client data found" />
        </Alert>
      </Box>
    );
  }

  const { client, metrics, recentActivities } = data;

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', maxWidth: '100vw', bgcolor: 'background.default', minHeight: '100%' }}>
    <Box sx={{ p: { xs: 1, sm: 2 }, width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <Button
          variant="outlined"
          startIcon={<ArrowLeft2 size={isMobile ? 14 : 16} />}
          onClick={() => router.push('/dashboard/clients')}
          sx={{ 
            mb: 2,
            fontSize: { xs: '0.875rem', sm: '1rem' },
            py: { xs: 0.5, sm: 1 },
            px: { xs: 1, sm: 2 }
          }}
        >
          {!isMobile && <FormattedMessage id="client.overview.back" defaultMessage="Back to Clients" />}
          {isMobile && <FormattedMessage id="client.overview.back" defaultMessage="Back" />}
        </Button>
        
        <Box sx={{ 
          display: 'flex', 
          alignItems: { xs: 'flex-start', sm: 'center' }, 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.5, sm: 2 }
        }}>
          <Avatar sx={{ 
            bgcolor: 'primary.main', 
            width: { xs: 40, sm: 48 }, 
            height: { xs: 40, sm: 48 }
          }}>
            <User size={isMobile ? 20 : 24} />
          </Avatar>
          <Box sx={{ flex: 1, width: '100%', minWidth: 0 }}>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={{ xs: 1, sm: 2 }} 
              alignItems={{ xs: 'flex-start', sm: 'center' }} 
              sx={{ mb: 1 }}
              flexWrap="wrap"
            >
              <Typography 
                variant={isMobile ? "h5" : "h4"}
                sx={{ 
                  fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' },
                  fontWeight: 600,
                  wordBreak: 'break-word'
                }}
              >
                {client.fullName}
              </Typography>
              {client.code && (
                <Chip 
                  label={`#${client.code}`} 
                  size={isMobile ? "small" : "medium"}
                  color="primary" 
                  variant="outlined"
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                />
              )}
            </Stack>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={{ xs: 1, sm: 2 }} 
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              flexWrap="wrap"
            >
              {client.email && (
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  {client.email}
                </Typography>
              )}
              {client.phone && (
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }}
                >
                  {client.phone}
                </Typography>
              )}
              <Chip
                label={client.status}
                color={getStatusColor(client.status) as any}
                variant="outlined"
                size={isMobile ? "small" : "medium"}
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              />
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, md: 3 } }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
                <Avatar sx={{ 
                  bgcolor: 'primary.main',
                  width: { xs: 36, sm: 40 },
                  height: { xs: 36, sm: 40 }
                }}>
                  <TickCircle size={isMobile ? 18 : 20} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant={isMobile ? "h6" : "h5"}
                    sx={{ 
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                      fontWeight: 600
                    }}
                  >
                    {metrics.totalFormSubmissions}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      mt: 0.5
                    }}
                  >
                    Form Submissions
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
                <Avatar sx={{ 
                  bgcolor: 'success.main',
                  width: { xs: 36, sm: 40 },
                  height: { xs: 36, sm: 40 }
                }}>
                  <Crown size={isMobile ? 18 : 20} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant={isMobile ? "h6" : "h5"}
                    sx={{ 
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                      fontWeight: 600
                    }}
                  >
                    {metrics.activePlansCount}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      mt: 0.5
                    }}
                  >
                    Active Plans
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
                <Avatar sx={{ 
                  bgcolor: 'info.main',
                  width: { xs: 36, sm: 40 },
                  height: { xs: 36, sm: 40 }
                }}>
                  <Activity size={isMobile ? 18 : 20} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant={isMobile ? "h6" : "h5"}
                    sx={{ 
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                      fontWeight: 600
                    }}
                  >
                    {metrics.nutritionPlansCount + metrics.workoutPlansCount}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      mt: 0.5
                    }}
                  >
                    Total Plans
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
                <Avatar sx={{ 
                  bgcolor: 'warning.main',
                  width: { xs: 36, sm: 40 },
                  height: { xs: 36, sm: 40 }
                }}>
                  <Clock size={isMobile ? 18 : 20} />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant={isMobile ? "h6" : "h5"}
                    sx={{ 
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                      fontWeight: 600
                    }}
                  >
                    {metrics.pendingFormsCount}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      mt: 0.5
                    }}
                  >
                    Pending Forms
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activities */}
      <Card sx={{ mb: { xs: 2, md: 0 } }}>
        <CardHeader
          title={
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Recent Activities
            </Typography>
          }
          action={
            <Button
              size={isMobile ? "small" : "medium"}
              startIcon={<Refresh size={isMobile ? 14 : 16} />}
              onClick={handleRefresh}
              sx={{ 
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                py: { xs: 0.5, sm: 1 }
              }}
            >
              {!isMobile && "Refresh"}
              {isMobile && "↻"}
            </Button>
          }
          sx={{ 
            px: { xs: 1.5, sm: 2 },
            pt: { xs: 1.5, sm: 2 },
            pb: { xs: 1, sm: 1.5 }
          }}
        />
        <CardContent sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          {recentActivities && recentActivities.length > 0 ? (
            <List sx={{ py: 0 }}>
              {recentActivities.slice(0, 10).map((activity, index) => (
                <Box key={activity.id}>
                  <ListItem sx={{ 
                    px: 0,
                    py: { xs: 1, sm: 1.5 },
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' }
                  }}>
                    <ListItemIcon sx={{ 
                      minWidth: { xs: 36, sm: 40 },
                      mt: { xs: 0.5, sm: 0 }
                    }}>
                      {getActivityIcon(activity.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography 
                          variant="body1"
                          sx={{ 
                            fontSize: { xs: '0.875rem', sm: '1rem' },
                            fontWeight: 500,
                            mb: { xs: 0.5, sm: 0 }
                          }}
                        >
                          {activity.title}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ mt: { xs: 0.5, sm: 0.5 } }}>
                          {activity.description && (
                            <Typography 
                              variant="body2" 
                              color="text.secondary" 
                              sx={{ 
                                mb: 0.5,
                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                wordBreak: 'break-word'
                              }}
                            >
                              {activity.description}
                            </Typography>
                          )}
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ 
                              fontSize: { xs: '0.7rem', sm: '0.75rem' }
                            }}
                          >
                            {format(new Date(activity.createdAt), isMobile ? 'MMM dd, HH:mm' : 'MMM dd, yyyy HH:mm')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < recentActivities.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: { xs: 3, sm: 4 } }}>
              <Typography 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              >
                No recent activities
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card sx={{ mt: { xs: 2, md: 2 }, mb: { xs: 2, md: 0 } }}>
        <CardHeader
          title={
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Attachments
            </Typography>
          }
          action={
            <Button
              size={isMobile ? "small" : "medium"}
              startIcon={<Refresh size={isMobile ? 14 : 16} />}
              onClick={loadAttachments}
              sx={{
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                py: { xs: 0.5, sm: 1 }
              }}
            >
              {!isMobile && "Refresh"}
              {isMobile && "↻"}
            </Button>
          }
          sx={{
            px: { xs: 1.5, sm: 2 },
            pt: { xs: 1.5, sm: 2 },
            pb: { xs: 1, sm: 1.5 }
          }}
        />
        <CardContent sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<AttachFile />}
                fullWidth={isMobile}
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              >
                Select files
                <input type="file" hidden multiple onChange={handleAttachmentSelect} />
              </Button>
              <Button
                variant="contained"
                startIcon={<CloudUpload />}
                disabled={pendingFiles.length === 0 || uploadingAttachments}
                onClick={handleUploadAttachments}
                fullWidth={isMobile}
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              >
                {uploadingAttachments ? 'Uploading...' : 'Upload'}
              </Button>
            </Stack>
            {pendingFiles.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {pendingFiles.map((file, idx) => (
                  <Chip
                    key={`${file.name}-${idx}`}
                    label={`${file.name} (${formatFileSize(file.size)})`}
                    onDelete={() =>
                      setPendingFiles((prev) => prev.filter((_, index) => index !== idx))
                    }
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Stack>
            )}
            {attachmentsError && (
              <Alert severity="error" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                {attachmentsError}
              </Alert>
            )}
          </Stack>

          {attachmentsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 2, sm: 3 } }}>
              <CircularProgress size={isMobile ? 28 : 32} />
            </Box>
          ) : attachments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: { xs: 3, sm: 4 } }}>
              <Typography 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              >
                No attachments yet
              </Typography>
              <Typography 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, mt: 0.5 }}
              >
                Share documents, PDFs, or images with your client
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {attachments.map((att) => (
                <Paper
                  key={att.id}
                  elevation={0}
                  sx={{
                    p: { xs: 1.25, sm: 1.5 },
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Stack 
                    direction={{ xs: 'column', sm: 'row' }} 
                    spacing={{ xs: 1, sm: 2 }} 
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          width: { xs: 36, sm: 40 },
                          height: { xs: 36, sm: 40 },
                        }}
                      >
                        <AttachFile fontSize="small" />
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: 600, 
                            fontSize: { xs: '0.95rem', sm: '1rem' },
                            wordBreak: 'break-word'
                          }}
                        >
                          {att.originalName}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                        >
                          {formatFileSize(att.size)} • {format(new Date(att.createdAt), isMobile ? 'MMM dd, HH:mm' : 'MMM dd, yyyy')}
                        </Typography>
                        {att.uploadedBy?.fullName && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.8rem' } }}
                          >
                            Shared by {att.uploadedBy.fullName}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }} justifyContent={{ xs: 'flex-end', sm: 'flex-start' }}>
                      <Button
                        size={isMobile ? "small" : "medium"}
                        variant="outlined"
                        startIcon={<DownloadIcon fontSize="small" />}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </Button>
                      <Button
                        size={isMobile ? "small" : "medium"}
                        color="error"
                        variant="outlined"
                        startIcon={<DeleteIcon fontSize="small" />}
                        onClick={() => handleDeleteAttachment(att.id)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Observations */}
      <Card sx={{ mt: { xs: 2, md: 2 }, mb: { xs: 2, md: 0 } }}>
        <CardHeader
          title={
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Observations
            </Typography>
          }
          action={
            <Button
              size={isMobile ? "small" : "medium"}
              startIcon={<Refresh size={isMobile ? 14 : 16} />}
              onClick={loadObservations}
              sx={{
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                py: { xs: 0.5, sm: 1 }
              }}
            >
              {!isMobile && "Refresh"}
              {isMobile && "↻"}
            </Button>
          }
          sx={{
            px: { xs: 1.5, sm: 2 },
            pt: { xs: 1.5, sm: 2 },
            pb: { xs: 1, sm: 1.5 }
          }}
        />
        <CardContent sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              label="Add an observation"
              placeholder="Write an observation for this client..."
              multiline
              minRows={3}
              fullWidth
              value={observationText}
              onChange={(e) => setObservationText(e.target.value)}
              size={isMobile ? "small" : "medium"}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="contained"
                onClick={handleAddObservation}
                disabled={savingObservation || !observationText.trim()}
                sx={{
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  py: { xs: 0.75, sm: 1 }
                }}
              >
                {savingObservation ? 'Saving...' : 'Save observation'}
              </Button>
            </Stack>
            {observationsError && (
              <Alert severity="error" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                {observationsError}
              </Alert>
            )}
          </Stack>

          {observationsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 2, sm: 3 } }}>
              <CircularProgress size={isMobile ? 28 : 32} />
            </Box>
          ) : observations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: { xs: 3, sm: 4 } }}>
              <Typography 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              >
                No observations yet
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {observations.map((observation, index) => (
                <Box key={observation.id}>
                  <ListItem
                    sx={{
                      px: 0,
                      py: { xs: 1, sm: 1.5 },
                      alignItems: 'flex-start',
                      flexDirection: 'column',
                      gap: 0.5
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        fontSize: { xs: '0.9rem', sm: '1rem' },
                        fontWeight: 500,
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {observation.content}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.8rem' } }}
                    >
                      {observation.author?.fullName || 'Coach'} • {format(new Date(observation.createdAt), isMobile ? 'MMM dd, HH:mm' : 'MMM dd, yyyy HH:mm')}
                    </Typography>
                  </ListItem>
                  {index < observations.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card sx={{ mt: { xs: 2, md: 2 } }}>
        <CardHeader 
          title={
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              {intl.formatMessage({ id: 'client.quickActions', defaultMessage: 'Quick Actions' })}
            </Typography>
          }
          sx={{ 
            px: { xs: 1.5, sm: 2 },
            pt: { xs: 1.5, sm: 2 },
            pb: { xs: 1, sm: 1.5 }
          }}
        />
        <CardContent sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={{ xs: 1.5, sm: 2 }} 
            flexWrap="wrap"
          >
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard/clients/${clientId}/nutrition`)}
              fullWidth={isMobile}
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.25 },
                minWidth: { xs: '100%', sm: 'auto' }
              }}
            >
              <FormattedMessage id="client.nutritionPlans" defaultMessage="Nutrition Plans" />
            </Button>
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard/clients/${clientId}/workout`)}
              fullWidth={isMobile}
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.25 },
                minWidth: { xs: '100%', sm: 'auto' }
              }}
            >
              <FormattedMessage id="client.workoutPlans" defaultMessage="Workout Plans" />
            </Button>
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard/clients/${clientId}/forms`)}
              fullWidth={isMobile}
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.25 },
                minWidth: { xs: '100%', sm: 'auto' }
              }}
            >
              <FormattedMessage id="Forms" defaultMessage="Forms" />
            </Button>
            <Button
              variant="outlined"
              onClick={() => router.push(`/dashboard/clients/${clientId}/subscription`)}
              fullWidth={isMobile}
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                py: { xs: 1, sm: 1.25 },
                minWidth: { xs: '100%', sm: 'auto' }
              }}
            >
              <FormattedMessage id="client.subscription" defaultMessage="Subscription" />
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
    </Box>
  );
}