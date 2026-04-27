'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/axios';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow, 
  IconButton, 
  Alert, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Tabs,
  Tab
} from '@mui/material';
import { Refresh, Delete, Add, Edit, PlayArrow, CloudUpload } from '@mui/icons-material';
import FileUpload from '@/components/FileUpload';
import Divider from '@mui/material/Divider';

interface TutorialVideo {
  id: string;
  pageId: string;
  lang: string;
  title: string;
  description?: string | null;
  videoUrl: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Page IDs mapping from menu items with order (based on sidebar menu order)
const PAGE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard / Overview', order: 0 },
  { value: 'clients', label: 'Clients', order: 1 },
  { value: 'client-overview', label: 'Client - Overview', order: 12 },
  { value: 'client-nutrition', label: 'Client - Nutrition', order: 13 },
  { value: 'client-workout', label: 'Client - Workout', order: 14 },
  { value: 'client-subscription', label: 'Client - Subscription', order: 15 },
  { value: 'finance', label: 'Finance', order: 2 },
  { value: 'forms', label: 'Forms', order: 3 },
  { value: 'queue', label: 'Queue', order: 4 },
  { value: 'nutrition', label: 'Nutrition', order: 5 },
  { value: 'workout', label: 'Workouts', order: 6 },
  { value: 'messenger', label: 'Messenger', order: 7 },
  { value: 'team', label: 'Team', order: 8 },
  { value: 'workspace', label: 'Workspace', order: 9 },
  { value: 'workspace-subscription', label: 'Workspace Subscription', order: 10 },
  { value: 'workspace-client-packages', label: 'Client Packages', order: 11 },
];

// Get order for a pageId
const getPageOrder = (pageId: string): number => {
  return PAGE_OPTIONS.find((p) => p.value === pageId)?.order ?? 999;
};

// Detect video duration from URL (YouTube/Vimeo)
const detectVideoDuration = async (videoUrl: string): Promise<number | null> => {
  if (!videoUrl) return null;

  try {
    // YouTube URL handling
    if (videoUrl.includes('youtube.com/watch') || videoUrl.includes('youtu.be/')) {
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
      const match = videoUrl.match(youtubeRegex);
      if (match && match[1]) {
        const videoId = match[1];
        // Use YouTube oEmbed API to get duration
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          // Note: YouTube oEmbed doesn't return duration, we'd need YouTube Data API v3
          // For now, we'll return null and let user enter manually or use a backend service
          return null;
        }
      }
    }

    // Vimeo URL handling
    if (videoUrl.includes('vimeo.com/')) {
      const vimeoRegex = /vimeo\.com\/(\d+)/;
      const match = videoUrl.match(vimeoRegex);
      if (match && match[1]) {
        const videoId = match[1];
        // Use Vimeo oEmbed API
        const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          const data = await response.json();
          // Vimeo oEmbed returns duration in seconds
          return data.duration || null;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error detecting video duration:', error);
    return null;
  }
};

export default function TutorialVideosPage() {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TutorialVideo | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'ar'>('en');
  const [formEn, setFormEn] = useState<Partial<TutorialVideo>>({
    pageId: '',
    lang: 'en',
    title: '',
    description: '',
    videoUrl: '',
    thumbnailUrl: '',
    duration: undefined,
    order: 0,
    isActive: true,
  });
  const [formAr, setFormAr] = useState<Partial<TutorialVideo>>({
    pageId: '',
    lang: 'ar',
    title: '',
    description: '',
    videoUrl: '',
    thumbnailUrl: '',
    duration: undefined,
    order: 0,
    isActive: true,
  });

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/admin/tutorial-videos');
      const list = Array.isArray((data as any)?.videos) ? (data as any).videos : [];
      setVideos(list as TutorialVideo[]);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to fetch tutorial videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handlePageChange = (pageId: string) => {
    const order = getPageOrder(pageId);
    setFormEn((prev) => ({ ...prev, pageId, order }));
    setFormAr((prev) => ({ ...prev, pageId, order }));
  };

  const handleVideoUrlChange = async (url: string, lang: 'en' | 'ar') => {
    if (lang === 'en') {
      setFormEn((prev) => ({ ...prev, videoUrl: url }));
      if (url) {
        const duration = await detectVideoDuration(url);
        if (duration) {
          setFormEn((prev) => ({ ...prev, duration }));
        }
      }
    } else {
      setFormAr((prev) => ({ ...prev, videoUrl: url }));
      if (url) {
        const duration = await detectVideoDuration(url);
        if (duration) {
          setFormAr((prev) => ({ ...prev, duration }));
        }
      }
    }
  };

  const openCreate = () => {
    setEditing(null);
    setActiveLangTab('en');
    setFormEn({ pageId: '', lang: 'en', title: '', description: '', videoUrl: '', thumbnailUrl: '', duration: undefined, order: 0, isActive: true });
    setFormAr({ pageId: '', lang: 'ar', title: '', description: '', videoUrl: '', thumbnailUrl: '', duration: undefined, order: 0, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (video: TutorialVideo) => {
    setEditing(video);
    const samePageVideos = videos.filter(v => v.pageId === video.pageId);
    const en = samePageVideos.find(v => v.lang === 'en');
    const ar = samePageVideos.find(v => v.lang === 'ar');
    const pageOrder = getPageOrder(video.pageId);
    setFormEn(en ? { ...en, order: pageOrder } : { pageId: video.pageId, lang: 'en', title: '', description: '', videoUrl: '', thumbnailUrl: '', duration: undefined, order: pageOrder, isActive: true } as Partial<TutorialVideo>);
    setFormAr(ar ? { ...ar, order: pageOrder } : { pageId: video.pageId, lang: 'ar', title: '', description: '', videoUrl: '', thumbnailUrl: '', duration: undefined, order: pageOrder, isActive: true } as Partial<TutorialVideo>);
    setActiveLangTab(video.lang === 'ar' ? 'ar' : 'en');
    setDialogOpen(true);
  };

  const saveVideo = async () => {
    try {
      setError(null);
      // We will upsert both EN and AR entries if they have required fields
      const pageId = formEn.pageId || formAr.pageId || '';
      if (!pageId) {
        setError('Page is required');
        return;
      }

      const ops: Promise<any>[] = [];

      const upsertOne = async (f: Partial<TutorialVideo>) => {
        // Skip if no title or no video URL (allow empty for now, will be validated on save)
        if (!f.title) return;
        if (!f.videoUrl) return; // Video URL is required
        if ((f as any).id) {
          return api.put(`/api/admin/tutorial-videos/${(f as any).id}`, f);
        }
        return api.post('/api/admin/tutorial-videos', f);
      };

      // Ensure pageId is set for both
      const enPayload = { ...formEn, pageId: pageId, lang: 'en' } as Partial<TutorialVideo> & { id?: string };
      const arPayload = { ...formAr, pageId: pageId, lang: 'ar' } as Partial<TutorialVideo> & { id?: string };

      ops.push(upsertOne(enPayload));
      ops.push(upsertOne(arPayload));

      await Promise.all(ops);

      setDialogOpen(false);
      await fetchVideos();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save tutorial video');
    }
  };

  const deleteVideo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tutorial video?')) return;
    try {
      setError(null);
      await api.delete(`/api/admin/tutorial-videos/${id}`);
      await fetchVideos();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete tutorial video');
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPageLabel = (pageId: string) => {
    return PAGE_OPTIONS.find((p) => p.value === pageId)?.label || pageId;
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 }, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" fontWeight={800}>Tutorial Videos</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startIcon={<Refresh />} onClick={fetchVideos} variant="outlined">
              Refresh
            </Button>
            <Button startIcon={<Add />} onClick={openCreate} variant="contained">
              Add Tutorial Video
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent>
            {loading ? (
              <Typography>Loading...</Typography>
            ) : videos.length === 0 ? (
              <Typography color="text.secondary">No tutorial videos found. Click "Add Tutorial Video" to create one.</Typography>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Page</TableCell>
                    <TableCell>Lang</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Video URL</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Order</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell>
                        <Chip label={getPageLabel(video.pageId)} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={video.lang?.toUpperCase() || 'EN'} size="small" />
                      </TableCell>
                      <TableCell>{video.title}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {video.videoUrl}
                          </Typography>
                          {video.videoUrl && (
                            <IconButton
                              size="small"
                              onClick={() => window.open(video.videoUrl, '_blank')}
                              title="Open video"
                            >
                              <PlayArrow fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{formatDuration(video.duration)}</TableCell>
                      <TableCell>{video.order}</TableCell>
                      <TableCell>
                        <Chip
                          label={video.isActive ? 'Active' : 'Inactive'}
                          color={video.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(video)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => deleteVideo(video.id)} color="error">
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Edit Tutorial Video' : 'Create Tutorial Video'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Page</InputLabel>
              <Select
                value={formEn.pageId || formAr.pageId || ''}
                onChange={(e) => handlePageChange(e.target.value)}
                label="Page"
                disabled={!!editing}
              >
                {PAGE_OPTIONS.map((page) => (
                  <MenuItem key={page.value} value={page.value}>
                    {page.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Tabs value={activeLangTab} onChange={(_e, v) => setActiveLangTab(v)} sx={{ mt: 1 }}>
              <Tab value="en" label="English" />
              <Tab value="ar" label="Arabic" />
            </Tabs>

            {activeLangTab === 'en' ? (
              <>
                <TextField label="Title" fullWidth value={formEn.title || ''} onChange={(e) => setFormEn({ ...formEn, title: e.target.value })} required />
                <TextField label="Description" fullWidth multiline rows={3} value={formEn.description || ''} onChange={(e) => setFormEn({ ...formEn, description: e.target.value })} />
                
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Upload Video to S3
                </Typography>
                <FileUpload
                  uploadType="tutorial-videos"
                  accept="video/*"
                  maxSize={100}
                  currentImageUrl={formEn.videoUrl || undefined}
                  onUploadComplete={(url) => {
                    setFormEn({ ...formEn, videoUrl: url });
                  }}
                />
                
                <Divider sx={{ my: 2 }}>OR</Divider>
                <TextField 
                  label="Video URL" 
                  fullWidth 
                  value={formEn.videoUrl || ''} 
                  onChange={(e) => handleVideoUrlChange(e.target.value, 'en')} 
                  helperText="YouTube, Vimeo, or direct video URL. Duration will be detected automatically for Vimeo." 
                />
                <TextField label="Thumbnail URL (optional)" fullWidth value={formEn.thumbnailUrl || ''} onChange={(e) => setFormEn({ ...formEn, thumbnailUrl: e.target.value })} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField 
                      label="Duration (seconds)" 
                      fullWidth 
                      type="number" 
                      value={formEn.duration || ''} 
                      onChange={(e) => setFormEn({ ...formEn, duration: e.target.value ? parseInt(e.target.value) : undefined })} 
                      helperText="Auto-detected for Vimeo"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField 
                      label="Order" 
                      fullWidth 
                      type="number" 
                      value={formEn.order || 0} 
                      onChange={(e) => setFormEn({ ...formEn, order: parseInt(e.target.value) || 0 })} 
                      helperText="Auto-set from page"
                      disabled
                    />
                  </Grid>
                </Grid>
                <FormControlLabel control={<Switch checked={formEn.isActive ?? true} onChange={(e) => setFormEn({ ...formEn, isActive: e.target.checked })} />} label="Active" />
              </>
            ) : (
              <>
                <TextField label="Title" fullWidth value={formAr.title || ''} onChange={(e) => setFormAr({ ...formAr, title: e.target.value })} required />
                <TextField label="Description" fullWidth multiline rows={3} value={formAr.description || ''} onChange={(e) => setFormAr({ ...formAr, description: e.target.value })} />
                
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Upload Video to S3
                </Typography>
                <FileUpload
                  uploadType="tutorial-videos"
                  accept="video/*"
                  maxSize={100}
                  currentImageUrl={formAr.videoUrl || undefined}
                  onUploadComplete={(url) => {
                    setFormAr({ ...formAr, videoUrl: url });
                  }}
                />
                
                <Divider sx={{ my: 2 }}>OR</Divider>
                <TextField 
                  label="Video URL" 
                  fullWidth 
                  value={formAr.videoUrl || ''} 
                  onChange={(e) => handleVideoUrlChange(e.target.value, 'ar')} 
                  helperText="YouTube, Vimeo, or direct video URL. Duration will be detected automatically for Vimeo." 
                />
                <TextField label="Thumbnail URL (optional)" fullWidth value={formAr.thumbnailUrl || ''} onChange={(e) => setFormAr({ ...formAr, thumbnailUrl: e.target.value })} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField 
                      label="Duration (seconds)" 
                      fullWidth 
                      type="number" 
                      value={formAr.duration || ''} 
                      onChange={(e) => setFormAr({ ...formAr, duration: e.target.value ? parseInt(e.target.value) : undefined })} 
                      helperText="Auto-detected for Vimeo"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField 
                      label="Order" 
                      fullWidth 
                      type="number" 
                      value={formAr.order || 0} 
                      onChange={(e) => setFormAr({ ...formAr, order: parseInt(e.target.value) || 0 })} 
                      helperText="Auto-set from page"
                      disabled
                    />
                  </Grid>
                </Grid>
                <FormControlLabel control={<Switch checked={formAr.isActive ?? true} onChange={(e) => setFormAr({ ...formAr, isActive: e.target.checked })} />} label="Active" />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveVideo} variant="contained">
            {editing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

