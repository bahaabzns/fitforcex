'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Chip as MuiChip,
  Button
} from '@mui/material';
import {
  Restaurant,
  ArrowBack,
  LocalFireDepartment,
  Opacity,
  FitnessCenter,
  EmojiFoodBeverage,
  Grain,
  Bento,
  EmojiNature,
  Close as CloseIcon,
  Refresh
} from '@mui/icons-material';
import { Refresh as RefreshIcon } from '@wandersonalwes/iconsax-react';
import useConfig from '@/hooks/useConfig';
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';
import ClientReplacementRequestDialog from '@/components/ClientReplacementRequestDialog';

const translations: Record<string, Record<string, string>> = { ar, en };

const nutrientKeys = [
  'water',
  'ash',
  'fiber',
  'sodium',
  'potassium',
  'calcium',
  'phosphorous',
  'magnesium',
  'iron',
  'zinc',
  'copper',
  'manganese',
  'fluoride',
  'selenium',
  'vitamin_a',
  'vitamin_c',
  'vitamin_b1',
  'vitamin_b2',
  'vitamin_b5',
  'vitamin_b6',
  'vitamin_b12',
  'vitamin_d',
  'vitamin_e',
  'vitamin_k',
  'niacin',
  'folic_acid',
  'choline',
  'betaine'
] as const;

const nutrientLabels: Record<string, string> = {
  water: 'Water (g)',
  ash: 'Ash (g)',
  fiber: 'Fiber (g)',
  sodium: 'Sodium (mg)',
  potassium: 'Potassium (mg)',
  calcium: 'Calcium (mg)',
  phosphorous: 'Phosphorous (mg)',
  magnesium: 'Magnesium (mg)',
  iron: 'Iron (mg)',
  zinc: 'Zinc (mg)',
  copper: 'Copper (mg)',
  manganese: 'Manganese (mg)',
  fluoride: 'Fluoride (mg)',
  selenium: 'Selenium (mg)',
  vitamin_a: 'Vitamin A (IU)',
  vitamin_c: 'Vitamin C (mg)',
  vitamin_b1: 'Vitamin B1 (mg)',
  vitamin_b2: 'Vitamin B2 (mg)',
  vitamin_b5: 'Vitamin B5 (mg)',
  vitamin_b6: 'Vitamin B6 (mg)',
  vitamin_b12: 'Vitamin B12 (mg)',
  vitamin_d: 'Vitamin D (IU)',
  vitamin_e: 'Vitamin E (mg)',
  vitamin_k: 'Vitamin K (mg)',
  niacin: 'Niacin (mg)',
  folic_acid: 'Folic Acid (mg)',
  choline: 'Choline (mg)',
  betaine: 'Betaine (mg)'
};

type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type SelectedEntity =
  | { type: 'cycle'; dayIndex: number }
  | { type: 'meal'; dayIndex: number; mealIndex: number }
  | { type: 'food'; dayIndex: number; mealIndex: number; foodIndex: number };

const formatMacro = (value: number, suffix = 'g') => `${Math.round(value)}${suffix}`;

export default function ClientNutritionPlanDetail() {
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  const isArabic = currentLang === 'ar';
  const t = (key: string): string => translations[currentLang]?.[key] || translations['en'][key] || key;
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { logoUrl, primaryColor, workspaceName } = useWorkspaceBranding();

  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestingFoodItem, setRequestingFoodItem] = useState<{ foodItem: any; mealId: string } | null>(null);

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
            id?: string;
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

  const planData = data?.plan;
  const cycles = planData?.cycles || [];
  const totalDays = cycles.length;

  useEffect(() => {
    if (!cycles.length) {
      if (selectedEntity) {
        setSelectedEntity(null);
      }
      return;
    }

    const isEntityValid =
      selectedEntity &&
      selectedEntity.dayIndex >= 0 &&
      selectedEntity.dayIndex < cycles.length;

    if (!isEntityValid && selectedEntity) {
      setSelectedEntity(null);
    }
  }, [cycles, selectedEntity]);

  // Calculate total daily nutrition across all meals for each day
  const getDayTotals = (day: (typeof cycles)[number]) => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    day?.meals?.forEach((meal) => {
      meal.foodItems?.forEach((fi) => {
        const serving = Number(fi.foodItem?.servingSize ?? 100) || 100;
        const factor = serving > 0 ? Number(fi.quantity ?? 0) / serving : 0;
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

  const calculateFoodItemMacros = (fi: { quantity: number; foodItem: any }): MacroTotals => {
    const serving = Number(fi.foodItem?.servingSize ?? 100) || 100;
    const factor = serving > 0 ? Number(fi.quantity ?? 0) / serving : 0;
    return {
      calories: (fi.foodItem?.calories || 0) * factor,
      protein: (fi.foodItem?.protein || 0) * factor,
      carbs: (fi.foodItem?.carbs || 0) * factor,
      fat: (fi.foodItem?.fat || 0) * factor
    };
  };

  const aggregateMacros = (items: MacroTotals[]): MacroTotals => {
    return items.reduce(
      (totals, current) => ({
        calories: totals.calories + current.calories,
        protein: totals.protein + current.protein,
        carbs: totals.carbs + current.carbs,
        fat: totals.fat + current.fat
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const calculateMealMacros = (meal: any): MacroTotals => {
    const itemTotals = (meal.foodItems || []).map(calculateFoodItemMacros);
    return aggregateMacros(itemTotals);
  };

  const calculateCycleMacros = (day: any): MacroTotals => {
    const mealTotals = (day.meals || []).map(calculateMealMacros);
    return aggregateMacros(mealTotals);
  };

  const calculateMicros = (entity: SelectedEntity | null) => {
    if (!entity) return [];
    const day = cycles[entity.dayIndex];
    if (!day) return [];

    const formatEntries = (totals: Record<string, number> = {}) =>
      nutrientKeys
        .map((key) => ({
          key,
          label: nutrientLabels[key] || key.replace(/_/g, ' '),
          value: Math.round((Number(totals[key]) || 0) * 100) / 100
        }))
        .filter((entry) => entry.value > 0);

    if (entity.type === 'cycle' && day.microTotals) {
      const entries = formatEntries(day.microTotals);
      if (entries.length) return entries;
    }

    const microTotals: Record<string, number> = {};
    const accumulate = (foodItem: any, quantity: number) => {
      const qty = Number(quantity ?? 0);
      if (!qty) return;
      nutrientKeys.forEach((key) => {
        const base = Number(foodItem?.[key] ?? 0);
        if (!base) return;
        microTotals[key] = (microTotals[key] || 0) + base * (qty / 100);
      });
    };

    const addMealItems = (meal?: any) => {
      meal?.foodItems?.forEach((fi: any) => accumulate(fi.foodItem || {}, fi.quantity));
    };

    if (entity.type === 'cycle') {
      (day.meals || []).forEach(addMealItems);
    } else if (entity.type === 'meal') {
      addMealItems(day.meals?.[entity.mealIndex]);
    } else if (entity.type === 'food') {
      const meal = day.meals?.[entity.mealIndex];
      const food = meal?.foodItems?.[entity.foodIndex];
      if (food) accumulate(food.foodItem || {}, food.quantity);
    }

    return formatEntries(microTotals);
  };

  const selectedSummary = useMemo(() => {
    if (!cycles.length || !selectedEntity) return null;
    const day = cycles[selectedEntity.dayIndex];
    if (!day) return null;

    if (selectedEntity.type === 'cycle') {
      return {
        title: day.label || `${t('client.nutrition.day')} ${day.dayIndex + 1}`,
        subtitle: t('client.nutrition.dailySummary'),
        macros: calculateCycleMacros(day),
        micros: calculateMicros(selectedEntity),
        icon: <Bento sx={{ fontSize: 32 }} color="primary" />
      };
    }

    if (selectedEntity.type === 'meal') {
      const meal = day.meals?.[selectedEntity.mealIndex];
      if (!meal) return null;
      return {
        title: meal.meal || `${t('client.nutrition.meal')} ${selectedEntity.mealIndex + 1}`,
        subtitle: t('client.nutrition.mealSummary'),
        macros: calculateMealMacros(meal),
        micros: calculateMicros(selectedEntity),
        icon: <Restaurant sx={{ fontSize: 32 }} color="success" />
      };
    }

    const meal = day.meals?.[selectedEntity.mealIndex];
    const food = meal?.foodItems?.[selectedEntity.foodIndex];
    if (!food) return null;
    return {
      title: (isArabic && food.foodItem?.nameArabic) || food.foodItem?.name || t('client.nutrition.food'),
      subtitle: t('client.nutrition.foodSummary'),
      macros: calculateFoodItemMacros(food),
      micros: calculateMicros(selectedEntity),
      icon: <EmojiNature sx={{ fontSize: 32 }} color="warning" />
    };
  }, [cycles, selectedEntity, isArabic, t]);

  const showDetailsPanel = Boolean(selectedSummary);

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

  if (error || !planData) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {t('client.nutrition.loadError')}
        </Alert>
      </Box>
    );
  }


  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', bgcolor: 'background.default' }}>
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
        {(isArabic && (planData.plan as any).titleArabic) || planData.plan.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mt: 0.5 }}>
              {t('client.nutrition.subtitle')}
            </Typography>
          </Box>
        </Stack>

        {/* Water Intake Info */}
        {(planData.plan.waterForDay || planData.plan.waterForTraining) && (
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {planData.plan.waterForDay && (
              <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Opacity />
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('client.nutrition.dailyWater')}</Typography>
                  <Typography variant="h6" fontWeight={700}>{planData.plan.waterForDay}L</Typography>
                </Box>
              </Paper>
            )}
            {planData.plan.waterForTraining && (
              <Paper sx={{ px: 2, py: 1, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FitnessCenter />
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>{t('client.nutrition.trainingWater')}</Typography>
                  <Typography variant="h6" fontWeight={700}>{planData.plan.waterForTraining}L</Typography>
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

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'flex-start',
          gap: { xs: 3, md: 4 }
        }}
      >
        <Box sx={{ flexGrow: 1, width: '100%' }}>
          <Stack spacing={3}>
        {planData.cycles?.map((day, idx) => {
          const dayTotals = getDayTotals(day);
          
          return (
            <Card key={idx} sx={{ borderRadius: 3, overflow: 'visible' }}>
              <CardContent>
                {/* Day Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedEntity({ type: 'cycle', dayIndex: idx })}
                  >
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
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'primary.50'),
                    border: '1px solid',
                    borderColor: (theme) => (theme.palette.mode === 'dark' ? 'divider' : 'primary.200')
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={700}
                      color={(theme) => (theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main')}
                    >
                      {t('client.nutrition.dailySummary')}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <MacroChip icon={<LocalFireDepartment fontSize="inherit" />} label={`${dayTotals.calories} kcal`} color="error" />
                      <MacroChip icon={<FitnessCenter fontSize="inherit" />} label={`${dayTotals.protein}g`} color="info" />
                      <MacroChip icon={<Grain fontSize="inherit" />} label={`${dayTotals.carbs}g`} color="warning" />
                      <MacroChip icon={<Opacity fontSize="inherit" />} label={`${dayTotals.fat}g`} color="success" />
                    </Stack>
                  </Stack>
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
                      <Grid key={mealIdx} item xs={12}>
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
                            },
                            border: selectedEntity?.type === 'meal' && selectedEntity.dayIndex === idx && selectedEntity.mealIndex === mealIdx
                              ? '2px solid'
                              : '1px solid transparent',
                            borderColor:
                              selectedEntity?.type === 'meal' &&
                              selectedEntity.dayIndex === idx &&
                              selectedEntity.mealIndex === mealIdx
                                ? 'primary.main'
                                : 'transparent'
                          }}
                        >
                          {/* Meal Header */}
                          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                            <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}>
                              <Restaurant />
                            </Avatar>
                            <Box flex={1}>
                              <Typography
                                variant="h6"
                                fontWeight={700}
                                sx={{ cursor: 'pointer' }}
                                onClick={() => setSelectedEntity({ type: 'meal', dayIndex: idx, mealIndex: mealIdx })}
                              >
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

                          {/* Meal Notes */}
                          {meal.notes && (
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                mb: 2,
                                borderRadius: 2,
                                backgroundColor: 'info.lighter',
                                borderColor: 'info.light'
                              }}
                            >
                              <Typography variant="subtitle2" fontWeight={700} color="info.dark" sx={{ mb: 0.5 }}>
                                {t('notes') || 'Notes'}
                              </Typography>
                              <Typography variant="body2" color="info.darker" sx={{ whiteSpace: 'pre-wrap' }}>
                                {meal.notes}
                              </Typography>
                            </Paper>
                          )}

                          {/* Food Items */}
                          {meal.foodItems && meal.foodItems.length > 0 && (
                            <Stack spacing={1.5}>
                              {meal.foodItems.map((fi, fiIdx) => {
                                const unit = (isArabic && fi.foodItem?.unitArabic) || fi.foodItem?.unit || 'g';
                                const quantityDisplay = `${fi.quantity}${unit ? ` ${unit}` : ''}`;
                                const macros = calculateFoodItemMacros(fi);
                                const isSelected =
                                  selectedEntity?.type === 'food' &&
                                  selectedEntity.dayIndex === idx &&
                                  selectedEntity.mealIndex === mealIdx &&
                                  selectedEntity.foodIndex === fiIdx;
                                const foodType =
                                  fi.foodItem?.type ||
                                  fi.foodItem?.category ||
                                  fi.foodItem?.group ||
                                  fi.foodItem?.foodType ||
                                  null;
                                return (
                                  <Paper
                                    key={fiIdx}
                                    variant="outlined"
                                    sx={{
                                      p: 1.5,
                                      borderRadius: 2,
                                      borderColor: isSelected ? 'primary.main' : 'divider',
                                      backgroundColor: isSelected ? 'primary.50' : 'background.paper',
                                      transition: 'all 0.2s ease',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() =>
                                      setSelectedEntity({
                                        type: 'food',
                                        dayIndex: idx,
                                        mealIndex: mealIdx,
                                        foodIndex: fiIdx
                                      })
                                    }
                                  >
                                    <Stack direction="row" spacing={2} alignItems="center">
                                      <Avatar
                                        sx={{
                                          bgcolor: 'primary.light',
                                          color: 'primary.dark',
                                          width: 48,
                                          height: 48,
                                          fontWeight: 700
                                        }}
                                      >
                                        {(fi.foodItem?.name || fi.foodItem?.nameArabic || 'F')[0]}
                                      </Avatar>
                                      <Box flex={1}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                          <Typography variant="subtitle1" fontWeight={600}>
                                            {(isArabic && fi.foodItem?.nameArabic) || fi.foodItem?.name || t('unknown')}
                                          </Typography>
                                          {foodType && (
                                            <MuiChip
                                              size="small"
                                              label={foodType}
                                              sx={{ fontSize: '0.65rem', height: 20 }}
                                            />
                                          )}
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                          {quantityDisplay}
                                        </Typography>
                                        <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                          <InlineMacro label="kcal" value={Math.round(macros.calories)} />
                                          <InlineMacro label={t('protein-short')} value={`${Math.round(macros.protein)}g`} />
                                          <InlineMacro label={t('carbs-short')} value={`${Math.round(macros.carbs)}g`} />
                                          <InlineMacro label={t('fat-short')} value={`${Math.round(macros.fat)}g`} />
                                        </Stack>
                                      </Box>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<RefreshIcon size={16} />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const meal = day.meals?.[mealIdx];
                                          if (meal && meal.id && fi.foodItem?.id) {
                                            setRequestingFoodItem({
                                              foodItem: fi.foodItem,
                                              mealId: meal.id,
                                            });
                                            setRequestDialogOpen(true);
                                          }
                                        }}
                                        sx={{ flexShrink: 0 }}
                                      >
                                        Request Replace
                                      </Button>
                                    </Stack>
                                  </Paper>
                                );
                              })}
                            </Stack>
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
        </Box>
        {showDetailsPanel && selectedSummary && (
          <Box
            sx={{
              width: { xs: '100%', md: 360, lg: 420 },
              flexShrink: 0,
              alignSelf: { md: 'stretch' }
            }}
          >
            <Card
              sx={{
                borderRadius: 3,
                p: 3,
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                position: 'relative'
              }}
            >
              <IconButton
                size="small"
                aria-label="Close nutrition summary"
                onClick={() => setSelectedEntity(null)}
                sx={{ position: 'absolute', top: 8, right: 8 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: 'primary.lighter'
                  }}
                >
                  {selectedSummary.icon}
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    {selectedSummary.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSummary.subtitle}
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                {t('client.nutrition.macros')}
              </Typography>
              <Grid container spacing={2}>
                <MacroStat icon={<LocalFireDepartment />} label={t('calories')} value={`${Math.round(selectedSummary.macros.calories)} kcal`} color="error" />
                <MacroStat icon={<FitnessCenter />} label={t('protein')} value={formatMacro(selectedSummary.macros.protein)} color="info" />
                <MacroStat icon={<Grain />} label={t('carbs')} value={formatMacro(selectedSummary.macros.carbs)} color="warning" />
                <MacroStat icon={<Opacity />} label={t('fat')} value={formatMacro(selectedSummary.macros.fat)} color="success" />
              </Grid>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">
                {t('client.nutrition.microsTitle')}
              </Typography>
              {selectedSummary.micros.length > 0 ? (
                <Stack spacing={1.2} maxHeight={260} sx={{ overflowY: 'auto', pr: 1 }}>
                  {selectedSummary.micros.map((micro) => (
                    <Box
                      key={micro.key}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderRadius: 2,
                        bgcolor: 'action.hover'
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {micro.label}
                      </Typography>
                      <Typography variant="body2" color="primary.main">
                        {micro.value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('client.nutrition.noMicros')}
                </Typography>
              )}
            </Card>
          </Box>
        )}
      </Box>

      {planData.cycles?.length === 0 && (
        <Card sx={{ borderRadius: 3 }}>
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Restaurant sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {t('client.nutrition.noPlan')}
            </Typography>
          </Box>
        </Card>
      )}

      {/* Replacement Request Dialog */}
      {requestingFoodItem && planData?.plan?.id && (
        <ClientReplacementRequestDialog
          open={requestDialogOpen}
          onClose={() => {
            setRequestDialogOpen(false);
            setRequestingFoodItem(null);
          }}
          foodItem={requestingFoodItem.foodItem}
          planId={planData.plan.id}
          mealId={requestingFoodItem.mealId}
          onRequestSubmitted={() => {
            // Optionally refresh the plan data
            // The request will be processed by coach later
          }}
        />
      )}
    </Box>
  );
}

type MacroChipProps = {
  icon: React.ReactNode;
  label: string;
  color: 'primary' | 'secondary' | 'error' | 'info' | 'warning' | 'success' | 'default';
};

const MacroChip = ({ icon, label, color }: MacroChipProps) => (
  <MuiChip
    icon={icon}
    label={label}
    color={color}
    size="small"
    sx={{ fontWeight: 600 }}
  />
);

type MacroStatProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'primary' | 'secondary' | 'error' | 'info' | 'warning' | 'success';
};

const MacroStat = ({ icon, label, value, color }: MacroStatProps) => (
  <Grid item xs={6}>
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5
      }}
    >
      <Avatar
        sx={{
          bgcolor: `${color}.50`,
          color: `${color}.main`,
          width: 40,
          height: 40
        }}
      >
        {icon}
      </Avatar>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="subtitle1" fontWeight={700}>
          {value}
        </Typography>
      </Box>
    </Paper>
  </Grid>
);

type InlineMacroProps = {
  label: string;
  value: string | number;
};

const InlineMacro = ({ label, value }: InlineMacroProps) => (
  <Typography
    variant="caption"
    sx={{
      fontWeight: 600,
      color: 'text.secondary',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.25
    }}
  >
    {label}:{' '}
    <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
      {value}
    </Box>
  </Typography>
);
