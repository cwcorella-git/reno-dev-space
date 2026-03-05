// Credentials: set ADMIN_EMAIL and ADMIN_PASSWORD in your environment before running.
// Example: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret node scripts/test-login-debug.mjs
import { chromium } from 'playwright'

const SITE_URL = 'https://cwcorella-git.github.io/reno-dev-space/'
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this script.')
  process.exit(1)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Capture ALL console messages with full detail
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${msg.type()}] ${msg.text()}`)
      // Try to get the stack/location
      console.log(`  location: ${msg.location()?.url || 'unknown'}:${msg.location()?.lineNumber}`)
    }
  })

  // Also capture page errors (uncaught exceptions)
  page.on('pageerror', err => {
    console.log(`[pageerror] ${err.message}`)
    console.log(`  stack: ${err.stack?.slice(0, 300)}`)
  })

  await page.goto(SITE_URL, { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  console.log('\n=== Before login: no errors expected ===\n')

  // Sign in
  const joinBtn = page.locator('button:has-text("Join the Community")')
  if (await joinBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await joinBtn.click()
    await page.waitForTimeout(800)
  }
  const switchBtn = page.locator('button:has-text("Sign in")').last()
  if (await switchBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await switchBtn.click()
    await page.waitForTimeout(500)
  }

  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)

  console.log('\n=== Clicking Sign In... ===\n')
  await page.click('button[type="submit"]')

  // Wait and capture errors as they come
  await page.waitForTimeout(6000)

  console.log('\n=== Done ===')
  await browser.close()
}

run().catch(console.error)
