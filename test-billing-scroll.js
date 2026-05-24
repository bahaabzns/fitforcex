const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 2000 } // Taller viewport to capture more
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to billing
    await page.goto('http://localhost:3000/fitstn/settings/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Scroll down to see payment history and more
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    
    // Take screenshot
    await page.screenshot({ path: 'billing-page-full.png' });
    console.log('Screenshot saved: billing-page-full.png');
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
})();
