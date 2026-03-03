import { test, expect } from '@playwright/test'

test.describe('Console Error Investigation', () => {
  test('capture all console errors and warnings on page load', async ({ page }) => {
    const errors: string[] = []
    const warnings: string[] = []
    const logs: string[] = []

    // Listen for ALL console messages
    page.on('console', (msg) => {
      const text = msg.text()
      if (msg.type() === 'error') errors.push(text)
      else if (msg.type() === 'warning') warnings.push(text)
      else logs.push(text)
    })

    // Listen for page-level errors (uncaught exceptions)
    const pageErrors: string[] = []
    page.on('pageerror', (err) => {
      pageErrors.push(`${err.name}: ${err.message}`)
    })

    // Load the page
    await page.goto('/reno-dev-space/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000) // extra time for Firestore subscriptions

    // Dismiss intro hint if visible
    const browseButton = page.locator('button:has-text("Browse First")')
    if (await browseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseButton.click()
      await page.waitForTimeout(1000)
    }

    // Wait for blocks to potentially load
    try {
      await page.locator('[data-block-id]').first().waitFor({ timeout: 5000 })
    } catch {
      console.log('No blocks appeared within 5s')
    }

    const blockCount = await page.locator('[data-block-id]').count()

    // Report findings
    console.log('\n===== CONSOLE ERROR INVESTIGATION =====')
    console.log(`\nBlocks loaded: ${blockCount}`)

    console.log(`\n--- Page Errors (uncaught exceptions): ${pageErrors.length} ---`)
    pageErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`))

    console.log(`\n--- Console Errors: ${errors.length} ---`)
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.slice(0, 200)}`))

    console.log(`\n--- Console Warnings: ${warnings.length} ---`)
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w.slice(0, 200)}`))

    console.log('\n===== END INVESTIGATION =====\n')

    await page.screenshot({ path: 'tests/screenshots/console-errors-page.png', fullPage: true })

    // The test passes — it's diagnostic
    expect(true).toBe(true)
  })
})
