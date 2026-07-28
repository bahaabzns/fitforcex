/**
 * One-off manual smoke test for the PDF export pipeline — not part of the
 * automated test suite. Renders a real nutrition plan and a real training
 * plan from the dev DB straight through fetchFull*Plan -> template -> Puppeteer,
 * writing the PDFs to disk so they can be opened and eyeballed.
 *
 * Usage (from server/): npx ts-node -r tsconfig-paths/register src/scripts/smoke-test-pdf-export.ts
 */
import fs from 'fs';
import path from 'path';
import pool from '../db';
import { fetchFullNutritionPlan } from '../modules/nutrition/nutrition.service';
import { fetchFullTrainingPlan } from '../modules/training/training.service';
import { renderNutritionPlanHtml } from '../modules/pdfExport/templates/nutritionPlan';
import { renderTrainingPlanHtml } from '../modules/pdfExport/templates/trainingPlan';
import { getOrDefaultNutritionPdfSettings, getOrDefaultTrainingPdfSettings } from '../modules/pdfExport/pdfExport.service';
import { renderHtmlToPdf } from '../lib/pdfRenderer';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'scratchpad-pdf-smoke');

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const nutritionRow = (await pool.query('SELECT id, workspace_id FROM nutrition_plans LIMIT 1')).rows[0];
    const trainingRow = (await pool.query('SELECT id, workspace_id FROM training_plans LIMIT 1')).rows[0];

    if (nutritionRow) {
        console.log('[smoke] rendering nutrition plan', nutritionRow.id);
        const plan = await fetchFullNutritionPlan(nutritionRow.id, nutritionRow.workspace_id);
        if (!plan) throw new Error('nutrition plan fetch returned null unexpectedly');
        const settings = await getOrDefaultNutritionPdfSettings(nutritionRow.workspace_id);
        const html = renderNutritionPlanHtml(plan as Record<string, unknown>, 'Test Client', settings);
        const pdf = await renderHtmlToPdf(html, { width: settings.page_width, height: settings.page_height });
        fs.writeFileSync(path.join(OUT_DIR, 'nutrition-plan.pdf'), pdf);
        console.log('[smoke] wrote nutrition-plan.pdf,', pdf.length, 'bytes');
    } else {
        console.log('[smoke] no nutrition_plans rows found, skipping');
    }

    if (trainingRow) {
        console.log('[smoke] rendering training plan', trainingRow.id);
        const plan = await fetchFullTrainingPlan(trainingRow.id, trainingRow.workspace_id);
        if (!plan) throw new Error('training plan fetch returned null unexpectedly');
        const settings = await getOrDefaultTrainingPdfSettings(trainingRow.workspace_id);
        const html = renderTrainingPlanHtml(plan as Record<string, unknown>, 'Test Client', settings);
        const pdf = await renderHtmlToPdf(html, { width: settings.page_width, height: settings.page_height });
        fs.writeFileSync(path.join(OUT_DIR, 'training-plan.pdf'), pdf);
        console.log('[smoke] wrote training-plan.pdf,', pdf.length, 'bytes');
    } else {
        console.log('[smoke] no training_plans rows found, skipping');
    }
}

main()
    .catch((err) => { console.error('[smoke] FAILED:', err); process.exitCode = 1; })
    .finally(() => { pool.end(); process.exit(process.exitCode ?? 0); });
