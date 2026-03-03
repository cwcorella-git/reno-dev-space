import { test, expect } from '@playwright/test'

test.describe('Drag Jitter Test', () => {
  test('capture rapid screenshots during block drag', async ({ page }) => {
    // Go to the app
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Take initial screenshot
    await page.screenshot({ path: 'tests/screenshots/01-initial.png', fullPage: true })

    // Click sign in button and log in as admin
    const signInButton = page.locator('button:has-text("Sign In")')
    if (await signInButton.isVisible()) {
      await signInButton.click()
      await page.waitForTimeout(500)

      // Fill in admin credentials (set via env vars)
      const email = process.env.ADMIN_EMAIL || 'christopher@corella.com'
      const password = process.env.ADMIN_PASSWORD || ''

      if (!password) {
        console.log('WARNING: No ADMIN_PASSWORD set. Set it via environment variable.')
        await page.screenshot({ path: 'tests/screenshots/02-auth-modal.png' })
        return
      }

      await page.fill('input[type="email"]', email)
      await page.fill('input[type="password"]', password)
      await page.click('button[type="submit"]')

      // Wait for auth to complete
      await page.waitForTimeout(2000)
    }

    await page.screenshot({ path: 'tests/screenshots/03-logged-in.png', fullPage: true })

    // Find a text block on the canvas
    const textBlock = page.locator('[class*="cursor-move"]').first()

    if (!(await textBlock.isVisible())) {
      console.log('No draggable text blocks found')
      return
    }

    // Click to select the block
    await textBlock.click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: 'tests/screenshots/04-selected.png', fullPage: true })

    // Get block's bounding box
    const box = await textBlock.boundingBox()
    if (!box) {
      console.log('Could not get block bounding box')
      return
    }

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    const endX = startX + 200 // Move 200px right
    const endY = startY + 100 // Move 100px down

    // Start the drag
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.screenshot({ path: 'tests/screenshots/05-drag-start.png', fullPage: true })

    // Take rapid screenshots during drag (every 50ms)
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      const x = startX + (endX - startX) * (i / steps)
      const y = startY + (endY - startY) * (i / steps)
      await page.mouse.move(x, y)
      await page.screenshot({ path: `tests/screenshots/06-dragging-${i.toString().padStart(2, '0')}.png`, fullPage: true })
    }

    // Release the mouse and capture rapid screenshots to see jitter
    await page.mouse.up()

    // Capture every 16ms (60fps) for 500ms after release
    for (let i = 0; i < 30; i++) {
      await page.screenshot({ path: `tests/screenshots/07-after-release-${i.toString().padStart(2, '0')}.png`, fullPage: true })
      await page.waitForTimeout(16)
    }

    console.log('Screenshots saved to tests/screenshots/')
  })
})
