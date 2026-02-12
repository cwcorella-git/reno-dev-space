import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = __dirname + '/../tests/screenshots';

// Ensure screenshot directory exists
mkdirSync(screenshotDir, { recursive: true });

const SITE_URL = 'https://cwcorella-git.github.io/reno-dev-space/';
const EMAIL = 'christopher@corella.com';
const PASSWORD = '.YQZv*S*7"jk^=?';

(async () => {
  const consoleErrors = [];
  const consoleWarnings = [];

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  // Listen for page errors (uncaught exceptions)
  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
  });

  try {
    // Step 1: Navigate to the site
    console.log(`Navigating to ${SITE_URL}...`);
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Step 2: Wait 3 seconds for the page to fully render
    console.log('Waiting 3 seconds for page to load...');
    await page.waitForTimeout(3000);

    // Step 3: Click "Join the Community" button to open auth modal
    console.log('Looking for "Join the Community" or "Sign In" button...');

    // Try "Join the Community" first (from IntroHint)
    let joinButton = page.locator('button:has-text("Join the Community")').first();
    let signInButton = page.locator('button:has-text("Sign In")').first();

    if (await joinButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Found "Join the Community" button, clicking...');
      await joinButton.click();
    } else if (await signInButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Found "Sign In" button, clicking...');
      await signInButton.click();
    } else {
      console.log('Neither button found. Taking diagnostic screenshot...');
      await page.screenshot({ path: `${screenshotDir}/test-login-diagnostic.png`, fullPage: true });
      console.log('Page content (first 2000 chars):', (await page.content()).slice(0, 2000));
      throw new Error('Could not find Join/Sign In button');
    }

    // Wait for the modal to appear
    console.log('Waiting for auth modal...');
    await page.waitForTimeout(1000);

    // Step 4: Click "Sign in" link at bottom to switch to login mode
    console.log('Looking for "Sign in" link to switch to login mode...');
    const signInLink = page.locator('button:has-text("Sign in")').last();
    if (await signInLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking "Sign in" link to switch to login mode...');
      await signInLink.click();
      await page.waitForTimeout(500);
    } else {
      console.log('Warning: "Sign in" link not found, may already be in login mode');
    }

    // Step 5: Fill email
    console.log('Filling email...');
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(EMAIL);

    // Step 6: Fill password
    console.log('Filling password...');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(PASSWORD);

    // Step 7: Take screenshot BEFORE clicking submit
    console.log('Taking screenshot BEFORE submit...');
    await page.screenshot({ path: `${screenshotDir}/test-login-before.png`, fullPage: false });
    console.log(`Screenshot saved: tests/screenshots/test-login-before.png`);

    // Step 8: Click submit button
    console.log('Clicking submit button...');
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Step 9: Wait 5 seconds for login to process
    console.log('Waiting 5 seconds for login to process...');
    await page.waitForTimeout(5000);

    // Step 10: Take screenshot AFTER
    console.log('Taking screenshot AFTER submit...');
    await page.screenshot({ path: `${screenshotDir}/test-login-after.png`, fullPage: false });
    console.log(`Screenshot saved: tests/screenshots/test-login-after.png`);

    // Step 11: Check for error text in the modal
    console.log('\n--- RESULTS ---');

    const errorDiv = page.locator('.bg-red-500\\/20');
    if (await errorDiv.isVisible({ timeout: 1000 }).catch(() => false)) {
      const errorText = await errorDiv.textContent();
      console.log(`ERROR IN MODAL: "${errorText}"`);
    } else {
      console.log('No error message visible in modal.');
    }

    // Step 12: Check if modal is still visible
    const modal = page.locator('.fixed.inset-0.z-50');
    const modalVisible = await modal.isVisible({ timeout: 1000 }).catch(() => false);

    if (modalVisible) {
      console.log('MODAL STATUS: Still visible (login likely FAILED or modal did not close)');
    } else {
      console.log('MODAL STATUS: Closed (login likely SUCCEEDED)');
    }

    // Check for any authenticated user indicators
    // Look for profile-related elements or admin indicators
    const profileTab = page.locator('button:has-text("Profile")');
    const addTextButton = page.locator('button:has-text("Add Text")');

    const hasProfile = await profileTab.isVisible({ timeout: 1000 }).catch(() => false);
    const hasAddText = await addTextButton.isVisible({ timeout: 1000 }).catch(() => false);

    console.log(`Profile tab visible: ${hasProfile}`);
    console.log(`Add Text button visible: ${hasAddText}`);

    if (hasProfile || hasAddText) {
      console.log('AUTHENTICATION: User appears to be authenticated');
    } else if (!modalVisible) {
      console.log('AUTHENTICATION: Modal closed but no auth indicators found yet');
    } else {
      console.log('AUTHENTICATION: User does NOT appear to be authenticated');
    }

    // Log console errors
    console.log(`\n--- BROWSER CONSOLE ERRORS (${consoleErrors.length}) ---`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((err, i) => {
        console.log(`  [${i + 1}] ${err}`);
      });
    } else {
      console.log('  (none)');
    }

    console.log(`\n--- BROWSER CONSOLE WARNINGS (${consoleWarnings.length}) ---`);
    if (consoleWarnings.length > 0) {
      consoleWarnings.slice(0, 10).forEach((warn, i) => {
        console.log(`  [${i + 1}] ${warn}`);
      });
      if (consoleWarnings.length > 10) {
        console.log(`  ... and ${consoleWarnings.length - 10} more`);
      }
    } else {
      console.log('  (none)');
    }

  } catch (err) {
    console.error('Script error:', err.message);
    await page.screenshot({ path: `${screenshotDir}/test-login-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
    console.log('\nBrowser closed.');
  }
})();
