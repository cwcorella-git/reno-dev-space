import { test, expect } from '@playwright/test'

test.describe('Vote celebration effects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/reno-dev-space')
    await page.waitForLoadState('networkidle')

    // Dismiss intro modal if present
    const browseBtn = page.getByRole('button', { name: /browse/i })
    if (await browseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseBtn.click()
    }

    // Wait for canvas to load
    await page.waitForSelector('[data-testid="canvas"]', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(1000)
  })

  test('capture confetti-pop effect', async ({ page }) => {
    // Login as admin
    await page.click('text=Sign In')
    await page.fill('input[type="email"]', 'christopher@corella.com')
    await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD || 'test123')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // Find a text block and click to select
    const blocks = page.locator('[data-block-id]')
    const count = await blocks.count()
    console.log(`Found ${count} blocks`)

    if (count > 0) {
      // Enable test mode via Effects panel
      // Click the sparkle/effects icon in panel
      const effectsIcon = page.locator('button:has(svg path[d*="M9.813 15.904"])')
      if (await effectsIcon.isVisible()) {
        await effectsIcon.click()
        await page.waitForTimeout(500)

        // Enable test mode toggle
        const testModeToggle = page.locator('text=Test Mode').locator('..').locator('button')
        if (await testModeToggle.isVisible()) {
          await testModeToggle.click()
          await page.waitForTimeout(300)
        }
      }

      // Click a block to select it
      await blocks.first().click()
      await page.waitForTimeout(500)

      // Take screenshot before voting
      await page.screenshot({ path: 'tests/screenshots/before-vote.png', fullPage: true })

      // Press space to vote up multiple times to see different effects
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Space')
        await page.waitForTimeout(1200) // Wait for effect to complete
        await page.screenshot({ path: `tests/screenshots/effect-${i + 1}.png`, fullPage: true })
      }
    }
  })
})
