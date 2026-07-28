import type { Browser } from 'puppeteer';

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
