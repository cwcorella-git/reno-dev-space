import { test, expect, Page, ConsoleMessage } from '@playwright/test'

/**
 * Diagnostic test to capture the actual previewSize values being used
 * by the overlap detection system.
 */

test.describe('Preview Size Diagnostic', () => {
  test('capture actual previewSize values', async ({ page }) => {
    const consoleLogs: string[] = []

    // Capture console logs
    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text()
      if (text.includes('previewSize') || text.includes('wouldOverlapDOM')) {
        consoleLogs.push(text)
      }
    })

    await page.goto('/')
    await page.waitForLoadState('load')

    // Wait for app to hydrate
    await page.waitForSelector('.bg-brand-dark', { timeout: 10000 })
    await page.waitForTimeout(3000)

    // Dismiss intro hint
    const browseButton = page.locator('button:has-text("Browse First")')
    if (await browseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseButton.click()
      await page.waitForTimeout(500)
    }

    // Get canvas and block info
    const canvasBox = await page.locator('div.relative.bg-brand-dark').first().boundingBox()
    console.log(`Canvas size: ${canvasBox?.width}x${canvasBox?.height}`)

    const blockCount = await page.locator('[data-block-id]').count()
    console.log(`Block count: ${blockCount}`)

    // Check if user can add text (need to be logged in as admin/pledged)
    const signInButton = page.locator('button:has-text("Sign In")')
    const isLoggedOut = await signInButton.isVisible({ timeout: 1000 }).catch(() => false)

    if (isLoggedOut) {
      console.log('Not logged in - cannot test Add Text mode')
      console.log('To test Add Text mode, run with auth:')
      console.log('TEST_ADMIN_EMAIL=xxx TEST_ADMIN_PASSWORD=xxx npx playwright test preview-size-debug')

      // Just verify the canvas is working
      expect(canvasBox).toBeTruthy()
      expect(canvasBox!.width).toBeGreaterThan(100)
      expect(blockCount).toBeGreaterThan(0)
      return
    }

    // Look for Add Text button (means user has permission)
    const addTextButton = page.locator('button:has-text("Add Text")')
    const canAddText = await addTextButton.isVisible({ timeout: 2000 }).catch(() => false)

    if (!canAddText) {
      console.log('Add Text button not visible - user may not have permission')
      return
    }

    // Enter Add Text mode
    await addTextButton.click()
    await page.waitForTimeout(500)

    // Move mouse around to trigger overlap detection logs
    if (canvasBox) {
      const positions = [
        { x: 0.2, y: 0.1 },  // top-left area
        { x: 0.5, y: 0.3 },  // middle
        { x: 0.8, y: 0.2 },  // top-right area
        { x: 0.3, y: 0.5 },  // middle-left
      ]

      for (const pos of positions) {
        const screenX = canvasBox.x + pos.x * canvasBox.width
        const screenY = canvasBox.y + pos.y * canvasBox.height
        await page.mouse.move(screenX, screenY)
        await page.waitForTimeout(200)
      }
    }

    // Wait for any async logging
    await page.waitForTimeout(1000)

    // Print all captured logs
    console.log('\n===== CAPTURED PREVIEW SIZE LOGS =====')
    if (consoleLogs.length === 0) {
      console.log('No previewSize logs captured (debug logging may not have triggered)')
    } else {
      consoleLogs.forEach(log => console.log(log))
    }
    console.log('===== END LOGS =====\n')

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/preview-size-debug.png', fullPage: true })

    expect(true).toBe(true)
  })
})
