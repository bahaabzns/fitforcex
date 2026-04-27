'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Alert,
  Autocomplete,
  Stack,
  CircularProgress,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  createReplacementRequest,
  getSmartSuggestions,
  getCategoryAlternatives,
  getFoodItemReplacements,
  replaceFoodInMeal,
  type FoodItem,
  type FoodReplacement,
} from '@/api/food-replacements';
import { openSnackbar } from '@/api/snackbar';

interface ClientReplacementRequestDialogProps {
  open: boolean;
  onClose: () => void;
  foodItem: FoodItem & { id: string };
  planId: string;
  mealId: string;
  onRequestSubmitted: () => void;
}

export default function ClientReplacementRequestDialog({
  open,
  onClose,
  foodItem,
  planId,
  mealId,
  onRequestSubmitted,
}: ClientReplacementRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [requestedFood, setRequestedFood] = useState<FoodItem | null>(null);
  const [availableFoods, setAvailableFoods] = useState<FoodItem[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{ foodItem: FoodItem; matchScore: number }>>([]);
  const [libraryReplacements, setLibraryReplacements] = useState<FoodReplacement[]>([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replacingFromLibrary, setReplacingFromLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadAvailableFoods();
      loadLibraryReplacements();
      setReason('');
      setRequestedFood(null);
      setError(null);
    }
  }, [open]);

  const loadLibraryReplacements = async () => {
    try {
      setLoadingLibrary(true);
      // Use client-specific endpoint
      const response = await getFoodItemReplacements(foodItem.id, true);
      setLibraryReplacements(response.replacements || []);
    } catch (err: any) {
      console.error('Failed to load library replacements:', err);
      setLibraryReplacements([]);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const loadAvailableFoods = async () => {
    try {
      setLoadingFoods(true);
      setLoadingSuggestions(true);
      // Load smart suggestions and category alternatives
      const [suggestions, category] = await Promise.all([
        getSmartSuggestions(foodItem.id, { tolerance: 20, limit: 30 }).catch(() => ({ suggestions: [] })),
        getCategoryAlternatives(foodItem.id).catch(() => ({ alternatives: [] })),
      ]);

      // Store smart suggestions with match scores
      if (suggestions.suggestions) {
        setSmartSuggestions(suggestions.suggestions.map(s => ({
          foodItem: s.foodItem,
          matchScore: s.matchScore
        })));
      }

      // Combine and deduplicate for autocomplete
      const allFoods = new Map<string, FoodItem>();
      
      suggestions.suggestions?.forEach((s) => {
        if (s.foodItem.id !== foodItem.id) {
          allFoods.set(s.foodItem.id, s.foodItem);
        }
      });

      category.alternatives?.forEach((food) => {
        if (food.id !== foodItem.id) {
          allFoods.set(food.id, food);
        }
      });

      setAvailableFoods(Array.from(allFoods.values()));
    } catch (err: any) {
      console.error('Failed to load available foods:', err);
    } finally {
      setLoadingFoods(false);
      setLoadingSuggestions(false);
    }
  };

  const handleLibraryReplacement = async (replacement: FoodReplacement) => {
    try {
      setReplacingFromLibrary(true);
      setError(null);
      
      await replaceFoodInMeal({
        mealId,
        originalFoodId: foodItem.id,
        replacementFoodId: replacement.replacement.id,
        autoMatchMacros: false, // Keep same quantity
      }, true); // Use client endpoint

      openSnackbar({
        open: true,
        message: 'Food replaced successfully from library!',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
      } as any);

      onRequestSubmitted();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to replace food');
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to replace food',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    } finally {
      setReplacingFromLibrary(false);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for the replacement');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createReplacementRequest({
        planId,
        mealId,
        originalFoodId: foodItem.id,
        requestedFoodId: requestedFood?.id,
        reason: reason.trim(),
      });

      openSnackbar({
        open: true,
        message: 'Replacement request submitted successfully. Your coach will review it soon.',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
      } as any);

      onRequestSubmitted();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6">Request Food Replacement</Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Current Food
          </Typography>
          <Box
            sx={{
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body1" fontWeight={600}>
              {foodItem.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`${foodItem.calories} kcal`} color="error" />
              <Chip size="small" label={`P: ${foodItem.protein}g`} />
              <Chip size="small" label={`C: ${foodItem.carbs}g`} />
              <Chip size="small" label={`F: ${foodItem.fat}g`} />
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Coach-Defined Replacements Library */}
          {libraryReplacements.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label="Library" size="small" color="primary" />
                Recommended Replacements
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                These are pre-approved by your coach. Selecting one will replace immediately.
              </Typography>
              {loadingLibrary ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Stack spacing={1}>
                  {libraryReplacements.map((replacement) => (
                    <Card
                      key={replacement.id}
                      sx={{
                        cursor: replacingFromLibrary ? 'wait' : 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                      onClick={() => !replacingFromLibrary && handleLibraryReplacement(replacement)}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {replacement.replacement.name}
                            </Typography>
                            {replacement.notes && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {replacement.notes}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                              <Chip size="small" label={`${replacement.replacement.calories} kcal`} color="error" />
                              <Chip size="small" label={`P: ${replacement.replacement.protein}g`} />
                              <Chip size="small" label={`C: ${replacement.replacement.carbs}g`} />
                              <Chip size="small" label={`F: ${replacement.replacement.fat}g`} />
                            </Box>
                          </Box>
                          <Button
                            variant="contained"
                            size="small"
                            disabled={replacingFromLibrary}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLibraryReplacement(replacement);
                            }}
                            sx={{ ml: 2 }}
                          >
                            {replacingFromLibrary ? <CircularProgress size={16} /> : 'Use'}
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
              <Divider sx={{ my: 2 }} />
            </Box>
          )}

          <TextField
            fullWidth
            label="Reason for Replacement *"
            multiline
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Allergic to chicken, prefer vegetarian option, not available in my area..."
            required
            helperText="Explain why you need to replace this food item"
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Other Replacement Options (Requires Approval)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Suggest a specific food if you have a preference. Your coach will review and approve.
            </Typography>
            {loadingFoods ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Autocomplete
                options={availableFoods}
                getOptionLabel={(option) => option.name}
                value={requestedFood}
                onChange={(_, newValue) => setRequestedFood(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Preferred Food" placeholder="Search for a food item..." />
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
                noOptionsText="No suggestions available"
              />
            )}
          </Box>

          <Alert severity="info">
            {libraryReplacements.length > 0
              ? 'Select from the library above for instant replacement, or submit a request for other foods.'
              : 'Your request will be sent to your coach for review. You\'ll be notified once it\'s processed.'}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting || replacingFromLibrary}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!reason.trim() || submitting || replacingFromLibrary}
        >
          {submitting ? <CircularProgress size={20} /> : 'Submit Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

