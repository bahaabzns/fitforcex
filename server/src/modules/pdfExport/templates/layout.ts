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
};

export function pageBreak(): string {
    return '<div class="page-break"></div>';
}

// Shared print CSS + header/footer chrome, driven entirely by pdf_settings —
// never hardcode a brand color/text here, or two coaches' exports would look
// identical regardless of their settings.
export function renderShell(settings: PageSettings, bodyHtml: string): string {
    const bgImage = settings.page_bg_image_url
        ? `background-image: url('${escapeHtml(settings.page_bg_image_url)}'); background-size: cover;`
        : '';

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    font-size: 11pt;
    ${bgImage}
  }
  .page { padding: 32pt 36pt; position: relative; }
  .page-break { page-break-after: always; }
  h1, h2, h3 { margin: 0 0 8pt 0; }
  h1 { font-size: 24pt; color: ${escapeHtml(settings.primary_color)}; }
  h2 { font-size: 16pt; color: ${escapeHtml(settings.primary_color)}; }
  h3 { font-size: 12pt; }
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
  .footer { position: absolute; bottom: 12pt; left: 36pt; right: 36pt; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }
  .notes { font-size: 9.5pt; color: #555; font-style: italic; margin-top: 4pt; }
  .section { margin-bottom: 20pt; }
  .badge { display: inline-block; padding: 2pt 8pt; border-radius: 10pt; background: ${escapeHtml(settings.table_header_bg_color)}; font-size: 9pt; margin-right: 6pt; }
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
