const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1024 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate directly to the billing page with correct slug
    await page.goto('http://localhost:3000/fitstn/settings/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'billing-page.png' });
    console.log('Screenshot saved: billing-page.png');
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
})();
