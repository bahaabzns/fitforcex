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
  InputAdornment
} from '@mui/material';
import { SearchNormal1, Copy, CloseCircle } from '@wandersonalwes/iconsax-react';
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
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
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
      
      <DialogContent>
        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Search by plan name or client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchNormal1 size={20} />
              </InputAdornment>
            )
          }}
        />

        {/* Plans List */}
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
          <Stack spacing={2} sx={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {filteredPlans.map((plan) => (
              <Card
                key={plan.id}
                sx={{
                  cursor: copying === plan.id ? 'wait' : 'default',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 3
                  }
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 2
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>
                        {plan.title}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                        {plan.clientName && (
                          <Chip
                            label={`Client: ${plan.clientName}`}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        )}
                        {plan.status && (
                          <Chip
                            label={plan.status}
                            size="small"
                            variant="outlined"
                            color={plan.status === 'active' ? 'success' : 'default'}
                          />
                        )}
                        {planType === 'workout' && plan.daysCount !== undefined && (
                          <Chip
                            label={`${plan.daysCount} days`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {planType === 'nutrition' && plan.cyclesCount !== undefined && (
                          <Chip
                            label={`${plan.cyclesCount} cycles`}
                            size="small"
                            variant="outlined"
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
                      sx={{ minWidth: 100 }}
                    >
                      {copying === plan.id ? 'Copying...' : 'Copy'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={copying !== null}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
