// Pure helpers for computing/serializing food diary entries. The per-item
// detail lives in food_diary_entries.items (a JSON snapshot, taken from the
// client's active nutrition plan the first time a day's diary is opened —
// see clientPortal.controller.ts's buildTodaySnapshot for why a live FK
// wouldn't survive the next coach plan edit). Shared by the client-portal
// and coach (clients) modules, same role workoutLogStats.ts plays for
// workout logs. No external dependencies — keep it pure.

/** Most recent N diary days returned by the client-portal and coach history endpoints. */
export const FOOD_DIARY_HISTORY_LIMIT = 90;

export interface FoodDiaryItem {
    meal_item_id:         string;
    food_item_id:          string | null;
    meal_name:             string;
    name_en:               string | null;
    name_ar:               string | null;
    prescribed_amount:     number;
    amount_eaten:          number;
    serving_unit:          string | null;
    serving_size:          number | null;
    calories_per_serving:  number;
    protein_per_serving:   number;
    carbs_per_serving:     number;
    fats_per_serving:      number;
}

export interface FoodDiaryEntryRow {
    id:             string;
    date:           string | Date;
    plan_id:        string | null;
    cycle_id:       string | null;
    items:          unknown;
    total_calories: unknown;
    total_protein:  unknown;
    total_carbs:    unknown;
    total_fats:     unknown;
    goal_calories:  number | null;
    goal_protein:   number | null;
    goal_carbs:     number | null;
    goal_fats:      number | null;
}

/** Actual macro/calorie contribution of amount_eaten, scaled from the food's per-serving values. */
function scaledValue(amountEaten: number, servingSize: number | null, perServing: number): number {
    if (!servingSize) return 0;
    return (amountEaten / servingSize) * perServing;
}

export function computeTotals(items: FoodDiaryItem[]) {
    return items.reduce(
        (acc, it) => ({
            calories: acc.calories + scaledValue(it.amount_eaten, it.serving_size, it.calories_per_serving),
            protein:  acc.protein + scaledValue(it.amount_eaten, it.serving_size, it.protein_per_serving),
            carbs:    acc.carbs + scaledValue(it.amount_eaten, it.serving_size, it.carbs_per_serving),
            fats:     acc.fats + scaledValue(it.amount_eaten, it.serving_size, it.fats_per_serving),
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
}

/**
 * Adherence — the decided metric (calories/macros vs. the cycle's goals at
 * the time the day's diary was snapshotted), averaged across whichever of
 * the four goals are actually set (a cycle isn't required to set all four).
 * Null, not 0, when no goal exists at all — "no target" isn't "0% adherent".
 * Capped at 100 per-macro: adherence means "how much of the target you hit",
 * and eating past the target is still fully adherent, not "227% adherent".
 */
export function computeAdherence(entry: FoodDiaryEntryRow): number | null {
    const pairs: Array<[number | null, unknown]> = [
        [entry.goal_calories, entry.total_calories],
        [entry.goal_protein, entry.total_protein],
        [entry.goal_carbs, entry.total_carbs],
        [entry.goal_fats, entry.total_fats],
    ];
    const ratios = pairs
        .filter(([goal]) => goal !== null && goal > 0)
        .map(([goal, total]) => Math.min((Number(total ?? 0) / (goal as number)) * 100, 100));
    if (ratios.length === 0) return null;
    return Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length);
}

export interface ItemAdherenceSummary {
    food_item_id: string | null;
    name_en:      string | null;
    name_ar:      string | null;
    avg_pct:      number;
    occurrences:  number;
}

/**
 * Per-item "amount eaten vs. prescribed" average across a set of entries,
 * worst first. Grouped by food_item_id (falling back to meal_item_id when
 * a legacy/manual item has none) so the same food eaten under different
 * meal_item_ids across plan edits still rolls up into one row. Items with
 * no prescribed amount are skipped -- there's nothing to compare against.
 * Capped at 100 for the same reason as computeAdherence -- eating more of an
 * item than prescribed is still fully adherent for that item, not a bonus.
 */
export function computeItemAdherence(entries: FoodDiaryEntryRow[]): ItemAdherenceSummary[] {
    const groups = new Map<string, { name_en: string | null; name_ar: string | null; food_item_id: string | null; sum: number; count: number }>();
    for (const entry of entries) {
        const items = Array.isArray(entry.items) ? entry.items as FoodDiaryItem[] : [];
        for (const item of items) {
            if (!item.prescribed_amount || item.prescribed_amount <= 0) continue;
            const key = item.food_item_id ?? item.meal_item_id;
            const pct = Math.min((item.amount_eaten / item.prescribed_amount) * 100, 100);
            const existing = groups.get(key);
            if (existing) {
                existing.sum += pct;
                existing.count += 1;
            } else {
                groups.set(key, { name_en: item.name_en, name_ar: item.name_ar, food_item_id: item.food_item_id, sum: pct, count: 1 });
            }
        }
    }
    return Array.from(groups.values())
        .map((g) => ({ food_item_id: g.food_item_id, name_en: g.name_en, name_ar: g.name_ar, avg_pct: Math.round(g.sum / g.count), occurrences: g.count }))
        .sort((a, b) => a.avg_pct - b.avg_pct);
}

/** Average of each entry's own computeAdherence(), ignoring entries with no goal set. Null if none had one. */
export function computePlanAdherence(entries: FoodDiaryEntryRow[]): number | null {
    const values = entries.map(computeAdherence).filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export interface PlanAdherenceSummary {
    planId:             string;
    planName:           string | null;
    entryCount:         number;
    avgAdherence:       number | null;
    firstDate:          Date;
    lastDate:           Date;
    leastAdherentItems: ItemAdherenceSummary[];
}

export interface FoodDiaryAdherenceRollup {
    plans:              PlanAdherenceSummary[];
    leastAdherentItems: ItemAdherenceSummary[];
    dailySeries:        { date: Date; adherence: number | null; planId: string | null }[];
}

/**
 * Cross-day rollup for the coach's "Food Diary" adherence view: adherence
 * grouped per nutrition plan (each with its own weakest items), the
 * all-plans weakest items, and a per-day trend series. `planNameById` is
 * passed in rather than looked up here to keep this Prisma-free and testable.
 */
export function summarizeFoodDiaryAdherence(
    entries: FoodDiaryEntryRow[],
    planNameById: Map<string, string>,
    leastAdherentLimit: number
): FoodDiaryAdherenceRollup {
    const entriesByPlan = new Map<string, FoodDiaryEntryRow[]>();
    for (const entry of entries) {
        if (!entry.plan_id) continue;
        const bucket = entriesByPlan.get(entry.plan_id);
        if (bucket) bucket.push(entry);
        else entriesByPlan.set(entry.plan_id, [entry]);
    }

    const plans = Array.from(entriesByPlan.entries())
        .map(([planId, planEntries]) => {
            const dates = planEntries.map((e) => e.date as Date).sort((a, b) => a.getTime() - b.getTime());
            return {
                planId,
                planName:           planNameById.get(planId) ?? null,
                entryCount:         planEntries.length,
                avgAdherence:       computePlanAdherence(planEntries),
                firstDate:          dates[0],
                lastDate:           dates[dates.length - 1],
                leastAdherentItems: computeItemAdherence(planEntries).slice(0, leastAdherentLimit),
            };
        })
        .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());

    return {
        plans,
        leastAdherentItems: computeItemAdherence(entries).slice(0, leastAdherentLimit),
        // One point per logged day, oldest first -- backs the modal's adherence
        // trend chart. `planId` lets the client filter this down to one plan's
        // trend without a second round trip; `adherence` is null on days with
        // no goal set, same meaning as computeAdherence everywhere else.
        dailySeries: entries.map((e) => ({ date: e.date as Date, adherence: computeAdherence(e), planId: e.plan_id })),
    };
}

export function serializeDiaryEntry(entry: FoodDiaryEntryRow) {
    return {
        id:             entry.id,
        date:           entry.date,
        plan_id:        entry.plan_id,
        cycle_id:       entry.cycle_id,
        items:          Array.isArray(entry.items) ? entry.items : [],
        total_calories: entry.total_calories !== null ? Number(entry.total_calories) : 0,
        total_protein:  entry.total_protein !== null ? Number(entry.total_protein) : 0,
        total_carbs:    entry.total_carbs !== null ? Number(entry.total_carbs) : 0,
        total_fats:     entry.total_fats !== null ? Number(entry.total_fats) : 0,
        goal_calories:  entry.goal_calories,
        goal_protein:   entry.goal_protein,
        goal_carbs:     entry.goal_carbs,
        goal_fats:      entry.goal_fats,
        adherence:      computeAdherence(entry),
    };
}
