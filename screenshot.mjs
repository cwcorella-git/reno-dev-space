import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(5000);

// Close the intro modal if present
try {
  await page.click('button:has-text("Browse First")', { timeout: 2000 });
  await page.waitForTimeout(1000);
} catch (e) {
  console.log('No modal to close');
}

await page.screenshot({ path: '/tmp/site-screenshot.png', fullPage: false });
await browser.close();
console.log('Screenshot saved');
