'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Box,
  Fab,
  Drawer,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Paper,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  PlayArrow,
  Close,
  VideoLibrary,
  Minimize,
} from '@mui/icons-material';
import api from '@/utils/axios';
import useConfig from '@/hooks/useConfig';

interface TutorialVideo {
  id: string;
  pageId: string;
  title: string;
  description?: string | null;
  videoUrl: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  order: number;
}

interface TutorialVideosResponse {
  currentPageVideo: TutorialVideo | null;
  allVideos: TutorialVideo[];
}

// Map pathname to pageId based on actual routes
function getPageIdFromPath(pathname: string): string {
  if (!pathname) return 'dashboard';
  
  // Normalize pathname
  const normalized = pathname.replace(/^\/|\/$/g, '');
  const parts = normalized.split('/');
  
  // If not a dashboard route, return default
  if (parts.length === 0 || parts[0] !== 'dashboard') {
    return 'dashboard';
  }

  // /dashboard -> dashboard
  if (parts.length === 1) {
    return 'dashboard';
  }

  // Handle nested routes first
  if (parts.length >= 3 && parts[1] === 'workspaces') {
    if (parts[2] === 'subscription') return 'workspace-subscription';
    if (parts[2] === 'client-packages') return 'workspace-client-packages';
  }

  // Handle client detail pages
  if (parts[1] === 'clients' && parts.length >= 4) {
    const clientPage = parts[3]; // e.g., 'overview', 'nutrition', 'workout', 'subscription'
    const clientPageMap: Record<string, string> = {
      'overview': 'client-overview',
      'nutrition': 'client-nutrition',
      'workout': 'client-workout',
      'subscription': 'client-subscription',
    };
    return clientPageMap[clientPage] || 'clients';
  }

  // Handle client detail pages - fallback to clients if just /dashboard/clients/[id]
  if (parts[1] === 'clients' && parts.length === 3) {
    return 'client-overview'; // Default to overview when just viewing client
  }

  // Direct page mapping
  const page = parts[1];
  const pageMap: Record<string, string> = {
    'clients': 'clients',
    'finance': 'finance',
    'forms': 'forms',
    'queue': 'queue',
    'nutrition': 'nutrition',
    'workout': 'workout',
    'messenger': 'messenger',
    'team': 'team',
    'workspace': 'workspace',
  };

  return pageMap[page] || 'dashboard';
}

export default function TutorialVideoHelper() {
  const pathname = usePathname();
  const { i18n } = useConfig();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TutorialVideosResponse | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);

  const pageId = getPageIdFromPath(pathname || '');
  const [currentPageId, setCurrentPageId] = useState<string>('');

  useEffect(() => {
    // Reset when page changes
    setOpen(false);
    setMinimized(false);
    setSelectedVideo(null);
    setData(null); // Clear old data when page changes
    setCurrentPageId(pageId);
  }, [pathname, pageId]);

  const fetchTutorialVideos = async () => {
    if (!pageId) return;

    try {
      setLoading(true);
      setError(null);
      const lang = (i18n || 'en');
      const { data: responseData } = await api.get(`/api/tutorial-videos/${pageId}`, { params: { lang } });
      setData(responseData);
      
      // Set current page video as selected by default
      if (responseData.currentPageVideo) {
        setSelectedVideo(responseData.currentPageVideo);
      } else if (responseData.allVideos && responseData.allVideos.length > 0) {
        // If no video for current page, select first from list
        setSelectedVideo(responseData.allVideos[0]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load tutorial videos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    // Always fetch fresh data if pageId changed or data doesn't exist
    if (!data || currentPageId !== pageId) {
      fetchTutorialVideos();
    } else {
      // Update selected video for current page
      if (data.currentPageVideo) {
        setSelectedVideo(data.currentPageVideo);
      }
    }
  };

  const openMinimizedPlayer = async () => {
    setMinimized(true);
    setOpen(false);
    if (!data || currentPageId !== pageId) {
      await fetchTutorialVideos();
    } else if (data.currentPageVideo) {
      setSelectedVideo(data.currentPageVideo);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setMinimized(false);
  };

  const handleMinimize = () => {
    setMinimized(true);
  };

  const handleRestore = () => {
    setMinimized(false);
  };

  const handleVideoSelect = (video: TutorialVideo) => {
    setSelectedVideo(video);
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert video URL to embeddable format
  const getEmbedUrl = (url: string): string => {
    if (!url) return '';
    
    // YouTube URL handling
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
      const match = url.match(youtubeRegex);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    
    // Vimeo URL handling
    if (url.includes('vimeo.com/')) {
      const vimeoRegex = /vimeo\.com\/(\d+)/;
      const match = url.match(vimeoRegex);
      if (match && match[1]) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
    }
    
    // If already an embed URL or direct video URL, return as is
    return url;
  };

  // Don't show if not on dashboard pages
  if (!pathname?.startsWith('/dashboard')) {
    return null;
  }

  return (
    <>
      {/* Floating Wide Banner Button */}
      {!open && !minimized && (
        <Paper
          elevation={6}
          onClick={openMinimizedPlayer}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1300,
            boxShadow: 6,
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5 }}>
            <PlayArrow color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Watch Tutorial
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Minimized State */}
      {minimized && (
        <>
          {/* Small button above minimized player to open the videos sidebar */}
          <Fab
            color="primary"
            size="small"
            onClick={handleOpen}
            sx={{
              position: 'fixed',
              bottom: 210,
              right: 24,
              zIndex: 1300,
              boxShadow: 4,
            }}
            aria-label="open videos list"
          >
            <VideoLibrary fontSize="small" />
          </Fab>

          {/* Minimized floating video player */}
          <Paper
            elevation={8}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1299,
              width: 320,
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: 8,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 200, flex: 1 }}>
                {selectedVideo?.title || 'Tutorial'}
              </Typography>
              <IconButton 
                size="small" 
                onClick={handleOpen} 
                title="Open videos sidebar"
                sx={{ 
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <VideoLibrary fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={handleClose} 
                title="Close"
                aria-label="Close tutorial video"
                sx={{ 
                  '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' }
                }}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ position: 'relative', width: '100%', height: 180, backgroundColor: 'black' }} onClick={handleOpen}>
              {selectedVideo ? (
                <iframe
                  src={getEmbedUrl(selectedVideo.videoUrl)}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', height: '100%' }}>
                  <Typography variant="caption">Loading...</Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </>
      )}

      {/* Drawer with Video Player */}
      <Drawer
        anchor="right"
        open={open && !minimized}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100%',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h6" fontWeight={600}>
              Tutorial Videos
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton 
                onClick={handleMinimize} 
                size="medium" 
                title="Minimize"
                sx={{ 
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <Minimize />
              </IconButton>
              <IconButton 
                onClick={handleClose} 
                size="medium"
                title="Close"
                aria-label="Close tutorial videos"
                sx={{ 
                  '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' }
                }}
              >
                <Close />
              </IconButton>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {error}
              </Alert>
            ) : selectedVideo ? (
              <>
                {/* Video Player */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {selectedVideo.title}
                  </Typography>
                  {selectedVideo.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {selectedVideo.description}
                    </Typography>
                  )}
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '56.25%', // 16:9 aspect ratio
                      backgroundColor: 'black',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <iframe
                      src={getEmbedUrl(selectedVideo.videoUrl)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </Box>
                  {selectedVideo.duration && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      Duration: {formatDuration(selectedVideo.duration)}
                    </Typography>
                  )}
                </Box>

                {/* Video List */}
                {data && (data.allVideos.length > 0 || (data.currentPageVideo && data.allVideos.length >= 0)) && (
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VideoLibrary fontSize="small" />
                        Other Tutorials
                      </Typography>
                    </Box>
                    <List>
                      {data.currentPageVideo && data.currentPageVideo.id !== selectedVideo.id && (
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={() => handleVideoSelect(data.currentPageVideo!)}
                            selected={data.currentPageVideo.id === selectedVideo.id}
                          >
                            <ListItemIcon>
                              <PlayArrow />
                            </ListItemIcon>
                            <ListItemText
                              primary={data.currentPageVideo.title}
                              secondary={`Current Page: ${data.currentPageVideo.pageId}`}
                            />
                            <Chip label="Current" size="small" color="primary" />
                          </ListItemButton>
                        </ListItem>
                      )}
                      {data.allVideos
                        .filter((v) => v.id !== selectedVideo.id && (!data.currentPageVideo || v.id !== data.currentPageVideo.id))
                        .map((video) => (
                          <ListItem key={video.id} disablePadding>
                            <ListItemButton onClick={() => handleVideoSelect(video)}>
                              <ListItemIcon>
                                <PlayArrow />
                              </ListItemIcon>
                              <ListItemText
                                primary={video.title}
                                secondary={video.pageId}
                              />
                              {video.duration && (
                                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                                  {formatDuration(video.duration)}
                                </Typography>
                              )}
                            </ListItemButton>
                          </ListItem>
                        ))}
                    </List>
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No tutorial videos available for this page.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

