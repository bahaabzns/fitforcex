const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 }
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:3000/fitstn/settings/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'billing-final.png' });
    console.log('Screenshot saved: billing-final.png');
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
})();
