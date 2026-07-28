import { training_pdf_settings } from '@prisma/client';
import { escapeHtml, formatNumber, pageBreak, renderShell, renderHeader, renderFooter, renderCoverPage, renderBackCoverPage } from './layout';

type Row = Record<string, unknown>;

function renderSetsTable(sets: Row[]): string {
    return `<table>
    <thead><tr><th>Set</th><th>Reps</th><th>Rest</th><th>Tempo</th><th>RIR</th></tr></thead>
    <tbody>
      ${sets.map((set, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(set.reps ?? '-')}</td>
        <td>${set.rest_seconds !== null && set.rest_seconds !== undefined ? `${formatNumber(set.rest_seconds)}s` : '-'}</td>
        <td>${escapeHtml(set.tempo ?? '-')}</td>
        <td>${escapeHtml(set.rir ?? '-')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderExercise(exercise: Row, settings: training_pdf_settings): string {
    const sets = (exercise.sets as Row[]) ?? [];
    const name = exercise.name || exercise.library_name_en;

    return `<div class="section">
  <h3>${escapeHtml(name)}${settings.show_exercise_equipment && exercise.equipment ? ` <span class="badge">${escapeHtml(exercise.equipment)}</span>` : ''}</h3>
  ${settings.show_sets_detail ? renderSetsTable(sets) : ''}
  ${exercise.notes && settings.show_exercise_notes ? `<div class="notes">${escapeHtml(exercise.notes)}</div>` : ''}
</div>`;
}

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
  ${plan.notes && settings.show_notes ? `<div class="notes">${escapeHtml(plan.notes)}</div>` : ''}
  ${renderFooter(settings, 'Summary')}
</div>`;
}

export function renderTrainingPlanHtml(plan: Row, clientName: string, settings: training_pdf_settings): string {
    const days = (plan.days as Row[]) ?? [];
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

    for (const day of days) {
        if (settings.show_day_summary_page) {
            pages.push(renderDaySummaryPage(day, settings));
        }

        const exercises = (day.exercises as Row[]) ?? [];
        const maxPerPage = settings.max_exercises_per_page && settings.max_exercises_per_page > 0
            ? settings.max_exercises_per_page
            : exercises.length || 1;

        for (let i = 0; i < exercises.length; i += maxPerPage) {
            const chunk = exercises.slice(i, i + maxPerPage);
            pages.push(`<div class="page">
  ${renderHeader(settings)}
  <h2>${escapeHtml(day.name)}</h2>
  ${chunk.map((exercise) => renderExercise(exercise, settings)).join('')}
  ${renderFooter(settings, escapeHtml(day.name))}
</div>`);
        }
    }

    if (settings.show_back_cover_page) {
        pages.push(renderBackCoverPage(settings as unknown as Parameters<typeof renderBackCoverPage>[0]));
    }

    const body = pages.join(pageBreak());
    return renderShell(settings, body);
}
