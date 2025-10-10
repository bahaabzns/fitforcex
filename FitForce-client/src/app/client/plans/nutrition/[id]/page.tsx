'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Card, CardContent, Typography, Stack, CircularProgress, Divider } from '@mui/material';

export default function ClientNutritionPlanDetail() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading, error } = useSWR(() => (id ? `client-nutrition-plan-${id}` : null), async () => {
    // Get plan with days/items
    // Fetch workspace id from local storage set by app axios interceptor
    const wsRes = await api.get('/api/clients/profile');
    const workspaceId = wsRes.data?.workspace?.id;
    const res = await api.get(`/api/nutrition/plans/${id}/cycles`, { headers: workspaceId ? { 'x-workspace-id': workspaceId } : {} });
    const planData = res.data;
    console.log('Nutrition plan data:', planData);
    return { plan: planData } as { plan: { plan: { id: string; title: string }; cycles: Array<{ dayIndex: number; label?: string; meals: Array<{ meal?: string; foodItems?: Array<{ quantity: number; foodItem: any }>; recipeName?: string; recipeNameArabic?: string; recipeImageUrl?: string }> }> } };
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading plan…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !data?.plan) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">Failed to load plan</Typography>
        </CardContent>
      </Card>
    );
  }

  const { plan } = data;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>{plan.plan.title}</Typography>
      <Stack spacing={2}>
        {plan.cycles.map((d, idx) => (
          <Card key={idx}>
            <CardContent>
              <Typography variant="h6">{d.label || `Day ${d.dayIndex}`}</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {d.meals.map((it, i) => (
                  <Box key={i} sx={{ width: { xs: '100%', md: 'calc(50% - 8px)' } }}>
                    <Card variant="outlined" sx={{ minHeight: 200 }}>
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                          {it.meal || `Meal ${i + 1}`}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          {/* Section 1: Food Items */}
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                              Food Items:
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                              {it.foodItems?.map(fi => fi.foodItem?.name).join(', ') || 'No items'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Servings: {it.foodItems?.reduce((sum, fi) => sum + fi.quantity, 0) || 0}
                            </Typography>
                          </Box>
                          
                          {/* Section 2: Nutritional Info & Recipe Image */}
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                              Nutritional Info:
                            </Typography>
                            {it.foodItems && it.foodItems.length > 0 && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
                                {Math.round(it.foodItems.reduce((sum, fi) => sum + (fi.foodItem?.calories || 0) * fi.quantity, 0))} kcal • 
                                P {Math.round(it.foodItems.reduce((sum, fi) => sum + (fi.foodItem?.protein || 0) * fi.quantity, 0))}g • 
                                C {Math.round(it.foodItems.reduce((sum, fi) => sum + (fi.foodItem?.carbs || 0) * fi.quantity, 0))}g • 
                                F {Math.round(it.foodItems.reduce((sum, fi) => sum + (fi.foodItem?.fat || 0) * fi.quantity, 0))}g
                              </Typography>
                            )}
                            
                            {/* Recipe Image */}
                            {(it as any).recipeImageUrl && (
                              <Box sx={{
                                width: '100%',
                                height: 80,
                                backgroundImage: `url(${(it as any).recipeImageUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                                borderRadius: 1,
                                border: '1px solid #e0e0e0'
                              }} />
                            )}
                            
                            {(it as any).recipeName && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                                Recipe: {(it as any).recipeName}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                ))}
                {d.meals.length === 0 && (
                  <Box sx={{ width: '100%' }}>
                    <Typography color="text.secondary">No meals for this day.</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}


