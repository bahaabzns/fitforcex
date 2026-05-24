const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 }
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:3000/fitstn/settings/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Scroll to see the tabs
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'billing-with-tabs.png' });
    console.log('Screenshot saved: billing-with-tabs.png');
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
})();
