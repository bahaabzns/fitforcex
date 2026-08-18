import { training_pdf_settings } from '@prisma/client';
import { escapeHtml, formatNumber, formatClock, pageBreak, renderShell, renderHeader, renderFooter, renderCoverPage, renderBackCoverPage, PAGE_PADDING_Y_PT, PAGE_PADDING_X_PT } from './layout';
import { chunkByHeight } from './pagination';
import { measureBlockHeights } from '../../../lib/pdfRenderer';
import { prescribedFieldsFor } from '../../../config/exerciseTrackingTypes';

type Row = Record<string, unknown>;

function hasValue(v: unknown): boolean {
    return v !== null && v !== undefined && v !== '';
}

const FIELD_LABEL: Record<string, string> = {
    reps: 'Reps', rest_seconds: 'Rest', tempo: 'Tempo', rir: 'RIR', rpe: 'RPE',
    duration_seconds: 'Duration', distance_km: 'Distance', incline_percent: 'Incline', speed_kmh: 'Speed',
};

function formatFieldCell(field: string, value: unknown): string {
    if (field === 'rest_seconds') return hasValue(value) ? `${formatNumber(value)}s` : '-';
    if (field === 'duration_seconds') return hasValue(value) ? formatClock(value) : '-';
    if (field === 'distance_km') return hasValue(value) ? `${formatNumber(value, 2)}km` : '-';
    if (field === 'incline_percent') return hasValue(value) ? `${formatNumber(value, 1)}%` : '-';
    if (field === 'speed_kmh') return hasValue(value) ? `${formatNumber(value, 1)}km/h` : '-';
    if (field === 'rpe') return hasValue(value) ? formatNumber(value, 1) : '-';
    return escapeHtml((value as string | number | null) ?? '-'); // reps/tempo/rir: free text or plain numbers
}

// Column set is entirely the coach's choice (tracked_metrics, set in the
// exercise library) — prescribedFieldsFor() already resolves base fields +
// the coach's selected metrics in canonical order, so there's no separate
// "does any set actually have a value" check needed here anymore.
function renderSetsTable(sets: Row[], exercise: Row): string {
    const fields = prescribedFieldsFor(exercise as { tracking_type?: string | null; tracked_metrics?: string[] | null });

    const headerCells = ['<th>Set</th>', ...fields.map((field) => `<th>${FIELD_LABEL[field]}</th>`)];

    return `<table>
    <thead><tr>${headerCells.join('')}</tr></thead>
    <tbody>
      ${sets.map((set, index) => {
          const cells = [`<td>${index + 1}</td>`, ...fields.map((field) => `<td>${formatFieldCell(field, set[field])}</td>`)];
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
  ${settings.show_sets_detail ? renderSetsTable(sets, exercise) : ''}
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
    // Viewport width narrowed by PAGE_PADDING_X_PT so the measured content
    // width matches `.page`'s real content box at render time (measure
    // blocks aren't wrapped in `.page`, so without this they'd measure
    // against the full page width and under-measure anything that wraps).
    const heights = await measureBlockHeights(renderShell(settings, measureBody), settings.page_width - PAGE_PADDING_X_PT);

    const headerHeight = heights[0];
    const footerHeight = heights[1];
    // Every content page renders the header too (see the `.page` block in
    // renderTrainingPlanHtml below) — omitting its height here let this
    // budget run over by roughly one header's worth, overflowing the
    // physical page and fragmenting the last item onto a near-empty
    // continuation page. See the plan/bug writeup for the full trace.
    const usableHeight = settings.page_height - PAGE_PADDING_Y_PT - headerHeight - footerHeight;

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
