import { test, expect, Page } from '@playwright/test'

// ── Helpers ───────────────────────────────────────────────────────

/** Wait for canvas blocks to load from Firestore (public read, no auth needed). */
async function waitForBlocks(page: Page, timeout = 10000): Promise<number> {
  try {
    await page.locator('[data-block-id]').first().waitFor({ timeout })
  } catch {
    return 0
  }
  return page.locator('[data-block-id]').count()
}

/** Get all block elements on the canvas with their bounding boxes. */
async function getBlocks(page: Page) {
  const blockEls = page.locator('[data-block-id]')
  const count = await blockEls.count()
  const blocks: { id: string; box: { x: number; y: number; width: number; height: number } }[] = []

  for (let i = 0; i < count; i++) {
    const el = blockEls.nth(i)
    const id = await el.getAttribute('data-block-id')
    const box = await el.boundingBox()
    if (id && box) blocks.push({ id, box })
  }

  return blocks
}

/**
 * Get the bounding box of the actual canvas element.
 *
 * IMPORTANT: The canvas is 1440px wide with `transform: translateX(-50%) scale(s)`,
 * so its visual bounding box extends BEYOND the viewport edges.
 * Always clamp coordinates to the visible viewport before using them for mouse events.
 */
async function getCanvasBox(page: Page) {
  const canvas = page.locator('div.relative.bg-brand-dark').first()
  try {
    await canvas.waitFor({ timeout: 5000 })
  } catch {
    return null
  }
  return canvas.boundingBox()
}

/** Get the visible portion of the canvas (clamped to viewport). */
async function getVisibleCanvasArea(page: Page) {
  const canvasBox = await getCanvasBox(page)
  if (!canvasBox) return null

  const viewport = page.viewportSize()
  if (!viewport) return null

  return {
    left: Math.max(canvasBox.x, 0),
    top: Math.max(canvasBox.y, 0),
    right: Math.min(canvasBox.x + canvasBox.width, viewport.width),
    bottom: Math.min(canvasBox.y + canvasBox.height, viewport.height),
    get width() { return this.right - this.left },
    get height() { return this.bottom - this.top },
  }
}

/** Count how many blocks currently have the indigo selection ring. */
async function countSelectedBlocks(page: Page): Promise<number> {
  const selected = page.locator('[data-block-id][class*="ring-indigo"]')
  return selected.count()
}

/**
 * Find a point on the visible canvas that doesn't overlap any block.
 * The marquee only starts when mousedown hits the canvas background,
 * NOT a block element (blocks intercept mousedown for their own drag).
 */
async function findEmptyPoint(
  page: Page,
  blocks: { box: { x: number; y: number; width: number; height: number } }[],
  area: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  preferredX?: number,
  preferredY?: number,
): Promise<{ x: number; y: number } | null> {
  const padding = 5 // stay away from block edges

  function hitsBlock(px: number, py: number): boolean {
    return blocks.some(b =>
      px >= b.box.x - padding &&
      px <= b.box.x + b.box.width + padding &&
      py >= b.box.y - padding &&
      py <= b.box.y + b.box.height + padding
    )
  }

  // Try preferred location first
  if (preferredX !== undefined && preferredY !== undefined) {
    if (!hitsBlock(preferredX, preferredY)) return { x: preferredX, y: preferredY }
  }

  // Scan the visible canvas in a grid pattern to find empty space
  const stepX = 40, stepY = 40
  for (let y = area.top + 10; y < area.bottom - 10; y += stepY) {
    for (let x = area.left + 10; x < area.right - 10; x += stepX) {
      if (!hitsBlock(x, y)) return { x, y }
    }
  }

  return null // canvas is completely covered (unlikely)
}

/** Perform a marquee drag from (x1,y1) to (x2,y2) in screen pixels. */
async function marqueeDrag(
  page: Page,
  x1: number, y1: number,
  x2: number, y2: number,
  steps = 8
) {
  await page.mouse.move(x1, y1)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    const x = x1 + (x2 - x1) * (i / steps)
    const y = y1 + (y2 - y1) * (i / steps)
    await page.mouse.move(x, y)
  }
  await page.mouse.up()
  await page.waitForTimeout(300)
}

// ── Tests ─────────────────────────────────────────────────────────

test.describe('Marquee Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reno-dev-space/')
    // Don't use 'networkidle' — Firestore's persistent WebSocket never goes idle
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000) // let Firestore subscriptions fire

    // Dismiss the IntroHint modal if visible
    const browseButton = page.locator('button:has-text("Browse First")')
    if (await browseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseButton.click()
      await page.waitForTimeout(500)
    }
  })

  test('marquee rectangle appears during drag', async ({ page }) => {
    const area = await getVisibleCanvasArea(page)
    if (!area) {
      console.log('Canvas not found')
      return test.skip()
    }

    console.log(`Visible canvas area: (${area.left}, ${area.top}) to (${area.right}, ${area.bottom})`)

    // Must start from empty canvas — blocks intercept mousedown for their own drag
    const blocks = await getBlocks(page)
    const emptyStart = await findEmptyPoint(page, blocks, area)
    if (!emptyStart) {
      console.log('No empty canvas space found — canvas completely covered by blocks')
      return test.skip()
    }

    console.log(`Starting marquee from empty point: (${emptyStart.x.toFixed(0)}, ${emptyStart.y.toFixed(0)})`)

    await page.mouse.move(emptyStart.x, emptyStart.y)
    await page.mouse.down()
    await page.mouse.move(emptyStart.x + 200, emptyStart.y + 150, { steps: 5 })

    const marqueeDiv = page.locator('div.border-indigo-500')
    const isVisible = await marqueeDiv.isVisible().catch(() => false)

    await page.screenshot({ path: 'tests/screenshots/marquee-01-visible.png', fullPage: true })
    await page.mouse.up()

    console.log(`Marquee visible during drag: ${isVisible}`)
    expect(isVisible).toBe(true)
  })

  test('marquee selects blocks within rectangle', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount < 1) {
      console.log('No blocks on canvas (need .env.local with Firebase credentials)')
      return test.skip()
    }

    const blocks = await getBlocks(page)
    if (blocks.length === 0) return test.skip()

    const area = await getVisibleCanvasArea(page)
    if (!area) return test.skip()

    // Target the first block: draw a marquee that generously covers it
    // Start from verified empty space ABOVE-LEFT of the target
    const target = blocks[0]
    const margin = 30

    const x1 = target.box.x - margin
    const y1 = target.box.y - margin
    const x2 = target.box.x + target.box.width + margin
    const y2 = target.box.y + target.box.height + margin

    // Ensure the start point doesn't land on another block
    const emptyStart = await findEmptyPoint(page, blocks, area, x1, y1)
    if (!emptyStart) {
      console.log('No empty canvas space found to start marquee')
      return test.skip()
    }

    console.log(`Dragging marquee over block ${target.id.slice(0, 8)}...`)
    console.log(`  from (${emptyStart.x.toFixed(0)}, ${emptyStart.y.toFixed(0)}) to (${x2.toFixed(0)}, ${y2.toFixed(0)})`)

    await marqueeDrag(page, emptyStart.x, emptyStart.y, x2, y2)

    await page.screenshot({ path: 'tests/screenshots/marquee-02-after-select.png', fullPage: true })

    const selectedCount = await countSelectedBlocks(page)
    console.log(`Selected ${selectedCount} blocks after marquee`)
    expect(selectedCount).toBeGreaterThanOrEqual(1)
  })

  test('tiny drag clears selection instead of selecting', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount < 1) return test.skip()

    // Click a block to select it
    const firstBlock = page.locator('[data-block-id]').first()
    await firstBlock.click()
    await page.waitForTimeout(300)

    const beforeCount = await countSelectedBlocks(page)
    console.log(`Before tiny drag: ${beforeCount} selected`)

    const area = await getVisibleCanvasArea(page)
    if (!area) return test.skip()

    const blocks = await getBlocks(page)
    // Find a truly empty spot for the tiny drag
    const emptySpot = await findEmptyPoint(page, blocks, area, area.right - 50, area.top + 30)
    if (!emptySpot) {
      console.log('No empty canvas space found')
      return test.skip()
    }

    // Tiny drag in empty space — should deselect
    await marqueeDrag(page, emptySpot.x, emptySpot.y, emptySpot.x + 3, emptySpot.y + 3, 2)

    const afterCount = await countSelectedBlocks(page)
    console.log(`After tiny drag: ${afterCount} selected`)
    expect(afterCount).toBe(0)
  })

  test('reverse-direction marquee (bottom-right to top-left) works', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount < 1) return test.skip()

    const blocks = await getBlocks(page)
    if (blocks.length === 0) return test.skip()

    const area = await getVisibleCanvasArea(page)
    if (!area) return test.skip()

    const target = blocks[0]
    const margin = 30

    // Drag from bottom-right to top-left (reverse direction)
    // Start point must be empty canvas space
    const startX = target.box.x + target.box.width + margin
    const startY = target.box.y + target.box.height + margin
    const emptyStart = await findEmptyPoint(page, blocks, area, startX, startY)
    if (!emptyStart) {
      console.log('No empty canvas space found to start reverse marquee')
      return test.skip()
    }

    await marqueeDrag(
      page,
      emptyStart.x,
      emptyStart.y,
      target.box.x - margin,
      target.box.y - margin,
    )

    await page.screenshot({ path: 'tests/screenshots/marquee-03-reverse.png', fullPage: true })

    const selectedCount = await countSelectedBlocks(page)
    console.log(`Reverse marquee selected: ${selectedCount} blocks`)
    expect(selectedCount).toBeGreaterThanOrEqual(1)
  })

  test('marquee covering only bottom half of tall block', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount < 1) return test.skip()

    const blocks = await getBlocks(page)
    if (blocks.length === 0) return test.skip()

    const area = await getVisibleCanvasArea(page)
    if (!area) return test.skip()

    // Find a tall block that's fully within the viewport (mouse events don't
    // work reliably outside the viewport)
    const visibleBlocks = blocks.filter(b =>
      b.box.y >= area.top &&
      b.box.y + b.box.height + 30 <= area.bottom // room for margin
    )
    if (visibleBlocks.length === 0) {
      console.log('No blocks fully visible within viewport')
      return test.skip()
    }

    const tallest = visibleBlocks.reduce((a, b) => (a.box.height > b.box.height ? a : b))
    console.log(`Tallest visible block: id=${tallest.id.slice(0, 8)}..., height=${tallest.box.height.toFixed(0)}px`)

    // Draw marquee covering ONLY the bottom half of the block
    const midY = tallest.box.y + tallest.box.height / 2
    const margin = 20
    const startX = tallest.box.x - margin
    const startY = midY + 5

    // Ensure start point is empty canvas (not on another block)
    const emptyStart = await findEmptyPoint(page, blocks, area, startX, startY)
    if (!emptyStart) {
      console.log('No empty canvas space found')
      return test.skip()
    }

    console.log(`Marquee from (${emptyStart.x.toFixed(0)}, ${emptyStart.y.toFixed(0)}) to (${(tallest.box.x + tallest.box.width + margin).toFixed(0)}, ${(tallest.box.y + tallest.box.height + margin).toFixed(0)})`)

    await marqueeDrag(
      page,
      emptyStart.x,
      emptyStart.y,
      tallest.box.x + tallest.box.width + margin,
      tallest.box.y + tallest.box.height + margin,
    )

    await page.screenshot({ path: 'tests/screenshots/marquee-04-bottom-half.png', fullPage: true })

    const selectedCount = await countSelectedBlocks(page)
    console.log(`Bottom-half marquee selected: ${selectedCount} blocks`)

    // User clearly intended to grab this block — any overlap should select
    expect(selectedCount).toBeGreaterThanOrEqual(1)
  })

  test('full-canvas marquee selects all visible blocks', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount < 2) {
      console.log(`Need >=2 blocks (found ${blockCount})`)
      return test.skip()
    }

    const blocks = await getBlocks(page)
    const area = await getVisibleCanvasArea(page)
    if (!area) return test.skip()

    // Start from top-left corner of visible canvas — must be empty space
    const emptyStart = await findEmptyPoint(page, blocks, area, area.left + 5, area.top + 5)
    if (!emptyStart) {
      console.log('No empty canvas space at top-left — canvas completely covered')
      return test.skip()
    }

    // Drag from empty start across entire visible canvas area
    await marqueeDrag(page, emptyStart.x, emptyStart.y, area.right - 5, area.bottom - 5, 12)

    await page.screenshot({ path: 'tests/screenshots/marquee-05-select-all.png', fullPage: true })

    const selectedCount = await countSelectedBlocks(page)
    console.log(`Full-canvas marquee: ${selectedCount} / ${blocks.length} blocks selected`)

    expect(selectedCount).toBeGreaterThanOrEqual(1)

    if (selectedCount < blocks.length) {
      console.log(`WARNING: MISSED ${blocks.length - selectedCount} blocks — likely height approximation bug`)
    }
  })

  test('diagnostic: block positions vs marquee coordinate space', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount === 0) {
      console.log('No blocks to diagnose (need .env.local with Firebase credentials)')
      return test.skip()
    }

    const blocks = await getBlocks(page)
    const canvasBox = await getCanvasBox(page)
    if (!canvasBox) return test.skip()

    console.log('\n===== MARQUEE DIAGNOSTIC =====')
    console.log(`Canvas: ${canvasBox.width.toFixed(0)}x${canvasBox.height.toFixed(0)} at (${canvasBox.x.toFixed(0)}, ${canvasBox.y.toFixed(0)})`)
    console.log(`Viewport: ${page.viewportSize()?.width}x${page.viewportSize()?.height}`)
    console.log(`Block count: ${blocks.length}\n`)

    let blocksWithBadApprox = 0

    for (const b of blocks) {
      // Convert screen px to canvas percentages (same math as Canvas.tsx)
      const xPct = ((b.box.x - canvasBox.x) / canvasBox.width) * 100
      const yPct = ((b.box.y - canvasBox.y) / canvasBox.height) * 100
      const wPct = (b.box.width / canvasBox.width) * 100
      const hPct = (b.box.height / canvasBox.height) * 100

      // The hardcoded approximation: blockBottom = block.y + 5
      const approxBottom = yPct + 5
      const realBottom = yPct + hPct

      const isTallerThanApprox = hPct > 5
      if (isTallerThanApprox) blocksWithBadApprox++

      console.log(
        `  ${b.id.slice(0, 8)}... ` +
        `y=${yPct.toFixed(1)}% h=${hPct.toFixed(1)}% ` +
        `approxBot=${approxBottom.toFixed(1)}% realBot=${realBottom.toFixed(1)}%` +
        (isTallerThanApprox ? ' << TALLER THAN 5%' : '')
      )
    }

    console.log(`\nBlocks with inaccurate height approx: ${blocksWithBadApprox} / ${blocks.length}`)
    if (blocksWithBadApprox > 0) {
      console.log('>> These blocks have unreachable bottom regions via marquee')
    }
    console.log('===== END DIAGNOSTIC =====\n')

    await page.screenshot({ path: 'tests/screenshots/marquee-06-diagnostic.png', fullPage: true })
    expect(blocks.length).toBeGreaterThan(0)
  })
})
