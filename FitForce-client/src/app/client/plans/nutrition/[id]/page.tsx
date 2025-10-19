'use client';

import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Stack, 
  CircularProgress, 
  Divider,
  Paper,
  Grid,
  Chip,
  Avatar,
  IconButton,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { 
  Restaurant, 
  ArrowBack,
  LocalFireDepartment,
  Opacity,
  FitnessCenter
} from '@mui/icons-material';

export default function ClientNutritionPlanDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data, isLoading, error } = useSWR(() => (id ? `client-nutrition-plan-${id}` : null), async () => {
    // Get plan with cycles/items
    const wsRes = await api.get('/api/clients/profile');
    const workspaceId = wsRes.data?.workspace?.id;
    const res = await api.get(`/api/nutrition/plans/${id}/cycles`, { 
      headers: workspaceId ? { 'x-workspace-id': workspaceId } : {} 
    });
    const planData = res.data;
    return { plan: planData } as { 
      plan: { 
        plan: { 
          id: string; 
          title: string; 
          waterForDay?: number; 
          waterForTraining?: number 
        }; 
        cycles: Array<{ 
          dayIndex: number; 
          label?: string; 
          meals: Array<{ 
            meal?: string; 
            foodItems?: Array<{ 
              quantity: number; 
              foodItem: any 
            }>; 
            recipeName?: string; 
            recipeNameArabic?: string; 
            recipeImageUrl?: string 
          }> 
        }> 
      } 
    };
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, minHeight: '60vh' }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} />
          <Typography color="text.secondary" variant="h6">Loading nutrition plan…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !data?.plan) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Failed to load nutrition plan. Please try again later.
        </Alert>
      </Box>
    );
  }

  const { plan } = data;
  const totalDays = plan.cycles?.length || 0;

  // Calculate total daily nutrition across all meals for each day
  const getDayTotals = (day: typeof plan.cycles[0]) => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    day.meals?.forEach(meal => {
      meal.foodItems?.forEach(fi => {
        totalCalories += (fi.foodItem?.calories || 0) * fi.quantity;
        totalProtein += (fi.foodItem?.protein || 0) * fi.quantity;
        totalCarbs += (fi.foodItem?.carbs || 0) * fi.quantity;
        totalFat += (fi.foodItem?.fat || 0) * fi.quantity;
      });
    });

    return {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat)
    };
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          color: 'white'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <IconButton 
            onClick={() => router.back()}
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.2)', 
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' },
              color: 'white'
            }}
          >
            <ArrowBack />
          </IconButton>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
            <Restaurant sx={{ fontSize: 32 }} />
          </Avatar>
          <Box flex={1}>
            <Typography variant="h4" fontWeight={700}>
              {plan.plan.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
              Complete nutrition plan for your goals
            </Typography>
          </Box>
        </Stack>

        {/* Water Intake Info */}
        {(plan.plan.waterForDay || plan.plan.waterForTraining) && (
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {plan.plan.waterForDay && (
              <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Opacity />
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Daily Water</Typography>
                  <Typography variant="h6" fontWeight={700}>{plan.plan.waterForDay}L</Typography>
                </Box>
              </Paper>
            )}
            {plan.plan.waterForTraining && (
              <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FitnessCenter />
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Training Water</Typography>
                  <Typography variant="h6" fontWeight={700}>{plan.plan.waterForTraining}L</Typography>
                </Box>
              </Paper>
            )}
            <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Restaurant />
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Total Days</Typography>
                <Typography variant="h6" fontWeight={700}>{totalDays}</Typography>
              </Box>
            </Paper>
          </Stack>
        )}
      </Paper>

      {/* Days/Cycles */}
      <Stack spacing={3}>
        {plan.cycles?.map((day, idx) => {
          const dayTotals = getDayTotals(day);
          
          return (
            <Card key={idx} sx={{ borderRadius: 3, overflow: 'visible' }}>
              <CardContent>
                {/* Day Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h5" fontWeight={700}>
                    {day.label || `Day ${day.dayIndex + 1}`}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip 
                      icon={<LocalFireDepartment />}
                      label={`${dayTotals.calories} kcal`} 
                      color="error" 
                      size="small"
                    />
                    <Chip label={`${day.meals?.length || 0} Meals`} variant="outlined" size="small" />
                  </Stack>
                </Stack>

                {/* Daily Macros Summary */}
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 2, 
                    mb: 3, 
                    borderRadius: 2,
                    bgcolor: 'primary.50',
                    border: '1px solid',
                    borderColor: 'primary.200'
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} color="primary.main" gutterBottom>
                    Daily Nutrition Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700} color="error.main">
                          {dayTotals.calories}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Calories</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700} color="info.main">
                          {dayTotals.protein}g
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Protein</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700} color="warning.main">
                          {dayTotals.carbs}g
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Carbs</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700} color="success.main">
                          {dayTotals.fat}g
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Fat</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>

                <Divider sx={{ mb: 3 }} />

                {/* Meals */}
                <Grid container spacing={3}>
                  {day.meals?.map((meal, mealIdx) => {
                    const mealTotals = {
                      calories: Math.round(meal.foodItems?.reduce((sum, fi) => sum + (fi.foodItem?.calories || 0) * fi.quantity, 0) || 0),
                      protein: Math.round(meal.foodItems?.reduce((sum, fi) => sum + (fi.foodItem?.protein || 0) * fi.quantity, 0) || 0),
                      carbs: Math.round(meal.foodItems?.reduce((sum, fi) => sum + (fi.foodItem?.carbs || 0) * fi.quantity, 0) || 0),
                      fat: Math.round(meal.foodItems?.reduce((sum, fi) => sum + (fi.foodItem?.fat || 0) * fi.quantity, 0) || 0)
                    };

                    return (
                      <Grid key={mealIdx} item xs={12} md={6}>
                        <Paper 
                          elevation={2}
                          sx={{ 
                            p: 2.5, 
                            borderRadius: 3,
                            height: '100%',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 6
                            }
                          }}
                        >
                          {/* Meal Header */}
                          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                            <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}>
                              <Restaurant />
                            </Avatar>
                            <Box flex={1}>
                              <Typography variant="h6" fontWeight={700}>
                                {meal.meal || `Meal ${mealIdx + 1}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {mealTotals.calories} kcal • P {mealTotals.protein}g • C {mealTotals.carbs}g • F {mealTotals.fat}g
                              </Typography>
                            </Box>
                          </Stack>

                          {/* Recipe Image */}
                          {meal.recipeImageUrl && (
                            <Box
                              sx={{
                                width: '100%',
                                height: 150,
                                backgroundImage: `url(${meal.recipeImageUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                borderRadius: 2,
                                mb: 2,
                                border: '2px solid',
                                borderColor: 'divider'
                              }}
                            />
                          )}

                          {/* Recipe Name */}
                          {meal.recipeName && (
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, color: 'primary.main' }}>
                              📋 {meal.recipeName}
                            </Typography>
                          )}

                          {/* Food Items Table */}
                          {meal.foodItems && meal.foodItems.length > 0 && (
                            <TableContainer>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell><strong>Food</strong></TableCell>
                                    <TableCell align="center"><strong>Qty</strong></TableCell>
                                    <TableCell align="right"><strong>Cal</strong></TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {meal.foodItems.map((fi, fiIdx) => (
                                    <TableRow key={fiIdx} hover>
                                      <TableCell>{fi.foodItem?.name || 'Unknown'}</TableCell>
                                      <TableCell align="center">
                                        <Chip label={fi.quantity} size="small" variant="outlined" />
                                      </TableCell>
                                      <TableCell align="right">
                                        {Math.round((fi.foodItem?.calories || 0) * fi.quantity)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}

                          {(!meal.foodItems || meal.foodItems.length === 0) && (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                              No food items specified
                            </Typography>
                          )}
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>

                {day.meals?.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Restaurant sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No meals for this day.</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {plan.cycles?.length === 0 && (
        <Card sx={{ borderRadius: 3 }}>
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Restaurant sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No nutrition plan data available
            </Typography>
          </Box>
        </Card>
      )}
    </Box>
  );
}
