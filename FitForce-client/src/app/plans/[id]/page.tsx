'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Typography, Stack, CircularProgress, Fab } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';

export default function PublicPlanPreviewPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading, error } = useSWR(() => (id ? `public-plan-${id}-cycles` : null), async () => {
    // Get workspace ID from cookie (set by middleware)
    const workspaceId = document.cookie
      .split('; ')
      .find(row => row.startsWith('ff_workspace_id='))
      ?.split('=')[1];

    const headers = workspaceId ? { 'x-workspace-id': workspaceId } : {};

    try {
      // Use public cycles endpoint (workspace-scoped, no client binding required)
      const cyclesRes = await api.get(`/api/nutrition/plans/${id}/cycles`, { headers });
      const planTitle = (cyclesRes.data as any)?.plan?.title || 'Nutrition Plan';
      const cycles = (cyclesRes.data as any)?.cycles || [];
      return { plan: { id, title: planTitle, cycles } as any } as { plan: { id: string; title: string; cycles: Array<any> } };
    } catch (e) {
      console.error('Failed to fetch plan cycles:', e);
      throw e;
    }
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
      <Box sx={{ m: { xs: 1, md: 3 }, p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography color="error">Failed to load plan</Typography>
      </Box>
    );
  }

  const { plan } = data;

  // Fixed page size in inches
  const PAGE_W_IN = 18.5;
  const PAGE_H_IN = 10.5;
  const PAGE_RADIUS = 0;   // no rounding per request

  const coverBgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760017978663-Copy_of_test_FMX_Ar_Nutrition_Template__Captain_Maged__page-0001.jpg';
  const pageBgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760005657260-Screenshot_From_2025-09-29_20-52-21.png';

  const cycles = (plan as any).cycles || [];

  const computeTotals = (items: Array<{ servings?: number; foodItem?: any }>) => {
    // servings represents grams; nutrition fields are per 100g
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 } as { calories: number; protein: number; carbs: number; fat: number };
    for (const it of items || []) {
      const grams = Number(it.servings ?? 0); // quantity in grams
      const factor = grams / 100; // nutrients per 100g
      const fi = it.foodItem || {};
      totals.calories += Number(fi.calories ?? 0) * factor;
      totals.protein += Number(fi.protein ?? 0) * factor;
      totals.carbs += Number(fi.carbs ?? 0) * factor;
      totals.fat += Number(fi.fat ?? 0) * factor;
    }
    return totals;
  };

  // Normalize meal items: maker returns meal.foodItems with { quantity, foodItem }
  const extractMealItems = (meal: any) => {
    const items = (meal?.foodItems || []).map((fi: any) => ({
      foodItem: fi.foodItem || {},
      servings: fi.quantity ?? fi.servings ?? 1,
    }));
    return items as Array<{ foodItem: any; servings: number }>;
  };

  const pages: React.ReactNode[] = [];

  // Page 1: Cover
  pages.push(
    <Box key="cover" sx={{ width: `${PAGE_W_IN}in`, height: `${PAGE_H_IN}in`, mx: 0, my: 0, bgcolor: '#000', color: '#fff', backgroundImage: `url(${coverBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', breakAfter: 'page', borderRadius: PAGE_RADIUS, overflow: 'hidden' }}>
      {/* Cover image only, no title overlay per request */}
    </Box>
  );

  // For each cycle: add a summary page, micronutrients page, and meal pages
  cycles.forEach((cycle: any, cycleIdx: number) => {
    const dayTitle = cycle.label || `Day ${Number(cycle.dayIndex ?? cycleIdx) + 1}`;
    // Flatten all meal items for totals
    const allItems: Array<{ foodItem: any; servings: number }> = [];
    for (const m of cycle.meals || []) allItems.push(...extractMealItems(m));
    const totals = computeTotals(allItems);

    // Day summary page
    pages.push(
      <Box key={`day-summary-${cycleIdx}`} sx={{ width: `${PAGE_W_IN}in`, height: `${PAGE_H_IN}in`, mx: 0, my: 0, p: { xs: 3, md: 6 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', breakAfter: 'page', borderRadius: PAGE_RADIUS, overflow: 'hidden', backgroundImage: `url(${pageBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <Typography variant="h2" sx={{ textAlign: 'center', mb: 4, fontSize: '1.2in' }}>{dayTitle}</Typography>
        <Stack direction="row" spacing={4} sx={{ mb: 6 }}>
                <Stack alignItems="center">
                  <Typography variant="overline" sx={{ fontSize: '0.28in' }}>سعرات حرارية</Typography>
                  <Typography variant="h5" sx={{ fontSize: '0.5in' }}>{Math.round(totals.calories)}</Typography>
                </Stack>
          <Stack alignItems="center">
                  <Typography variant="overline" sx={{ fontSize: '0.28in' }}>بروتين</Typography>
            <Typography variant="h5" sx={{ fontSize: '0.5in' }}>{Math.round(totals.protein)} g</Typography>
          </Stack>
          <Stack alignItems="center">
                  <Typography variant="overline" sx={{ fontSize: '0.28in' }}>كربوهيدرات</Typography>
            <Typography variant="h5" sx={{ fontSize: '0.5in' }}>{Math.round(totals.carbs)} g</Typography>
          </Stack>
          <Stack alignItems="center">
                  <Typography variant="overline" sx={{ fontSize: '0.28in' }}>دهون</Typography>
            <Typography variant="h5" sx={{ fontSize: '0.5in' }}>{Math.round(totals.fat)} g</Typography>
          </Stack>
        </Stack>
        <Typography variant="subtitle1" color="text.secondary">Meals follow in the next pages</Typography>
      </Box>
    );

    // Micronutrients page (if totals provided by API)
    const micro = (cycle as any).microTotals || {};
    const order: string[] = [
      'water','ash','fiber','sodium','potassium','calcium','phosphorous','magnesium','iron','zinc','copper','manganese','fluoride','selenium',
      'vitamin_a','vitamin_c','vitamin_d','vitamin_e','vitamin_k','vitamin_b1','vitamin_b2','vitamin_b5','vitamin_b6','vitamin_b12','niacin','folic_acid','choline','betaine'
    ];
    const labels: Record<string, string> = {
      water: 'Water',
      ash: 'Ash',
      fiber: 'Fiber',
      sodium: 'Sodium',
      potassium: 'Potassium',
      calcium: 'Calcium',
      phosphorous: 'Phosphorous',
      magnesium: 'Magnesium',
      iron: 'Iron',
      zinc: 'Zinc',
      copper: 'Copper',
      manganese: 'Manganese',
      fluoride: 'Fluoride',
      selenium: 'Selenium',
      vitamin_a: 'Vitamin A',
      vitamin_c: 'Vitamin C',
      vitamin_d: 'Vitamin D',
      vitamin_e: 'Vitamin E',
      vitamin_k: 'Vitamin K',
      vitamin_b1: 'Vitamin B1',
      vitamin_b2: 'Vitamin B2',
      vitamin_b5: 'Vitamin B5',
      vitamin_b6: 'Vitamin B6',
      vitamin_b12: 'Vitamin B12',
      niacin: 'Niacin',
      folic_acid: 'Folic Acid',
      choline: 'Choline',
      betaine: 'Betaine',
    };
    const microEntries = order.map((k) => [k, Number(micro[k] ?? 0)] as [string, number]);
    if (microEntries.length > 0) {
      pages.push(
        <Box key={`day-micro-${cycleIdx}`} sx={{ width: `${PAGE_W_IN}in`, height: `${PAGE_H_IN}in`, mx: 0, my: 0, p: { xs: 3, md: 6 }, display: 'flex', flexDirection: 'column', breakAfter: 'page', borderRadius: PAGE_RADIUS, overflow: 'hidden', backgroundImage: `url(${pageBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <Typography variant="h3" sx={{ textAlign: 'center', mb: 3, fontSize: '0.8in' }}>Micronutrients</Typography>
          <Box className="micro-grid" sx={{ maxWidth: 900, mx: 'auto', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2 }}>
            {microEntries.map(([key, val]) => (
              <Box key={key} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1 }}>
                <Typography variant="subtitle1" sx={{ textAlign: 'center', fontSize: '0.35in' }}>{labels[key] || key.replace(/_/g, ' ')}</Typography>
                <Typography variant="subtitle2" sx={{ textAlign: 'center', fontSize: '0.32in' }}>{Math.round(Number(val ?? 0))}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      );
    }

    // One page per meal (as defined by cycle.meals)
    (cycle.meals || []).forEach((meal: any, idx: number) => {
      const mealName = meal.meal || meal.title || `Meal ${idx + 1}`;
      const items = extractMealItems(meal);
      const mealTotals = computeTotals(items);
      pages.push(
        <Box key={`cycle-${cycleIdx}-meal-${idx}`} sx={{ width: `${PAGE_W_IN}in`, height: `${PAGE_H_IN}in`, mx: 0, my: 0, p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'row', gap: 2, breakAfter: 'page', borderRadius: PAGE_RADIUS, overflow: 'hidden', backgroundImage: `url(${pageBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          {/* Left section: recipe image background with totals */}
          <Box sx={{ 
            flex: 1, 
            position: 'relative', 
            minHeight: '100%',
            backgroundImage: (meal as any).recipeImageUrl ? `url(${(meal as any).recipeImageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            borderRadius: 2,
            border: '2px solid #fff'
          }}>
            {/* Dark overlay for better readability */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 2
            }} />
            
            {/* Totals anchored at bottom */}
            <Box sx={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  width: '9in',
                  maxWidth: '95%',
                  height: '2.2in',
                  backgroundImage: 'url(https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760018300944-nutrition_facts_container.png)',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  display: 'grid',
                  gridTemplateRows: '1fr 1fr 1fr',
                  alignItems: 'end',
                  justifyItems: 'center',
                  pb: '0.00in',
                }}
              >
                {/* Row 1 intentionally empty to match the image header */}
                <Box sx={{ gridRow: 2, width: '75%', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', transform: 'translateY(0.3in)' }}>
                  <Box sx={{ display: 'flex', gap: '0.25in', alignItems: 'baseline' }}>
                    <Typography variant="overline" sx={{ fontSize: '0.35in' }}>kcal</Typography>
                    <Typography variant="h6" sx={{ fontSize: '0.6in' }}>{Math.round(mealTotals.calories)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: '0.25in', alignItems: 'baseline' }}>
                    <Typography variant="overline" sx={{ fontSize: '0.35in' }}>P</Typography>
                    <Typography variant="h6" sx={{ fontSize: '0.6in' }}>{Math.round(mealTotals.protein)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ gridRow: 3, width: '75%', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', transform: 'translateY(0.16in)' }}>
                  <Box sx={{ display: 'flex', gap: '0.25in', alignItems: 'baseline' }}>
                    <Typography variant="overline" sx={{ fontSize: '0.35in' }}>C</Typography>
                    <Typography variant="h6" sx={{ fontSize: '0.6in' }}>{Math.round(mealTotals.carbs)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: '0.25in', alignItems: 'baseline' }}>
                    <Typography variant="overline" sx={{ fontSize: '0.35in' }}>F</Typography>
                    <Typography variant="h6" sx={{ fontSize: '0.6in' }}>{Math.round(mealTotals.fat)}</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
            </Box>
          </Box>
          {/* Right section: title and items list (RTL: name then quantity) */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }} dir="rtl">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 3, gap: 2 }}>
              <Typography variant="h3" sx={{ textAlign: 'right', fontSize: '0.9in' }}>{mealName}</Typography>
              {(meal as any).recipeVideoUrl && (
                <Box
                  component="a"
                  href={(meal as any).recipeVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: 'red',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '2px solid red',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'red',
                      color: 'white',
                      transform: 'scale(1.1)'
                    },
                    '@media print': {
                      color: 'red !important',
                      backgroundColor: 'white !important',
                      border: '2px solid red !important'
                    }
                  }}
                >
                  📺
                </Box>
              )}
            </Box>
            <Stack spacing={1.5}>
              {items.map((it: any, i: number) => {
                const fi = it.foodItem || {};
                const servings = Number(it.servings ?? 1);
                return (
                  <Box key={i} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 1.5, borderBottom: '1px dashed', borderColor: 'divider', pb: 1 }}>
                    <Typography variant="subtitle1" sx={{ textAlign: 'right', fontSize: '0.38in' }}>{fi.nameArabic || fi.titleArabic || fi.name || fi.title || 'Item'}</Typography>
                    <Typography variant="subtitle2" sx={{ textAlign: 'right', fontSize: '0.36in' }}>{servings}</Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Box>
      );
    });
  });

  // Ending pages with provided backgrounds
  const endPages = [
    'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760007620334-Screenshot_From_2025-10-09_13-59-09.png',
    'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760007598494-Screenshot_From_2025-10-09_13-59-13.png',
    'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760018241014-Copy_of_test_FMX_Ar_Nutrition_Template__Captain_Maged__page-0005.jpg',
  ];
  endPages.forEach((bg, i) => {
    pages.push(
      <Box key={`end-${i}`} sx={{ width: `${PAGE_W_IN}in`, height: `${PAGE_H_IN}in`, mx: 0, my: 0, backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', breakAfter: 'page', borderRadius: PAGE_RADIUS, overflow: 'hidden' }} />
    );
  });

  return (
    <Box className="print-container" sx={{ p: 2 }}>
      <style jsx global>{`
        /* Hide settings buttons and layouts - always hidden */
        button[aria-label*="settings"], 
        button[aria-label*="Settings"],
        button[data-testid*="settings"],
        button[data-testid*="Settings"],
        .settings-button,
        .layout-settings,
        [data-settings],
        [aria-label*="settings"],
        [aria-label*="Settings"],
        .MuiFab-root[aria-label*="settings"],
        .MuiFab-root[aria-label*="Settings"],
        .MuiIconButton-root[aria-label*="settings"],
        .MuiIconButton-root[aria-label*="Settings"],
        button[title*="settings"],
        button[title*="Settings"],
        .MuiFab-root[title*="settings"],
        .MuiFab-root[title*="Settings"],
        .MuiIconButton-root[title*="settings"],
        .MuiIconButton-root[title*="Settings"] {
          display: none !important;
        }

        @media print {
          @page { size: ${PAGE_W_IN}in ${PAGE_H_IN}in; margin: 0; }
          html, body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-container { padding: 0 !important; }
          .print-stack { gap: 0 !important; }
          .print-stack > * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; }
          .micro-grid { grid-template-columns: repeat(6, 1fr) !important; }
        }
      `}</style>
      <Stack className="print-stack" spacing={4} alignItems="center">
        {pages}
      </Stack>
      <Fab className="no-print" color="primary" aria-label="Print" onClick={() => window.print()} sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 2000 }}>
        <PrintIcon />
      </Fab>
    </Box>
  );
}


