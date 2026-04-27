

const r2 = (n) => Math.round(n * 100) / 100;

export function calcItem(item) {
    const factor = item.amount / item.serving_size;
    return {
    calories: r2(item.calories_per_serving * factor),
    protein: r2(item.protein_per_serving * factor),
    carbs: r2(item.carbs_per_serving * factor),
    fats: r2(item.fats_per_serving * factor),
    };
}

export function calcMeal(meal) {
    const raw = meal.items.reduce(
    (totals, item) => {
        const itemTotals = calcItem(item);
        totals.calories += itemTotals.calories;
        totals.protein += itemTotals.protein;
        totals.carbs += itemTotals.carbs;
        totals.fats += itemTotals.fats;
        return totals;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );
    return { calories: r2(raw.calories), protein: r2(raw.protein), carbs: r2(raw.carbs), fats: r2(raw.fats) };
}

export function calcCycle(cycle) {
    const raw = cycle.meals.reduce(
    (totals, meal) => {
        const mealTotals = calcMeal(meal);
        totals.calories += mealTotals.calories;
        totals.protein += mealTotals.protein;
        totals.carbs += mealTotals.carbs;
        totals.fats += mealTotals.fats;
        return totals;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );
    return { calories: r2(raw.calories), protein: r2(raw.protein), carbs: r2(raw.carbs), fats: r2(raw.fats) };
}
