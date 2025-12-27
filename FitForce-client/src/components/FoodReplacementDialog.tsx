'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  FormControlLabel,
  Checkbox,
  Stack,
  Divider,
  Tabs,
  Tab,
  Slider,
} from '@mui/material';
import {
  getFoodItemReplacements,
  getSmartSuggestions,
  getCategoryAlternatives,
  replaceFoodInMeal,
  type FoodItem,
  type FoodReplacement,
  type SmartSuggestion,
} from '@/api/food-replacements';
import { openSnackbar } from '@/api/snackbar';

interface FoodReplacementDialogProps {
  open: boolean;
  onClose: () => void;
  foodItem: FoodItem & { id: string };
  mealId: string;
  currentQuantity: number;
  onReplace: (newFoodItem: FoodItem, newQuantity: number) => void;
}

export default function FoodReplacementDialog({
  open,
  onClose,
  foodItem,
  mealId,
  currentQuantity,
  onReplace,
}: FoodReplacementDialogProps) {
  const [tab, setTab] = useState(0); // 0: Coach Suggestions, 1: Smart Matches, 2: Same Category
  const [replacements, setReplacements] = useState<FoodReplacement[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [categoryAlternatives, setCategoryAlternatives] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReplacement, setSelectedReplacement] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState<number>(currentQuantity);
  const [autoMatchMacros, setAutoMatchMacros] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [tolerance, setTolerance] = useState(10); // Tolerance for smart suggestions

  useEffect(() => {
    if (open && foodItem.id) {
      loadReplacements();
      // Load smart suggestions and category alternatives when dialog opens
      loadSmartSuggestions();
      loadCategoryAlternatives();
    }
  }, [open, foodItem.id, tolerance]);

  useEffect(() => {
    if (open) {
      setQuantity(currentQuantity);
      setSelectedReplacement(null);
      setAutoMatchMacros(false);
      setTab(0);
    }
  }, [open, currentQuantity]);

  const loadReplacements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFoodItemReplacements(foodItem.id);
      setReplacements(data.replacements);
    } catch (err: any) {
      setError(err?.message || 'Failed to load replacements');
    } finally {
      setLoading(false);
    }
  };

  const loadSmartSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const data = await getSmartSuggestions(foodItem.id, { tolerance, limit: 20 });
      setSmartSuggestions(data.suggestions);
    } catch (err: any) {
      console.error('Failed to load smart suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadCategoryAlternatives = async () => {
    try {
      setLoadingCategory(true);
      const data = await getCategoryAlternatives(foodItem.id);
      setCategoryAlternatives(data.alternatives);
    } catch (err: any) {
      console.error('Failed to load category alternatives:', err);
    } finally {
      setLoadingCategory(false);
    }
  };

  const calculateMacros = (food: FoodItem, qty: number) => {
    const servingSize = food.servingSize || 100;
    const factor = qty / servingSize;
    return {
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fat: Math.round(food.fat * factor * 10) / 10,
    };
  };

  const originalMacros = calculateMacros(foodItem, quantity);
  const newMacros = selectedReplacement
    ? calculateMacros(selectedReplacement, quantity)
    : null;

  // Helper function to get macro difference color
  const getMacroColor = (original: number, newVal: number | null) => {
    if (!newVal) return 'default';
    const diff = Math.abs(newVal - original);
    const percentDiff = original > 0 ? (diff / original) * 100 : 0;
    if (percentDiff < 5) return 'success';
    if (percentDiff < 15) return 'warning';
    return 'error';
  };

  // Helper function to format macro difference
  const formatMacroDiff = (original: number, newVal: number | null) => {
    if (!newVal) return '—';
    const diff = newVal - original;
    if (diff === 0) return '0';
    return diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  };

  const handleReplace = async () => {
    if (!selectedReplacement) return;

    try {
      setReplacing(true);
      const result = await replaceFoodInMeal({
        mealId,
        originalFoodId: foodItem.id,
        replacementFoodId: selectedReplacement.id,
        quantity: autoMatchMacros ? undefined : quantity,
        autoMatchMacros,
      });

      onReplace(result.mealFoodItem.foodItem, result.mealFoodItem.quantity);
      openSnackbar({
        open: true,
        message: 'Food replaced successfully',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
      } as any);
      onClose();
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.message || 'Failed to replace food',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    } finally {
      setReplacing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Replace Food Item</Typography>
        </Box>
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
              <Chip size="small" label={`${originalMacros.calories} kcal`} color="error" />
              <Chip size="small" label={`P: ${originalMacros.protein}g`} />
              <Chip size="small" label={`C: ${originalMacros.carbs}g`} />
              <Chip size="small" label={`F: ${originalMacros.fat}g`} />
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Tabs for different replacement types */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Coach Suggestions" />
            <Tab label="Smart Matches" />
            <Tab label="Same Category" />
          </Tabs>
        </Box>

        {/* Tab 0: Coach Suggestions */}
        {tab === 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Pre-defined replacements by coach
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : replacements.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No replacements defined for this food item. Add replacements in the food library.
              </Alert>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {replacements.map((replacement) => (
                  <ListItemButton
                    key={replacement.id}
                    selected={selectedReplacement?.id === replacement.replacement.id}
                    onClick={() => setSelectedReplacement(replacement.replacement)}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&.Mui-selected': {
                        bgcolor: 'primary.lighter',
                        '&:hover': {
                          bgcolor: 'primary.light',
                        },
                      },
                    }}
                  >
                    <ListItemText
                      primary={replacement.replacement.name}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip size="small" label={`${replacement.replacement.calories} kcal`} color="error" variant="outlined" />
                          <Chip size="small" label={`P: ${replacement.replacement.protein}g`} variant="outlined" />
                          <Chip size="small" label={`C: ${replacement.replacement.carbs}g`} variant="outlined" />
                          <Chip size="small" label={`F: ${replacement.replacement.fat}g`} variant="outlined" />
                          {replacement.notes && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {replacement.notes}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </>
        )}

        {/* Tab 1: Smart Matches */}
        {tab === 1 && (
          <>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ flex: 1 }}>
                AI-suggested replacements based on macro similarity
              </Typography>
              <Box sx={{ width: 200 }}>
                <Typography variant="caption" color="text.secondary">
                  Tolerance: {tolerance}%
                </Typography>
                <Slider
                  value={tolerance}
                  onChange={(_, v) => setTolerance(v as number)}
                  min={5}
                  max={30}
                  step={5}
                  marks
                  size="small"
                />
              </Box>
            </Stack>
            {loadingSuggestions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : smartSuggestions.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No smart matches found. Try increasing the tolerance.
              </Alert>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {smartSuggestions.map((suggestion) => (
                  <ListItemButton
                    key={suggestion.foodItem.id}
                    selected={selectedReplacement?.id === suggestion.foodItem.id}
                    onClick={() => setSelectedReplacement(suggestion.foodItem)}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&.Mui-selected': {
                        bgcolor: 'primary.lighter',
                        '&:hover': {
                          bgcolor: 'primary.light',
                        },
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">{suggestion.foodItem.name}</Typography>
                          <Chip size="small" label={`${suggestion.matchScore}% match`} color="success" />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip size="small" label={`${suggestion.foodItem.calories} kcal`} color="error" variant="outlined" />
                          <Chip size="small" label={`P: ${suggestion.foodItem.protein}g`} variant="outlined" />
                          <Chip size="small" label={`C: ${suggestion.foodItem.carbs}g`} variant="outlined" />
                          <Chip size="small" label={`F: ${suggestion.foodItem.fat}g`} variant="outlined" />
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {(() => {
                              const servingSize = suggestion.foodItem.servingSize || 100;
                              const factor = quantity / servingSize;
                              const diff = suggestion.macroDifference.calories * factor;
                              return `Diff: ${diff > 0 ? '+' : ''}${diff.toFixed(0)} kcal`;
                            })()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </>
        )}

        {/* Tab 2: Same Category */}
        {tab === 2 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              All foods in the same category: {foodItem.category || 'Uncategorized'}
            </Typography>
            {loadingCategory ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : categoryAlternatives.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {foodItem.category
                  ? `No other foods found in the "${foodItem.category}" category.`
                  : 'This food item has no category assigned.'}
              </Alert>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {categoryAlternatives.map((food) => (
                  <ListItemButton
                    key={food.id}
                    selected={selectedReplacement?.id === food.id}
                    onClick={() => setSelectedReplacement(food)}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&.Mui-selected': {
                        bgcolor: 'primary.lighter',
                        '&:hover': {
                          bgcolor: 'primary.light',
                        },
                      },
                    }}
                  >
                    <ListItemText
                      primary={food.name}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip size="small" label={`${food.calories} kcal`} color="error" variant="outlined" />
                          <Chip size="small" label={`P: ${food.protein}g`} variant="outlined" />
                          <Chip size="small" label={`C: ${food.carbs}g`} variant="outlined" />
                          <Chip size="small" label={`F: ${food.fat}g`} variant="outlined" />
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </>
        )}

        {selectedReplacement && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Quantity
              </Typography>
              <TextField
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                disabled={autoMatchMacros}
                fullWidth
                size="small"
                InputProps={{
                  endAdornment: (
                    <Typography variant="caption" sx={{ ml: 1 }}>
                      {selectedReplacement.unit || 'g'}
                    </Typography>
                  ),
                }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoMatchMacros}
                    onChange={(e) => setAutoMatchMacros(e.target.checked)}
                  />
                }
                label="Auto-adjust quantity to match original macros"
                sx={{ mt: 1 }}
              />
            </Box>

            <Box
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Macro Comparison
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Original
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip size="small" label={`${originalMacros.calories} kcal`} color="error" />
                    <Chip size="small" label={`P: ${originalMacros.protein}g`} />
                    <Chip size="small" label={`C: ${originalMacros.carbs}g`} />
                    <Chip size="small" label={`F: ${originalMacros.fat}g`} />
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    New
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label={`${newMacros?.calories || 0} kcal ${formatMacroDiff(originalMacros.calories, newMacros?.calories || null)}`}
                      color={getMacroColor(originalMacros.calories, newMacros?.calories || null)}
                    />
                    <Chip
                      size="small"
                      label={`P: ${newMacros?.protein || 0}g ${formatMacroDiff(originalMacros.protein, newMacros?.protein || null)}`}
                      color={getMacroColor(originalMacros.protein, newMacros?.protein || null)}
                    />
                    <Chip
                      size="small"
                      label={`C: ${newMacros?.carbs || 0}g ${formatMacroDiff(originalMacros.carbs, newMacros?.carbs || null)}`}
                      color={getMacroColor(originalMacros.carbs, newMacros?.carbs || null)}
                    />
                    <Chip
                      size="small"
                      label={`F: ${newMacros?.fat || 0}g ${formatMacroDiff(originalMacros.fat, newMacros?.fat || null)}`}
                      color={getMacroColor(originalMacros.fat, newMacros?.fat || null)}
                    />
                  </Box>
                </Box>
              </Stack>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={replacing}>
          Cancel
        </Button>
        <Button
          onClick={handleReplace}
          variant="contained"
          disabled={!selectedReplacement || replacing}
        >
          {replacing ? <CircularProgress size={20} /> : 'Replace'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

