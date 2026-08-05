// Fixture data for the PDF Settings live preview (pdfExport.controller.ts's
// previewSettings) — lets a coach see their branding applied without needing
// a real client/plan selected. Shape matches what fetchFullNutritionPlan /
// fetchFullTrainingPlan return, just hand-written instead of queried.

export const SAMPLE_CLIENT_NAME = 'Sample Client';

export const SAMPLE_NUTRITION_PLAN = {
    name: 'Sample Nutrition Plan',
    cycles: [
        {
            name: 'Cycle 1',
            goal_calories: 2200,
            goal_protein: 160,
            goal_carbs: 220,
            goal_fats: 70,
            note: 'Focus on whole foods and consistent meal timing.',
            meals: [
                {
                    name: 'Breakfast',
                    note: 'Eat within an hour of waking.',
                    items: [
                        {
                            name: 'Oats', amount: 80, serving_size: 100, serving_unit: 'g',
                            calories_per_serving: 389, protein_per_serving: 17, carbs_per_serving: 66, fats_per_serving: 7,
                            is_swapped: false, alternatives: [{ name: 'Cream of Wheat' }],
                        },
                        {
                            name: 'Whey Protein', amount: 30, serving_size: 30, serving_unit: 'g',
                            calories_per_serving: 120, protein_per_serving: 24, carbs_per_serving: 3, fats_per_serving: 1.5,
                            is_swapped: false, alternatives: [],
                        },
                    ],
                },
                {
                    name: 'Lunch',
                    note: '',
                    items: [
                        {
                            name: 'Chicken Breast', amount: 200, serving_size: 100, serving_unit: 'g',
                            calories_per_serving: 165, protein_per_serving: 31, carbs_per_serving: 0, fats_per_serving: 3.6,
                            is_swapped: false, alternatives: [],
                        },
                        {
                            name: 'White Rice', amount: 150, serving_size: 100, serving_unit: 'g',
                            calories_per_serving: 130, protein_per_serving: 2.7, carbs_per_serving: 28, fats_per_serving: 0.3,
                            is_swapped: false, alternatives: [{ name: 'Quinoa' }],
                        },
                    ],
                },
            ],
        },
    ],
};

export const SAMPLE_TRAINING_PLAN = {
    name: 'Sample Training Plan',
    notes: 'Progressive overload — increase load once every set hits the top of the rep range.',
    days: [
        {
            name: 'Day 1 — Push',
            notes: 'Warm up shoulders before pressing.',
            exercises: [
                {
                    name: 'Barbell Bench Press', equipment: 'Barbell', notes: 'Control the eccentric.',
                    tracking_type: 'sets_reps',
                    tracked_metrics: ['tempo', 'rir'],
                    // A self-contained data: URI (a simple barbell glyph), not a hotlinked
                    // external image — the settings-page preview renders this on every
                    // debounced keystroke, so it can't depend on outbound network access.
                    thumbnail_path: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTQwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE0MCIgZmlsbD0iIzNhNGE1YyIvPjxnIHN0cm9rZT0iI2M5ZDNkYyIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxsaW5lIHgxPSI1NSIgeTE9IjcwIiB4Mj0iMTQ1IiB5Mj0iNzAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjcwIiByPSIxNiIgZmlsbD0iI2M5ZDNkYyIgc3Ryb2tlPSJub25lIi8+PGNpcmNsZSBjeD0iMTUwIiBjeT0iNzAiIHI9IjE2IiBmaWxsPSIjYzlkM2RjIiBzdHJva2U9Im5vbmUiLz48L2c+PC9zdmc+',
                    youtube_url: 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
                    sets: [
                        { reps: '8', rest_seconds: 90, tempo: '2010', rir: 2 },
                        { reps: '8', rest_seconds: 90, tempo: '2010', rir: 2 },
                        { reps: '8', rest_seconds: 90, tempo: '2010', rir: 1 },
                    ],
                },
                {
                    name: 'Overhead Press', equipment: 'Barbell', notes: '',
                    tracking_type: 'sets_reps',
                    tracked_metrics: ['rpe'],
                    sets: [
                        { reps: '10', rest_seconds: 75, rpe: 7.5 },
                        { reps: '10', rest_seconds: 75, rpe: 8 },
                    ],
                },
                {
                    // Time-based, duration only — exercises the sample data for
                    // the PDF Settings live preview shows every renderSetsTable
                    // column set (see trainingPlan.ts's prescribedFieldsFor usage).
                    name: 'Plank', equipment: 'Bodyweight', notes: 'Hold a straight line from head to heels.',
                    tracking_type: 'time_based',
                    tracked_metrics: ['duration_seconds'],
                    sets: [
                        { duration_seconds: 45, rest_seconds: 30 },
                        { duration_seconds: 45, rest_seconds: 30 },
                        { duration_seconds: 30, rest_seconds: 30 },
                    ],
                },
                {
                    name: 'Treadmill Run', equipment: 'Machine', notes: 'Steady-state cardio, conversational pace.',
                    tracking_type: 'time_based',
                    tracked_metrics: ['duration_seconds', 'distance_km', 'incline_percent', 'speed_kmh'],
                    sets: [
                        { duration_seconds: 1200, distance_km: 3.2, incline_percent: 1.5, speed_kmh: 9.5, rest_seconds: null },
                    ],
                },
            ],
        },
    ],
};
