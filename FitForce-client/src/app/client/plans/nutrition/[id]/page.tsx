'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { useWorkspaceBranding } from '@/hooks/useWorkspaceBranding';
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
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip
} from '@mui/material';
import { 
  Restaurant, 
  ArrowBack,
  LocalFireDepartment,
  Opacity,
  FitnessCenter,
  Info
} from '@mui/icons-material';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = { ar, en };

export default function ClientNutritionPlanDetail() {
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const isArabic = currentLang === 'ar';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { logoUrl, primaryColor, workspaceName } = useWorkspaceBranding();

  // State for micros dialog
  const [microsDialogOpen, setMicrosDialogOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

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
          <Typography color="text.secondary" variant="h6">{t('client.nutrition.loading')}</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !data?.plan) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {t('client.nutrition.loadError')}
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
        const serving = Number(fi.foodItem?.servingSize ?? 100) || 100;
        const factor = serving > 0 ? (Number(fi.quantity ?? 0) / serving) : 0;
        totalCalories += (fi.foodItem?.calories || 0) * factor;
        totalProtein += (fi.foodItem?.protein || 0) * factor;
        totalCarbs += (fi.foodItem?.carbs || 0) * factor;
        totalFat += (fi.foodItem?.fat || 0) * factor;
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
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}CC 100%)`,
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
          {logoUrl ? (
            <Box sx={{ width: 56, height: 56, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={`${workspaceName} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </Box>
          ) : (
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              <Restaurant sx={{ fontSize: 32 }} />
            </Avatar>
          )}
          <Box flex={1}>
            <Typography variant="h4" fontWeight={700}>
              {(isArabic && (plan.plan as any).titleArabic) || plan.plan.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
              {t('client.nutrition.subtitle')}
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
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('client.nutrition.dailyWater')}</Typography>
                  <Typography variant="h6" fontWeight={700}>{plan.plan.waterForDay}L</Typography>
                </Box>
              </Paper>
            )}
            {plan.plan.waterForTraining && (
              <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FitnessCenter />
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('client.nutrition.trainingWater')}</Typography>
                  <Typography variant="h6" fontWeight={700}>{plan.plan.waterForTraining}L</Typography>
                </Box>
              </Paper>
            )}
            <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Restaurant />
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('client.nutrition.totalDays')}</Typography>
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
                    {day.label || `${t('client.nutrition.day')} ${day.dayIndex + 1}`}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip 
                      icon={<LocalFireDepartment />}
                      label={`${dayTotals.calories} kcal`} 
                      color="error" 
                      size="small"
                    />
                    <Chip label={`${day.meals?.length || 0} ${t('client.nutrition.meals')}`} variant="outlined" size="small" />
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
                    {t('client.nutrition.dailySummary')}
                    <Tooltip title={t('client.nutrition.viewMicros')} arrow>
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          setSelectedDayIndex(idx);
                          setMicrosDialogOpen(true);
                        }}
                        sx={{ ml: 1 }}
                      >
                        <Info fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700} color="error.main">
                          {dayTotals.calories}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{t('calories')}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700} color="info.main">
                          {dayTotals.protein}g
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{t('protein')}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700} color="warning.main">
                          {dayTotals.carbs}g
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{t('carbs')}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={700} color="success.main">
                          {dayTotals.fat}g
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{t('fat')}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>

                <Divider sx={{ mb: 3 }} />

                {/* Meals */}
                <Grid container spacing={3}>
                  {day.meals?.map((meal, mealIdx) => {
                    const mealTotals = {
                      calories: Math.round((meal.foodItems?.reduce((sum, fi) => {
                        const serving = Number(fi.foodItem?.servingSize ?? 100) || 100;
                        const factor = serving > 0 ? (Number(fi.quantity ?? 0) / serving) : 0;
                        return sum + (fi.foodItem?.calories || 0) * factor;
                      }, 0) || 0)),
                      protein: Math.round((meal.foodItems?.reduce((sum, fi) => {
                        const serving = Number(fi.foodItem?.servingSize ?? 100) || 100;
                        const factor = serving > 0 ? (Number(fi.quantity ?? 0) / serving) : 0;
                        return sum + (fi.foodItem?.protein || 0) * factor;
                      }, 0) || 0)),
                      carbs: Math.round((meal.foodItems?.reduce((sum, fi) => {
                        const serving = Number(fi.foodItem?.servingSize ?? 100) || 100;
                        const factor = serving > 0 ? (Number(fi.quantity ?? 0) / serving) : 0;
                        return sum + (fi.foodItem?.carbs || 0) * factor;
                      }, 0) || 0)),
                      fat: Math.round((meal.foodItems?.reduce((sum, fi) => {
                        const serving = Number(fi.foodItem?.servingSize ?? 100) || 100;
                        const factor = serving > 0 ? (Number(fi.quantity ?? 0) / serving) : 0;
                        return sum + (fi.foodItem?.fat || 0) * factor;
                      }, 0) || 0))
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
                                {meal.meal || `${t('client.nutrition.meal')} ${mealIdx + 1}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {mealTotals.calories} {t('kcal')} • {t('protein-short')} {mealTotals.protein}g • {t('carbs-short')} {mealTotals.carbs}g • {t('fat-short')} {mealTotals.fat}g
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
                                    <TableCell><strong>{t('client.nutrition.food')}</strong></TableCell>
                                    <TableCell align="center"><strong>{t('qty')}</strong></TableCell>
                                    <TableCell align="right"><strong>{t('cal-short')}</strong></TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {meal.foodItems.map((fi, fiIdx) => (
                                    <TableRow key={fiIdx} hover>
                                      <TableCell>{(isArabic && fi.foodItem?.nameArabic) || fi.foodItem?.name || t('unknown')}</TableCell>
                                      <TableCell align="center">
                                        <Chip label={fi.quantity} size="small" variant="outlined" />
                                      </TableCell>
                                      <TableCell align="right">
                                        {Math.round((fi.foodItem?.calories || 0) * ((Number(fi.quantity ?? 0)) / (Number(fi.foodItem?.servingSize ?? 100) || 100)))}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}

                          {(!meal.foodItems || meal.foodItems.length === 0) && (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                              {t('client.nutrition.noFoodItems')}
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
                    <Typography color="text.secondary">{t('client.nutrition.noMeals')}</Typography>
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
              {t('client.nutrition.noPlan')}
            </Typography>
          </Box>
        </Card>
      )}

      {/* Micronutrients Dialog */}
      <Dialog 
        open={microsDialogOpen} 
        onClose={() => setMicrosDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Info />
            <Typography variant="h6">
              {t('client.nutrition.microsTitle')} - {plan.cycles?.[selectedDayIndex]?.label || `${t('client.nutrition.day')} ${selectedDayIndex + 1}`}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {plan.cycles?.[selectedDayIndex] && (() => {
            const selectedDay = plan.cycles[selectedDayIndex];
            
            // Calculate micronutrients for the selected day (prefer server-provided totals)
            const microTotals: Record<string, number> = {};
            const add = (k: string, v: number) => {
              microTotals[k] = (microTotals[k] || 0) + v;
            };
            
            const nutrientKeys = [
              "water","ash","fiber","sodium","potassium","calcium","phosphorous","magnesium","iron","zinc","copper","manganese","fluoride","selenium",
              "vitamin_a","vitamin_c","vitamin_b1","vitamin_b2","vitamin_b5","vitamin_b6","vitamin_b12","vitamin_d","vitamin_e","vitamin_k",
              "niacin","folic_acid","choline","betaine"
            ];
            
            for (const meal of selectedDay.meals || []) {
              for (const fi of meal.foodItems || []) {
                const qty = Number(fi.quantity ?? 1);
                const f: any = fi.foodItem || {};
                for (const key of nutrientKeys) {
                  const base = Number(f[key] ?? 0);
                  if (!isNaN(base)) add(key, base * qty);
                }
              }
            }
            
            const labels: Record<string, string> = {
              water: "Water (g)",
              ash: "Ash (g)",
              fiber: "Fiber (g)",
              sodium: "Sodium (mg)",
              potassium: "Potassium (mg)",
              calcium: "Calcium (mg)",
              phosphorous: "Phosphorous (mg)",
              magnesium: "Magnesium (mg)",
              iron: "Iron (mg)",
              zinc: "Zinc (mg)",
              copper: "Copper (mg)",
              manganese: "Manganese (mg)",
              fluoride: "Fluoride (mg)",
              selenium: "Selenium (mg)",
              vitamin_a: "Vitamin A (IU)",
              vitamin_c: "Vitamin C (mg)",
              vitamin_b1: "Vitamin B1 (mg)",
              vitamin_b2: "Vitamin B2 (mg)",
              vitamin_b5: "Vitamin B5 (mg)",
              vitamin_b6: "Vitamin B6 (mg)",
              vitamin_b12: "Vitamin B12 (mg)",
              vitamin_d: "Vitamin D (IU)",
              vitamin_e: "Vitamin E (mg)",
              vitamin_k: "Vitamin K (mg)",
              niacin: "Niacin (mg)",
              folic_acid: "Folic Acid (mg)",
              choline: "Choline (mg)",
              betaine: "Betaine (mg)"
            };
            
            const order = [
              "water","ash","fiber","sodium","potassium","calcium","phosphorous","magnesium","iron","zinc","copper","manganese","fluoride","selenium",
              "vitamin_a","vitamin_c","vitamin_b1","vitamin_b2","vitamin_b5","vitamin_b6","vitamin_b12","vitamin_d","vitamin_e","vitamin_k",
              "niacin","folic_acid","choline","betaine"
            ];
            
            // If server provided microTotals on the day, use it directly
            const serverTotals = (selectedDay as any).microTotals as Record<string, number> | undefined;
            const microEntries = serverTotals
              ? order.map((k) => [k, Number(serverTotals[k] ?? 0)] as [string, number])
              : order.map((k) => [k, Number(microTotals[k] ?? 0)] as [string, number]);
            
            return (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {t('client.nutrition.microsNote')}
                </Typography>
                <Grid container spacing={2}>
                  {microEntries.map(([key, val]) => (
                    <Grid key={key} item xs={6} sm={4} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 1,
                        textAlign: 'center',
                        bgcolor: 'background.paper'
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {labels[key] || key.replace(/_/g, ' ')}
                        </Typography>
                        <Typography variant="h6" color="primary.main">
                          {Math.round(val * 100) / 100}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMicrosDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
