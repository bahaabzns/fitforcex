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
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';
import MobileSwipeableSections from '@/components/MobileSwipeableSections';

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
  clientId?: string;
  cycles?: Cycle[];
}

interface Cycle {
  id: string;
  title: string;
  label: string;
  dayIndex: number;
  meals?: Meal[];
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileSection, setMobileSection] = useState(0);
  
  // State for plans with all data loaded
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planQuery, setPlanQuery] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(false);
  
  // Current working data (derived from selected plan)
  const [currentCycles, setCurrentCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [currentCycleIndex, setCurrentCycleIndex] = useState<number>(0);
  
  // Current meals (derived from selected cycle)
  const [currentMeals, setCurrentMeals] = useState<Meal[]>([]);
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
  // Load all nutrition plans with their cycles and meals
  const loadAllPlansData = async () => {
    try {
      setLoadingPlans(true);
      const response = await api.get(`/api/nutrition/plans`);
      const plansData = response.data.plans || [];
      
      // Filter plans for the current client
      const clientPlans = plansData.filter((plan: Plan) => plan.clientId === clientId);
      
      // Load cycles and meals for each plan
      const plansWithData = await Promise.all(
        clientPlans.map(async (plan: Plan) => {
          try {
            // Load cycles for this plan
            const cyclesResponse = await api.get(`/api/clients/${clientId}/nutrition/plans/${plan.id}/cycles`);
            const cycles = cyclesResponse.data.cycles || [];
            
            // Load meals for each cycle
            const cyclesWithMeals = await Promise.all(
              cycles.map(async (cycle: Cycle) => {
                try {
                  const mealsResponse = await api.get(`/api/clients/${clientId}/nutrition/cycles/${cycle.id}/meals`);
                  return {
                    ...cycle,
                    meals: mealsResponse.data.meals || []
                  };
                } catch (err) {
                  console.warn(`Failed to load meals for cycle ${cycle.id}:`, err);
                  return {
                    ...cycle,
                    meals: []
                  };
                }
              })
            );
            
            return {
              ...plan,
              cycles: cyclesWithMeals
            };
          } catch (err) {
            console.warn(`Failed to load cycles for plan ${plan.id}:`, err);
            return {
              ...plan,
              cycles: []
            };
          }
        })
      );
      
      setPlans(plansWithData);
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

  useEffect(() => {
    if (clientId) loadAllPlansData();
  }, [clientId]);

  // Update current working data when plan is selected
  useEffect(() => {
    if (!selectedPlanId) {
      setCurrentCycles([]);
      setSelectedCycleId(null);
      setCurrentCycleIndex(0);
      setCurrentMeals([]);
      setSelectedMealId(null);
      return;
    }

    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    if (selectedPlan && selectedPlan.cycles) {
      setCurrentCycles(selectedPlan.cycles);
      
      // Select first cycle by default
      if (selectedPlan.cycles.length > 0) {
        setSelectedCycleId(selectedPlan.cycles[0].id);
        setCurrentCycleIndex(0);
        setCurrentMeals(selectedPlan.cycles[0].meals || []);
      } else {
        setSelectedCycleId(null);
        setCurrentCycleIndex(0);
        setCurrentMeals([]);
      }
    } else {
      setCurrentCycles([]);
      setSelectedCycleId(null);
      setCurrentCycleIndex(0);
      setCurrentMeals([]);
    }
    setSelectedMealId(null);
  }, [selectedPlanId, plans]);

  // Update current meals when cycle is selected
  useEffect(() => {
    if (!selectedCycleId || !currentCycles.length) {
      setCurrentMeals([]);
      setSelectedMealId(null);
      return;
    }

    const selectedCycle = currentCycles.find(c => c.id === selectedCycleId);
    if (selectedCycle && selectedCycle.meals) {
      setCurrentMeals(selectedCycle.meals);
    } else {
      setCurrentMeals([]);
    }
    setSelectedMealId(null);
  }, [selectedCycleId, currentCycles]);

  const filteredPlans = plans.filter(plan =>
    plan.title.toLowerCase().includes(planQuery.toLowerCase())
  );

  const handleCreatePlan = async () => {
    if (!newPlanTitle.trim()) return;
    // In-memory create plan (draft)
    const tempId = `tmp-${Date.now()}`;
    const draftPlan: Plan = { 
      id: tempId, 
      title: newPlanTitle,
      cycles: []
    };
    setPlans((prev) => [...prev, draftPlan]);
    setSelectedPlanId(tempId);
    // Create initial cycle for the new plan
    const firstCycleId = `tmpc-${Date.now()}`;
    const firstCycle: Cycle = { 
      id: firstCycleId, 
      title: 'Cycle 1', 
      label: 'Cycle 1', 
      dayIndex: 1,
      meals: []
    };
    // Update the plan with the new cycle
    setPlans((prev) => prev.map(p => 
      p.id === tempId 
        ? { ...p, cycles: [firstCycle] }
        : p
    ));
    setNewPlanTitle('');
    setIsCreatePlanDialogOpen(false);
    setIsPlanDirty(true);
  };


  const handleCreateMeal = () => {
    if (!newMealTitle.trim() || !selectedCycleId || !selectedPlanId) return;
    const tempId = `tmpm-${Date.now()}`;
    const newMeal: Meal = { id: tempId, dayId: selectedCycleId, meal: newMealTitle, foodItems: [] };
    
    // Update the plan's cycle with the new meal
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? {
            ...plan,
            cycles: plan.cycles?.map(cycle =>
              cycle.id === selectedCycleId
                ? {
                    ...cycle,
                    meals: [...(cycle.meals || []), newMeal]
                  }
                : cycle
            ) || []
          }
        : plan
    ));
    
    setSelectedMealId(tempId);
    setNewMealTitle('');
    setIsCreateMealDialogOpen(false);
    setIsPlanDirty(true);
  };

  const handleAddFoodToMeal = () => {
    if (!selectedFoodItems.length || !selectedMealId) return;
    const baseMeal = currentMeals.find((m) => m.id === selectedMealId);
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
    
    // Update the plan's meal with the new food items
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? {
            ...plan,
            cycles: plan.cycles?.map(cycle =>
              cycle.id === baseMeal.dayId
                ? {
                    ...cycle,
                    meals: cycle.meals?.map(meal =>
                      meal.id === baseMeal.id
                        ? { ...meal, foodItems: [...(meal.foodItems || []), ...added] }
                        : meal
                    ) || []
                  }
                : cycle
            ) || []
          }
        : plan
    ));
    
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
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      if (!selectedPlan) return;
      
      // Persist plan, cycles, meals, and food items
      // 1) Ensure plan exists on server
      let serverPlanId = selectedPlanId;
      if (selectedPlanId.startsWith('tmp-')) {
        const createPlanRes = await api.post(`/api/clients/${clientId}/nutrition/plans`, { title: selectedPlan.title });
        serverPlanId = createPlanRes.data.plan.id;
        // replace temp id
        setPlans((prev) => prev.map((p) => (p.id === selectedPlanId ? { ...p, id: serverPlanId } : p)));
      }

      // 2) Sync cycles
      const cyclesToSync = selectedPlan.cycles || [];
      const createdCycleIdMap: Record<string, string> = {};
      for (const c of cyclesToSync) {
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
      const createdMealIdMap: Record<string, string> = {};
      for (const cycle of cyclesToSync) {
        const effectiveCycleId = createdCycleIdMap[cycle.id] || cycle.id;
        for (const meal of cycle.meals || []) {
          let serverMealId = meal.id;
          if (meal.id.startsWith('tmpm-')) {
            const res = await api.post(`/api/clients/${clientId}/nutrition/cycles/${effectiveCycleId}/meals`, {
              title: meal.meal
            });
            serverMealId = res.data.meal.id;
            createdMealIdMap[meal.id] = serverMealId;
          }
        }
      }

      // 4) Sync food items for each meal
      for (const cycle of cyclesToSync) {
        const effectiveCycleId = createdCycleIdMap[cycle.id] || cycle.id;
        for (const meal of cycle.meals || []) {
          const effectiveMealId = createdMealIdMap[meal.id] || meal.id;
          for (const item of meal.foodItems || []) {
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
      }

      setIsPlanDirty(false);
      
      // Preserve the selected plan ID before reloading
      const preservedPlanId = serverPlanId;
      
      // Reload all plans data to get fresh server data
      await loadAllPlansData();
      
      // Ensure the saved plan remains selected
      setSelectedPlanId(preservedPlanId);
      
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
  const currentCycle = currentCycles[currentCycleIndex];
  const canGoPrevious = currentCycleIndex > 0;
  const canGoNext = currentCycleIndex < currentCycles.length - 1;
  
  const handlePreviousCycle = () => {
    if (canGoPrevious) {
      const newIndex = currentCycleIndex - 1;
      setCurrentCycleIndex(newIndex);
      setSelectedCycleId(currentCycles[newIndex].id);
      setSelectedMealId(null); // Reset meal selection
    }
  };
  
  const handleNextCycle = () => {
    if (canGoNext) {
      const newIndex = currentCycleIndex + 1;
      setCurrentCycleIndex(newIndex);
      setSelectedCycleId(currentCycles[newIndex].id);
      setSelectedMealId(null); // Reset meal selection
    }
  };
  
  const handleCopyCycle = async () => {
    if (!selectedCycleId || !selectedPlanId) return;
    const base = currentCycles[currentCycleIndex];
    if (!base) return;
    const newId = `tmpc-${Date.now()}`;
    const copy: Cycle = {
      id: newId,
      title: `${base.title} (Copy)`,
      label: `${base.label} (Copy)`,
      dayIndex: currentCycles.length + 1,
      meals: base.meals?.map(meal => ({
        ...meal,
        id: `tmpm-${Date.now()}-${Math.random()}`,
        dayId: newId
      })) || []
    };
    
    // Update the plan with the new cycle
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? { ...plan, cycles: [...(plan.cycles || []), copy] }
        : plan
    ));
    
    setCurrentCycleIndex(currentCycles.length);
    setSelectedCycleId(newId);
    setIsPlanDirty(true);
  };

  const handleDeleteCycle = () => {
    if (currentCycles.length <= 1 || !selectedCycleId || !selectedPlanId) return; // cannot delete last cycle
    
    // Update the plan by removing the cycle
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? {
            ...plan,
            cycles: plan.cycles?.filter((_, idx) => idx !== currentCycleIndex)
              .map((c, i) => ({ ...c, dayIndex: i + 1 })) || []
          }
        : plan
    ));
    
    const newIndex = Math.max(0, currentCycleIndex - 1);
    setCurrentCycleIndex(newIndex);
    setSelectedMealId(null);
    setIsPlanDirty(true);
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>Nutrition Maker</Typography>
          {selectedPlanId && isPlanDirty && (
            <Button
              variant="contained"
              size="large"
              onClick={handleSavePlan}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={20} /> : null}
              sx={{ 
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              {saving ? 'Saving...' : 'Save Plan'}
            </Button>
          )}
        </Box>
        <Chip label={`Client: ${clientId}`} variant="outlined" />
      </Box>

      {/* Main Content */}
      {isMobile ? (
        <MobileSwipeableSections
          sections={[
            // Section 1: Plans
            <Card key="plans" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                {selectedPlanId && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      try {
                        await api.post(`/api/nutrition/plans/${selectedPlanId}/activate`);
                        // Refresh plans list to reflect status change
                        await loadAllPlansData();
                        openSnackbar({ open: true, message: 'Plan activated', variant: 'alert', alert: { color: 'success' } });
                      } catch (e) {
                        openSnackbar({ open: true, message: 'Failed to activate plan', variant: 'alert', alert: { color: 'error' } });
                      }
                    }}
                  >
                    Activate
                  </Button>
                )}
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
                          // Only clear data if switching to a different plan
                          if (selectedPlanId !== plan.id) {
                            setSelectedPlanId(plan.id);
                            // On mobile, automatically move to section 2 (cycles) when plan is selected
                            if (isMobile) {
                              setMobileSection(1);
                            }
                          }
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
                              <Chip size="small" label={plan.status} color={plan.status === 'active' ? 'success' : plan.status === 'draft' ? 'default' : 'warning'} variant={plan.status === 'active' ? 'filled' : 'outlined'} />
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
        </Card>,
            
            // Section 2: Current Cycle & Meals
            <Card key="cycles" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6">Current Cycle & Meals</Typography>
                  {currentCycles.length > 1 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={handlePreviousCycle}
                        disabled={!canGoPrevious}
                      >
                        <ArrowLeft2 size={16} />
                      </IconButton>
                      <Typography variant="body2" color="text.secondary">
                        {currentCycleIndex + 1} of {currentCycles.length}
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
                    disabled={saving || currentCycles.length <= 1}
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
                    {currentMeals.map((meal) => (
                      <Grid item xs={12} key={meal.id}>
                        <Card
                          sx={{
                            border: selectedMealId === meal.id ? 2 : 1,
                            borderColor: selectedMealId === meal.id ? 'secondary.main' : 'divider',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedMealId(meal.id);
                            // On mobile, automatically move to section 3 (meal details) when meal is selected
                            if (isMobile) {
                              setMobileSection(2);
                            }
                          }}
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
          </Card>,
            
            // Section 3: Food Items
            <Card key="food-items" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
              {selectedMealId && currentMeals.find(m => m.id === selectedMealId) ? (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {currentMeals.find(m => m.id === selectedMealId)?.meal}
                  </Typography>
                  {currentMeals.find(m => m.id === selectedMealId)?.foodItems && currentMeals.find(m => m.id === selectedMealId)?.foodItems.length > 0 ? (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2">
                          {currentMeals.find(m => m.id === selectedMealId)?.foodItems.length} food item(s)
                        </Typography>
                      </Box>
                <List>
                        {currentMeals.find(m => m.id === selectedMealId)?.foodItems.map((item) => (
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
                                        setCurrentMeals((prev: Meal[]) => prev.map((m: Meal) => m.id !== (selectedMealId as string) ? m : {
                                          ...m,
                                          foodItems: m.foodItems.map((fi: MealFoodItem) => fi.id === item.id ? { ...fi, quantity: val } : fi)
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
          ]}
          activeSection={mobileSection}
          onSectionChange={setMobileSection}
        />
      ) : (
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
                  {selectedPlanId && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={async () => {
                        try {
                          await api.post(`/api/nutrition/plans/${selectedPlanId}/activate`);
                          await loadAllPlansData();
                          openSnackbar({ open: true, message: 'Plan activated', variant: 'alert', alert: { color: 'success' } });
                        } catch (e) {
                          openSnackbar({ open: true, message: 'Failed to activate plan', variant: 'alert', alert: { color: 'error' } });
                        }
                      }}
                    >
                      Activate
                    </Button>
                  )}
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
                            if (selectedPlanId !== plan.id) {
                              setSelectedPlanId(plan.id);
                            }
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
                            subheader={createdDate ? `Created: ${createdDate}` : undefined}
                            action={
                              plan.status && (
                                <Chip
                                  label={plan.status}
                                  color={plan.status === 'active' ? 'success' : 'default'}
                                  size="small"
                                />
                              )
                            }
                          />
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
                    {currentCycles.length > 1 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={handlePreviousCycle}
                          disabled={!canGoPrevious}
                        >
                          <ArrowLeft2 size={16} />
                        </IconButton>
                        <Typography variant="body2" color="text.secondary">
                          {currentCycleIndex + 1} / {currentCycles.length}
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
                      disabled={saving || currentCycles.length <= 1}
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
                    
                    <Grid container spacing={2} direction="column">
                      {currentMeals.map((meal) => (
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
                {selectedMealId && currentMeals.find(m => m.id === selectedMealId) ? (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      {currentMeals.find(m => m.id === selectedMealId)?.meal}
                    </Typography>
                    {currentMeals.find(m => m.id === selectedMealId)?.foodItems && currentMeals.find(m => m.id === selectedMealId)?.foodItems.length! > 0 ? (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle2">
                            {currentMeals.find(m => m.id === selectedMealId)?.foodItems.length} food item(s)
                          </Typography>
                        </Box>
                        <List>
                          {currentMeals.find(m => m.id === selectedMealId)?.foodItems.map((item) => (
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
                                          setCurrentMeals((prev) => prev.map((m) => m.id !== (selectedMealId as string) ? m : {
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
      )}

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
    </Stack>
  );
}
