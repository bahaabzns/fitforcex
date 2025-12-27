'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Alert,
  CircularProgress,
  Divider,
  Paper,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Edit,
  Refresh,
} from '@mui/icons-material';
import {
  getPendingReplacementRequests,
  processReplacementRequest,
  getSmartSuggestions,
  type ReplacementRequest,
  type FoodItem,
} from '@/api/food-replacements';
import { openSnackbar } from '@/api/snackbar';
import useSWR from 'swr';
import api from '@/utils/axios';

interface PendingReplacementRequestsProps {
  clientId?: string;
  onRequestProcessed?: () => void;
}

export default function PendingReplacementRequests({
  clientId,
  onRequestProcessed,
}: PendingReplacementRequestsProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ReplacementRequest | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | 'modify'>('approve');
  const [approvedFood, setApprovedFood] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [originalQuantity, setOriginalQuantity] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [availableFoods, setAvailableFoods] = useState<FoodItem[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{ foodItem: FoodItem; matchScore: number }>>([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, mutate } = useSWR(
    'pending-replacement-requests',
    () => getPendingReplacementRequests(clientId),
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const requests = data?.requests || [];

  useEffect(() => {
    if (processDialogOpen && selectedRequest) {
      loadAvailableFoods();
    }
  }, [processDialogOpen, selectedRequest]);

  const loadAvailableFoods = async () => {
    if (!selectedRequest) return;
    
    try {
      setLoadingFoods(true);
      setLoadingSuggestions(true);
      
      // Load all foods and smart suggestions
      const [foodsResponse, suggestions] = await Promise.all([
        api.get('/api/nutrition/food-items').catch((err) => {
          console.error('Failed to load food items:', err);
          return { data: { foodItems: [] } };
        }),
        getSmartSuggestions(selectedRequest.originalFood.id, { tolerance: 20, limit: 10 }).catch((err) => {
          console.error('Failed to load smart suggestions:', err);
          return { suggestions: [] };
        }),
      ]);

      const foodItems = foodsResponse?.data?.foodItems || foodsResponse?.data || [];
      console.log('Loaded food items:', foodItems.length);
      setAvailableFoods(Array.isArray(foodItems) ? foodItems : []);
      
      if (suggestions.suggestions) {
        setSmartSuggestions(suggestions.suggestions.map(s => ({
          foodItem: s.foodItem,
          matchScore: s.matchScore
        })));
      }
    } catch (err) {
      console.error('Failed to load foods:', err);
    } finally {
      setLoadingFoods(false);
      setLoadingSuggestions(false);
    }
  };

  const handleProcess = (request: ReplacementRequest, actionType: 'approve' | 'reject' | 'modify') => {
    setSelectedRequest(request);
    setAction(actionType);
    setApprovedFood(request.requestedFood || null);
    setNotes('');
    // Use original quantity from request, or default to 100
    const origQty = request.originalQuantity || 100;
    setOriginalQuantity(origQty);
    setQuantity(origQty);
    setProcessDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedRequest) return;

    if (action === 'modify' && !approvedFood) {
      openSnackbar({
        open: true,
        message: 'Please select a replacement food',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
      return;
    }

    try {
      setSubmitting(true);
      
      // Convert action to status (approve -> approved, reject -> rejected, modify -> modified)
      const statusMap: Record<'approve' | 'reject' | 'modify', 'approved' | 'rejected' | 'modified'> = {
        approve: 'approved',
        reject: 'rejected',
        modify: 'modified',
      };
      
      await processReplacementRequest(selectedRequest.id, {
        status: statusMap[action],
        approvedFoodId: approvedFood?.id,
        quantity: quantity && quantity > 0 ? quantity : undefined,
        notes: notes.trim() || undefined,
      });

      openSnackbar({
        open: true,
        message: `Request ${statusMap[action]} successfully`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
      } as any);

      setProcessDialogOpen(false);
      setSelectedRequest(null);
      mutate();
      onRequestProcessed?.();
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to process request',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            No pending replacement requests
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {requests.map((request) => (
          <Card key={request.id} variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {request.client?.fullName || 'Client'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Plan: {request.plan.title}
                    </Typography>
                  </Box>
                  <Chip
                    label={request.status}
                    color={request.status === 'pending' ? 'warning' : 'default'}
                    size="small"
                  />
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Original Food
                  </Typography>
                  <Paper sx={{ p: 1.5, bgcolor: 'background.default' }}>
                    <Typography variant="body2" fontWeight={600}>
                      {request.originalFood.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" label={`${request.originalFood.calories} kcal`} color="error" />
                      <Chip size="small" label={`P: ${request.originalFood.protein}g`} />
                      <Chip size="small" label={`C: ${request.originalFood.carbs}g`} />
                      <Chip size="small" label={`F: ${request.originalFood.fat}g`} />
                    </Box>
                  </Paper>
                </Box>

                {request.requestedFood && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Client Requested
                    </Typography>
                    <Paper sx={{ p: 1.5, bgcolor: 'primary.50' }}>
                      <Typography variant="body2" fontWeight={600}>
                        {request.requestedFood.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={`${request.requestedFood.calories} kcal`} color="error" />
                        <Chip size="small" label={`P: ${request.requestedFood.protein}g`} />
                        <Chip size="small" label={`C: ${request.requestedFood.carbs}g`} />
                        <Chip size="small" label={`F: ${request.requestedFood.fat}g`} />
                      </Box>
                    </Paper>
                  </Box>
                )}

                {request.reason && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Reason
                    </Typography>
                    <Paper sx={{ p: 1.5, bgcolor: 'background.default' }}>
                      <Typography variant="body2">{request.reason}</Typography>
                    </Paper>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => handleProcess(request, 'reject')}
                    disabled={processingId === request.id}
                  >
                    Reject
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleProcess(request, 'modify')}
                    disabled={processingId === request.id}
                  >
                    Modify
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => handleProcess(request, 'approve')}
                    disabled={processingId === request.id}
                  >
                    Approve
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Process Dialog */}
      <Dialog open={processDialogOpen} onClose={() => setProcessDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {action === 'approve' && 'Approve Replacement Request'}
          {action === 'reject' && 'Reject Replacement Request'}
          {action === 'modify' && 'Modify Replacement Request'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {selectedRequest && (
              <>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Original Food
                  </Typography>
                  <Typography variant="body2">{selectedRequest.originalFood.name}</Typography>
                </Box>

                {action === 'modify' && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Select Replacement Food *
                    </Typography>
                    
                    {/* Smart Suggestions */}
                    {smartSuggestions.length > 0 && !approvedFood && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Smart Suggestions (click to select):
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {smartSuggestions.slice(0, 5).map((suggestion) => (
                            <Chip
                              key={suggestion.foodItem.id}
                              label={`${suggestion.foodItem.name} (${suggestion.matchScore}% match)`}
                              onClick={() => setApprovedFood(suggestion.foodItem)}
                              sx={{ cursor: 'pointer' }}
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    
                    {loadingFoods ? (
                      <CircularProgress size={24} />
                    ) : (
                      <Autocomplete
                        options={availableFoods}
                        getOptionLabel={(option) => option?.name || ''}
                        value={approvedFood}
                        onChange={(_, newValue) => setApprovedFood(newValue)}
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            label="Select Food" 
                            placeholder="Search for a food item..." 
                            helperText={availableFoods.length === 0 ? 'No food items available. Please add food items to your library first.' : ''}
                          />
                        )}
                        renderOption={(props, option) => (
                          <Box component="li" {...props}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2">{option.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.calories} kcal • P: {option.protein}g • C: {option.carbs}g • F: {option.fat}g
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        noOptionsText={availableFoods.length === 0 ? 'No food items found. Add food items to your library first.' : 'No matching food items'}
                        filterOptions={(options, { inputValue }) => {
                          if (!inputValue) return options;
                          const search = inputValue.toLowerCase();
                          return options.filter(option => 
                            option.name?.toLowerCase().includes(search) ||
                            option.nameArabic?.toLowerCase().includes(search)
                          );
                        }}
                      />
                    )}
                  </Box>
                )}

                {action === 'approve' && selectedRequest.requestedFood && (
                  <Alert severity="info">
                    Will approve with: <strong>{selectedRequest.requestedFood.name}</strong>
                  </Alert>
                )}

                {/* Quantity Field - Show for approve and modify */}
                {(action === 'approve' || action === 'modify') && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Quantity (grams/ml)
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={quantity || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setQuantity(isNaN(val) ? null : val);
                      }}
                      inputProps={{ min: 0, step: 0.1 }}
                      helperText={
                        originalQuantity 
                          ? `Original quantity: ${originalQuantity}g. Adjust as needed.`
                          : 'Enter the quantity for the replacement food'
                      }
                      placeholder="Enter quantity"
                    />
                    {approvedFood && quantity && quantity > 0 && (
                      <Box sx={{ mt: 1, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Calculated Macros:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip 
                            size="small" 
                            label={`${Math.round((approvedFood.calories * quantity) / (approvedFood.servingSize || 100))} kcal`} 
                            color="error" 
                          />
                          <Chip 
                            size="small" 
                            label={`P: ${((approvedFood.protein * quantity) / (approvedFood.servingSize || 100)).toFixed(1)}g`} 
                          />
                          <Chip 
                            size="small" 
                            label={`C: ${((approvedFood.carbs * quantity) / (approvedFood.servingSize || 100)).toFixed(1)}g`} 
                          />
                          <Chip 
                            size="small" 
                            label={`F: ${((approvedFood.fat * quantity) / (approvedFood.servingSize || 100)).toFixed(1)}g`} 
                          />
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}

                <TextField
                  fullWidth
                  label="Notes (Optional)"
                  multiline
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes for the client..."
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProcessDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting || (action === 'modify' && !approvedFood)}
          >
            {submitting ? <CircularProgress size={20} /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

