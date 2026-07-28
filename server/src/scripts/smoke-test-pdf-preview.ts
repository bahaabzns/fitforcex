/**
 * One-off manual smoke test for the PDF Settings live preview endpoint —
 * renders both sample plan types with a workspace's saved settings plus a
 * draft override, writing the PDFs to disk to eyeball.
 *
 * Usage (from server/): npx ts-node -r tsconfig-paths/register src/scripts/smoke-test-pdf-preview.ts
 */
import fs from 'fs';
import path from 'path';
import pool from '../db';
import { getOrDefaultNutritionPdfSettings, getOrDefaultTrainingPdfSettings } from '../modules/pdfExport/pdfExport.service';
import { renderNutritionPlanHtml } from '../modules/pdfExport/templates/nutritionPlan';
import { renderTrainingPlanHtml } from '../modules/pdfExport/templates/trainingPlan';
import { SAMPLE_NUTRITION_PLAN, SAMPLE_TRAINING_PLAN, SAMPLE_CLIENT_NAME } from '../modules/pdfExport/templates/sampleData';
import { renderHtmlToPdf } from '../lib/pdfRenderer';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'scratchpad-pdf-smoke');

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const wsRow = (await pool.query('SELECT id FROM workspaces LIMIT 1')).rows[0];
    if (!wsRow) throw new Error('no workspace found in dev DB');

    const savedNutrition = await getOrDefaultNutritionPdfSettings(wsRow.id);
    const nutritionDraft = { ...savedNutrition, primary_color: '#E91E63', coach_name: 'Preview Test Coach' };
    const nutritionHtml = renderNutritionPlanHtml(SAMPLE_NUTRITION_PLAN, SAMPLE_CLIENT_NAME, nutritionDraft);
    const nutritionPdf = await renderHtmlToPdf(nutritionHtml, { width: nutritionDraft.page_width, height: nutritionDraft.page_height });
    fs.writeFileSync(path.join(OUT_DIR, 'preview-nutrition.pdf'), nutritionPdf);
    console.log('[smoke] wrote preview-nutrition.pdf,', nutritionPdf.length, 'bytes');

    const savedTraining = await getOrDefaultTrainingPdfSettings(wsRow.id);
    const trainingDraft = { ...savedTraining, primary_color: '#E91E63', coach_name: 'Preview Test Coach' };
    const trainingHtml = renderTrainingPlanHtml(SAMPLE_TRAINING_PLAN, SAMPLE_CLIENT_NAME, trainingDraft);
    const trainingPdf = await renderHtmlToPdf(trainingHtml, { width: trainingDraft.page_width, height: trainingDraft.page_height });
    fs.writeFileSync(path.join(OUT_DIR, 'preview-training.pdf'), trainingPdf);
    console.log('[smoke] wrote preview-training.pdf,', trainingPdf.length, 'bytes');
}

main()
    .catch((err) => { console.error('[smoke] FAILED:', err); process.exitCode = 1; })
    .finally(() => { pool.end(); process.exit(process.exitCode ?? 0); });
