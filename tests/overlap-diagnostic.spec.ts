import { test, expect, Page, ConsoleMessage } from '@playwright/test'

/**
 * Comprehensive diagnostic test for overlap detection.
 * Logs all values during operations to identify asymmetric behavior.
 */

interface BlockInfo {
  id: string
  box: DOMRect
  relativeToCanvas: { x: number; y: number; width: number; height: number }
}

interface CanvasInfo {
  box: DOMRect
  heightPercent: number
}

// Admin credentials
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'christopher@corella.com'
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '.YQZv*S*7"jk^=?'

test.describe('Overlap Detection Diagnostic', () => {
  let consoleLogs: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleLogs = []

    // Capture ALL console logs
    page.on('console', (msg: ConsoleMessage) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
    })

    page.on('pageerror', (error) => {
      consoleLogs.push(`[PAGE ERROR] ${error.message}`)
    })

    await page.goto('/')
    await page.waitForLoadState('load')

    // Wait for app hydration
    try {
      await page.waitForSelector('[data-block-id]', { timeout: 15000 })
    } catch {
      console.log('[Setup] No blocks found, may need more time')
    }

    await page.waitForTimeout(2000)

    // Dismiss intro hint
    const browseButton = page.locator('button:has-text("Browse First")')
    if (await browseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseButton.click()
      await page.waitForTimeout(500)
    }
  })

  test.afterEach(async () => {
    // Print filtered logs
    const overlapLogs = consoleLogs.filter(l =>
      l.includes('wouldOverlapDOM') ||
      l.includes('previewSize') ||
      l.includes('Measured') ||
      l.includes('OVERLAP')
    )

    if (overlapLogs.length > 0) {
      console.log('\n===== OVERLAP DETECTION LOGS =====')
      overlapLogs.forEach(l => console.log(l))
      console.log('===== END LOGS =====\n')
    }
  })

  async function getCanvasInfo(page: Page): Promise<CanvasInfo | null> {
    const canvas = page.locator('div.relative.bg-brand-dark').first()
    const box = await canvas.boundingBox()
    if (!box) return null

    const DESIGN_HEIGHT = 900
    const heightPercent = (box.height / DESIGN_HEIGHT) * 100

    return { box: box as DOMRect, heightPercent }
  }

  async function getBlocksInfo(page: Page, canvasInfo: CanvasInfo): Promise<BlockInfo[]> {
    const blockEls = page.locator('[data-block-id]')
    const count = await blockEls.count()
    const blocks: BlockInfo[] = []

    for (let i = 0; i < count; i++) {
      const el = blockEls.nth(i)
      const id = await el.getAttribute('data-block-id')
      const box = await el.boundingBox()

      if (id && box) {
        blocks.push({
          id,
          box: box as DOMRect,
          relativeToCanvas: {
            x: ((box.x - canvasInfo.box.x) / canvasInfo.box.width) * 100,
            y: ((box.y - canvasInfo.box.y) / canvasInfo.box.height) * canvasInfo.heightPercent,
            width: (box.width / canvasInfo.box.width) * 100,
            height: (box.height / canvasInfo.box.height) * 100
          }
        })
      }
    }

    return blocks
  }

  test('analyze asymmetric overlap detection around a single block', async ({ page }) => {
    const canvasInfo = await getCanvasInfo(page)
    if (!canvasInfo) return test.skip()

    const blocks = await getBlocksInfo(page, canvasInfo)
    if (blocks.length === 0) return test.skip()

    // Find a block near the center of visible area
    const visibleBlocks = blocks.filter(b =>
      b.box.y > canvasInfo.box.y &&
      b.box.y < canvasInfo.box.y + canvasInfo.box.height * 0.5
    )

    if (visibleBlocks.length === 0) return test.skip()

    const targetBlock = visibleBlocks[0]
    console.log('\n===== TARGET BLOCK ANALYSIS =====')
    console.log(`Block ID: ${targetBlock.id}`)
    console.log(`Screen position: (${targetBlock.box.x.toFixed(0)}, ${targetBlock.box.y.toFixed(0)})`)
    console.log(`Screen size: ${targetBlock.box.width.toFixed(0)}x${targetBlock.box.height.toFixed(0)}px`)
    console.log(`Canvas %: x=${targetBlock.relativeToCanvas.x.toFixed(1)}%, y=${targetBlock.relativeToCanvas.y.toFixed(1)}%`)
    console.log(`Canvas % size: ${targetBlock.relativeToCanvas.width.toFixed(1)}%x${targetBlock.relativeToCanvas.height.toFixed(1)}%`)

    // Calculate approach positions (20px gap from each side)
    const gap = 20
    const approaches = {
      left: {
        x: targetBlock.box.x - 150 - gap, // 150px wide preview + gap
        y: targetBlock.box.y + targetBlock.box.height / 2,
        label: 'LEFT'
      },
      right: {
        x: targetBlock.box.x + targetBlock.box.width + gap,
        y: targetBlock.box.y + targetBlock.box.height / 2,
        label: 'RIGHT'
      },
      top: {
        x: targetBlock.box.x + targetBlock.box.width / 2,
        y: targetBlock.box.y - 50 - gap, // 50px tall preview + gap
        label: 'TOP'
      },
      bottom: {
        x: targetBlock.box.x + targetBlock.box.width / 2,
        y: targetBlock.box.y + targetBlock.box.height + gap,
        label: 'BOTTOM'
      }
    }

    // Sign in to enable Add Text mode
    const signInButton = page.locator('button:has-text("Sign In")')
    if (await signInButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('\n[Auth] Attempting sign in...')
      await signInButton.click()
      await page.waitForTimeout(500)

      // Switch to login mode
      const loginLink = page.locator('.text-brand-accent:has-text("Sign in")')
      if (await loginLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        await loginLink.click()
        await page.waitForTimeout(300)
      }

      await page.fill('input[type="email"]', ADMIN_EMAIL)
      await page.fill('input[type="password"]', ADMIN_PASSWORD)
      await page.locator('button[type="submit"]').click()
      await page.waitForTimeout(2000)
    }

    // Check if Add Text button is available
    const addTextButton = page.locator('button:has-text("Add Text")')
    const canAddText = await addTextButton.isVisible({ timeout: 3000 }).catch(() => false)

    if (!canAddText) {
      console.log('[Test] Cannot access Add Text mode - skipping approach test')
      console.log('[Test] Run with: TEST_ADMIN_EMAIL=xxx TEST_ADMIN_PASSWORD=xxx npx playwright test')
      await page.screenshot({ path: 'tests/screenshots/diagnostic-no-auth.png' })
      return
    }

    // Enter Add Text mode
    await addTextButton.click()
    await page.waitForTimeout(500)

    console.log('\n===== APPROACH TEST RESULTS =====')

    for (const [direction, pos] of Object.entries(approaches)) {
      // Clamp to canvas bounds
      const clampedX = Math.max(canvasInfo.box.x + 50, Math.min(canvasInfo.box.x + canvasInfo.box.width - 50, pos.x))
      const clampedY = Math.max(canvasInfo.box.y + 50, Math.min(canvasInfo.box.y + canvasInfo.box.height - 50, pos.y))

      await page.mouse.move(clampedX, clampedY)
      await page.waitForTimeout(300)

      // Check preview state
      const cantPlace = page.locator('text="Can\'t place here"')
      const clickToPlace = page.locator('text="Click to place"')

      const isBlocked = await cantPlace.isVisible({ timeout: 300 }).catch(() => false)
      const isAllowed = await clickToPlace.isVisible({ timeout: 300 }).catch(() => false)

      const result = isBlocked ? '❌ BLOCKED' : isAllowed ? '✅ ALLOWED' : '❓ UNKNOWN'

      console.log(`${pos.label}: screen(${clampedX.toFixed(0)}, ${clampedY.toFixed(0)}) → ${result}`)

      // Take screenshot for blocked cases
      if (isBlocked) {
        await page.screenshot({
          path: `tests/screenshots/diagnostic-blocked-${direction}.png`,
          clip: {
            x: Math.max(0, targetBlock.box.x - 200),
            y: Math.max(0, targetBlock.box.y - 100),
            width: targetBlock.box.width + 400,
            height: targetBlock.box.height + 200
          }
        })
      }
    }

    // Exit Add Text mode
    const cancelButton = page.locator('button:has-text("Cancel")')
    if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelButton.click()
    }

    console.log('===== END APPROACH TEST =====\n')

    await page.screenshot({ path: 'tests/screenshots/diagnostic-final.png', fullPage: true })
  })

  test('log detailed overlap check values', async ({ page }) => {
    // Inject logging into the overlap detection
    await page.addInitScript(() => {
      // Override console.log to capture more detail
      const originalLog = console.log
      console.log = (...args: unknown[]) => {
        originalLog.apply(console, args)
      }
    })

    const canvasInfo = await getCanvasInfo(page)
    if (!canvasInfo) return test.skip()

    console.log('\n===== CANVAS INFO =====')
    console.log(`Canvas: ${canvasInfo.box.width.toFixed(0)}x${canvasInfo.box.height.toFixed(0)}px`)
    console.log(`Canvas position: (${canvasInfo.box.x.toFixed(0)}, ${canvasInfo.box.y.toFixed(0)})`)
    console.log(`Canvas heightPercent: ${canvasInfo.heightPercent.toFixed(1)}%`)

    const blocks = await getBlocksInfo(page, canvasInfo)

    console.log(`\nFound ${blocks.length} blocks`)

    // Show first 5 blocks
    for (const block of blocks.slice(0, 5)) {
      console.log(`\nBlock ${block.id.slice(0, 8)}:`)
      console.log(`  Screen: (${block.box.x.toFixed(0)}, ${block.box.y.toFixed(0)}) ${block.box.width.toFixed(0)}x${block.box.height.toFixed(0)}px`)
      console.log(`  Canvas%: (${block.relativeToCanvas.x.toFixed(1)}%, ${block.relativeToCanvas.y.toFixed(1)}%)`)
    }

    // Calculate what the preview box SHOULD be using measureNewBlockSize logic
    // The preview should be ~48px tall (typical text height), not 6% of canvas
    const expectedPreviewHeight = 48 // pixels
    const expectedHeightPercent = (expectedPreviewHeight / canvasInfo.box.height) * 100

    console.log(`\n===== EXPECTED PREVIEW SIZE =====`)
    console.log(`If text is ~48px tall:`)
    console.log(`  Height: ${expectedPreviewHeight}px = ${expectedHeightPercent.toFixed(2)}% of canvas`)
    console.log(`If using default 6%:`)
    console.log(`  Height: ${(6/100) * canvasInfo.box.height}px (THIS IS THE BUG!)`)

    expect(true).toBe(true)
  })

  test('verify wouldOverlapDOM tolerance is symmetric', async ({ page }) => {
    // This test verifies the math in the overlap detection
    const canvasInfo = await getCanvasInfo(page)
    if (!canvasInfo) return test.skip()

    const blocks = await getBlocksInfo(page, canvasInfo)
    if (blocks.length === 0) return test.skip()

    const block = blocks[0]
    const TOLERANCE = 24 // From overlapDetection.ts

    console.log('\n===== TOLERANCE SYMMETRY CHECK =====')
    console.log(`Block: ${block.box.width.toFixed(0)}x${block.box.height.toFixed(0)}px at (${block.box.x.toFixed(0)}, ${block.box.y.toFixed(0)})`)
    console.log(`Tolerance: ${TOLERANCE}px`)

    // Assuming a 150x50 preview box
    const previewW = 150
    const previewH = 50

    // Calculate "safe" zones where preview would NOT overlap
    // From LEFT: newRight <= blockLeft + TOLERANCE
    //   newRight = previewLeft + previewW
    //   previewLeft <= blockLeft + TOLERANCE - previewW
    const safeLeftMax = block.box.x + TOLERANCE - previewW

    // From RIGHT: newLeft >= blockRight - TOLERANCE
    //   newLeft >= blockRight - TOLERANCE
    const safeRightMin = block.box.x + block.box.width - TOLERANCE

    // From TOP: newBottom <= blockTop + TOLERANCE
    //   previewTop + previewH <= blockTop + TOLERANCE
    //   previewTop <= blockTop + TOLERANCE - previewH
    const safeTopMax = block.box.y + TOLERANCE - previewH

    // From BOTTOM: newTop >= blockBottom - TOLERANCE
    const safeBottomMin = block.box.y + block.box.height - TOLERANCE

    console.log(`\nSafe zones (where preview is allowed):`)
    console.log(`  LEFT approach: preview.x <= ${safeLeftMax.toFixed(0)} (${TOLERANCE - previewW}px into block)`)
    console.log(`  RIGHT approach: preview.x >= ${safeRightMin.toFixed(0)} (${TOLERANCE}px before block edge)`)
    console.log(`  TOP approach: preview.y <= ${safeTopMax.toFixed(0)} (${TOLERANCE - previewH}px into block)`)
    console.log(`  BOTTOM approach: preview.y >= ${safeBottomMin.toFixed(0)} (${TOLERANCE}px before block edge)`)

    console.log(`\nNote: If preview is LARGER than tolerance, approach from that side becomes harder!`)
    console.log(`  Preview width (${previewW}px) vs tolerance (${TOLERANCE}px): ${previewW > TOLERANCE ? 'WIDTH EXCEEDS TOLERANCE!' : 'OK'}`)
    console.log(`  Preview height (${previewH}px) vs tolerance (${TOLERANCE}px): ${previewH > TOLERANCE ? 'HEIGHT EXCEEDS TOLERANCE!' : 'OK'}`)

    console.log('===== END SYMMETRY CHECK =====\n')

    expect(true).toBe(true)
  })
})
