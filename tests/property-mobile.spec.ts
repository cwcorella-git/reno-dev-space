import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

test.describe('Property Gallery Mobile View', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport (iPhone 12)
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('mobile view: gallery positioning and appearance', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for gallery to render
    const gallery = page.locator('[style*="top: 66.7%"]').first()
    await expect(gallery).toBeVisible({ timeout: 10000 })

    // Take full page screenshot
    await page.screenshot({
      path: 'tests/screenshots/mobile-full-page.png',
      fullPage: true
    })
    console.log('✓ Screenshot: mobile-full-page.png')

    // Scroll to gallery
    await gallery.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)

    // Take gallery close-up
    await gallery.screenshot({
      path: 'tests/screenshots/mobile-gallery-closeup.png'
    })
    console.log('✓ Screenshot: mobile-gallery-closeup.png')

    // Check gallery width (should be 340px)
    const box = await gallery.boundingBox()
    expect(box).toBeTruthy()
    if (box) {
      console.log(`Gallery width: ${box.width}px (expected 340px scaled)`)
    }
  })

  test('mobile view: carousel navigation', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const gallery = page.locator('[style*="top: 66.7%"]').first()
    await expect(gallery).toBeVisible({ timeout: 10000 })
    await gallery.scrollIntoViewIfNeeded()

    // Look for navigation arrows
    const leftArrow = page.locator('button').filter({ hasText: '←' })
    const rightArrow = page.locator('button').filter({ hasText: '→' })

    // Check if arrows exist
    const hasLeftArrow = await leftArrow.count()
    const hasRightArrow = await rightArrow.count()

    console.log(`Left arrow found: ${hasLeftArrow > 0}`)
    console.log(`Right arrow found: ${hasRightArrow > 0}`)

    if (hasRightArrow > 0) {
      // Click right arrow
      await rightArrow.first().click()
      await page.waitForTimeout(500)

      await page.screenshot({
        path: 'tests/screenshots/mobile-carousel-next.png',
        fullPage: true
      })
      console.log('✓ Screenshot: mobile-carousel-next.png')
    }

    if (hasLeftArrow > 0) {
      // Click left arrow
      await leftArrow.first().click()
      await page.waitForTimeout(500)

      await page.screenshot({
        path: 'tests/screenshots/mobile-carousel-prev.png',
        fullPage: true
      })
      console.log('✓ Screenshot: mobile-carousel-prev.png')
    }

    // Check for property counter (e.g., "Property 1 of 3")
    const counter = page.locator('text=/Property \\d+ of \\d+/')
    if (await counter.count() > 0) {
      const counterText = await counter.first().textContent()
      console.log(`Counter: ${counterText}`)
    }
  })

  test('mobile view: add property button and modal', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const gallery = page.locator('[style*="top: 66.7%"]').first()
    await expect(gallery).toBeVisible({ timeout: 10000 })
    await gallery.scrollIntoViewIfNeeded()

    // Look for "Add Property" or "+ Add Property" button
    const addButton = page.locator('button').filter({ hasText: /Add Property/i })

    if (await addButton.count() > 0) {
      console.log('✓ Add Property button found')

      // Click to open modal
      await addButton.first().click()
      await page.waitForTimeout(500)

      // Check if modal appeared
      const modal = page.locator('text=Add Rental Property').first()
      await expect(modal).toBeVisible({ timeout: 5000 })

      // Take modal screenshot
      await page.screenshot({
        path: 'tests/screenshots/mobile-add-property-modal.png',
        fullPage: true
      })
      console.log('✓ Screenshot: mobile-add-property-modal.png')

      // Check that panel is hidden
      const panel = page.locator('text=Editor').first()
      const panelVisible = await panel.isVisible().catch(() => false)
      console.log(`Panel visible when modal open: ${panelVisible} (should be false)`)

      // Check modal width matches screen
      const modalContainer = page.locator('.fixed.inset-0.z-50').first()
      const modalBox = await modalContainer.boundingBox()
      if (modalBox) {
        console.log(`Modal width: ${modalBox.width}px (viewport: 390px)`)
      }

      // Try to scroll (should be locked)
      const scrollBefore = await page.evaluate(() => window.scrollY)
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(200)
      const scrollAfter = await page.evaluate(() => window.scrollY)
      console.log(`Scroll locked: ${scrollBefore === scrollAfter} (before: ${scrollBefore}, after: ${scrollAfter})`)

      // Close modal with ESC
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)

      // Verify modal closed
      await expect(modal).not.toBeVisible()
      console.log('✓ Modal closed with ESC')

      // Take screenshot after modal closed
      await page.screenshot({
        path: 'tests/screenshots/mobile-modal-closed.png',
        fullPage: true
      })
      console.log('✓ Screenshot: mobile-modal-closed.png')
    } else {
      console.log('⚠ Add Property button not found (user may need to be logged in)')
    }
  })

  test('mobile view: safe zone positioning', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const gallery = page.locator('[style*="top: 66.7%"]').first()
    await expect(gallery).toBeVisible({ timeout: 10000 })
    await gallery.scrollIntoViewIfNeeded()

    const box = await gallery.boundingBox()
    expect(box).toBeTruthy()

    if (box) {
      const viewportWidth = 390
      const galleryWidth = box.width
      const leftMargin = box.x
      const rightMargin = viewportWidth - (box.x + box.width)

      console.log(`Gallery dimensions:`)
      console.log(`  Width: ${galleryWidth}px`)
      console.log(`  Left margin: ${leftMargin.toFixed(1)}px`)
      console.log(`  Right margin: ${rightMargin.toFixed(1)}px`)
      console.log(`  Centered: ${Math.abs(leftMargin - rightMargin) < 5}`)

      // Gallery should be centered (margins roughly equal)
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(5)
    }
  })
})
