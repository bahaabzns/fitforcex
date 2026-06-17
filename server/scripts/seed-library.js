/**
 * One-time script: seeds reference library data (food categories + items,
 * exercise muscle groups, equipment, and exercises) into a workspace.
 *
 * Usage: node server/scripts/seed-library.js [workspaceSlug]
 *        (defaults to "bahaa-bzns")
 *
 * Idempotent: re-running will not create duplicates — every insert is guarded
 * by a name match within the workspace.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createId } = require('@paralleldrive/cuid2');
const pool = require('../db');

const WORKSPACE_SLUG = process.argv[2] || 'bahaa-bzns';

// ── Reference data ──────────────────────────────────────────────────────────

// Lookup tables. `name_en` is the join key referenced by items below.
const FOOD_CATEGORIES = [
    { name_en: 'Protein',       name_ar: 'بروتين' },
    { name_en: 'Carbohydrates', name_ar: 'كربوهيدرات' },
    { name_en: 'Vegetables',    name_ar: 'خضروات' },
    { name_en: 'Fruits',        name_ar: 'فواكه' },
    { name_en: 'Dairy',         name_ar: 'ألبان' },
    { name_en: 'Nuts & Seeds',  name_ar: 'مكسرات وبذور' },
    { name_en: 'Fats & Oils',   name_ar: 'دهون وزيوت' },
    { name_en: 'Legumes',       name_ar: 'بقوليات' },
];

const MUSCLE_GROUPS = [
    { name_en: 'Chest',       name_ar: 'صدر' },
    { name_en: 'Back',        name_ar: 'ظهر' },
    { name_en: 'Shoulders',   name_ar: 'أكتاف' },
    { name_en: 'Biceps',      name_ar: 'عضلة ذات الرأسين' },
    { name_en: 'Triceps',     name_ar: 'عضلة ثلاثية الرؤوس' },
    { name_en: 'Quadriceps',  name_ar: 'عضلة الفخذ الأمامية' },
    { name_en: 'Hamstrings',  name_ar: 'أوتار الركبة' },
    { name_en: 'Glutes',      name_ar: 'عضلات المؤخرة' },
    { name_en: 'Core',        name_ar: 'عضلات البطن' },
    { name_en: 'Calves',      name_ar: 'السمانة' },
];

const EQUIPMENTS = [
    { name_en: 'Barbell',         name_ar: 'بار حديد' },
    { name_en: 'Dumbbell',        name_ar: 'دمبل' },
    { name_en: 'Machine',         name_ar: 'جهاز' },
    { name_en: 'Cable',           name_ar: 'كابل' },
    { name_en: 'Bodyweight',      name_ar: 'وزن الجسم' },
    { name_en: 'Kettlebell',      name_ar: 'كيتل بيل' },
    { name_en: 'Resistance Band', name_ar: 'شريط مقاومة' },
    { name_en: 'Bench',           name_ar: 'مقعد' },
];

// 20 food items — macros are per the given serving size.
const FOOD_ITEMS = [
    { name_en: 'Chicken Breast',    name_ar: 'صدر دجاج',              food_category: 'Protein',       serving_size: 100, serving_unit: 'g',  calories: 165, protein: 31,  carbs: 0,   fats: 3.6 },
    { name_en: 'Salmon',            name_ar: 'سلمون',                 food_category: 'Protein',       serving_size: 100, serving_unit: 'g',  calories: 208, protein: 20,  carbs: 0,   fats: 13 },
    { name_en: 'Eggs',              name_ar: 'بيض',                   food_category: 'Protein',       serving_size: 100, serving_unit: 'g',  calories: 155, protein: 13,  carbs: 1.1, fats: 11 },
    { name_en: 'Beef Steak',        name_ar: 'ستيك لحم بقري',         food_category: 'Protein',       serving_size: 100, serving_unit: 'g',  calories: 250, protein: 26,  carbs: 0,   fats: 15 },
    { name_en: 'Canned Tuna',       name_ar: 'تونة معلبة',            food_category: 'Protein',       serving_size: 100, serving_unit: 'g',  calories: 132, protein: 28,  carbs: 0,   fats: 1 },
    { name_en: 'White Rice',        name_ar: 'أرز أبيض',              food_category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  calories: 130, protein: 2.7, carbs: 28,  fats: 0.3 },
    { name_en: 'Brown Rice',        name_ar: 'أرز بني',               food_category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  calories: 112, protein: 2.6, carbs: 24,  fats: 0.9 },
    { name_en: 'Oats',              name_ar: 'شوفان',                 food_category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  calories: 389, protein: 17,  carbs: 66,  fats: 7 },
    { name_en: 'Sweet Potato',      name_ar: 'بطاطا حلوة',            food_category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  calories: 86,  protein: 1.6, carbs: 20,  fats: 0.1 },
    { name_en: 'Whole Wheat Bread', name_ar: 'خبز قمح كامل',          food_category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  calories: 247, protein: 13,  carbs: 41,  fats: 3.4 },
    { name_en: 'Broccoli',          name_ar: 'بروكلي',                food_category: 'Vegetables',    serving_size: 100, serving_unit: 'g',  calories: 34,  protein: 2.8, carbs: 7,   fats: 0.4 },
    { name_en: 'Spinach',           name_ar: 'سبانخ',                 food_category: 'Vegetables',    serving_size: 100, serving_unit: 'g',  calories: 23,  protein: 2.9, carbs: 3.6, fats: 0.4 },
    { name_en: 'Banana',            name_ar: 'موز',                   food_category: 'Fruits',        serving_size: 100, serving_unit: 'g',  calories: 89,  protein: 1.1, carbs: 23,  fats: 0.3 },
    { name_en: 'Apple',             name_ar: 'تفاح',                  food_category: 'Fruits',        serving_size: 100, serving_unit: 'g',  calories: 52,  protein: 0.3, carbs: 14,  fats: 0.2 },
    { name_en: 'Greek Yogurt',      name_ar: 'زبادي يوناني',          food_category: 'Dairy',         serving_size: 100, serving_unit: 'g',  calories: 59,  protein: 10,  carbs: 3.6, fats: 0.4 },
    { name_en: 'Whole Milk',        name_ar: 'حليب كامل الدسم',       food_category: 'Dairy',         serving_size: 100, serving_unit: 'ml', calories: 61,  protein: 3.2, carbs: 4.8, fats: 3.3 },
    { name_en: 'Almonds',           name_ar: 'لوز',                   food_category: 'Nuts & Seeds',  serving_size: 100, serving_unit: 'g',  calories: 579, protein: 21,  carbs: 22,  fats: 50 },
    { name_en: 'Peanut Butter',     name_ar: 'زبدة الفول السوداني',   food_category: 'Nuts & Seeds',  serving_size: 100, serving_unit: 'g',  calories: 588, protein: 25,  carbs: 20,  fats: 50 },
    { name_en: 'Olive Oil',         name_ar: 'زيت زيتون',             food_category: 'Fats & Oils',   serving_size: 15,  serving_unit: 'ml', calories: 119, protein: 0,   carbs: 0,   fats: 13.5 },
    { name_en: 'Lentils',           name_ar: 'عدس',                   food_category: 'Legumes',       serving_size: 100, serving_unit: 'g',  calories: 116, protein: 9,   carbs: 20,  fats: 0.4 },
];

// 20 exercises — muscle_group / equipment reference the lookup tables above.
const EXERCISES = [
    { name_en: 'Barbell Bench Press',     name_ar: 'ضغط البار على المقعد',        muscle_group: 'Chest',      equipment: 'Barbell' },
    { name_en: 'Incline Dumbbell Press',  name_ar: 'ضغط الدمبل المائل',           muscle_group: 'Chest',      equipment: 'Dumbbell' },
    { name_en: 'Push-Up',                 name_ar: 'تمرين الضغط',                  muscle_group: 'Chest',      equipment: 'Bodyweight' },
    { name_en: 'Pull-Up',                 name_ar: 'العقلة',                       muscle_group: 'Back',       equipment: 'Bodyweight' },
    { name_en: 'Bent-Over Barbell Row',   name_ar: 'تجديف البار المنحني',         muscle_group: 'Back',       equipment: 'Barbell' },
    { name_en: 'Lat Pulldown',            name_ar: 'سحب أمامي',                    muscle_group: 'Back',       equipment: 'Cable' },
    { name_en: 'Overhead Press',          name_ar: 'ضغط الكتف',                    muscle_group: 'Shoulders',  equipment: 'Barbell' },
    { name_en: 'Lateral Raise',           name_ar: 'رفرفة جانبي',                  muscle_group: 'Shoulders',  equipment: 'Dumbbell' },
    { name_en: 'Barbell Curl',            name_ar: 'مرجحة البار للباي',           muscle_group: 'Biceps',     equipment: 'Barbell' },
    { name_en: 'Dumbbell Hammer Curl',    name_ar: 'مرجحة المطرقة',               muscle_group: 'Biceps',     equipment: 'Dumbbell' },
    { name_en: 'Triceps Pushdown',        name_ar: 'سحب الترايسبس لأسفل',         muscle_group: 'Triceps',    equipment: 'Cable' },
    { name_en: 'Close-Grip Bench Press',  name_ar: 'ضغط البار بقبضة ضيقة',        muscle_group: 'Triceps',    equipment: 'Barbell' },
    { name_en: 'Barbell Back Squat',      name_ar: 'السكوات بالبار',              muscle_group: 'Quadriceps', equipment: 'Barbell' },
    { name_en: 'Leg Press',               name_ar: 'مكبس الأرجل',                 muscle_group: 'Quadriceps', equipment: 'Machine' },
    { name_en: 'Romanian Deadlift',       name_ar: 'الرفعة الرومانية',            muscle_group: 'Hamstrings', equipment: 'Barbell' },
    { name_en: 'Leg Curl',                name_ar: 'ثني الأرجل',                  muscle_group: 'Hamstrings', equipment: 'Machine' },
    { name_en: 'Hip Thrust',              name_ar: 'دفع الورك',                   muscle_group: 'Glutes',     equipment: 'Barbell' },
    { name_en: 'Plank',                   name_ar: 'تمرين البلانك',               muscle_group: 'Core',       equipment: 'Bodyweight' },
    { name_en: 'Hanging Leg Raise',       name_ar: 'رفع الأرجل معلقاً',           muscle_group: 'Core',       equipment: 'Bodyweight' },
    { name_en: 'Standing Calf Raise',     name_ar: 'رفع السمانة وقوفاً',          muscle_group: 'Calves',     equipment: 'Machine' },
];

// ── Insert helpers (idempotent by name within the workspace) ─────────────────

async function seedSimpleLookup(table, rows, workspaceId, conflictColumns) {
    let inserted = 0;
    for (const row of rows) {
        const res = await pool.query(
            `INSERT INTO ${table} (id, workspace_id, name_en, name_ar)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (${conflictColumns}) DO NOTHING
             RETURNING id`,
            [createId(), workspaceId, row.name_en, row.name_ar],
        );
        inserted += res.rowCount;
    }
    return inserted;
}

// food_categories has no unique constraint — guard with NOT EXISTS.
async function seedFoodCategories(workspaceId) {
    let inserted = 0;
    for (const row of FOOD_CATEGORIES) {
        const res = await pool.query(
            `INSERT INTO food_categories (id, workspace_id, name_en, name_ar)
             SELECT $1::text, $2::text, $3::varchar, $4::varchar
             WHERE NOT EXISTS (
                 SELECT 1 FROM food_categories WHERE workspace_id = $2 AND name_en = $3
             )
             RETURNING id`,
            [createId(), workspaceId, row.name_en, row.name_ar],
        );
        inserted += res.rowCount;
    }
    return inserted;
}

async function seedFoodItems(workspaceId) {
    let inserted = 0;
    for (const f of FOOD_ITEMS) {
        const res = await pool.query(
            `INSERT INTO food_items
                 (id, workspace_id, name_en, name_ar, food_category, serving_size, serving_unit,
                  calories_per_serving, protein_per_serving, carbs_per_serving, fats_per_serving)
             SELECT $1::text, $2::text, $3::varchar, $4::varchar, $5::text, $6::numeric, $7::text, $8::numeric, $9::numeric, $10::numeric, $11::numeric
             WHERE NOT EXISTS (
                 SELECT 1 FROM food_items WHERE workspace_id = $2 AND name_en = $3
             )
             RETURNING id`,
            [createId(), workspaceId, f.name_en, f.name_ar, f.food_category, f.serving_size, f.serving_unit,
             f.calories, f.protein, f.carbs, f.fats],
        );
        inserted += res.rowCount;
    }
    return inserted;
}

async function seedExercises(workspaceId) {
    let inserted = 0;
    for (const e of EXERCISES) {
        const res = await pool.query(
            `INSERT INTO exercise_library
                 (id, workspace_id, name_en, name_ar, muscle_group, equipment, created_at, updated_at)
             SELECT $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, NOW(), NOW()
             WHERE NOT EXISTS (
                 SELECT 1 FROM exercise_library WHERE workspace_id = $2 AND name_en = $3
             )
             RETURNING id`,
            [createId(), workspaceId, e.name_en, e.name_ar, e.muscle_group, e.equipment],
        );
        inserted += res.rowCount;
    }
    return inserted;
}

// ── Run ─────────────────────────────────────────────────────────────────────

async function run() {
    try {
        const { rows } = await pool.query(
            'SELECT id, name FROM workspaces WHERE slug = $1',
            [WORKSPACE_SLUG],
        );
        if (rows.length === 0) {
            throw new Error(`Workspace with slug "${WORKSPACE_SLUG}" not found`);
        }
        const workspaceId = rows[0].id;
        console.log(`Seeding into workspace "${rows[0].name}" (${workspaceId})\n`);

        const categories = await seedFoodCategories(workspaceId);
        const muscles    = await seedSimpleLookup('exercise_muscle_groups', MUSCLE_GROUPS, workspaceId, 'workspace_id, name_en');
        const equipments = await seedSimpleLookup('exercise_equipments', EQUIPMENTS, workspaceId, 'workspace_id, name_en');
        const foods      = await seedFoodItems(workspaceId);
        const exercises  = await seedExercises(workspaceId);

        console.log(`food_categories:        ${categories} inserted (of ${FOOD_CATEGORIES.length})`);
        console.log(`exercise_muscle_groups: ${muscles} inserted (of ${MUSCLE_GROUPS.length})`);
        console.log(`exercise_equipments:    ${equipments} inserted (of ${EQUIPMENTS.length})`);
        console.log(`food_items:             ${foods} inserted (of ${FOOD_ITEMS.length})`);
        console.log(`exercise_library:       ${exercises} inserted (of ${EXERCISES.length})`);
        console.log('\nDone.');
    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();
