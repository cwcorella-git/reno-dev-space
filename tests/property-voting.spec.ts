import { test, expect } from '@playwright/test'

test.describe('Property Voting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3006/')

    // Wait for auth modal and sign in (or create test account)
    // This is a simplified example - you may need to adjust based on your auth setup
    await page.waitForSelector('text=Sign In', { timeout: 10000 })
  })

  test('should allow upvoting a property (+5)', async ({ page }) => {
    // Navigate to properties section
    await page.click('text=Potential Spaces')

    // Wait for property card to load
    await page.waitForSelector('[aria-label="Vote up"]', { timeout: 5000 })

    // Get initial brightness value
    const brightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const initialBrightness = parseInt(brightnessText || '50')

    // Click upvote button
    await page.click('[aria-label="Vote up"]')

    // Wait for vote to process
    await page.waitForTimeout(1000)

    // Verify brightness increased by 5
    const newBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const newBrightness = parseInt(newBrightnessText || '50')

    expect(newBrightness).toBe(initialBrightness + 5)

    // Verify button is now in active state (green background)
    const upvoteButton = page.locator('[aria-label="Remove upvote"]').first()
    await expect(upvoteButton).toHaveClass(/bg-green-600/)
  })

  test('should allow downvoting a property (-5)', async ({ page }) => {
    await page.click('text=Potential Spaces')
    await page.waitForSelector('[aria-label="Vote down"]', { timeout: 5000 })

    const brightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const initialBrightness = parseInt(brightnessText || '50')

    await page.click('[aria-label="Vote down"]')
    await page.waitForTimeout(1000)

    const newBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const newBrightness = parseInt(newBrightnessText || '50')

    expect(newBrightness).toBe(initialBrightness - 5)

    const downvoteButton = page.locator('[aria-label="Remove downvote"]').first()
    await expect(downvoteButton).toHaveClass(/bg-red-600/)
  })

  test('should NOT neutralize upvote when clicking same button again (no-op)', async ({ page }) => {
    await page.click('text=Potential Spaces')
    await page.waitForSelector('[aria-label="Vote up"]', { timeout: 5000 })

    const brightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const initialBrightness = parseInt(brightnessText || '50')

    // First upvote
    await page.click('[aria-label="Vote up"]')
    await page.waitForTimeout(1000)

    let currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    let currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness + 5)

    // Click upvote again - should be NO-OP (brightness stays at +5)
    await page.click('[aria-label="Remove upvote"]')
    await page.waitForTimeout(1000)

    // Should STAY at +5 (no change)
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness + 5)

    // Button should stay in active state (still upvoted)
    const upvoteButton = page.locator('[aria-label="Remove upvote"]').first()
    await expect(upvoteButton).toHaveClass(/bg-green-600/)
  })

  test('should NOT neutralize downvote when clicking same button again (no-op)', async ({ page }) => {
    await page.click('text=Potential Spaces')
    await page.waitForSelector('[aria-label="Vote down"]', { timeout: 5000 })

    const brightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const initialBrightness = parseInt(brightnessText || '50')

    // First downvote
    await page.click('[aria-label="Vote down"]')
    await page.waitForTimeout(1000)

    let currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    let currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness - 5)

    // Click downvote again - should be NO-OP (brightness stays at -5)
    await page.click('[aria-label="Remove downvote"]')
    await page.waitForTimeout(1000)

    // Should STAY at -5 (no change)
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness - 5)

    // Button should stay in active state (still downvoted)
    const downvoteButton = page.locator('[aria-label="Remove downvote"]').first()
    await expect(downvoteButton).toHaveClass(/bg-red-600/)
  })

  test('should neutralize upvote by voting down (opposite direction)', async ({ page }) => {
    await page.click('text=Potential Spaces')
    await page.waitForSelector('[aria-label="Vote up"]', { timeout: 5000 })

    const brightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const initialBrightness = parseInt(brightnessText || '50')

    // Upvote first (+5)
    await page.click('[aria-label="Vote up"]')
    await page.waitForTimeout(1000)

    let currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    let currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness + 5)

    // Vote down to neutralize (back to original, not downvote)
    await page.click('[aria-label="Vote down"]')
    await page.waitForTimeout(1000)

    // Should return to initial brightness (neutralized)
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness)

    // Both buttons should be inactive (neutral state)
    const upvoteButton = page.locator('[aria-label="Vote up"]').first()
    await expect(upvoteButton).toHaveClass(/bg-white\/10/)
  })

  test('should neutralize downvote by voting up (opposite direction)', async ({ page }) => {
    await page.click('text=Potential Spaces')
    await page.waitForSelector('[aria-label="Vote down"]', { timeout: 5000 })

    const brightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const initialBrightness = parseInt(brightnessText || '50')

    // Downvote first (-5)
    await page.click('[aria-label="Vote down"]')
    await page.waitForTimeout(1000)

    let currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    let currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness - 5)

    // Vote up to neutralize (back to original, not upvote)
    await page.click('[aria-label="Vote up"]')
    await page.waitForTimeout(1000)

    // Should return to initial brightness (neutralized)
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness)

    // Both buttons should be inactive (neutral state)
    const downvoteButton = page.locator('[aria-label="Vote down"]').first()
    await expect(downvoteButton).toHaveClass(/bg-white\/10/)
  })

  test('should prevent voting more than once in same direction (no-op)', async ({ page }) => {
    await page.click('text=Potential Spaces')
    await page.waitForSelector('[aria-label="Vote up"]', { timeout: 5000 })

    const brightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const initialBrightness = parseInt(brightnessText || '50')

    // First upvote
    await page.click('[aria-label="Vote up"]')
    await page.waitForTimeout(1000)

    let currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    let currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness + 5)

    // Try to upvote again (should be NO-OP, not add another +5)
    await page.click('[aria-label="Remove upvote"]')
    await page.waitForTimeout(1000)

    // Should stay at initial + 5 (NOT initial, NOT initial + 10)
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness + 5)
  })
})
