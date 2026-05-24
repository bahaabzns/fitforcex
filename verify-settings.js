const { chromium } = require('playwright');

async function verifySettings() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('=== Settings Page Verification ===\n');

    // Test Profile route
    console.log('1️⃣ Navigating to /fitstn/settings/profile...');
    await page.goto('http://localhost:3000/fitstn/settings/profile', {
      waitUntil: 'networkidle',
      timeout: 10000
    }).catch(e => console.log('Note: Navigation may redirect to login'));

    const url = page.url();
    console.log(`   Current URL: ${url}`);

    // Check for breadcrumb in header
    const headerBreadcrumb = await page.$eval('header', el => el.textContent)
      .catch(() => 'Header not found');

    console.log(`\n   Header content: ${headerBreadcrumb}\n`);

    // Check for tab buttons (should NOT exist)
    const hasTabButtons = await page.$$eval('button', buttons => {
      return buttons.some(btn =>
        btn.textContent.includes('Profile') ||
        btn.textContent.includes('Workspace') ||
        btn.textContent.includes('Billing')
      );
    }).catch(() => false);

    console.log(`   ✅ Tab buttons present: ${hasTabButtons ? '❌ FAIL' : '✓ PASS'}\n`);

    // Check for specific breadcrumb text
    const breadcrumbText = await page.$eval('header', el => el.textContent)
      .catch(() => '');

    const hasProfileBreadcrumb = breadcrumbText.includes('Profile');
    const hasSettingsBreadcrumb = breadcrumbText.includes('Settings');

    console.log(`   Breadcrumb shows "Settings": ${hasSettingsBreadcrumb ? '✓' : '❌'}`);
    console.log(`   Breadcrumb shows "Profile": ${hasProfileBreadcrumb ? '✓' : '❌'}\n`);

    // Take screenshot
    await page.screenshot({ path: 'd:\\fitforce-x\\screenshot-profile.png' });
    console.log('   📸 Screenshot saved: screenshot-profile.png\n');

  } catch (error) {
    console.error('Error during verification:', error.message);
  } finally {
    await browser.close();
  }
}

verifySettings().catch(console.error);
