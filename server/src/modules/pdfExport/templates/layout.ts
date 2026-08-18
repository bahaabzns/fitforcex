// Every value that comes from plan/food/exercise content (coach-entered text)
// must go through this before landing in the HTML string — the render page
// has JS disabled (see lib/pdfRenderer.ts) as a second layer, but broken
// markup from an unescaped "<" in a note would still visually corrupt the PDF.
export function escapeHtml(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatNumber(value: unknown, fractionDigits = 0): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return n.toFixed(fractionDigits);
}

/** Seconds -> "M:SS" for a duration-tracked set (e.g. a plank hold or a treadmill run). */
export function formatClock(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return '-';
    const total = Math.round(n);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// A plain structural type (not derived from one Prisma model) — both
// nutrition_pdf_settings and training_pdf_settings have this exact field
// shape for the concerns shared across plan types, and are fully independent
// tables otherwise (see DECISIONS.md, 2026-07-28), so neither model is the
// "real" owner of this shape.
export type PageSettings = {
    coach_name: string;
    footer_text: string;
    primary_color: string;
    header_text_color: string;
    table_header_bg_color: string;
    table_alt_bg_color: string;
    logo_url: string | null;
    page_bg_image_url: string | null;
    page_width: number;
    page_height: number;
    body_text_color: string;
    // Optional: only training_pdf_settings has this column — nutrition's
    // settings object simply won't have the property, which is fine since
    // exerciseThumbSize() below falls back to 'medium' when it's absent.
    exercise_thumbnail_size?: string;
};

export function pageBreak(): string {
    return '<div class="page-break"></div>';
}

// `.page`'s own padding (see the `.page` rule in renderShell's stylesheet
// below) — the single source of truth trainingPlan.ts/nutritionPlan.ts's
// pagination math derives both the per-page height budget (Y) and the
// measurement viewport's content width (X) from, so a future change to this
// CSS can't silently drift out of sync with either.
export const PAGE_PADDING_Y_PT = 32 * 2; // top + bottom
export const PAGE_PADDING_X_PT = 36 * 2; // left + right

// Preset sizes (points) for the exercise thumbnail in trainingPlan.ts —
// fixed width:height ratio (~1.4545:1) across all three so the image never
// looks stretched, whichever size a coach picks.
const EXERCISE_THUMB_SIZES: Record<string, { width: number; height: number }> = {
    small:  { width: 48, height: 33 },
    medium: { width: 64, height: 44 },
    large:  { width: 96, height: 66 },
};

export function exerciseThumbSize(size: string | undefined): { width: number; height: number } {
    return EXERCISE_THUMB_SIZES[size ?? 'medium'] ?? EXERCISE_THUMB_SIZES.medium;
}

// Shared print CSS + header/footer chrome, driven entirely by pdf_settings —
// never hardcode a brand color/text here, or two coaches' exports would look
// identical regardless of their settings.
export function renderShell(settings: PageSettings, bodyHtml: string): string {
    // Applied per `.page` div, not on `<body>` — the body is one continuous
    // element spanning every page's content concatenated together, so a
    // body-level `background-size: cover` scales the image to the *whole*
    // multi-page document's height, leaving every page after the first
    // showing just an arbitrary cropped sliver of it. Scoping it to `.page`
    // (with `min-height: page_height` so short pages still get full
    // coverage) makes each physical PDF page show its own independent,
    // correctly-scaled copy of the image instead.
    const bgImage = settings.page_bg_image_url
        ? `background-image: url('${escapeHtml(settings.page_bg_image_url)}'); background-size: cover; background-position: center; background-repeat: no-repeat;`
        : '';
    const thumbSize = exerciseThumbSize(settings.exercise_thumbnail_size);

    // `.section` (below, in the stylesheet) gets `page-break-inside: avoid` —
    // `.page` has no max-height, only `min-height`, so when a day/cycle's
    // content is taller than one physical page, Chromium's print engine
    // paginates the overflow across additional physical pages on its own.
    // Without that rule, it doesn't know a `.section` — one exercise
    // (training) or one meal (nutrition) — is meant to stay together, and
    // happily splits it mid-table between two pages; with it, an overflowing
    // section is pushed to the next page whole instead.
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: ${escapeHtml(settings.body_text_color)};
    font-size: 11pt;
  }
  .page { padding: 32pt 36pt; position: relative; min-height: ${settings.page_height}pt; ${bgImage} }
  .page-break { page-break-after: always; }
  h1, h2, h3 { margin: 0 0 8pt 0; }
  h1 { font-size: 24pt; color: ${escapeHtml(settings.primary_color)}; }
  h2 { font-size: 16pt; color: ${escapeHtml(settings.primary_color)}; }
  h3 { font-size: 12pt; color: ${escapeHtml(settings.primary_color)}; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 16pt 0; }
  th {
    background: ${escapeHtml(settings.table_header_bg_color)};
    color: ${escapeHtml(settings.header_text_color)};
    text-align: left;
    padding: 6pt 8pt;
    font-size: 9pt;
    text-transform: uppercase;
  }
  td { padding: 6pt 8pt; font-size: 10pt; border-bottom: 0.5pt solid #eee; }
  tr:nth-child(even) td { background: ${escapeHtml(settings.table_alt_bg_color)}; }
  .header { display: flex; align-items: center; gap: 12pt; margin-bottom: 20pt; border-bottom: 1pt solid #eee; padding-bottom: 12pt; }
  .header img { height: 32pt; }
  .header .brand { font-size: 13pt; font-weight: bold; color: ${escapeHtml(settings.primary_color)}; }
  .footer { position: absolute; bottom: 12pt; left: 36pt; right: 36pt; font-size: 8pt; display: flex; justify-content: space-between; }
  .notes { font-size: 9.5pt; font-style: italic; margin-top: 4pt; }
  .section { margin-bottom: 20pt; page-break-inside: avoid; break-inside: avoid; }
  .badge { display: inline-block; padding: 2pt 8pt; border-radius: 10pt; background: ${escapeHtml(settings.table_header_bg_color)}; color: ${escapeHtml(settings.header_text_color)}; font-size: 9pt; margin-right: 6pt; }
  .exercise-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12pt; }
  .exercise-head-text { flex: 1; min-width: 0; }
  .exercise-thumb { display: block; position: relative; width: ${thumbSize.width}pt; height: ${thumbSize.height}pt; flex-shrink: 0; border-radius: 4pt; overflow: hidden; text-decoration: none; color: inherit; }
  .exercise-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .exercise-thumb-play { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 18pt; height: 18pt; border-radius: 50%; background: rgba(0,0,0,0.55); color: #fff; font-size: 8pt; display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function renderHeader(settings: PageSettings): string {
    // Both display name and logo are optional now — with neither set, an
    // empty header bar (just its bottom border) would show as a stray blank
    // strip at the top of every page, so skip rendering it entirely instead.
    if (!settings.logo_url && !settings.coach_name) return '';
    const logo = settings.logo_url
        ? `<img src="${escapeHtml(settings.logo_url)}" alt="" />`
        : '';
    const brand = settings.coach_name
        ? `<div class="brand">${escapeHtml(settings.coach_name)}</div>`
        : '';
    return `<div class="header">${logo}${brand}</div>`;
}

export function renderFooter(settings: PageSettings, pageLabel: string): string {
    return `<div class="footer"><span>${escapeHtml(settings.footer_text)}</span><span>${escapeHtml(pageLabel)}</span></div>`;
}

export function renderCoverPage(
    settings: PageSettings & {
        cover_title: string; cover_subtitle: string | null; cover_image_url: string | null;
        show_cover_header: boolean; show_cover_title: boolean; show_cover_subtitle: boolean; show_cover_client_name: boolean;
    },
    opts: { title: string; subtitle?: string; clientName: string }
): string {
    // The cover image fills the whole page as a background rather than
    // sitting as a small inset picture — it's upload-validated (see
    // pdfExport.controller.ts's uploadCoverImage) to exactly match the page's
    // pixel dimensions, so `cover` sizing here is a safety net, not the thing
    // doing the real fitting work.
    const coverBg = settings.cover_image_url
        ? `background-image: url('${escapeHtml(settings.cover_image_url)}'); background-size: cover; background-position: center; background-repeat: no-repeat;`
        : '';
    // height: page_height (not page_height - padding) — `.page`'s own 32pt
    // top/bottom padding is already included in that height by the global
    // `box-sizing: border-box` rule; subtracting it again left the div (and
    // the cover background image filling it) 64pt short of the real page,
    // showing up as a blank white strip at the bottom.
    return `<div class="page" style="display:flex; flex-direction:column; justify-content:center; align-items:center; height: ${settings.page_height}pt; text-align:center; ${coverBg}">
  ${settings.show_cover_header ? renderHeader(settings) : ''}
  ${settings.show_cover_title ? `<h1 style="font-size:30pt;">${escapeHtml(opts.title)}</h1>` : ''}
  ${settings.show_cover_subtitle && opts.subtitle ? `<h2 style="font-weight:normal;">${escapeHtml(opts.subtitle)}</h2>` : ''}
  ${settings.show_cover_client_name ? `<p style="font-size:13pt; margin-top:24pt;">Prepared for <strong>${escapeHtml(opts.clientName)}</strong></p>` : ''}
  ${renderFooter(settings, 'Cover')}
</div>`;
}

export function renderBackCoverPage(settings: PageSettings & { back_cover_bg_image_url: string | null }): string {
    const bg = settings.back_cover_bg_image_url
        ? `background-image: url('${escapeHtml(settings.back_cover_bg_image_url)}'); background-size: cover;`
        : '';
    return `<div class="page" style="height: ${settings.page_height}pt; ${bg}"></div>`;
}
