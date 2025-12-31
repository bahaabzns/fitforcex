const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    console.log('[console]', msg.type(), msg.text());
  });

  page.on('pageerror', (err) => {
    console.error('[pageerror]', err && err.stack ? err.stack : err);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log('[response]', res.status(), res.url());
    }
  });

  const url = process.argv[2] || 'http://localhost:3000/dashboard/queue';
  console.log('Opening', url);

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    // wait a bit for client side activity
    await page.waitForTimeout(2000);
  } catch (err) {
    console.error('Navigation failed:', err);
  }

  // Print page html for debugging
  const html = await page.content();
  console.log('Page content length:', html.length);

  await browser.close();
})();