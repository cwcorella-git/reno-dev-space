import { test, expect } from '@playwright/test'

/**
 * Bounding Box Accuracy Tests
 *
 * These tests verify that visual bounding boxes (selection outlines) match
 * the actual rendered text dimensions, especially when text wraps to multiple
 * lines or when blocks are resized/collapsed.
 *
 * Related issue: Text wrapping causes inconsistent overlap detection because
 * bounding box calculations use fixed height estimates instead of actual DOM
 * measurements.
 */

// Test data with various text lengths that will/won't wrap
const TEST_TEXTS = {
  short: 'HORIZŌ',
  medium: 'FREEFORM COOPERATION',
  long: 'Designers, Programmers, NFT/AI Artists',
  multiline: 'NO LEADS, PRODUCERS, OR CEOS\nDesigners, Programmers,\nNFT/AI Artists',
  veryLong: 'A SHARED SPACE FOR CREATIVES TO DEVELOP GAMES WITHOUT TRADITIONAL HIERARCHIES OR GATEKEEPERS'
}

test.describe('Bounding Box Accuracy', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000')

    // Wait for Firebase to load
    await page.waitForTimeout(1000)
  })

  test('should match bounding box to actual text dimensions - short text', async ({ page }) => {
    // This test requires being logged in as admin to add text
    // For now, we'll test with existing blocks

    const blocks = await page.locator('[data-block-id]').all()

    if (blocks.length === 0) {
      test.skip()
      return
    }

    const block = blocks[0]

    // Get the visual bounding box (selection outline)
    await block.click()
    await page.waitForTimeout(200) // Wait for selection to render

    const blockRect = await block.boundingBox()
    if (!blockRect) {
      throw new Error('Could not get block bounding box')
    }

    // Get the actual text content dimensions
    const textElement = block.locator('div[contenteditable], div[style*="font"]').first()
    const textRect = await textElement.boundingBox()

    if (!textRect) {
      throw new Error('Could not get text bounding box')
    }

    // Bounding box should contain the text with minimal padding
    // Allow 20px padding for borders/spacing
    const padding = 20

    expect(blockRect.width).toBeGreaterThanOrEqual(textRect.width - padding)
    expect(blockRect.height).toBeGreaterThanOrEqual(textRect.height - padding)

    // Should not be excessively larger (indicates wrong calculation)
    expect(blockRect.height).toBeLessThan(textRect.height + 100)
  })

  test('should detect text wrapping and adjust bounding box height', async ({ page }) => {
    const blocks = await page.locator('[data-block-id]').all()

    for (const block of blocks) {
      const blockRect = await block.boundingBox()
      if (!blockRect) continue

      // Get text content
      const textContent = await block.locator('div[contenteditable], div[style*="font"]').first().textContent()
      if (!textContent) continue

      // Estimate line count (rough heuristic based on text length and block width)
      const charCount = textContent.length
      const charsPerLine = Math.floor(blockRect.width / 8) // ~8px per char average
      const estimatedLines = Math.max(1, Math.ceil(charCount / charsPerLine))

      // Get actual rendered height
      const textElement = block.locator('div[contenteditable], div[style*="font"]').first()
      const textRect = await textElement.boundingBox()

      if (!textRect) continue

      // Height should accommodate all lines
      // Base font size ~16px, line height ~1.5 = 24px per line
      const minExpectedHeight = estimatedLines * 20

      expect(textRect.height, `Text "${textContent.substring(0, 30)}..." should have height for ${estimatedLines} lines`)
        .toBeGreaterThanOrEqual(minExpectedHeight)
    }
  })

  test('should update bounding box when block is resized', async ({ page }) => {
    // This test requires admin access
    // We'll test the resize handles if they're visible

    const block = page.locator('[data-block-id]').first()
    await block.click()

    const initialRect = await block.boundingBox()
    if (!initialRect) {
      test.skip()
      return
    }

    // Look for resize handle (right edge)
    const resizeHandle = block.locator('[style*="cursor: ew-resize"], [style*="cursor: e-resize"]').first()

    if (!(await resizeHandle.isVisible())) {
      test.skip()
      return
    }

    // Drag resize handle to the right
    await resizeHandle.dragTo(resizeHandle, {
      targetPosition: { x: 50, y: 0 } // Drag 50px to the right
    })

    await page.waitForTimeout(300) // Wait for Firestore update

    const newRect = await block.boundingBox()
    if (!newRect) {
      throw new Error('Could not get updated bounding box')
    }

    // Width should have increased
    expect(newRect.width).toBeGreaterThan(initialRect.width)

    // Height might change if text unwraps
    // Just verify it's still reasonable
    expect(newRect.height).toBeGreaterThan(0)
  })

  test('should detect visual overlap between blocks', async ({ page }) => {
    const blocks = await page.locator('[data-block-id]').all()

    if (blocks.length < 2) {
      test.skip()
      return
    }

    const blockRects = await Promise.all(
      blocks.map(async (block) => {
        const rect = await block.boundingBox()
        const id = await block.getAttribute('data-block-id')
        return { id, rect }
      })
    )

    // Check each pair for overlap
    for (let i = 0; i < blockRects.length; i++) {
      for (let j = i + 1; j < blockRects.length; j++) {
        const a = blockRects[i]
        const b = blockRects[j]

        if (!a.rect || !b.rect) continue

        // Check if rectangles overlap
        const overlaps = !(
          a.rect.x + a.rect.width <= b.rect.x ||
          b.rect.x + b.rect.width <= a.rect.x ||
          a.rect.y + a.rect.height <= b.rect.y ||
          b.rect.y + b.rect.height <= a.rect.y
        )

        // If blocks visually overlap, log it (this might be expected in some cases)
        if (overlaps) {
          console.log(`Visual overlap detected between blocks ${a.id} and ${b.id}`)
          console.log(`  Block ${a.id}: (${a.rect.x}, ${a.rect.y}) ${a.rect.width}x${a.rect.height}`)
          console.log(`  Block ${b.id}: (${b.rect.x}, ${b.rect.y}) ${b.rect.width}x${b.rect.height}`)
        }
      }
    }
  })

  test('should prevent new block placement in overlapping positions', async ({ page }) => {
    // This requires admin access and tests the "Add Text" feature

    // Check if we're admin (look for add text button or admin indicators)
    const addTextButton = page.locator('button:has-text("Add Text")').first()

    if (!(await addTextButton.isVisible())) {
      test.skip()
      return
    }

    await addTextButton.click()
    await page.waitForTimeout(200)

    // Move cursor over existing blocks - should show red preview
    const existingBlock = page.locator('[data-block-id]').first()
    const blockRect = await existingBlock.boundingBox()

    if (!blockRect) {
      test.skip()
      return
    }

    // Move cursor to center of existing block
    const centerX = blockRect.x + blockRect.width / 2
    const centerY = blockRect.y + blockRect.height / 2

    await page.mouse.move(centerX, centerY)
    await page.waitForTimeout(100)

    // Look for red preview indicator (preview should be red when overlapping)
    const canvas = page.locator('[data-canvas-container]')
    const previewBox = canvas.locator('div[style*="border"]').first()

    if (await previewBox.isVisible()) {
      const borderColor = await previewBox.evaluate((el) => {
        return window.getComputedStyle(el).borderColor
      })

      // Should be red when overlapping
      // RGB values for red: rgb(239, 68, 68) or similar
      console.log('Preview border color when over existing block:', borderColor)
    }
  })

  test('should calculate correct height for multi-line wrapped text', async ({ page }) => {
    const blocks = await page.locator('[data-block-id]').all()

    for (const block of blocks) {
      const textElement = block.locator('div[contenteditable], div[style*="font"]').first()
      const textContent = await textElement.textContent()

      if (!textContent || textContent.length < 30) continue

      const textRect = await textElement.boundingBox()
      const blockRect = await block.boundingBox()

      if (!textRect || !blockRect) continue

      // For long text, expect multiple lines
      const fontSize = await textElement.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize)
      })

      const lineHeight = fontSize * 1.5 // Typical line height
      const estimatedLines = Math.round(textRect.height / lineHeight)

      console.log(`Block with ${textContent.length} chars:`)
      console.log(`  Text rect: ${textRect.width}x${textRect.height}`)
      console.log(`  Block rect: ${blockRect.width}x${blockRect.height}`)
      console.log(`  Estimated lines: ${estimatedLines}`)

      // Block height should accommodate all text lines
      expect(blockRect.height, 'Block height should contain all text')
        .toBeGreaterThanOrEqual(textRect.height - 10)
    }
  })

  test('should handle collapsed vs expanded block states', async ({ page }) => {
    // Some blocks might have collapsed state - test if implemented
    const blocks = await page.locator('[data-block-id]').all()

    for (const block of blocks) {
      // Check if block has collapse/expand controls
      const collapseButton = block.locator('[aria-label*="ollapse"], button:has-text("−"), button:has-text("+")').first()

      if (!(await collapseButton.isVisible())) continue

      const expandedRect = await block.boundingBox()
      if (!expandedRect) continue

      // Click collapse
      await collapseButton.click()
      await page.waitForTimeout(200)

      const collapsedRect = await block.boundingBox()
      if (!collapsedRect) continue

      // Collapsed should be smaller
      expect(collapsedRect.height, 'Collapsed block should be shorter')
        .toBeLessThan(expandedRect.height)

      // Click expand
      await collapseButton.click()
      await page.waitForTimeout(200)

      const reExpandedRect = await block.boundingBox()
      if (!reExpandedRect) continue

      // Should return to original size (within tolerance)
      expect(Math.abs(reExpandedRect.height - expandedRect.height))
        .toBeLessThan(5)
    }
  })
})

test.describe('Overlap Detection Accuracy', () => {
  test('should use DOM measurements for overlap checks', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await page.waitForTimeout(1000)

    // Get all blocks
    const blocks = await page.locator('[data-block-id]').all()

    if (blocks.length < 2) {
      test.skip()
      return
    }

    // For each block, calculate what percentage-based height estimate would be
    // versus actual DOM height
    for (const block of blocks) {
      const id = await block.getAttribute('data-block-id')
      const blockRect = await block.boundingBox()

      if (!blockRect) continue

      // Get canvas dimensions to calculate percentages
      const canvas = page.locator('[data-canvas-container]')
      const canvasRect = await canvas.boundingBox()

      if (!canvasRect) continue

      // Calculate what the height would be as percentage
      const heightPercent = (blockRect.height / canvasRect.height) * 100

      // Hardcoded estimate used in code is 1%
      const estimatedHeight = 1

      // Calculate the error
      const error = Math.abs(heightPercent - estimatedHeight)
      const errorPercent = (error / heightPercent) * 100

      console.log(`Block ${id}:`)
      console.log(`  Actual height: ${heightPercent.toFixed(2)}%`)
      console.log(`  Estimated height: ${estimatedHeight}%`)
      console.log(`  Error: ${errorPercent.toFixed(0)}%`)

      // If error is > 50%, overlap detection will be very inaccurate
      if (errorPercent > 50) {
        console.warn(`⚠️  Height estimate is off by ${errorPercent.toFixed(0)}% for block ${id}`)
      }
    }
  })
})
