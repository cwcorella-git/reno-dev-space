import { test, expect } from '@playwright/test'

const PROD_URL = 'https://cwcorella-git.github.io/reno-dev-space/'

test.describe('Mobile Screenshots - Production', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport (iPhone 12)
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('mobile: full page overview', async ({ page }) => {
    await page.goto(PROD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for canvas to render
    await page.waitForTimeout(2000)

    // Take full page screenshot
    await page.screenshot({
      path: 'tests/screenshots/mobile-full-page.png',
      fullPage: true
    })
    console.log('✓ Screenshot: mobile-full-page.png')
  })

  test('mobile: property gallery close-up', async ({ page }) => {
    await page.goto(PROD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for gallery
    const gallery = page.locator('[style*="top: 66.7%"]').first()

    if (await gallery.isVisible({ timeout: 5000 }).catch(() => false)) {
      await gallery.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)

      // Take gallery screenshot
      await gallery.screenshot({
        path: 'tests/screenshots/mobile-gallery.png'
      })
      console.log('✓ Screenshot: mobile-gallery.png')
      console.log('✓ Gallery found and visible')
    } else {
      console.log('⚠ Gallery not found (may have no properties yet)')

      // Take screenshot anyway to show current state
      await page.screenshot({
        path: 'tests/screenshots/mobile-no-gallery.png',
        fullPage: true
      })
      console.log('✓ Screenshot: mobile-no-gallery.png')
    }
  })

  test('mobile: bottom panel', async ({ page }) => {
    await page.goto(PROD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Scroll to bottom panel
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // Take screenshot of bottom area
    await page.screenshot({
      path: 'tests/screenshots/mobile-bottom-panel.png',
      fullPage: false
    })
    console.log('✓ Screenshot: mobile-bottom-panel.png')
  })

  test('mobile: canvas scroll behavior', async ({ page }) => {
    await page.goto(PROD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const scrollStart = await page.evaluate(() => window.scrollY)
    console.log(`Initial scroll position: ${scrollStart}`)

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500))
    await page.waitForTimeout(500)

    const scrollMid = await page.evaluate(() => window.scrollY)
    console.log(`After scroll: ${scrollMid}`)

    await page.screenshot({
      path: 'tests/screenshots/mobile-scrolled.png',
      fullPage: false
    })
    console.log('✓ Screenshot: mobile-scrolled.png')

    // Check viewport dimensions
    const viewport = page.viewportSize()
    const dimensions = await page.evaluate(() => ({
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight
    }))

    console.log('Viewport:', viewport)
    console.log('Dimensions:', dimensions)
  })

  test('mobile: navigation arrows (if properties exist)', async ({ page }) => {
    await page.goto(PROD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const gallery = page.locator('[style*="top: 66.7%"]').first()

    if (await gallery.isVisible({ timeout: 5000 }).catch(() => false)) {
      await gallery.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)

      // Look for navigation arrows
      const leftArrow = page.locator('button').filter({ hasText: '←' })
      const rightArrow = page.locator('button').filter({ hasText: '→' })

      const hasLeft = await leftArrow.count()
      const hasRight = await rightArrow.count()

      console.log(`Navigation arrows: left=${hasLeft}, right=${hasRight}`)

      if (hasRight > 0) {
        // Take "before" screenshot
        await page.screenshot({
          path: 'tests/screenshots/mobile-carousel-before.png',
          fullPage: false
        })
        console.log('✓ Screenshot: mobile-carousel-before.png')

        // Click right arrow
        await rightArrow.first().click()
        await page.waitForTimeout(500)

        // Take "after" screenshot
        await page.screenshot({
          path: 'tests/screenshots/mobile-carousel-after.png',
          fullPage: false
        })
        console.log('✓ Screenshot: mobile-carousel-after.png')
        console.log('✓ Navigation works')
      } else {
        console.log('⚠ No navigation arrows (may be only 1 property)')
      }
    } else {
      console.log('⚠ Gallery not found')
    }
  })

  test('mobile: banner and top area', async ({ page }) => {
    await page.goto(PROD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Scroll to top
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'tests/screenshots/mobile-top-banner.png',
      fullPage: false
    })
    console.log('✓ Screenshot: mobile-top-banner.png')
  })
})
