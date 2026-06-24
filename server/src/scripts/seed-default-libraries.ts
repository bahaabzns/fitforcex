/**
 * Seed the global Default Libraries (master_* tables) with a curated starter set.
 *
 * Idempotent: rows are matched by name_en and only inserted when missing, so it is
 * safe to re-run. This is the "reference data" seed — the Super Admin can extend it
 * via the Default Libraries UI or bulk import. New coach workspaces are cloned from
 * whatever lives in these tables at signup time (see lib/libraryClone.ts).
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-default-libraries.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

const MUSCLE_GROUPS: [string, string][] = [
    ['Chest', 'صدر'], ['Back', 'ظهر'], ['Shoulders', 'أكتاف'], ['Biceps', 'باي'],
    ['Triceps', 'تراي'], ['Forearms', 'ساعد'], ['Quadriceps', 'أمامي الفخذ'],
    ['Hamstrings', 'خلفي الفخذ'], ['Glutes', 'أرداف'], ['Calves', 'سمانة'],
    ['Abs', 'بطن'], ['Trapezius', 'ترابيس'],
];

const EQUIPMENT: [string, string][] = [
    ['Barbell', 'بار'], ['Dumbbell', 'دامبل'], ['Kettlebell', 'كيتل بل'],
    ['Cable Machine', 'كابل'], ['Smith Machine', 'سميث'], ['Resistance Band', 'حبل مقاومة'],
    ['Bodyweight', 'وزن الجسم'], ['EZ Bar', 'بار متعرج'], ['Machine', 'ماكينة'],
    ['Flat Bench', 'بنش مستوي'], ['Pull-up Bar', 'عقلة'], ['Medicine Ball', 'كرة طبية'],
];

// [name_en, name_ar, muscle_group, equipment]
const EXERCISES: [string, string, string, string][] = [
    ['Barbell Bench Press', 'بنش بريس بالبار', 'Chest', 'Barbell'],
    ['Incline Dumbbell Press', 'بنش عالي دامبل', 'Chest', 'Dumbbell'],
    ['Cable Fly', 'تفتيح كابل', 'Chest', 'Cable Machine'],
    ['Push-up', 'ضغط', 'Chest', 'Bodyweight'],
    ['Deadlift', 'ديدليفت', 'Back', 'Barbell'],
    ['Pull-up', 'عقلة', 'Back', 'Pull-up Bar'],
    ['Bent-over Row', 'تجديف منحني', 'Back', 'Barbell'],
    ['Lat Pulldown', 'سحب أمامي', 'Back', 'Cable Machine'],
    ['Seated Cable Row', 'تجديف كابل', 'Back', 'Cable Machine'],
    ['Overhead Press', 'ضغط كتف', 'Shoulders', 'Barbell'],
    ['Dumbbell Lateral Raise', 'رفرفة جانبي', 'Shoulders', 'Dumbbell'],
    ['Face Pull', 'سحب للوجه', 'Shoulders', 'Cable Machine'],
    ['Barbell Curl', 'مرجحة بار', 'Biceps', 'Barbell'],
    ['Dumbbell Hammer Curl', 'مرجحة هامر', 'Biceps', 'Dumbbell'],
    ['Cable Curl', 'مرجحة كابل', 'Biceps', 'Cable Machine'],
    ['Triceps Pushdown', 'دفع تراي', 'Triceps', 'Cable Machine'],
    ['Skull Crusher', 'سكال كراشر', 'Triceps', 'EZ Bar'],
    ['Dips', 'متوازي', 'Triceps', 'Bodyweight'],
    ['Wrist Curl', 'مرجحة رسغ', 'Forearms', 'Dumbbell'],
    ['Back Squat', 'سكوات خلفي', 'Quadriceps', 'Barbell'],
    ['Leg Press', 'ضغط أرجل', 'Quadriceps', 'Machine'],
    ['Lunge', 'طعن', 'Quadriceps', 'Dumbbell'],
    ['Leg Extension', 'تمديد رجل', 'Quadriceps', 'Machine'],
    ['Romanian Deadlift', 'رومانيان ديدليفت', 'Hamstrings', 'Barbell'],
    ['Leg Curl', 'ثني رجل', 'Hamstrings', 'Machine'],
    ['Hip Thrust', 'دفع حوض', 'Glutes', 'Barbell'],
    ['Glute Bridge', 'جسر الأرداف', 'Glutes', 'Bodyweight'],
    ['Standing Calf Raise', 'رفع سمانة واقف', 'Calves', 'Machine'],
    ['Seated Calf Raise', 'رفع سمانة جالس', 'Calves', 'Machine'],
    ['Crunch', 'كرنش', 'Abs', 'Bodyweight'],
    ['Hanging Leg Raise', 'رفع رجل معلق', 'Abs', 'Pull-up Bar'],
    ['Plank', 'بلانك', 'Abs', 'Bodyweight'],
    ['Cable Crunch', 'كرنش كابل', 'Abs', 'Cable Machine'],
    ['Barbell Shrug', 'رفع ترابيس', 'Trapezius', 'Barbell'],
    ['Goblet Squat', 'جوبلت سكوات', 'Quadriceps', 'Kettlebell'],
    ['Arnold Press', 'أرنولد بريس', 'Shoulders', 'Dumbbell'],
];

const FOOD_CATEGORIES: [string, string][] = [
    ['Protein', 'بروتين'], ['Carbohydrates', 'كربوهيدرات'], ['Vegetables', 'خضروات'],
    ['Fruits', 'فواكه'], ['Dairy', 'ألبان'], ['Fats & Oils', 'دهون وزيوت'],
    ['Nuts & Seeds', 'مكسرات وبذور'], ['Beverages', 'مشروبات'], ['Grains', 'حبوب'],
    ['Legumes', 'بقوليات'],
];

// [name_en, name_ar, category, kcal, protein, carbs, fats] per 100g
const FOOD_ITEMS: [string, string, string, number, number, number, number][] = [
    ['Chicken Breast', 'صدر فراخ', 'Protein', 165, 31, 0, 3.6],
    ['Egg', 'بيض', 'Protein', 155, 13, 1.1, 11],
    ['Beef (lean)', 'لحم بقري قليل الدهن', 'Protein', 250, 26, 0, 15],
    ['Salmon', 'سلمون', 'Protein', 208, 20, 0, 13],
    ['Tuna (canned)', 'تونة', 'Protein', 132, 28, 0, 1],
    ['Whey Protein', 'واي بروتين', 'Protein', 400, 80, 8, 6],
    ['White Rice (cooked)', 'أرز أبيض مطبوخ', 'Carbohydrates', 130, 2.7, 28, 0.3],
    ['Brown Rice (cooked)', 'أرز بني مطبوخ', 'Carbohydrates', 123, 2.7, 26, 1],
    ['Sweet Potato', 'بطاطا', 'Carbohydrates', 86, 1.6, 20, 0.1],
    ['Potato', 'بطاطس', 'Carbohydrates', 77, 2, 17, 0.1],
    ['Oats', 'شوفان', 'Grains', 389, 17, 66, 7],
    ['Whole Wheat Bread', 'عيش أسمر', 'Grains', 247, 13, 41, 3.4],
    ['Pasta (cooked)', 'مكرونة مطبوخة', 'Carbohydrates', 131, 5, 25, 1.1],
    ['Broccoli', 'بروكلي', 'Vegetables', 34, 2.8, 7, 0.4],
    ['Spinach', 'سبانخ', 'Vegetables', 23, 2.9, 3.6, 0.4],
    ['Cucumber', 'خيار', 'Vegetables', 15, 0.7, 3.6, 0.1],
    ['Tomato', 'طماطم', 'Vegetables', 18, 0.9, 3.9, 0.2],
    ['Carrot', 'جزر', 'Vegetables', 41, 0.9, 10, 0.2],
    ['Banana', 'موز', 'Fruits', 89, 1.1, 23, 0.3],
    ['Apple', 'تفاح', 'Fruits', 52, 0.3, 14, 0.2],
    ['Orange', 'برتقال', 'Fruits', 47, 0.9, 12, 0.1],
    ['Strawberry', 'فراولة', 'Fruits', 32, 0.7, 7.7, 0.3],
    ['Dates', 'تمر', 'Fruits', 277, 1.8, 75, 0.2],
    ['Milk (whole)', 'لبن كامل الدسم', 'Dairy', 61, 3.2, 4.8, 3.3],
    ['Greek Yogurt', 'زبادي يوناني', 'Dairy', 59, 10, 3.6, 0.4],
    ['Cottage Cheese', 'جبنة قريش', 'Dairy', 98, 11, 3.4, 4.3],
    ['Cheddar Cheese', 'جبنة شيدر', 'Dairy', 402, 25, 1.3, 33],
    ['Olive Oil', 'زيت زيتون', 'Fats & Oils', 884, 0, 0, 100],
    ['Butter', 'زبدة', 'Fats & Oils', 717, 0.9, 0.1, 81],
    ['Peanut Butter', 'زبدة فول سوداني', 'Nuts & Seeds', 588, 25, 20, 50],
    ['Almonds', 'لوز', 'Nuts & Seeds', 579, 21, 22, 50],
    ['Walnuts', 'عين جمل', 'Nuts & Seeds', 654, 15, 14, 65],
    ['Lentils (cooked)', 'عدس مطبوخ', 'Legumes', 116, 9, 20, 0.4],
    ['Chickpeas (cooked)', 'حمص مطبوخ', 'Legumes', 164, 9, 27, 2.6],
    ['Kidney Beans (cooked)', 'فاصوليا حمراء', 'Legumes', 127, 8.7, 22, 0.5],
    ['Fava Beans', 'فول', 'Legumes', 110, 7.6, 19, 0.4],
];

// ── Default Form Templates (master_forms / master_form_questions) ───────────────
// Cloned into every new workspace as editable coach forms (see lib/libraryClone.ts).
// Question types reuse the shared form builder: text, long_text, number, scale,
// select, multiselect, date. Photo/measurement elements don't exist yet, so the
// "progress photos" prompt is a long_text placeholder until that element ships.

type SeedQuestion = {
    label_en: string;
    label_ar: string;
    type: string;
    required?: boolean;
    options?: string[];
    options_ar?: string[];
    min_value?: number;
    max_value?: number;
    placeholder_en?: string;
};

type SeedTemplate = {
    title_en: string;
    title_ar: string;
    form_type: 'assessment' | 'check-in';
    description_en: string;
    questions: SeedQuestion[];
};

const FORM_TEMPLATES: SeedTemplate[] = [
    {
        title_en: 'Standard Assessment Form',
        title_ar: 'نموذج التقييم القياسي',
        form_type: 'assessment',
        description_en: 'Initial intake collected when a new client starts.',
        questions: [
            { label_en: 'What is your primary goal?', label_ar: 'ما هو هدفك الأساسي؟', type: 'long_text', required: true },
            { label_en: 'Training experience', label_ar: 'خبرة التمرين', type: 'select', required: true,
              options: ['Beginner', 'Intermediate', 'Advanced'], options_ar: ['مبتدئ', 'متوسط', 'متقدم'] },
            { label_en: 'Any injuries or limitations?', label_ar: 'هل لديك أي إصابات أو قيود؟', type: 'long_text' },
            { label_en: 'Current weight (kg)', label_ar: 'الوزن الحالي (كجم)', type: 'number', required: true },
            { label_en: 'Height (cm)', label_ar: 'الطول (سم)', type: 'number', required: true },
            { label_en: 'Days per week available to train', label_ar: 'عدد أيام التمرين المتاحة أسبوعياً', type: 'number', required: true },
        ],
    },
    {
        title_en: 'Weekly Check-In Form',
        title_ar: 'نموذج المتابعة الأسبوعي',
        form_type: 'check-in',
        description_en: 'Weekly progress check-in submitted by the client.',
        questions: [
            { label_en: 'Current weight (kg)', label_ar: 'الوزن الحالي (كجم)', type: 'number', required: true },
            { label_en: 'Energy level', label_ar: 'مستوى الطاقة', type: 'scale', min_value: 1, max_value: 10 },
            { label_en: 'Training adherence', label_ar: 'الالتزام بالتمرين', type: 'scale', min_value: 1, max_value: 10 },
            { label_en: 'Nutrition adherence', label_ar: 'الالتزام بالتغذية', type: 'scale', min_value: 1, max_value: 10 },
            { label_en: 'Sleep quality', label_ar: 'جودة النوم', type: 'scale', min_value: 1, max_value: 10 },
            { label_en: 'Notes for your coach', label_ar: 'ملاحظات لمدربك', type: 'long_text' },
            { label_en: 'Progress photos (paste links)', label_ar: 'صور التقدم (أضف الروابط)', type: 'long_text',
              placeholder_en: 'Front, side and back photo links' },
        ],
    },
];

async function seedFormTemplates() {
    const existing = new Set(
        (await prisma.master_forms.findMany({ select: { title_en: true } })).map((f) => f.title_en.toLowerCase())
    );

    let created = 0;
    for (const tpl of FORM_TEMPLATES) {
        if (existing.has(tpl.title_en.toLowerCase())) continue;

        const formId = createId();
        await prisma.master_forms.create({
            data: {
                id: formId, title_en: tpl.title_en, title_ar: tpl.title_ar,
                description_en: tpl.description_en, form_type: tpl.form_type, status: 'active',
            },
        });
        await prisma.master_form_questions.createMany({
            data: tpl.questions.map((q, i) => ({
                id: createId(), master_form_id: formId,
                label_en: q.label_en, label_ar: q.label_ar, type: q.type,
                required: q.required ?? false, order_index: i,
                options: q.options ?? Prisma.DbNull, options_ar: q.options_ar ?? Prisma.DbNull,
                min_value: q.min_value ?? null, max_value: q.max_value ?? null,
                placeholder_en: q.placeholder_en ?? null,
            })),
        });
        created += 1;
    }
    console.log(`  Form templates: +${created} (${FORM_TEMPLATES.length - created} already present)`);
}

async function seedSimple(label: string, existing: Set<string>, rows: [string, string][], insert: (data: { id: string; name_en: string; name_ar: string }[]) => Promise<unknown>) {
    const toInsert = rows
        .filter(([en]) => !existing.has(en.toLowerCase()))
        .map(([name_en, name_ar]) => ({ id: createId(), name_en, name_ar }));
    if (toInsert.length) await insert(toInsert);
    console.log(`  ${label}: +${toInsert.length} (${rows.length - toInsert.length} already present)`);
}

async function main() {
    console.log('Seeding Default Libraries...');

    const [mg, eq, ex, fc, fi] = await Promise.all([
        prisma.master_exercise_muscle_groups.findMany({ select: { name_en: true } }),
        prisma.master_exercise_equipments.findMany({ select: { name_en: true } }),
        prisma.master_exercise_library.findMany({ select: { name_en: true } }),
        prisma.master_food_categories.findMany({ select: { name_en: true } }),
        prisma.master_food_items.findMany({ select: { name_en: true } }),
    ]);
    const set = (rows: { name_en: string }[]) => new Set(rows.map((r) => r.name_en.toLowerCase()));

    await seedSimple('Muscle groups', set(mg), MUSCLE_GROUPS, (data) => prisma.master_exercise_muscle_groups.createMany({ data, skipDuplicates: true }));
    await seedSimple('Equipment', set(eq), EQUIPMENT, (data) => prisma.master_exercise_equipments.createMany({ data, skipDuplicates: true }));
    await seedSimple('Food categories', set(fc), FOOD_CATEGORIES, (data) => prisma.master_food_categories.createMany({ data, skipDuplicates: true }));

    const exExisting = set(ex);
    const exToInsert = EXERCISES
        .filter(([en]) => !exExisting.has(en.toLowerCase()))
        .map(([name_en, name_ar, muscle_group, equipment]) => ({ id: createId(), name_en, name_ar, muscle_group, equipment }));
    if (exToInsert.length) await prisma.master_exercise_library.createMany({ data: exToInsert, skipDuplicates: true });
    console.log(`  Exercises: +${exToInsert.length} (${EXERCISES.length - exToInsert.length} already present)`);

    const fiExisting = set(fi);
    const fiToInsert = FOOD_ITEMS
        .filter(([en]) => !fiExisting.has(en.toLowerCase()))
        .map(([name_en, name_ar, food_category, kcal, protein, carbs, fats]) => ({
            id: createId(), name_en, name_ar, food_category,
            serving_size: 100, serving_unit: 'g',
            calories_per_serving: kcal, protein_per_serving: protein, carbs_per_serving: carbs, fats_per_serving: fats,
        }));
    if (fiToInsert.length) await prisma.master_food_items.createMany({ data: fiToInsert, skipDuplicates: true });
    console.log(`  Food items: +${fiToInsert.length} (${FOOD_ITEMS.length - fiToInsert.length} already present)`);

    await seedFormTemplates();

    console.log('Done.');
}

main()
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
