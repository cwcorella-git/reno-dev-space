import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const consoleMessages = [];
page.on('console', msg => {
  consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
});

const pageErrors = [];
page.on('pageerror', error => {
  pageErrors.push(error.message);
});

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(5000);

console.log('\n=== Console Messages (last 10) ===');
console.log(consoleMessages.slice(-10).join('\n'));

console.log('\n=== Page Errors ===');
console.log(pageErrors.join('\n'));

// Check for error notification element
const errorText = await page.locator('text=1 error').textContent().catch(() => null);
if (errorText) {
  console.log('\n=== Error Notification Found ===');
  console.log(errorText);
}

await browser.close();
