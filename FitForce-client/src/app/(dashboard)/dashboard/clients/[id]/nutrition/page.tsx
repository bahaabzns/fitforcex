'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Chip,
  TextField,
  Stack,
  CircularProgress,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add,
  Trash,
  ArrowLeft2,
  ArrowRight2,
  Copy
} from '@wandersonalwes/iconsax-react';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';

interface FoodItem {
  id: string;
  name: string;
  servingSize: number; // e.g., 100
  unit: string; // e.g., g, ml
  calories: number; // per serving
  protein: number;
  carbs: number;
  fat: number;
}

interface Plan {
  id: string;
  title: string;
  createdBy?: string;
  createdAt?: string;
  status?: string;
}

interface Cycle {
  id: string;
  title: string;
  label: string;
  dayIndex: number;
}

interface MealFoodItem {
  id: string;
  mealId: string;
  foodItemId: string;
  quantity: number; // quantity in food unit
  foodItem: FoodItem;
}

interface Meal {
  id: string;
  dayId: string;
  meal: string;
  foodItems: MealFoodItem[];
}

export default function ClientNutritionPage() {
  const { id: clientId } = useParams() as { id: string };
  
  // State for plans
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planQuery, setPlanQuery] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(false);
  
  // State for cycles (in-memory)
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [currentCycleIndex, setCurrentCycleIndex] = useState<number>(0);
  
  // State for meals (in-memory, keyed by cycle)
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  
  // State for food items
  const [workspaceFood, setWorkspaceFood] = useState<FoodItem[]>([]);
  const [loadingFood, setLoadingFood] = useState(false);
  
  // Dialog states
  const [isCreatePlanDialogOpen, setIsCreatePlanDialogOpen] = useState(false);
  const [isCreateMealDialogOpen, setIsCreateMealDialogOpen] = useState(false);
  const [isAddFoodDialogOpen, setIsAddFoodDialogOpen] = useState(false);
  
  // Form states
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newMealTitle, setNewMealTitle] = useState('');
  const [selectedFoodItems, setSelectedFoodItems] = useState<string[]>([]);
  const [editingQuantities, setEditingQuantities] = useState<{[key: string]: number}>({});
  const [isEditingQuantities, setIsEditingQuantities] = useState(false);
  const [isPlanDirty, setIsPlanDirty] = useState(false);
  
  const [saving, setSaving] = useState(false);

  // Load workspace food items
  useEffect(() => {
    const loadFood = async () => {
      try {
        setLoadingFood(true);
        const response = await api.get('/api/nutrition/food-items');
        setWorkspaceFood(response.data.foodItems || []);
      } catch (err: any) {
        openSnackbar({
          open: true,
          message: 'Failed to load food items',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoadingFood(false);
      }
    };
    loadFood();
  }, []);

  // Load plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await api.get(`/api/clients/${clientId}/nutrition/plans`);
        setPlans(response.data.plans || []);
      } catch (err: any) {
        openSnackbar({
          open: true,
          message: 'Failed to load nutrition plans',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoadingPlans(false);
      }
    };
    loadPlans();
  }, [clientId]);

  // Load cycles when plan is selected (initial seed from API)
  useEffect(() => {
    if (!selectedPlanId) {
      setCycles([]);
      setSelectedCycleId(null);
      setCurrentCycleIndex(0);
      setMeals([]);
      return;
    }

    const loadCycles = async () => {
      try {
        const response = await api.get(`/api/clients/${clientId}/nutrition/plans/${selectedPlanId}/cycles`);
        const cyclesData = response.data.cycles || [];
        setCycles(cyclesData);
        
        // Select first cycle by default
        if (cyclesData.length > 0) {
          setSelectedCycleId(cyclesData[0].id);
          setCurrentCycleIndex(0);
        }
      } catch (err: any) {
        openSnackbar({
          open: true,
          message: 'Failed to load cycles',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    };
    loadCycles();
  }, [selectedPlanId, clientId]);

  // Load meals when cycle is selected (initial seed from API)
  useEffect(() => {
    if (!selectedCycleId) {
      setMeals([]);
      setSelectedMealId(null);
      return;
    }

    const loadMeals = async () => {
      try {
        const response = await api.get(`/api/clients/${clientId}/nutrition/cycles/${selectedCycleId}/meals`);
        setMeals(response.data.meals || []);
      } catch (err: any) {
        openSnackbar({
          open: true,
          message: 'Failed to load meals',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    };
    loadMeals();
  }, [selectedCycleId, clientId]);

  const filteredPlans = plans.filter(plan =>
    plan.title.toLowerCase().includes(planQuery.toLowerCase())
  );

  const handleCreatePlan = async () => {
    if (!newPlanTitle.trim()) return;
    // In-memory create plan (draft)
    const tempId = `tmp-${Date.now()}`;
    const draftPlan: Plan = { id: tempId, title: newPlanTitle };
    setPlans((prev) => [...prev, draftPlan]);
    setSelectedPlanId(tempId);
    // Create initial cycle for the new plan
    const firstCycleId = `tmpc-${Date.now()}`;
    const firstCycle: Cycle = { id: firstCycleId, title: 'Cycle 1', label: 'Cycle 1', dayIndex: 1 };
    setCycles([firstCycle]);
    setSelectedCycleId(firstCycleId);
    setCurrentCycleIndex(0);
    setMeals([]);
    setNewPlanTitle('');
    setIsCreatePlanDialogOpen(false);
    setIsPlanDirty(true);
  };


  const handleCreateMeal = () => {
    if (!newMealTitle.trim() || !selectedCycleId) return;
    const tempId = `tmpm-${Date.now()}`;
    const newMeal: Meal = { id: tempId, dayId: selectedCycleId, meal: newMealTitle, foodItems: [] };
    setMeals((prev) => [...prev, newMeal]);
    setSelectedMealId(tempId);
    setNewMealTitle('');
    setIsCreateMealDialogOpen(false);
    setIsPlanDirty(true);
  };

  const handleAddFoodToMeal = () => {
    if (!selectedFoodItems.length || !selectedMealId) return;
    const baseMeal = meals.find((m) => m.id === selectedMealId);
    if (!baseMeal) return;
    const added: MealFoodItem[] = selectedFoodItems
      .map((foodItemId) => {
        const food = workspaceFood.find((f) => f.id === foodItemId);
        if (!food) return null;
        return {
          id: `tmpfi-${baseMeal.id}-${foodItemId}-${Date.now()}`,
          mealId: baseMeal.id,
          foodItemId,
          quantity: food.servingSize || 100,
          foodItem: food
        } as MealFoodItem;
      })
      .filter(Boolean) as MealFoodItem[];
    setMeals((prev) => prev.map((m) => (m.id === baseMeal.id ? { ...m, foodItems: [...(m.foodItems || []), ...added] } : m)));
    setSelectedFoodItems([]);
    setIsAddFoodDialogOpen(false);
    setIsPlanDirty(true);
  };

  const showSection2 = !!selectedPlanId;
  const showSection3 = !!selectedMealId;
  
  const handleSavePlan = async () => {
    if (!selectedPlanId) return;
    
    try {
      setSaving(true);
      // Persist plan, cycles, meals, and food items
      // 1) Ensure plan exists on server
      let serverPlanId = selectedPlanId;
      if (selectedPlanId.startsWith('tmp-')) {
        const planTitle = plans.find((p) => p.id === selectedPlanId)?.title || 'Untitled';
        const createPlanRes = await api.post(`/api/clients/${clientId}/nutrition/plans`, { title: planTitle });
        serverPlanId = createPlanRes.data.plan.id;
        // replace temp id
        setPlans((prev) => prev.map((p) => (p.id === selectedPlanId ? { ...p, id: serverPlanId } : p)));
      }

      // 2) Sync cycles
      const currentCycles = cycles;
      const createdCycleIdMap: Record<string, string> = {};
      for (const c of currentCycles) {
        let serverCycleId = c.id;
        if (c.id.startsWith('tmpc-')) {
          const res = await api.post(`/api/clients/${clientId}/nutrition/plans/${serverPlanId}/cycles`, {
            title: c.title,
            label: c.label,
            dayIndex: c.dayIndex
          });
          serverCycleId = res.data.cycle.id;
          createdCycleIdMap[c.id] = serverCycleId;
        }
      }

      // 3) Sync meals
      const currentMeals = meals;
      const createdMealIdMap: Record<string, string> = {};
      for (const m of currentMeals) {
        const effectiveCycleId = createdCycleIdMap[m.dayId] || m.dayId;
        let serverMealId = m.id;
        if (m.id.startsWith('tmpm-')) {
          const res = await api.post(`/api/clients/${clientId}/nutrition/cycles/${effectiveCycleId}/meals`, {
            title: m.meal
          });
          serverMealId = res.data.meal.id;
          createdMealIdMap[m.id] = serverMealId;
        }
      }

      // 4) Sync food items for each meal
      for (const m of currentMeals) {
        const effectiveMealId = createdMealIdMap[m.id] || m.id;
        for (const item of m.foodItems || []) {
          if (item.id.startsWith('tmpfi-')) {
            await api.post(`/api/clients/${clientId}/nutrition/meals/${effectiveMealId}/food-items`, {
              foodItemId: item.foodItemId,
              quantity: item.quantity
            });
          } else {
            // existing item: update quantity if needed
            await api.put(`/api/clients/${clientId}/nutrition/meals/${effectiveMealId}/food-items/${item.id}`, {
              quantity: item.quantity
            });
          }
        }
      }

      setIsPlanDirty(false);
      
      openSnackbar({
        open: true,
        message: 'Plan saved and activated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to save plan',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Get current cycle for navigation
  const currentCycle = cycles[currentCycleIndex];
  const canGoPrevious = currentCycleIndex > 0;
  const canGoNext = currentCycleIndex < cycles.length - 1;
  
  const handlePreviousCycle = () => {
    if (canGoPrevious) {
      const newIndex = currentCycleIndex - 1;
      setCurrentCycleIndex(newIndex);
      setSelectedCycleId(cycles[newIndex].id);
      setSelectedMealId(null); // Reset meal selection
      setMeals([]); // Clear meals
    }
  };
  
  const handleNextCycle = () => {
    if (canGoNext) {
      const newIndex = currentCycleIndex + 1;
      setCurrentCycleIndex(newIndex);
      setSelectedCycleId(cycles[newIndex].id);
      setSelectedMealId(null); // Reset meal selection
      setMeals([]); // Clear meals
    }
  };
  
  const handleCopyCycle = async () => {
    if (!selectedCycleId) return;
    const base = cycles[currentCycleIndex];
    if (!base) return;
    const newId = `tmpc-${Date.now()}`;
    const copy: Cycle = {
      id: newId,
      title: `${base.title} (Copy)`,
      label: `${base.label} (Copy)`,
      dayIndex: cycles.length + 1
    };
    setCycles((prev) => [...prev, copy]);
    setCurrentCycleIndex(cycles.length);
    setSelectedCycleId(newId);
    setIsPlanDirty(true);
  };

  const handleDeleteCycle = () => {
    if (cycles.length <= 1 || !selectedCycleId) return; // cannot delete last cycle
    const newCycles = cycles.filter((c, idx) => idx !== currentCycleIndex);
    setCycles(newCycles.map((c, i) => ({ ...c, dayIndex: i + 1 })));
    const newIndex = Math.max(0, currentCycleIndex - 1);
    setCurrentCycleIndex(newIndex);
    setSelectedCycleId(newCycles[newIndex]?.id || null);
    // Remove meals belonging to deleted cycle
    setMeals((prev) => prev.filter((m) => m.dayId !== cycles[currentCycleIndex].id));
    setSelectedMealId(null);
    setIsPlanDirty(true);
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4">Nutrition Maker</Typography>
        <Chip label={`Client: ${clientId}`} variant="outlined" />
      </Box>

      {/* Main Content */}
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
        {/* Section 1: Plans */}
        <Card sx={{ flex: showSection2 ? '1 1 0' : '1 1 0', minWidth: 0, width: showSection2 ? '50%' : '100%' }}>
          <CardHeader
            title="Plans"
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search plans..."
                  value={planQuery}
                  onChange={(e) => setPlanQuery(e.target.value)}
                  InputProps={{}}
                  sx={{ width: 200 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add size={16} />}
                  onClick={() => setIsCreatePlanDialogOpen(true)}
                >
                  Create Plan
                </Button>
              </Stack>
            }
          />
          <CardContent>
            {loadingPlans ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2} direction="column">
                {filteredPlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const createdDate = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : undefined;
                  return (
                    <Grid item xs={12} key={plan.id}>
                      <Card
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          setSelectedCycleId(null);
                          setSelectedMealId(null);
                          setCycles([]);
                          setMeals([]);
                        }}
                        sx={{
                          cursor: 'pointer',
                          border: isSelected ? 2 : 1,
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? 'primary.lighter' : 'background.paper'
                        }}
                      >
                        <CardHeader
                          title={plan.title}
                          subheader={createdDate ? `Created ${createdDate}` : undefined}
                        />
                        <CardContent>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                            {plan.status && (
                              <Chip size="small" label={plan.status} variant="outlined" />
                            )}
                            {plan.createdBy && (
                              <Chip size="small" label={`By ${plan.createdBy}`} variant="light" />
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Current Cycle & Meals */}
        {showSection2 && (
          <Card sx={{ flex: showSection3 ? '1 1 0' : '1 1 0', minWidth: 0, width: showSection3 ? '50%' : '100%' }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6">Current Cycle & Meals</Typography>
                  {cycles.length > 1 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={handlePreviousCycle}
                        disabled={!canGoPrevious}
                      >
                        <ArrowLeft2 size={16} />
                      </IconButton>
                      <Typography variant="body2" color="text.secondary">
                        {currentCycleIndex + 1} of {cycles.length}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={handleNextCycle}
                        disabled={!canGoNext}
                      >
                        <ArrowRight2 size={16} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              }
              action={
                <Stack direction="row" spacing={1}>
                  {selectedCycleId && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Copy size={16} />}
                      onClick={handleCopyCycle}
                      disabled={saving}
                    >
                      Copy
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<Trash size={16} />}
                    onClick={handleDeleteCycle}
                    disabled={saving || cycles.length <= 1}
                  >
                    Delete Cycle
                  </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add size={16} />}
                  onClick={() => setIsCreateMealDialogOpen(true)}
                >
                  Create Meal
                </Button>
                </Stack>
              }
            />
            <CardContent>
              {currentCycle ? (
                <Box>
                  {/* Current Cycle Header */}
                  <Box sx={{ 
                    p: 2, 
                    mb: 2, 
                    backgroundColor: 'primary.main', 
                    color: 'primary.contrastText',
                    borderRadius: 1,
                    textAlign: 'center'
                  }}>
                    <Typography variant="h6">{currentCycle.label}</Typography>
                    <Typography variant="body2">Day {currentCycle.dayIndex}</Typography>
                  </Box>
                  
                  {/* Meals under current cycle stacked vertically */}
                  <Grid container spacing={2} direction="column">
                    {meals.filter((m) => m.dayId === currentCycle.id).map((meal) => (
                      <Grid item xs={12} key={meal.id}>
                        <Card
                          sx={{
                            border: selectedMealId === meal.id ? 2 : 1,
                            borderColor: selectedMealId === meal.id ? 'secondary.main' : 'divider',
                            cursor: 'pointer'
                          }}
                          onClick={() => setSelectedMealId(meal.id)}
                        >
                          <CardHeader title={meal.meal} />
                          <CardContent>
                            <Typography variant="body2" color="text.secondary">
                              {meal.foodItems?.length || 0} food item(s)
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                    <Grid item xs={12}>
                      <Card
                        sx={{
                          border: '1px dashed',
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onClick={() => setIsCreateMealDialogOpen(true)}
                      >
                        <Button startIcon={<Add size={16} />}>Add Meal</Button>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">No cycle selected</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}


        {/* Section 3: Food Items */}
        {showSection3 && (
          <Card sx={{ flex: '1 1 0', minWidth: 0, width: '50%' }}>
            <CardHeader
              title="Food Items"
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add size={16} />}
                  onClick={() => setIsAddFoodDialogOpen(true)}
                >
                  Add Food
                </Button>
              }
            />
            <CardContent>
              {selectedMealId && meals.find(m => m.id === selectedMealId) ? (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {meals.find(m => m.id === selectedMealId)?.meal}
                  </Typography>
                  {meals.find(m => m.id === selectedMealId)?.foodItems && meals.find(m => m.id === selectedMealId)?.foodItems.length > 0 ? (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2">
                          {meals.find(m => m.id === selectedMealId)?.foodItems.length} food item(s)
                        </Typography>
                      </Box>
                <List>
                        {meals.find(m => m.id === selectedMealId)?.foodItems.map((item) => (
                          <ListItem key={item.id}>
                      <ListItemText
                        primary={item.foodItem.name}
                              secondary={(() => {
                                const quantity = editingQuantities[item.id] ?? item.quantity;
                                const factor = quantity / (item.foodItem.servingSize || 100);
                                const calories = Math.round(item.foodItem.calories * factor);
                                const protein = Math.round(item.foodItem.protein * factor);
                                const carbs = Math.round(item.foodItem.carbs * factor);
                                const fat = Math.round(item.foodItem.fat * factor);
                                return (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" color="text.secondary">
                                      {calories} cal • {protein}g P • {carbs}g C • {fat}g F
                                    </Typography>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={editingQuantities[item.id] ?? item.quantity}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEditingQuantities(prev => ({ ...prev, [item.id]: val }));
                                        // Update live in-memory state on change
                                        setMeals((prev) => prev.map((m) => m.id !== (selectedMealId as string) ? m : {
                                          ...m,
                                          foodItems: m.foodItems.map((fi) => fi.id === item.id ? { ...fi, quantity: val } : fi)
                                        }));
                                        setIsPlanDirty(true);
                                      }}
                                      sx={{ width: 110 }}
                                      InputProps={{ endAdornment: <Typography variant="caption" sx={{ ml: 0.5 }}>{item.foodItem.unit}</Typography> as any }}
                                    />
                                  </Box>
                                );
                              })()}
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small" color="error">
                          <Trash size={16} />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                      {/* Inline editing saves in-memory on change; no bulk actions needed */}
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No food items added yet</Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">Select a meal to view food items</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Create Plan Dialog */}
      <Dialog open={isCreatePlanDialogOpen} onClose={() => setIsCreatePlanDialogOpen(false)}>
        <DialogTitle>Create Nutrition Plan</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Plan Title"
            value={newPlanTitle}
            onChange={(e) => setNewPlanTitle(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreatePlanDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreatePlan} disabled={saving || !newPlanTitle.trim()}>
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Create Meal Dialog */}
      <Dialog open={isCreateMealDialogOpen} onClose={() => setIsCreateMealDialogOpen(false)}>
        <DialogTitle>Create Meal</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Meal Title"
            value={newMealTitle}
            onChange={(e) => setNewMealTitle(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateMealDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateMeal} disabled={saving || !newMealTitle.trim()}>
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Food Dialog */}
      <Dialog open={isAddFoodDialogOpen} onClose={() => setIsAddFoodDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Food Items to Meal</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <List>
              {workspaceFood.map((food) => {
                const isSelected = selectedFoodItems.includes(food.id);
                
                return (
                  <ListItem
                    key={food.id}
                    sx={{
                      cursor: 'pointer',
                      border: isSelected ? 2 : 1,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      mb: 1,
                      '&:hover': { borderColor: 'primary.main' }
                    }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFoodItems(prev => prev.filter(id => id !== food.id));
                      } else {
                        setSelectedFoodItems(prev => [...prev, food.id]);
                      }
                    }}
                  >
                    <ListItemText
                      primary={food.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {food.calories} cal per {food.servingSize}{food.unit} • {food.protein}g protein • {food.carbs}g carbs • {food.fat}g fat
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddFoodDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddFoodToMeal} disabled={saving || !selectedFoodItems.length}>
            {saving ? <CircularProgress size={20} /> : `Add ${selectedFoodItems.length} item(s)`}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Save Plan Button */}
      {selectedPlanId && isPlanDirty && (
        <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSavePlan}
            disabled={saving}
            sx={{ 
              boxShadow: 3,
              '&:hover': {
                boxShadow: 6
              }
            }}
          >
            {saving ? <CircularProgress size={24} /> : 'Save Plan'}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
