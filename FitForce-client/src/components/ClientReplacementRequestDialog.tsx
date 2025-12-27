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
} from '@mui/material';
import {
  createReplacementRequest,
  getSmartSuggestions,
  getCategoryAlternatives,
  type FoodItem,
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
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadAvailableFoods();
      setReason('');
      setRequestedFood(null);
      setError(null);
    }
  }, [open]);

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
              Preferred Replacement (Optional)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Suggest a specific food if you have a preference. Your coach may approve a different option.
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
            Your request will be sent to your coach for review. You'll be notified once it's processed.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!reason.trim() || submitting}
        >
          {submitting ? <CircularProgress size={20} /> : 'Submit Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

