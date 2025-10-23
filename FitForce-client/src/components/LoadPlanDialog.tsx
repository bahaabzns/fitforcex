'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  Box,
  Typography,
  CircularProgress,
  Chip,
  Stack,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Paper,
  Divider,
  Fade,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { SearchNormal1, Copy, CloseCircle, ArrowDown2, ArrowUp2 } from '@wandersonalwes/iconsax-react';
import api from '@/utils/axios';

interface LoadPlanDialogProps {
  open: boolean;
  onClose: () => void;
  planType: 'workout' | 'nutrition';
  currentClientId: string;
  onPlanLoaded: () => void;
}

interface WorkspacePlan {
  id: string;
  title: string;
  clientId?: string;
  clientName?: string;
  status?: string;
  createdAt: string;
  daysCount?: number;
  cyclesCount?: number;
}

export default function LoadPlanDialog({
  open,
  onClose,
  planType,
  currentClientId,
  onPlanLoaded
}: LoadPlanDialogProps) {
  const [plans, setPlans] = useState<WorkspacePlan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<WorkspacePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (open) {
      loadWorkspacePlans();
    }
  }, [open, planType]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPlans(plans);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredPlans(
        plans.filter(
          (plan) =>
            plan.title.toLowerCase().includes(query) ||
            plan.clientName?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, plans]);

  const loadWorkspacePlans = async () => {
    try {
      setLoading(true);
      const endpoint =
        planType === 'workout'
          ? '/api/workout/plans/workspace'
          : '/api/nutrition/plans/workspace';
      
      const response = await api.get(endpoint);
      
      // Filter out plans for the current client (no need to copy from themselves)
      const workspacePlans = (response.data.plans || []).filter(
        (plan: any) => plan.clientId !== currentClientId
      );
      
      setPlans(workspacePlans);
      setFilteredPlans(workspacePlans);
    } catch (err: any) {
      console.error('Failed to load workspace plans:', err);
      setPlans([]);
      setFilteredPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPlan = async (planId: string) => {
    try {
      setCopying(planId);
      
      const endpoint =
        planType === 'workout'
          ? `/api/workout/plans/${planId}/copy`
          : `/api/nutrition/plans/${planId}/copy`;
      
      await api.post(endpoint, {
        targetClientId: currentClientId
      });
      
      // Success - notify parent and close
      onPlanLoaded();
      onClose();
    } catch (err: any) {
      console.error('Failed to copy plan:', err);
      alert('Failed to copy plan. Please try again.');
    } finally {
      setCopying(null);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setShowScrollTop(false);
    setShowScrollBottom(false);
    onClose();
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
    
    setShowScrollTop(scrollTop > 100);
    setShowScrollBottom(scrollPercentage < 0.95);
  };

  const scrollToTop = () => {
    const scrollContainer = document.getElementById('plans-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    const scrollContainer = document.getElementById('plans-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          height: isMobile ? '100vh' : '85vh',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 600 }}>
              Load {planType === 'workout' ? 'Workout' : 'Nutrition'} Plan
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              Browse all workspace plans and copy one to this client
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseCircle size={24} />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' }}>
        {/* Search Bar */}
        <Box sx={{ p: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            fullWidth
            placeholder="Search by plan name or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchNormal1 size={20} />
                </InputAdornment>
              )
            }}
          />
          
          {/* Results Count */}
          {!loading && (
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              {filteredPlans.length} of {plans.length} plans
              {searchQuery && ` matching "${searchQuery}"`}
            </Typography>
          )}
        </Box>

        {/* Plans List */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <Stack alignItems="center" spacing={2}>
                <CircularProgress />
                <Typography color="text.secondary">Loading plans...</Typography>
              </Stack>
            </Box>
          ) : filteredPlans.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {plans.length === 0
                  ? 'No plans available'
                  : 'No plans match your search'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {plans.length === 0
                  ? 'Create some plans for other clients first'
                  : 'Try a different search term'}
              </Typography>
            </Box>
          ) : (
            <>
              {/* Scrollable Plans Container */}
              <Box
                id="plans-scroll-container"
                onScroll={handleScroll}
                sx={{
                  height: '100%',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  px: 3,
                  py: 2,
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: 'rgba(0,0,0,0.5)',
                    },
                  },
                }}
              >
                <Stack spacing={1.5}>
                  {filteredPlans.map((plan, index) => (
                    <Fade in timeout={300 + index * 50} key={plan.id}>
                      <Card
                        sx={{
                          cursor: copying === plan.id ? 'wait' : 'default',
                          transition: 'all 0.2s ease-in-out',
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            boxShadow: 4,
                            borderColor: 'primary.main',
                            transform: 'translateY(-2px)',
                          },
                          '&:active': {
                            transform: 'translateY(0px)',
                          }
                        }}
                      >
                        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 2
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography 
                                variant="h6" 
                                sx={{ 
                                  fontSize: '1rem', 
                                  fontWeight: 600, 
                                  mb: 1,
                                  lineHeight: 1.3,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                {plan.title}
                              </Typography>
                              
                              <Stack 
                                direction="row" 
                                spacing={0.5} 
                                sx={{ 
                                  mb: 1.5, 
                                  flexWrap: 'wrap', 
                                  gap: 0.5 
                                }}
                              >
                                {plan.clientName && (
                                  <Chip
                                    label={`Client: ${plan.clientName}`}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                )}
                                {plan.status && (
                                  <Chip
                                    label={plan.status}
                                    size="small"
                                    variant="outlined"
                                    color={plan.status === 'active' ? 'success' : 'default'}
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                )}
                                {planType === 'workout' && plan.daysCount !== undefined && (
                                  <Chip
                                    label={`${plan.daysCount} days`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                )}
                                {planType === 'nutrition' && plan.cyclesCount !== undefined && (
                                  <Chip
                                    label={`${plan.cyclesCount} cycles`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                )}
                              </Stack>
                              
                              <Typography variant="caption" color="textSecondary">
                                Created: {new Date(plan.createdAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                            
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={copying === plan.id ? <CircularProgress size={16} color="inherit" /> : <Copy size={16} />}
                              onClick={() => handleCopyPlan(plan.id)}
                              disabled={copying !== null}
                              sx={{ 
                                minWidth: 100,
                                height: 36,
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                borderRadius: 2,
                                textTransform: 'none',
                                boxShadow: 2,
                                '&:hover': {
                                  boxShadow: 4,
                                }
                              }}
                            >
                              {copying === plan.id ? 'Copying...' : 'Copy'}
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Fade>
                  ))}
                </Stack>
              </Box>

              {/* Scroll Indicators */}
              <Fade in={showScrollTop}>
                <IconButton
                  onClick={scrollToTop}
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: 'background.paper',
                    boxShadow: 3,
                    '&:hover': {
                      backgroundColor: 'background.paper',
                      boxShadow: 4,
                    }
                  }}
                  size="small"
                >
                  <ArrowUp2 size={20} />
                </IconButton>
              </Fade>

              <Fade in={showScrollBottom}>
                <IconButton
                  onClick={scrollToBottom}
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    backgroundColor: 'background.paper',
                    boxShadow: 3,
                    '&:hover': {
                      backgroundColor: 'background.paper',
                      boxShadow: 4,
                    }
                  }}
                  size="small"
                >
                  <ArrowDown2 size={20} />
                </IconButton>
              </Fade>
            </>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Typography variant="caption" color="textSecondary">
            {filteredPlans.length > 0 && `Showing ${filteredPlans.length} plans`}
          </Typography>
          <Button 
            onClick={handleClose} 
            disabled={copying !== null}
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
