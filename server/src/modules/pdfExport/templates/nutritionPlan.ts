import { nutrition_pdf_settings } from '@prisma/client';
import { escapeHtml, formatNumber, pageBreak, renderShell, renderHeader, renderFooter, renderCoverPage, renderBackCoverPage } from './layout';

type Row = Record<string, unknown>;

// Actual macro/calorie contribution of a serving amount, scaled from the food
// item's per-serving values — mirrors the ratio used by
// nutrition.service.ts's calculateEquivalentAmount, just solved for the
// macro/calorie output instead of an equivalent amount.
function scaledValue(amount: unknown, servingSize: unknown, perServing: unknown): number {
    const a = Number(amount);
    const s = Number(servingSize);
    const p = Number(perServing);
    if (!Number.isFinite(a) || !Number.isFinite(s) || !s || !Number.isFinite(p)) return 0;
    return (a / s) * p;
}

type MacroTotals = { calories: number; protein: number; carbs: number; fats: number };

function mealTotals(meal: Row): MacroTotals {
    const items = (meal.items as Row[]) ?? [];
    return items.reduce<MacroTotals>(
        (acc, item) => ({
            calories: acc.calories + scaledValue(item.amount, item.serving_size, item.calories_per_serving),
            protein:  acc.protein + scaledValue(item.amount, item.serving_size, item.protein_per_serving),
            carbs:    acc.carbs + scaledValue(item.amount, item.serving_size, item.carbs_per_serving),
            fats:     acc.fats + scaledValue(item.amount, item.serving_size, item.fats_per_serving),
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
}

function renderFoodRow(item: Row, settings: nutrition_pdf_settings): string {
    const cells = [`<td>${escapeHtml(item.name)}${item.is_swapped ? ' <span class="badge">swapped</span>' : ''}</td>`,
        `<td>${escapeHtml(item.amount)} ${escapeHtml(item.serving_unit)}</td>`];
    if (settings.show_food_calories) cells.push(`<td>${formatNumber(scaledValue(item.amount, item.serving_size, item.calories_per_serving))} kcal</td>`);
    if (settings.show_food_macros) {
        cells.push(`<td>P ${formatNumber(scaledValue(item.amount, item.serving_size, item.protein_per_serving))}g</td>`);
        cells.push(`<td>C ${formatNumber(scaledValue(item.amount, item.serving_size, item.carbs_per_serving))}g</td>`);
        cells.push(`<td>F ${formatNumber(scaledValue(item.amount, item.serving_size, item.fats_per_serving))}g</td>`);
    }
    let row = `<tr>${cells.join('')}</tr>`;

    if (settings.show_alternatives) {
        const alts = (item.alternatives as Row[]) ?? [];
        if (alts.length) {
            const altNames = alts.map((alt) => escapeHtml(alt.name)).join(', ');
            row += `<tr><td colspan="${cells.length}" class="notes">Alternatives: ${altNames}</td></tr>`;
        }
    }
    return row;
}

function renderMeal(meal: Row, settings: nutrition_pdf_settings): string {
    const totals = mealTotals(meal);
    const items = (meal.items as Row[]) ?? [];
    const headerCells = ['<th>Food</th>', '<th>Amount</th>'];
    if (settings.show_food_calories) headerCells.push('<th>Calories</th>');
    if (settings.show_food_macros) headerCells.push('<th>Protein</th>', '<th>Carbs</th>', '<th>Fats</th>');

    return `<div class="section">
  <h3>${escapeHtml(meal.name)}${settings.show_meal_totals ? ` <span class="badge">${formatNumber(totals.calories)} kcal</span>` : ''}</h3>
  ${meal.note && settings.show_notes ? `<div class="notes">${escapeHtml(meal.note)}</div>` : ''}
  <table>
    <thead><tr>${headerCells.join('')}</tr></thead>
    <tbody>${items.map((item) => renderFoodRow(item, settings)).join('')}</tbody>
  </table>
</div>`;
}

function renderCycleSummaryPage(cycle: Row, settings: nutrition_pdf_settings, pageLabel: string): string {
    return `<div class="page">
  ${renderHeader(settings)}
  <h2>${escapeHtml(cycle.name)}</h2>
  ${settings.show_cycle_totals ? `<table>
    <thead><tr><th>Goal Calories</th><th>Goal Protein</th><th>Goal Carbs</th><th>Goal Fats</th></tr></thead>
    <tbody><tr>
      <td>${formatNumber(cycle.goal_calories)} kcal</td>
      <td>${formatNumber(cycle.goal_protein)} g</td>
      <td>${formatNumber(cycle.goal_carbs)} g</td>
      <td>${formatNumber(cycle.goal_fats)} g</td>
    </tr></tbody>
  </table>` : ''}
  ${cycle.note && settings.show_notes ? `<div class="notes">${escapeHtml(cycle.note)}</div>` : ''}
  ${renderFooter(settings, pageLabel)}
</div>`;
}

function renderPlanSummaryPage(plan: Row, settings: nutrition_pdf_settings): string {
    const cycles = (plan.cycles as Row[]) ?? [];
    return `<div class="page">
  ${renderHeader(settings)}
  <h2>Plan Summary</h2>
  <table>
    <thead><tr><th>Cycle</th><th>Meals</th><th>Goal Calories</th></tr></thead>
    <tbody>
      ${cycles.map((cycle) => `<tr>
        <td>${escapeHtml(cycle.name)}</td>
        <td>${((cycle.meals as Row[]) ?? []).length}</td>
        <td>${formatNumber(cycle.goal_calories)} kcal</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${renderFooter(settings, 'Summary')}
</div>`;
}

export function renderNutritionPlanHtml(plan: Row, clientName: string, settings: nutrition_pdf_settings): string {
    const cycles = (plan.cycles as Row[]) ?? [];
    const pages: string[] = [];

    if (settings.show_cover_page) {
        pages.push(renderCoverPage(settings as unknown as Parameters<typeof renderCoverPage>[0], {
            title:      String(plan.name ?? settings.cover_title),
            subtitle:   settings.cover_subtitle ?? undefined,
            clientName,
        }));
    }

    if (settings.show_plan_summary_page) {
        pages.push(renderPlanSummaryPage(plan, settings));
    }

    for (const cycle of cycles) {
        if (settings.show_cycle_summary_page) {
            pages.push(renderCycleSummaryPage(cycle, settings, escapeHtml(cycle.name)));
        }
        if (settings.show_meal_summary_page) {
            const meals = (cycle.meals as Row[]) ?? [];
            const maxPerPage = settings.max_meals_per_page && settings.max_meals_per_page > 0
                ? settings.max_meals_per_page
                : meals.length || 1;

            for (let i = 0; i < meals.length; i += maxPerPage) {
                const chunk = meals.slice(i, i + maxPerPage);
                pages.push(`<div class="page">
  ${renderHeader(settings)}
  <h2>${escapeHtml(cycle.name)}</h2>
  ${chunk.map((meal) => renderMeal(meal, settings)).join('')}
  ${renderFooter(settings, escapeHtml(cycle.name))}
</div>`);
            }
        }
    }

    if (settings.show_back_cover_page) {
        pages.push(renderBackCoverPage(settings as unknown as Parameters<typeof renderBackCoverPage>[0]));
    }

    const body = pages.join(pageBreak());
    return renderShell(settings, body);
}
