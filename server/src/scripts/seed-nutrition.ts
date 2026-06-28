/**
 * Seed workspace food categories and food items for the nutrition module.
 * Idempotent — re-running will not create duplicates.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx ts-node -r tsconfig-paths/register src/scripts/seed-nutrition.ts [workspaceSlug]
 *
 * workspaceSlug defaults to "bahaa-bzns".
 */

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

const WORKSPACE_SLUG = process.argv[2] ?? 'bahaa-bzns';

const FOOD_CATEGORIES = [
    { name_en: 'Protein',       name_ar: 'بروتين' },
    { name_en: 'Carbohydrates', name_ar: 'كربوهيدرات' },
    { name_en: 'Vegetables',    name_ar: 'خضروات' },
];

// 10 items — macros are per 100 g serving unless noted
const FOOD_ITEMS: {
    name_en: string; name_ar: string; category: string;
    serving_size: number; serving_unit: string;
    kcal: number; protein: number; carbs: number; fats: number;
}[] = [
    // Protein (4)
    { name_en: 'Chicken Breast',    name_ar: 'صدر دجاج',       category: 'Protein',       serving_size: 100, serving_unit: 'g',  kcal: 165, protein: 31,  carbs: 0,    fats: 3.6 },
    { name_en: 'Eggs',              name_ar: 'بيض',             category: 'Protein',       serving_size: 100, serving_unit: 'g',  kcal: 155, protein: 13,  carbs: 1.1,  fats: 11  },
    { name_en: 'Salmon',            name_ar: 'سلمون',           category: 'Protein',       serving_size: 100, serving_unit: 'g',  kcal: 208, protein: 20,  carbs: 0,    fats: 13  },
    { name_en: 'Tuna (canned)',     name_ar: 'تونة معلبة',      category: 'Protein',       serving_size: 100, serving_unit: 'g',  kcal: 132, protein: 28,  carbs: 0,    fats: 1   },
    // Carbohydrates (4)
    { name_en: 'White Rice',        name_ar: 'أرز أبيض',        category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  kcal: 130, protein: 2.7, carbs: 28,   fats: 0.3 },
    { name_en: 'Brown Rice',        name_ar: 'أرز بني',         category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  kcal: 112, protein: 2.6, carbs: 24,   fats: 0.9 },
    { name_en: 'Oats',              name_ar: 'شوفان',           category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  kcal: 389, protein: 17,  carbs: 66,   fats: 7   },
    { name_en: 'Sweet Potato',      name_ar: 'بطاطا حلوة',      category: 'Carbohydrates', serving_size: 100, serving_unit: 'g',  kcal: 86,  protein: 1.6, carbs: 20,   fats: 0.1 },
    // Vegetables (2)
    { name_en: 'Broccoli',          name_ar: 'بروكلي',          category: 'Vegetables',    serving_size: 100, serving_unit: 'g',  kcal: 34,  protein: 2.8, carbs: 7,    fats: 0.4 },
    { name_en: 'Spinach',           name_ar: 'سبانخ',           category: 'Vegetables',    serving_size: 100, serving_unit: 'g',  kcal: 23,  protein: 2.9, carbs: 3.6,  fats: 0.4 },
];

async function main() {
    const workspace = await prisma.workspaces.findFirst({ where: { slug: WORKSPACE_SLUG } });
    if (!workspace) throw new Error(`Workspace with slug "${WORKSPACE_SLUG}" not found`);

    const workspaceId = workspace.id;
    console.log(`Seeding into workspace "${workspace.name}" (${workspaceId})\n`);

    // ── Categories ────────────────────────────────────────────────────────────
    const existingCategories = await prisma.food_categories.findMany({
        where:  { workspace_id: workspaceId },
        select: { name_en: true },
    });
    const existingCategoryNames = new Set(existingCategories.map((c) => c.name_en.toLowerCase()));

    const categoriesToInsert = FOOD_CATEGORIES.filter(
        (c) => !existingCategoryNames.has(c.name_en.toLowerCase()),
    );
    if (categoriesToInsert.length) {
        await prisma.food_categories.createMany({
            data: categoriesToInsert.map((c) => ({
                id: createId(), workspace_id: workspaceId, name_en: c.name_en, name_ar: c.name_ar,
            })),
        });
    }
    console.log(`food_categories: +${categoriesToInsert.length} inserted (${FOOD_CATEGORIES.length - categoriesToInsert.length} already present)`);

    // ── Food items ────────────────────────────────────────────────────────────
    const existingItems = await prisma.food_items.findMany({
        where:  { workspace_id: workspaceId },
        select: { name_en: true },
    });
    const existingItemNames = new Set(existingItems.map((i) => i.name_en.toLowerCase()));

    const itemsToInsert = FOOD_ITEMS.filter(
        (f) => !existingItemNames.has(f.name_en.toLowerCase()),
    );
    if (itemsToInsert.length) {
        await prisma.food_items.createMany({
            data: itemsToInsert.map((f) => ({
                id:                   createId(),
                workspace_id:         workspaceId,
                name_en:              f.name_en,
                name_ar:              f.name_ar,
                food_category:        f.category,
                serving_size:         f.serving_size,
                serving_unit:         f.serving_unit,
                calories_per_serving: f.kcal,
                protein_per_serving:  f.protein,
                carbs_per_serving:    f.carbs,
                fats_per_serving:     f.fats,
            })),
        });
    }
    console.log(`food_items:      +${itemsToInsert.length} inserted (${FOOD_ITEMS.length - itemsToInsert.length} already present)`);

    console.log('\nDone.');
}

main()
    .catch((err) => { console.error('Seed failed:', err.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
