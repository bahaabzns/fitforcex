import { training_pdf_settings } from '@prisma/client';
import { escapeHtml, formatNumber, pageBreak, renderShell, renderHeader, renderFooter, renderCoverPage, renderBackCoverPage } from './layout';
import { chunkByHeight } from './pagination';
import { measureBlockHeights } from '../../../lib/pdfRenderer';

type Row = Record<string, unknown>;

// `.page`'s own top+bottom padding (layout.ts) — subtracted from page_height
// to get the height actually available for a day's content.
const PAGE_PADDING_PT = 32 * 2;

function hasValue(v: unknown): boolean {
    return v !== null && v !== undefined && v !== '';
}

function renderSetsTable(sets: Row[]): string {
    // Tempo/RIR are optional per exercise (not every lift is tracked with
    // them) — showing an all-dashes column for a whole exercise's table adds
    // visual noise with zero information, so the column is dropped entirely
    // when none of this exercise's sets have a value for it, rather than
    // rendering "-" in every row.
    const hasTempo = sets.some((set) => hasValue(set.tempo));
    const hasRir = sets.some((set) => hasValue(set.rir));

    const headerCells = ['<th>Set</th>', '<th>Reps</th>', '<th>Rest</th>'];
    if (hasTempo) headerCells.push('<th>Tempo</th>');
    if (hasRir) headerCells.push('<th>RIR</th>');

    return `<table>
    <thead><tr>${headerCells.join('')}</tr></thead>
    <tbody>
      ${sets.map((set, index) => {
          const cells = [
              `<td>${index + 1}</td>`,
              `<td>${escapeHtml(set.reps ?? '-')}</td>`,
              `<td>${set.rest_seconds !== null && set.rest_seconds !== undefined ? `${formatNumber(set.rest_seconds)}s` : '-'}</td>`,
          ];
          if (hasTempo) cells.push(`<td>${escapeHtml(set.tempo ?? '-')}</td>`);
          if (hasRir) cells.push(`<td>${escapeHtml(set.rir ?? '-')}</td>`);
          return `<tr>${cells.join('')}</tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function renderExercise(exercise: Row, settings: training_pdf_settings): string {
    const sets = (exercise.sets as Row[]) ?? [];
    const name = exercise.name || exercise.library_name_en;
    // Reused from exercise_library — a coach sets this once per library
    // exercise (same upload path as the exercise picker / video player use
    // client-side) and it's already resolved to a public URL by
    // fetchFullTrainingPlan, so nothing new to fetch here.
    const showThumb = settings.show_exercise_thumbnail && exercise.thumbnail_path;
    const hasVideo = exercise.youtube_url || exercise.video_path;
    const thumbInner = `<img src="${escapeHtml(exercise.thumbnail_path)}" alt="" />${hasVideo ? '<span class="exercise-thumb-play">&#9654;</span>' : ''}`;
    // Only youtube_url gets a click-through link — video_path is a
    // self-hosted file with no public watch page to send a PDF reader to, so
    // it keeps the play-icon affordance without becoming a dead link.
    const thumb = showThumb
        ? (exercise.youtube_url
            ? `<a class="exercise-thumb" href="${escapeHtml(exercise.youtube_url)}">${thumbInner}</a>`
            : `<div class="exercise-thumb">${thumbInner}</div>`)
        : '';

    return `<div class="section">
  <div class="exercise-head">
    <div class="exercise-head-text">
      <h3>${escapeHtml(name)}${settings.show_exercise_equipment && exercise.equipment ? ` <span class="badge">${escapeHtml(exercise.equipment)}</span>` : ''}</h3>
    </div>
    ${thumb}
  </div>
  ${settings.show_sets_detail ? renderSetsTable(sets) : ''}
  ${exercise.notes && settings.show_exercise_notes ? `<div class="notes">${escapeHtml(exercise.notes)}</div>` : ''}
</div>`;
}

// DEBT: unlike the per-day exercise-content pages below, this table has no
// chunking at all — a day with enough exercises for this table alone to
// overflow one physical page would hit the same background/padding bug the
// auto-fit chunking in renderTrainingPlanHtml() exists to fix (see DEBT.md).
function renderDaySummaryPage(day: Row, settings: training_pdf_settings): string {
    const exercises = (day.exercises as Row[]) ?? [];
    return `<div class="page">
  ${renderHeader(settings)}
  <h2>${escapeHtml(day.name)}</h2>
  <table>
    <thead><tr><th>Exercise</th><th>Sets</th></tr></thead>
    <tbody>
      ${exercises.map((ex) => `<tr><td>${escapeHtml(ex.name || ex.library_name_en)}</td><td>${((ex.sets as Row[]) ?? []).length}</td></tr>`).join('')}
    </tbody>
  </table>
  ${day.notes && settings.show_notes ? `<div class="notes">${escapeHtml(day.notes)}</div>` : ''}
  ${renderFooter(settings, escapeHtml(day.name))}
</div>`;
}

// DEBT: same unchunked-table limitation as renderDaySummaryPage above, just
// triggered by day count instead of exercise count (see DEBT.md).
function renderPlanSummaryPage(plan: Row, settings: training_pdf_settings): string {
    const days = (plan.days as Row[]) ?? [];
    return `<div class="page">
  ${renderHeader(settings)}
  <h2>Plan Summary</h2>
  <table>
    <thead><tr><th>Day</th><th>Exercises</th></tr></thead>
    <tbody>
      ${days.map((day) => `<tr><td>${escapeHtml(day.name)}</td><td>${((day.exercises as Row[]) ?? []).length}</td></tr>`).join('')}
    </tbody>
  </table>
  ${renderFooter(settings, 'Summary')}
</div>`;
}

// A dedicated page right after the cover — not embedded in the cover itself,
// so it reads as its own thing rather than crowding the title/client-name
// layout, and it's always placed here (not tucked inside the plan-summary
// page) so it's guaranteed visible even when that page is toggled off.
function renderPlanNotesPage(plan: Row, settings: training_pdf_settings): string {
    return `<div class="page">
  ${renderHeader(settings)}
  <h2>Plan Notes</h2>
  <div class="notes">${escapeHtml(plan.notes)}</div>
  ${renderFooter(settings, 'Notes')}
</div>`;
}

// One day's exercises, already grouped into page-sized chunks — either by
// real measurement (auto-fit) or by a coach's manual max_exercises_per_page
// count. Either way, groupDayExercises() below is the only thing that needs
// to know which strategy is in effect.
type DayGroups = Row[][];

// Splits a day's exercises by a coach-set fixed count — today's exact
// pre-existing behavior, kept byte-for-byte unchanged when a coach has
// deliberately chosen a manual limit (no measurement pass runs at all).
function chunkByFixedCount(exercises: Row[], maxPerPage: number): DayGroups {
    const groups: DayGroups = [];
    for (let i = 0; i < exercises.length; i += maxPerPage) {
        groups.push(exercises.slice(i, i + maxPerPage));
    }
    return groups;
}

// Measures every day's heading, optional notes, and exercises in one
// Puppeteer round-trip for the whole plan, then chunks each day's exercises
// to what actually fits a physical page — see templates/pagination.ts and
// the design notes in pdfExport.controller.ts's DEBT.md entry for why this
// exists instead of letting one page grow past the physical page height.
async function measureDayGroups(days: Row[], settings: training_pdf_settings): Promise<DayGroups[]> {
    const blocks: string[] = [];
    blocks.push(renderHeader(settings));                 // index 0
    // Measured with the longest real day name in the plan (not a fixed
    // placeholder) — the footer is a flex row of two short spans, so
    // wrapping is unlikely regardless, but this keeps the measured height a
    // safe upper bound rather than an unverified assumption.
    const longestDayName = days.reduce((longest, day) => (
        String(day.name ?? '').length > longest.length ? String(day.name ?? '') : longest
    ), '');
    blocks.push(renderFooter(settings, escapeHtml(longestDayName))); // index 1

    const dayRanges = days.map((day) => {
        const headingIdx = blocks.length;
        blocks.push(`<h2>${escapeHtml(day.name)}</h2>`);
        let notesIdx: number | null = null;
        if (day.notes && settings.show_notes) {
            notesIdx = blocks.length;
            blocks.push(`<div class="notes">${escapeHtml(day.notes)}</div>`);
        }
        const exercises = (day.exercises as Row[]) ?? [];
        const exerciseStart = blocks.length;
        for (const exercise of exercises) {
            blocks.push(renderExercise(exercise, settings));
        }
        return { headingIdx, notesIdx, exerciseStart, exerciseCount: exercises.length };
    });

    const measureBody = blocks.map((html) => `<div data-measure-block>${html}</div>`).join('');
    const heights = await measureBlockHeights(renderShell(settings, measureBody), settings.page_width);

    const footerHeight = heights[1];
    const usableHeight = settings.page_height - PAGE_PADDING_PT - footerHeight;

    return days.map((day, dayIndex) => {
        const range = dayRanges[dayIndex];
        const exercises = (day.exercises as Row[]) ?? [];
        if (exercises.length === 0) return [];

        const restBudget = usableHeight - heights[range.headingIdx];
        const firstBudget = restBudget - (range.notesIdx !== null ? heights[range.notesIdx] : 0);
        const exerciseHeights = heights.slice(range.exerciseStart, range.exerciseStart + range.exerciseCount);
        return chunkByHeight(exercises, exerciseHeights, { first: firstBudget, rest: restBudget });
    });
}

export async function renderTrainingPlanHtml(plan: Row, clientName: string, settings: training_pdf_settings): Promise<string> {
    const days = (plan.days as Row[]) ?? [];
    const pages: string[] = [];

    if (settings.show_cover_page) {
        pages.push(renderCoverPage(settings as unknown as Parameters<typeof renderCoverPage>[0], {
            title:      String(plan.name ?? settings.cover_title),
            subtitle:   settings.cover_subtitle ?? undefined,
            clientName,
        }));
    }

    if (plan.notes && settings.show_notes) {
        pages.push(renderPlanNotesPage(plan, settings));
    }

    if (settings.show_plan_summary_page) {
        pages.push(renderPlanSummaryPage(plan, settings));
    }

    // Manual limit (> 0) keeps today's exact fixed-count chunking, with no
    // measurement pass at all — auto ("no limit", the default) is the mode
    // that used to cram every exercise into one ever-growing page.
    const autoFit = !settings.max_exercises_per_page || settings.max_exercises_per_page <= 0;
    const autoFitGroups = autoFit ? await measureDayGroups(days, settings) : null;

    days.forEach((day, dayIndex) => {
        if (settings.show_day_summary_page) {
            pages.push(renderDaySummaryPage(day, settings));
        }

        const exercises = (day.exercises as Row[]) ?? [];
        const groups = autoFitGroups
            ? autoFitGroups[dayIndex]
            : chunkByFixedCount(exercises, settings.max_exercises_per_page as number);

        groups.forEach((chunk, groupIndex) => {
            // Day notes go on the actual workout page too, not just the
            // separate day-summary page (which a coach may have toggled
            // off) — only on the day's first page so a multi-page day
            // doesn't repeat the same note on every chunk.
            const isFirstPageOfDay = groupIndex === 0;
            pages.push(`<div class="page">
  ${renderHeader(settings)}
  <h2>${escapeHtml(day.name)}</h2>
  ${isFirstPageOfDay && day.notes && settings.show_notes ? `<div class="notes">${escapeHtml(day.notes)}</div>` : ''}
  ${chunk.map((exercise) => renderExercise(exercise, settings)).join('')}
  ${renderFooter(settings, escapeHtml(day.name))}
</div>`);
        });
    });

    if (settings.show_back_cover_page) {
        pages.push(renderBackCoverPage(settings as unknown as Parameters<typeof renderBackCoverPage>[0]));
    }

    const body = pages.join(pageBreak());
    return renderShell(settings, body);
}
