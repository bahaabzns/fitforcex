'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  Stack,
  Divider,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  bulkReplaceFood,
  type FoodItem,
  type BulkReplaceRequest,
  type BulkReplaceResponse,
} from '@/api/food-replacements';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';

interface BulkReplacementDialogProps {
  open: boolean;
  onClose: () => void;
  originalFoodId?: string;
  replacementFoodId?: string;
  onSuccess?: () => void;
}

export default function BulkReplacementDialog({
  open,
  onClose,
  originalFoodId,
  replacementFoodId,
  onSuccess,
}: BulkReplacementDialogProps) {
  const [originalFood, setOriginalFood] = useState<FoodItem | null>(null);
  const [replacementFood, setReplacementFood] = useState<FoodItem | null>(null);
  const [availableFoods, setAvailableFoods] = useState<FoodItem[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<Array<{ id: string; title: string }>>([]);
  const [availablePlans, setAvailablePlans] = useState<Array<{ id: string; title: string }>>([]);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [autoMatchMacros, setAutoMatchMacros] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BulkReplaceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadAvailableFoods();
      loadAvailablePlans();
      setResults(null);
      setError(null);
      setAutoMatchMacros(false);
      setQuantity(null);
      if (originalFoodId) {
        loadFoodDetails(originalFoodId).then(setOriginalFood);
      }
      if (replacementFoodId) {
        loadFoodDetails(replacementFoodId).then(setReplacementFood);
      }
    }
  }, [open, originalFoodId, replacementFoodId]);

  const loadFoodDetails = async (foodId: string): Promise<FoodItem | null> => {
    try {
      const res = await api.get(`/api/nutrition/food-items/${foodId}`);
      return res.data.foodItem;
    } catch {
      return null;
    }
  };

  const loadAvailableFoods = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/nutrition/food-items');
      const foodItems = res.data?.foodItems || res.data || [];
      setAvailableFoods(Array.isArray(foodItems) ? foodItems : []);
    } catch (err) {
      console.error('Failed to load food items:', err);
      setAvailableFoods([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePlans = async () => {
    try {
      setLoadingPlans(true);
      const res = await api.get('/api/nutrition/plans');
      const plans = res.data?.plans || res.data || [];
      setAvailablePlans(Array.isArray(plans) ? plans : []);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setAvailablePlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSubmit = async () => {
    if (!originalFood || !replacementFood) {
      openSnackbar({
        open: true,
        message: 'Please select both original and replacement foods',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
      return;
    }

    if (selectedPlans.length === 0) {
      openSnackbar({
        open: true,
        message: 'Please select at least one plan',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const request: BulkReplaceRequest = {
        originalFoodId: originalFood.id,
        replacementFoodId: replacementFood.id,
        planIds: selectedPlans.map((p) => p.id),
        autoMatchMacros,
        quantity: quantity && quantity > 0 ? quantity : undefined,
      };

      const response = await bulkReplaceFood(request);
      setResults(response);

      openSnackbar({
        open: true,
        message: `Bulk replacement completed: ${response.summary.totalReplaced} items replaced across ${response.summary.totalPlans} plans`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
      } as any);

      onSuccess?.();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to perform bulk replacement';
      setError(errorMessage);
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6">Bulk Replace Food Items</Typography>
        <Typography variant="caption" color="text.secondary">
          Replace a food item across multiple nutrition plans
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Original Food Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Original Food *
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Autocomplete
                options={availableFoods}
                getOptionLabel={(option) => option?.name || ''}
                value={originalFood}
                onChange={(_, newValue) => setOriginalFood(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Original Food"
                    placeholder="Search for a food item..."
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
                filterOptions={(options, { inputValue }) => {
                  if (!inputValue) return options;
                  const search = inputValue.toLowerCase();
                  return options.filter(
                    (option) =>
                      option.name?.toLowerCase().includes(search) ||
                      option.nameArabic?.toLowerCase().includes(search)
                  );
                }}
              />
            )}
            {originalFood && (
              <Box sx={{ mt: 1, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Selected: {originalFood.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip size="small" label={`${originalFood.calories} kcal`} color="error" />
                  <Chip size="small" label={`P: ${originalFood.protein}g`} />
                  <Chip size="small" label={`C: ${originalFood.carbs}g`} />
                  <Chip size="small" label={`F: ${originalFood.fat}g`} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Replacement Food Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Replacement Food *
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Autocomplete
                options={availableFoods}
                getOptionLabel={(option) => option?.name || ''}
                value={replacementFood}
                onChange={(_, newValue) => setReplacementFood(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Replacement Food"
                    placeholder="Search for a food item..."
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
                filterOptions={(options, { inputValue }) => {
                  if (!inputValue) return options;
                  const search = inputValue.toLowerCase();
                  return options.filter(
                    (option) =>
                      option.name?.toLowerCase().includes(search) ||
                      option.nameArabic?.toLowerCase().includes(search)
                  );
                }}
              />
            )}
            {replacementFood && (
              <Box sx={{ mt: 1, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Selected: {replacementFood.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip size="small" label={`${replacementFood.calories} kcal`} color="error" />
                  <Chip size="small" label={`P: ${replacementFood.protein}g`} />
                  <Chip size="small" label={`C: ${replacementFood.carbs}g`} />
                  <Chip size="small" label={`F: ${replacementFood.fat}g`} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Plan Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Select Plans *
            </Typography>
            {loadingPlans ? (
              <CircularProgress size={24} />
            ) : (
              <Autocomplete
                multiple
                options={availablePlans}
                getOptionLabel={(option) => option.title}
                value={selectedPlans}
                onChange={(_, newValue) => setSelectedPlans(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Plans"
                    placeholder="Choose plans to apply replacement..."
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      label={option.title}
                      size="small"
                    />
                  ))
                }
              />
            )}
            {selectedPlans.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {selectedPlans.length} plan{selectedPlans.length !== 1 ? 's' : ''} selected
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Quantity and Options */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={autoMatchMacros}
                  onChange={(e) => setAutoMatchMacros(e.target.checked)}
                />
              }
              label="Auto-match macros (automatically adjust quantity to match calories)"
            />
            {!autoMatchMacros && (
              <TextField
                fullWidth
                type="number"
                label="Quantity (grams/ml)"
                value={quantity || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setQuantity(isNaN(val) ? null : val);
                }}
                inputProps={{ min: 0, step: 0.1 }}
                helperText="Leave empty to keep original quantities"
                sx={{ mt: 2 }}
              />
            )}
          </Box>

          {/* Results */}
          {results && (
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" gutterBottom>
                Replacement Results
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Total Plans: {results.summary.totalPlans}
                </Typography>
                <Typography variant="body2" color="success.main">
                  Successfully Replaced: {results.summary.totalReplaced}
                </Typography>
                {results.summary.totalFailed > 0 && (
                  <Typography variant="body2" color="error.main">
                    Failed: {results.summary.totalFailed}
                  </Typography>
                )}
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Per Plan:
                </Typography>
                {results.results.map((result) => (
                  <Box key={result.planId} sx={{ mb: 1 }}>
                    <Typography variant="caption">
                      {result.planTitle}: {result.replaced} replaced
                      {result.failed > 0 && `, ${result.failed} failed`}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}

          {processing && (
            <Box>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Processing bulk replacement...
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          {results ? 'Close' : 'Cancel'}
        </Button>
        {!results && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={processing || !originalFood || !replacementFood || selectedPlans.length === 0}
          >
            {processing ? <CircularProgress size={20} /> : 'Apply Bulk Replacement'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

