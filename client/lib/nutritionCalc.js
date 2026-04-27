

export function calcItem(item) {
    const factor = item.amount / item.serving_size;
    return {
    calories: Math.round(item.calories_per_serving * factor * 10) / 10,
    protein: Math.round(item.protein_per_serving * factor * 10) / 10,
    carbs: Math.round(item.carbs_per_serving * factor * 10) / 10,
    fats: Math.round(item.fats_per_serving * factor * 10) / 10,
    };
}

export function calcMeal(meal) {
    return meal.items.reduce(
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
}

export function calcCycle(cycle) {
    return cycle.meals.reduce(
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
}
