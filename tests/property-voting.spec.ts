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

  test('should neutralize upvote when clicking same button again', async ({ page }) => {
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

    // Click upvote again to neutralize
    await page.click('[aria-label="Remove upvote"]')
    await page.waitForTimeout(1000)

    // Should return to original brightness
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness)

    // Button should return to inactive state
    const upvoteButton = page.locator('[aria-label="Vote up"]').first()
    await expect(upvoteButton).toHaveClass(/bg-white\/10/)
  })

  test('should neutralize downvote when clicking same button again', async ({ page }) => {
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

    // Click downvote again to neutralize
    await page.click('[aria-label="Remove downvote"]')
    await page.waitForTimeout(1000)

    // Should return to original brightness
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness)
  })

  test('should switch from upvote to downvote (net -10 swing)', async ({ page }) => {
    await page.click('text=Potential Spaces')
    await page.waitForSelector('[aria-label="Vote up"]', { timeout: 5000 })

    const brightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    const initialBrightness = parseInt(brightnessText || '50')

    // Upvote first
    await page.click('[aria-label="Vote up"]')
    await page.waitForTimeout(1000)

    let currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    let currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness + 5)

    // Switch to downvote
    await page.click('[aria-label="Vote down"]')
    await page.waitForTimeout(1000)

    // Should be initial - 5 (removed +5, added -5)
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness - 5)
  })

  test('should prevent voting more than once in same direction', async ({ page }) => {
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

    // Try to upvote again (should neutralize, not add another +5)
    await page.click('[aria-label="Remove upvote"]')
    await page.waitForTimeout(1000)

    // Should return to initial, NOT initial + 10
    currentBrightnessText = await page.locator('.font-mono.text-white.font-semibold').first().textContent()
    currentBrightness = parseInt(currentBrightnessText || '50')
    expect(currentBrightness).toBe(initialBrightness)
  })
})
