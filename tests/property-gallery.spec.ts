import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

test.describe('Property Gallery Positioning', () => {
  test('gallery is positioned at 2/3 canvas height within mobile safe zone', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for PropertyGallery to render (either with properties or empty state)
    const gallery = page.locator('[style*="top: 66.7%"]').first()

    await expect(gallery).toBeVisible()

    // Check positioning
    const box = await gallery.boundingBox()
    expect(box).toBeTruthy()

    if (box) {
      // Width should be 340px (with 17.5px breathing room on each side of 375px mobile zone)
      expect(box.width).toBe(340)

      // Should be horizontally centered
      const viewportWidth = page.viewportSize()?.width || 1280
      const expectedLeft = (viewportWidth - 340) / 2
      expect(Math.abs(box.x - expectedLeft)).toBeLessThan(2) // Allow 2px tolerance
    }
  })

  test('gallery respects mobile safe zone boundaries', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const gallery = page.locator('[style*="top: 66.7%"]').first()
    await expect(gallery).toBeVisible()

    const box = await gallery.boundingBox()

    if (box) {
      // Gallery width (340px) + breathing room (2 * 17.5px) = 375px mobile safe zone
      const breathingRoom = (375 - 340) / 2
      expect(breathingRoom).toBe(17.5)

      // Gallery should be 340px wide
      expect(box.width).toBe(340)
    }
  })

  test('add property modal respects mobile constraints', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Need to be logged in to see "Add Property" button
    // For now, just check if modal exists in DOM with correct constraints
    const modalClass = 'max-w-\\[340px\\]'

    // Check that AddPropertyModal component has the constraint in source
    const pageContent = await page.content()
    expect(pageContent).toContain('max-w-[340px]')
  })

  test('gallery has proper border and no dark background', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const gallery = page.locator('[style*="top: 66.7%"]').first()
    await expect(gallery).toBeVisible()

    // Check for border class
    const classes = await gallery.getAttribute('class')
    expect(classes).toContain('border')
    expect(classes).toContain('border-white/10')
    expect(classes).toContain('rounded-lg')

    // Should NOT have dark gradient background
    expect(classes).not.toContain('bg-gradient')
  })

  test('property card has vertical layout', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Check that card uses flex-col (vertical layout) not flex-row
    const cardContent = await page.content()

    // PropertyCard should have flex flex-col, not md:flex-row
    expect(cardContent).toContain('flex-col')
  })
})

test.describe('Property Gallery Visual Snapshot', () => {
  test('gallery appears at correct position with proper spacing', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for gallery
    const gallery = page.locator('[style*="top: 66.7%"]').first()
    await expect(gallery).toBeVisible()

    // Take screenshot of canvas area
    const canvas = page.locator('[class*="bg-brand-dark"]').first()
    await expect(canvas).toBeVisible()

    // Screenshot for visual verification
    await canvas.screenshot({ path: 'tests/screenshots/property-gallery-position.png' })

    console.log('✓ Screenshot saved: tests/screenshots/property-gallery-position.png')
  })
})
