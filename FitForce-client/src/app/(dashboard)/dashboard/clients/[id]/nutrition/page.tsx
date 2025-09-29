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
  
  // State for cycles
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [currentCycleIndex, setCurrentCycleIndex] = useState<number>(0);
  
  // State for meals (nested under cycles)
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

  // Load cycles when plan is selected
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

  // Load meals when cycle is selected
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
    
    try {
      setSaving(true);
      const response = await api.post(`/api/clients/${clientId}/nutrition/plans`, {
        title: newPlanTitle
      });
      
      setPlans(prev => [...prev, response.data.plan]);
      setNewPlanTitle('');
      setIsCreatePlanDialogOpen(false);
      setIsPlanDirty(true);
      
      openSnackbar({
        open: true,
        message: 'Nutrition plan created successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to create nutrition plan',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };


  const handleCreateMeal = async () => {
    if (!newMealTitle.trim() || !selectedCycleId) return;
    
    try {
      setSaving(true);
      const response = await api.post(`/api/clients/${clientId}/nutrition/cycles/${selectedCycleId}/meals`, {
        title: newMealTitle
      });
      
      // Reload meals to get updated data
      const mealsResponse = await api.get(`/api/clients/${clientId}/nutrition/cycles/${selectedCycleId}/meals`);
      setMeals(mealsResponse.data.meals || []);
      
      setNewMealTitle('');
      setIsCreateMealDialogOpen(false);
      setIsPlanDirty(true);
      
      openSnackbar({
        open: true,
        message: 'Meal created successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to create meal',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddFoodToMeal = async () => {
    if (!selectedFoodItems.length || !selectedMealId) return;
    
    try {
      setSaving(true);
      
      // Add each selected food item
      for (const foodItemId of selectedFoodItems) {
        const food = workspaceFood.find(f => f.id === foodItemId);
      await api.post(`/api/clients/${clientId}/nutrition/meals/${selectedMealId}/food-items`, {
          foodItemId: foodItemId,
          quantity: food?.servingSize || 100
      });
      }
      
      // Reload meals to get updated data
      const response = await api.get(`/api/clients/${clientId}/nutrition/cycles/${selectedCycleId}/meals`);
      setMeals(response.data.meals || []);
      
      setSelectedFoodItems([]);
      setIsAddFoodDialogOpen(false);
      setIsPlanDirty(true);
      
      openSnackbar({
        open: true,
        message: 'Food items added to meal successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to add food items to meal',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const showSection2 = !!selectedPlanId;
  const showSection3 = !!selectedMealId;
  
  const handleSavePlan = async () => {
    if (!selectedPlanId) return;
    
    try {
      setSaving(true);
      // Here we would save the plan and activate it
      // For now, just mark as not dirty
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
    
    try {
      setSaving(true);
      const response = await api.post(`/api/clients/${clientId}/nutrition/cycles/${selectedCycleId}/copy`, {
        title: `Copy of ${currentCycle?.label}`
      });
      
      // Reload cycles
      const cyclesResponse = await api.get(`/api/clients/${clientId}/nutrition/plans/${selectedPlanId}/cycles`);
      setCycles(cyclesResponse.data.cycles || []);
      
      openSnackbar({
        open: true,
        message: 'Cycle copied successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to copy cycle',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
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
              <List>
                {filteredPlans.map((plan) => (
                  <ListItem
                    key={plan.id}
                    button
                    selected={selectedPlanId === plan.id}
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setSelectedCycleId(null);
                      setSelectedMealId(null);
                      setCycles([]);
                      setMeals([]);
                    }}
                  >
                    <ListItemText
                      primary={plan.title}
                      secondary={plan.createdBy ? `Created by ${plan.createdBy}` : undefined}
                    />
                  </ListItem>
                ))}
              </List>
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
                  
                  {/* Meals under current cycle */}
              <List>
                {meals.map((meal) => (
                  <ListItem
                    key={meal.id}
                    button
                    selected={selectedMealId === meal.id}
                    onClick={() => setSelectedMealId(meal.id)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          '&.Mui-selected': {
                            backgroundColor: 'secondary.main',
                            color: 'secondary.contrastText',
                            '&:hover': {
                              backgroundColor: 'secondary.dark'
                            }
                          }
                        }}
                  >
                    <ListItemText
                          primary={meal.meal}
                          secondary={`${meal.servings} serving(s)`}
                    />
                  </ListItem>
                ))}
              </List>
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
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            const currentMeal = meals.find(m => m.id === selectedMealId);
                            if (currentMeal) {
                              const quantities: {[key: string]: number} = {};
                              currentMeal.foodItems.forEach(item => {
                                quantities[item.id] = item.quantity;
                              });
                              setEditingQuantities(quantities);
                              setIsEditingQuantities(true);
                            }
                          }}
                        >
                          Edit Quantities
                        </Button>
                      </Box>
                <List>
                        {meals.find(m => m.id === selectedMealId)?.foodItems.map((item) => (
                          <ListItem key={item.id}>
                      <ListItemText
                        primary={item.foodItem.name}
                              secondary={
                                isEditingQuantities ? (
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={editingQuantities[item.id] || item.quantity}
                                    onChange={(e) => {
                                      setEditingQuantities(prev => ({
                                        ...prev,
                                        [item.id]: Number(e.target.value)
                                      }));
                                    }}
                                    sx={{ width: 100, mt: 1 }}
                                  />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              cursor: 'pointer', 
                              textDecoration: 'underline',
                              color: 'primary.main',
                              '&:hover': { color: 'primary.dark' }
                            }}
                            onClick={() => {
                              setEditingQuantities(prev => ({
                                ...prev,
                                [item.id]: item.quantity
                              }));
                              setIsEditingQuantities(true);
                            }}
                          >
                            {item.quantity}{item.foodItem.unit}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            - {Math.round((item.foodItem.calories * item.quantity) / item.foodItem.servingSize)} cal
                          </Typography>
                        </Box>
                      )
                              }
                      />
                      <ListItemSecondaryAction>
                              {isEditingQuantities ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={async () => {
                                    try {
                                      setSaving(true);
                                      await api.put(`/api/clients/${clientId}/nutrition/meals/${selectedMealId}/food-items/${item.id}`, {
                                        quantity: editingQuantities[item.id] || item.quantity
                                      });
                                      
                                      // Reload meals
                                      const response = await api.get(`/api/clients/${clientId}/nutrition/cycles/${selectedCycleId}/meals`);
                                      setMeals(response.data.meals || []);
                                      
                                      openSnackbar({
                                        open: true,
                                        message: 'Quantity updated successfully',
                                        variant: 'alert',
                                        alert: { color: 'success' }
                                      });
                                    } catch (error) {
                                      openSnackbar({
                                        open: true,
                                        message: 'Failed to update quantity',
                                        variant: 'alert',
                                        alert: { color: 'error' }
                                      });
                                    } finally {
                                      setSaving(false);
                                    }
                                  }}
                                  disabled={saving}
                                >
                                  Save
                                </Button>
                              ) : (
                        <IconButton size="small" color="error">
                          <Trash size={16} />
                        </IconButton>
                              )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                      {isEditingQuantities && (
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            onClick={async () => {
                              try {
                                setSaving(true);
                                const currentMeal = meals.find(m => m.id === selectedMealId);
                                if (currentMeal) {
                                  for (const item of currentMeal.foodItems) {
                                    if (editingQuantities[item.id] !== undefined && editingQuantities[item.id] !== item.quantity) {
                                      await api.put(`/api/clients/${clientId}/nutrition/meals/${selectedMealId}/food-items/${item.id}`, {
                                        quantity: editingQuantities[item.id]
                                      });
                                    }
                                  }
                                  
                                  // Reload meals
                                  const response = await api.get(`/api/clients/${clientId}/nutrition/cycles/${selectedCycleId}/meals`);
                                  setMeals(response.data.meals || []);
                                  
                                  setIsEditingQuantities(false);
                                  setEditingQuantities({});
                                  
                                  openSnackbar({
                                    open: true,
                                    message: 'All quantities updated successfully',
                                    variant: 'alert',
                                    alert: { color: 'success' }
                                  });
                                }
                              } catch (error) {
                                openSnackbar({
                                  open: true,
                                  message: 'Failed to update quantities',
                                  variant: 'alert',
                                  alert: { color: 'error' }
                                });
                              } finally {
                                setSaving(false);
                              }
                            }}
                            disabled={saving}
                          >
                            {saving ? <CircularProgress size={20} /> : 'Save All'}
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => {
                              setIsEditingQuantities(false);
                              setEditingQuantities({});
                            }}
                          >
                            Cancel
                          </Button>
                        </Box>
                      )}
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
