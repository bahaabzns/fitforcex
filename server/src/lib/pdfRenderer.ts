/// <reference lib="dom" />
// The reference above pulls in DOM types (document, HTMLElement, ...) for
// type-checking *this file only* — needed because measureBlockHeights()'s
// page.evaluate() callback runs inside a real browser page, not Node. It
// doesn't add "dom" to the project's tsconfig globally, so it can't shadow
// Node/Express globals (Buffer, Request, Response, ...) used elsewhere.
import type { Browser } from 'puppeteer';
import { ptToPx, pxToPt } from '../modules/pdfExport/templates/pagination';

// Loaded lazily (not a static top-level import): puppeteer ships as a pure
// ESM package ("type": "module", no CJS build). A static `import` here gets
// pulled in transitively by every file that imports app.ts — including the
// whole Jest integration suite via tests/helpers/testServer.ts — and Jest's
// CJS-only module runtime can't parse puppeteer's `export * from ...` syntax,
// which broke every unrelated test, not just this feature's. A dynamic
// `import()` is preserved as a real ECMAScript dynamic import even under this
// project's `module: commonjs` target, so it only resolves puppeteer at the
// point something actually calls renderHtmlToPdf.
async function loadPuppeteer() {
    return import('puppeteer');
}

// One headless Chromium instance for the process lifetime. Launching a fresh
// browser per export request is the usual way these features end up slow and
// memory-hungry in production — a page (closed after each render) is cheap,
// a browser process is not.
let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
    const { default: puppeteer } = await loadPuppeteer();
    return puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
}

async function getBrowser(): Promise<Browser> {
    if (!browserPromise) {
        browserPromise = launchBrowser();
    }
    try {
        const browser = await browserPromise;
        if (!browser.connected) throw new Error('Puppeteer browser disconnected');
        return browser;
    } catch (err) {
        // Prior launch is unusable (crashed / disconnected) — drop it so the
        // next call relaunches instead of permanently failing every export.
        browserPromise = null;
        throw err;
    }
}

export async function renderHtmlToPdf(
    html: string,
    pageSize: { width: number; height: number }
): Promise<Buffer> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        // Plan/food/exercise content is coach-entered text embedded straight into
        // this HTML (see templates/*.ts) — disabling JS means an injected
        // <script>/onerror payload just renders as inert markup instead of
        // executing in a page that has real network access.
        await page.setJavaScriptEnabled(false);
        // 'networkidle0' isn't valid for setContent (no navigation happens) —
        // 'load' still waits for the window load event, which covers any
        // <img> (logo/background) references finishing before we snapshot to PDF.
        await page.setContent(html, { waitUntil: 'load' });
        // pdf_settings stores page dimensions in points (595.28 x 841.89 = A4),
        // but Puppeteer's page.pdf() only accepts px/in/cm/mm — 72pt = 1in.
        const pdf = await page.pdf({
            width:           `${pageSize.width / 72}in`,
            height:          `${pageSize.height / 72}in`,
            printBackground: true,
        });
        return Buffer.from(pdf);
    } finally {
        await page.close();
    }
}

// Measures the real rendered height (pt) of each `[data-measure-block]`
// element in `html`, in document order — used by trainingPlan.ts/
// nutritionPlan.ts to pre-chunk a day's exercises / a cycle's meals into
// page-sized groups instead of letting one page stretch across several
// physical pages and rely on Chromium's native (and, for our custom
// per-page background/padding, unreliable — see templates/pagination.ts)
// print fragmentation.
//
// JS stays enabled on this page (unlike renderHtmlToPdf's final render,
// which disables it for security) because `page.evaluate` requires it. This
// is only safe because templates/layout.ts, trainingPlan.ts, and
// nutritionPlan.ts are and must stay script-free — if any of them ever grows
// real client-side layout logic, a JS-enabled measurement and the
// JS-disabled final print render could disagree, and these measured heights
// would silently stop matching reality.
export async function measureBlockHeights(html: string, pageWidthPt: number): Promise<number[]> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        // Tall enough that nothing wraps into its own pagination during
        // measurement itself — this page is never printed, only measured.
        await page.setViewport({ width: ptToPx(pageWidthPt), height: 20000 });
        await page.setContent(html, { waitUntil: 'load' });
        const pxHeights = await page.evaluate(() => {
            const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-measure-block]'));
            // offsetTop deltas (not getBoundingClientRect().height) so each
            // block's measured "slot" naturally includes the CSS margin
            // between it and the next block — hardcoding that margin as a
            // separate constant would silently drift out of sync with the
            // stylesheet the moment `.section`'s margin-bottom changes.
            return blocks.map((el, i) => {
                // renderFooter()'s `.footer` is position:absolute (pinned to
                // the bottom of `.page`), which takes it out of normal flow
                // entirely — its wrapper block collapses to zero height, so
                // the offsetTop-delta technique below always measured it as
                // 0 regardless of its real size. getBoundingClientRect
                // reports the footer's actual box regardless of positioning;
                // it doesn't need margin-inclusion like the other blocks
                // since nothing is ever packed directly against its edge.
                const footer = el.querySelector<HTMLElement>('.footer');
                if (footer) return footer.getBoundingClientRect().height;
                return i < blocks.length - 1
                    ? blocks[i + 1].offsetTop - el.offsetTop
                    : document.body.scrollHeight - el.offsetTop;
            });
        });
        // offsetTop/scrollHeight/getBoundingClientRect are always in CSS
        // pixels; every caller compares these against page_height and the
        // PAGE_PADDING_*_PT constants, which are in points — see pxToPt.
        return pxHeights.map(pxToPt);
    } finally {
        await page.close();
    }
}
