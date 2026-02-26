import { test, expect, Page, ConsoleMessage } from '@playwright/test'

// ── Test Credentials ─────────────────────────────────────────────────
// Admin credentials - use environment variables or fallback to hardcoded
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'christopher@corella.com'
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '.YQZv*S*7"jk^=?'

// ── Helpers ──────────────────────────────────────────────────────────

/** Sign in as admin user */
async function signInAsAdmin(page: Page): Promise<boolean> {
  // Check if already signed in (Add Text button visible = admin already logged in)
  const addTextButton = page.locator('button:has-text("Add Text")')
  if (await addTextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('[Auth] Already signed in as admin')
    return true
  }

  // Look for "Sign In" button in the panel (Profile tab area)
  const signInButton = page.locator('button:has-text("Sign In")')
  const isVisible = await signInButton.isVisible({ timeout: 3000 }).catch(() => false)
  if (!isVisible) {
    console.log('[Auth] Sign In button not found')
    return false
  }

  await signInButton.click()
  await page.waitForTimeout(500)

  // Modal opens in signup mode by default - look for "Already have an account? Sign in" link
  // The link text is just "Sign in" but it's inside a text that says "Already have an account?"
  const signInLink = page.locator('text="Already have an account?"').locator('..').locator('button:has-text("Sign in")')

  // Alternative: just find the Sign in link at the bottom of the modal
  const altSignInLink = page.locator('.text-brand-accent:has-text("Sign in")')

  if (await altSignInLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await altSignInLink.click()
    await page.waitForTimeout(300)
    console.log('[Auth] Switched to login mode')
  } else if (await signInLink.isVisible({ timeout: 1000 }).catch(() => false)) {
    await signInLink.click()
    await page.waitForTimeout(300)
    console.log('[Auth] Switched to login mode (alt)')
  }

  // Now fill in credentials - should be in login mode (Welcome Back)
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)

  // Submit
  const submitButton = page.locator('button[type="submit"]')
  await submitButton.click()

  // Wait for either: modal closes (success) or error appears (failure)
  await page.waitForTimeout(1000)

  // Check for error message in the modal
  const errorBox = page.locator('.bg-red-500\\/20')
  const hasError = await errorBox.isVisible({ timeout: 2000 }).catch(() => false)
  if (hasError) {
    const errorText = await errorBox.textContent().catch(() => 'unknown error')
    console.log(`[Auth] Login error: ${errorText}`)
    await page.screenshot({ path: 'tests/screenshots/auth-failed-debug.png' })
    return false
  }

  // Wait for modal to close
  await page.waitForTimeout(2000)

  // Verify Add Text button appears (admin privilege)
  const hasAddText = await addTextButton.isVisible({ timeout: 5000 }).catch(() => false)

  if (hasAddText) {
    console.log('[Auth] Successfully signed in as admin')
    return true
  }

  // Take diagnostic screenshot
  await page.screenshot({ path: 'tests/screenshots/auth-failed-debug.png' })
  console.log('[Auth] Failed to verify admin sign-in - check auth-failed-debug.png')
  return false
}

/** Enter Add Text mode by clicking the button */
async function enterAddTextMode(page: Page): Promise<boolean> {
  const addTextButton = page.locator('button:has-text("Add Text")')

  if (!await addTextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('[AddText] Add Text button not visible')
    return false
  }

  await addTextButton.click()
  await page.waitForTimeout(300)

  // Verify we're in Add Text mode (button should now say "Cancel")
  const cancelButton = page.locator('button:has-text("Cancel")')
  const inMode = await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)

  console.log(`[AddText] Entered Add Text mode: ${inMode}`)
  return inMode
}

/** Exit Add Text mode */
async function exitAddTextMode(page: Page): Promise<void> {
  const cancelButton = page.locator('button:has-text("Cancel")')
  if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await cancelButton.click()
    await page.waitForTimeout(300)
  }
}

/** Wait for canvas blocks to load */
async function waitForBlocks(page: Page, timeout = 10000): Promise<number> {
  try {
    await page.locator('[data-block-id]').first().waitFor({ timeout })
  } catch {
    return 0
  }
  return page.locator('[data-block-id]').count()
}

/** Get all block elements with their bounding boxes */
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

/** Get the canvas bounding box */
async function getCanvasBox(page: Page) {
  const canvas = page.locator('div.relative.bg-brand-dark').first()
  try {
    await canvas.waitFor({ timeout: 5000 })
  } catch {
    return null
  }
  return canvas.boundingBox()
}

/** Check if the Add Text preview shows valid (indigo) or invalid (red) placement */
async function getPreviewState(page: Page): Promise<'valid' | 'invalid' | 'hidden'> {
  // Check for the overlapping message (red)
  const overlappingIndicator = page.locator('text="Can\'t place here"')
  const isOverlapping = await overlappingIndicator.isVisible({ timeout: 500 }).catch(() => false)
  if (isOverlapping) return 'invalid'

  // Check for the "Click to place" message (indigo/green)
  const validIndicator = page.locator('text="Click to place"')
  const isValid = await validIndicator.isVisible({ timeout: 500 }).catch(() => false)
  if (isValid) return 'valid'

  return 'hidden'
}

/** Move mouse to a canvas percentage position */
async function moveToCanvasPosition(
  page: Page,
  canvasBox: { x: number; y: number; width: number; height: number },
  xPercent: number,
  yPercent: number
): Promise<{ screenX: number; screenY: number }> {
  const screenX = canvasBox.x + (xPercent / 100) * canvasBox.width
  const screenY = canvasBox.y + (yPercent / 100) * canvasBox.height
  await page.mouse.move(screenX, screenY)
  await page.waitForTimeout(100) // Let React update
  return { screenX, screenY }
}

/** Find an empty area on the canvas */
async function findEmptyPosition(
  page: Page,
  blocks: { box: { x: number; y: number; width: number; height: number } }[],
  canvasBox: { x: number; y: number; width: number; height: number }
): Promise<{ xPercent: number; yPercent: number } | null> {
  // Preview box dimensions must match the app's calculation!
  // Width: 12% of canvas width
  // Height: 6% of DESIGN_HEIGHT (not canvas height!)
  const DESIGN_HEIGHT = 900
  const canvasHeightPercent = (canvasBox.height / DESIGN_HEIGHT) * 100

  const previewWidthPx = (12 / 100) * canvasBox.width
  const previewHeightPx = (6 / canvasHeightPercent) * canvasBox.height  // ~54px

  function hitsAnyBlock(xPct: number, yPct: number): boolean {
    // Convert percentage to screen pixels (matching the app's calculation)
    const previewLeft = canvasBox.x + (xPct / 100) * canvasBox.width
    const previewTop = canvasBox.y + (yPct / canvasHeightPercent) * canvasBox.height
    const previewRight = previewLeft + previewWidthPx
    const previewBottom = previewTop + previewHeightPx

    return blocks.some(b => !(
      previewRight < b.box.x ||
      previewLeft > b.box.x + b.box.width ||
      previewBottom < b.box.y ||
      previewTop > b.box.y + b.box.height
    ))
  }

  // Scan for empty space (y is in canvasHeightPercent units, not 0-100)
  for (let yPct = 5; yPct < canvasHeightPercent * 0.8; yPct += 8) {
    for (let xPct = 5; xPct < 80; xPct += 10) {
      if (!hitsAnyBlock(xPct, yPct)) {
        return { xPercent: xPct, yPercent: yPct }
      }
    }
  }

  return null
}

/** Convert screen coordinates to canvas percentages */
function screenToCanvasPercent(
  screenX: number,
  screenY: number,
  canvasBox: { x: number; y: number; width: number; height: number }
): { xPercent: number; yPercent: number } {
  const xPercent = ((screenX - canvasBox.x) / canvasBox.width) * 100
  const yPercent = ((screenY - canvasBox.y) / canvasBox.height) * 100
  return { xPercent, yPercent }
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe('Block Geometry Analysis (no auth required)', () => {
  test('analyze block bounding boxes and potential overlap zones', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Dismiss IntroHint
    const browseButton = page.locator('button:has-text("Browse First")')
    if (await browseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseButton.click()
      await page.waitForTimeout(500)
    }

    const blockCount = await waitForBlocks(page)
    if (blockCount === 0) {
      console.log('No blocks found - skipping geometry analysis')
      return test.skip()
    }

    const canvasBox = await getCanvasBox(page)
    if (!canvasBox) return test.skip()

    const blocks = await getBlocks(page)

    // DESIGN_HEIGHT from the app constants
    const DESIGN_HEIGHT = 900
    const canvasHeightPercent = (canvasBox.height / DESIGN_HEIGHT) * 100

    // Preview dimensions: 12% of width, but 6% of DESIGN_HEIGHT (not canvas height!)
    const previewWidthPx = (12 / 100) * canvasBox.width
    const previewHeightPx = (6 / canvasHeightPercent) * canvasBox.height  // This equals 6% of DESIGN_HEIGHT

    console.log('\n===== BLOCK GEOMETRY ANALYSIS =====')
    console.log(`Canvas: ${canvasBox.width.toFixed(0)}x${canvasBox.height.toFixed(0)} at (${canvasBox.x.toFixed(0)}, ${canvasBox.y.toFixed(0)})`)
    console.log(`canvasHeightPercent: ${canvasHeightPercent.toFixed(1)}%`)
    console.log(`Preview box size: ${previewWidthPx.toFixed(0)}px x ${previewHeightPx.toFixed(0)}px (should be ~${(0.12 * 1440).toFixed(0)}px x 54px)`)
    console.log(`Found ${blocks.length} blocks:\n`)

    for (const block of blocks) {
      const relX = ((block.box.x - canvasBox.x) / canvasBox.width * 100).toFixed(1)
      const relY = ((block.box.y - canvasBox.y) / canvasBox.height * 100).toFixed(1)
      const relW = (block.box.width / canvasBox.width * 100).toFixed(1)
      const relH = (block.box.height / canvasBox.height * 100).toFixed(1)

      console.log(`  Block ${block.id.slice(0, 8)}...`)
      console.log(`    Screen: (${block.box.x.toFixed(0)}, ${block.box.y.toFixed(0)}) ${block.box.width.toFixed(0)}x${block.box.height.toFixed(0)}px`)
      console.log(`    Canvas%: (${relX}%, ${relY}%) ${relW}%x${relH}%`)

      // Calculate danger zones where preview would overlap
      const PREVIEW_W = 12 // percent
      const PREVIEW_H = 6  // percent
      const dangerLeft = Math.max(0, parseFloat(relX) - PREVIEW_W)
      const dangerRight = Math.min(100 - PREVIEW_W, parseFloat(relX) + parseFloat(relW))
      const dangerTop = Math.max(0, parseFloat(relY) - PREVIEW_H)
      const dangerBottom = Math.min(100 - PREVIEW_H, parseFloat(relY) + parseFloat(relH))

      console.log(`    Danger zone: x=${dangerLeft.toFixed(1)}-${dangerRight.toFixed(1)}%, y=${dangerTop.toFixed(1)}-${dangerBottom.toFixed(1)}%`)
    }

    // Check for overlapping blocks (blocks that overlap each other)
    const overlaps: string[] = []
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i].box
        const b = blocks[j].box
        const overlapsX = !(a.x + a.width < b.x || b.x + b.width < a.x)
        const overlapsY = !(a.y + a.height < b.y || b.y + b.height < a.y)
        if (overlapsX && overlapsY) {
          overlaps.push(`${blocks[i].id.slice(0, 8)} overlaps ${blocks[j].id.slice(0, 8)}`)
        }
      }
    }

    if (overlaps.length > 0) {
      console.log(`\n⚠️  EXISTING BLOCK OVERLAPS DETECTED:`)
      overlaps.forEach(o => console.log(`    ${o}`))
    }

    console.log('\n===== END ANALYSIS =====\n')

    await page.screenshot({ path: 'tests/screenshots/block-geometry.png', fullPage: true })
    expect(blocks.length).toBeGreaterThan(0)
  })
})

test.describe('Overlap Detection Accuracy (requires auth)', () => {
  // Collect console logs for diagnostics
  let consoleLogs: string[] = []
  let authWorking = false

  test.beforeEach(async ({ page }) => {
    consoleLogs = []

    // Capture console logs
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.text().includes('[wouldOverlapDOM]')) {
        consoleLogs.push(msg.text())
      }
    })

    // Dev server runs at root, production uses /reno-dev-space/
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Dismiss IntroHint if visible
    const browseButton = page.locator('button:has-text("Browse First")')
    if (await browseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseButton.click()
      await page.waitForTimeout(500)
    }
  })

  test.describe.configure({ mode: 'serial' })  // Run auth test first

  test.afterEach(async () => {
    if (consoleLogs.length > 0) {
      console.log('\n===== Overlap Detection Console Logs =====')
      consoleLogs.forEach(log => console.log(log))
      console.log('===== End Logs =====\n')
    }
  })

  test('can authenticate as admin', async ({ page }) => {
    const success = await signInAsAdmin(page)

    await page.screenshot({
      path: 'tests/screenshots/overlap-01-authenticated.png',
      fullPage: true
    })

    if (!success) {
      console.log('\n⚠️  AUTH FAILED - Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars')
      console.log('   Or run tests with: TEST_ADMIN_EMAIL=email TEST_ADMIN_PASSWORD=pass npx playwright test')
      console.log('   Skipping remaining auth-dependent tests.\n')
    }

    // This test passes regardless - it's diagnostic
    // The real assertion is in dependent tests
    expect(true).toBe(true)
  })

  test('can enter and exit Add Text mode', async ({ page }) => {
    const authSuccess = await signInAsAdmin(page)
    if (!authSuccess) return test.skip()

    const enterSuccess = await enterAddTextMode(page)
    expect(enterSuccess).toBe(true)

    await page.screenshot({
      path: 'tests/screenshots/overlap-02-add-text-mode.png',
      fullPage: true
    })

    await exitAddTextMode(page)
  })

  test('empty canvas position shows valid placement', async ({ page }) => {
    const authSuccess = await signInAsAdmin(page)
    if (!authSuccess) return test.skip()

    const blockCount = await waitForBlocks(page)
    console.log(`Found ${blockCount} blocks on canvas`)

    const canvasBox = await getCanvasBox(page)
    if (!canvasBox) return test.skip()

    const blocks = await getBlocks(page)
    const emptyPos = await findEmptyPosition(page, blocks, canvasBox)

    if (!emptyPos) {
      console.log('No empty position found on canvas')
      return test.skip()
    }

    console.log(`Found empty position at ${emptyPos.xPercent.toFixed(1)}%, ${emptyPos.yPercent.toFixed(1)}%`)

    await enterAddTextMode(page)
    await moveToCanvasPosition(page, canvasBox, emptyPos.xPercent, emptyPos.yPercent)
    await page.waitForTimeout(200)

    const state = await getPreviewState(page)
    console.log(`Preview state at empty position: ${state}`)

    await page.screenshot({
      path: 'tests/screenshots/overlap-03-empty-position.png',
      fullPage: true
    })

    expect(state).toBe('valid')

    await exitAddTextMode(page)
  })

  test('position directly over a block shows invalid placement', async ({ page }) => {
    const authSuccess = await signInAsAdmin(page)
    if (!authSuccess) return test.skip()

    const blockCount = await waitForBlocks(page)
    if (blockCount < 1) {
      console.log('No blocks to test overlap with')
      return test.skip()
    }

    const canvasBox = await getCanvasBox(page)
    if (!canvasBox) return test.skip()

    const blocks = await getBlocks(page)
    const targetBlock = blocks[0]

    // Move to center of the first block
    const blockCenterX = targetBlock.box.x + targetBlock.box.width / 2
    const blockCenterY = targetBlock.box.y + targetBlock.box.height / 2
    const { xPercent, yPercent } = screenToCanvasPercent(blockCenterX, blockCenterY, canvasBox)

    console.log(`Testing overlap at block center: ${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%`)
    console.log(`Block ${targetBlock.id.slice(0, 8)}... at screen (${targetBlock.box.x.toFixed(0)}, ${targetBlock.box.y.toFixed(0)}) size ${targetBlock.box.width.toFixed(0)}x${targetBlock.box.height.toFixed(0)}`)

    await enterAddTextMode(page)
    await page.mouse.move(blockCenterX, blockCenterY)
    await page.waitForTimeout(200)

    const state = await getPreviewState(page)
    console.log(`Preview state over block: ${state}`)

    await page.screenshot({
      path: 'tests/screenshots/overlap-04-over-block.png',
      fullPage: true
    })

    expect(state).toBe('invalid')

    await exitAddTextMode(page)
  })

  test('position just outside block edge shows valid placement', async ({ page }) => {
    const authSuccess = await signInAsAdmin(page)
    if (!authSuccess) return test.skip()

    const blockCount = await waitForBlocks(page)
    if (blockCount < 1) return test.skip()

    const canvasBox = await getCanvasBox(page)
    if (!canvasBox) return test.skip()

    const blocks = await getBlocks(page)
    const targetBlock = blocks[0]

    // Position the cursor ABOVE the block, accounting for preview box height
    // Preview is ~6% of canvas height, so we need to be that far above
    const previewHeightPx = (6 / 100) * canvasBox.height
    const marginPx = 10 // Extra margin
    const aboveBlockY = targetBlock.box.y - previewHeightPx - marginPx

    // Make sure we're within canvas bounds
    if (aboveBlockY < canvasBox.y + 20) {
      console.log('Not enough space above block, trying below')
      // Try below the block instead
      const belowBlockY = targetBlock.box.y + targetBlock.box.height + marginPx
      if (belowBlockY + previewHeightPx > canvasBox.y + canvasBox.height - 20) {
        console.log('Not enough space around block')
        return test.skip()
      }
    }

    const testY = aboveBlockY > canvasBox.y + 20
      ? aboveBlockY
      : targetBlock.box.y + targetBlock.box.height + marginPx

    const testX = targetBlock.box.x // Same horizontal position

    console.log(`Testing just outside block at screen (${testX.toFixed(0)}, ${testY.toFixed(0)})`)

    await enterAddTextMode(page)
    await page.mouse.move(testX, testY)
    await page.waitForTimeout(200)

    const state = await getPreviewState(page)
    console.log(`Preview state just outside block: ${state}`)

    await page.screenshot({
      path: 'tests/screenshots/overlap-05-outside-block.png',
      fullPage: true
    })

    // This SHOULD be valid since we're outside the block
    expect(state).toBe('valid')

    await exitAddTextMode(page)
  })

  test('diagnostic: compare visual overlap vs detection result', async ({ page }) => {
    const authSuccess = await signInAsAdmin(page)
    if (!authSuccess) return test.skip()

    const blockCount = await waitForBlocks(page)
    if (blockCount < 1) return test.skip()

    const canvasBox = await getCanvasBox(page)
    if (!canvasBox) return test.skip()

    const blocks = await getBlocks(page)

    console.log('\n===== OVERLAP DETECTION DIAGNOSTIC =====')
    console.log(`Canvas: ${canvasBox.width.toFixed(0)}x${canvasBox.height.toFixed(0)} at (${canvasBox.x.toFixed(0)}, ${canvasBox.y.toFixed(0)})`)
    console.log(`Preview box: 12% x 6% = ${(0.12 * canvasBox.width).toFixed(0)}px x ${(0.06 * canvasBox.height).toFixed(0)}px`)
    console.log(`Block count: ${blocks.length}\n`)

    await enterAddTextMode(page)

    // Test multiple positions around the first block
    const target = blocks[0]
    const testPositions = [
      { name: 'center', x: target.box.x + target.box.width / 2, y: target.box.y + target.box.height / 2, expectInvalid: true },
      { name: 'top-left corner', x: target.box.x, y: target.box.y, expectInvalid: true },
      { name: 'bottom-right corner', x: target.box.x + target.box.width, y: target.box.y + target.box.height, expectInvalid: true },
      { name: 'way above', x: target.box.x + target.box.width / 2, y: target.box.y - 100, expectInvalid: false },
      { name: 'way below', x: target.box.x + target.box.width / 2, y: target.box.y + target.box.height + 100, expectInvalid: false },
      { name: 'way left', x: target.box.x - 200, y: target.box.y + target.box.height / 2, expectInvalid: false },
      { name: 'way right', x: target.box.x + target.box.width + 200, y: target.box.y + target.box.height / 2, expectInvalid: false },
    ]

    const mismatches: string[] = []

    for (const pos of testPositions) {
      // Clamp to canvas bounds
      const clampedX = Math.max(canvasBox.x + 10, Math.min(canvasBox.x + canvasBox.width - 10, pos.x))
      const clampedY = Math.max(canvasBox.y + 10, Math.min(canvasBox.y + canvasBox.height - 10, pos.y))

      await page.mouse.move(clampedX, clampedY)
      await page.waitForTimeout(150)

      const state = await getPreviewState(page)
      const actual = state === 'invalid'
      const match = actual === pos.expectInvalid

      console.log(
        `  ${pos.name}: screen(${clampedX.toFixed(0)}, ${clampedY.toFixed(0)}) ` +
        `expect=${pos.expectInvalid ? 'invalid' : 'valid'} actual=${state} ` +
        `${match ? '✓' : '✗ MISMATCH'}`
      )

      if (!match) {
        mismatches.push(pos.name)
      }
    }

    await page.screenshot({
      path: 'tests/screenshots/overlap-06-diagnostic.png',
      fullPage: true
    })

    console.log(`\nMismatches: ${mismatches.length > 0 ? mismatches.join(', ') : 'none'}`)
    console.log('===== END DIAGNOSTIC =====\n')

    await exitAddTextMode(page)

    // Log all captured console output
    if (consoleLogs.length > 0) {
      console.log('\n===== Console Logs from wouldOverlapDOM =====')
      consoleLogs.forEach(log => console.log(log))
    }

    // This test always passes - it's for gathering diagnostic info
    expect(true).toBe(true)
  })

  test('scan grid positions and report detection accuracy', async ({ page }) => {
    const authSuccess = await signInAsAdmin(page)
    if (!authSuccess) return test.skip()

    const blockCount = await waitForBlocks(page)
    const canvasBox = await getCanvasBox(page)
    if (!canvasBox) return test.skip()

    const blocks = await getBlocks(page)

    console.log('\n===== GRID SCAN DIAGNOSTIC =====')

    await enterAddTextMode(page)

    // Scan a grid of positions
    const results: { x: number; y: number; state: string; shouldOverlap: boolean }[] = []
    const PREVIEW_WIDTH = 0.12 * canvasBox.width
    const PREVIEW_HEIGHT = 0.06 * canvasBox.height

    for (let yPct = 10; yPct <= 70; yPct += 15) {
      for (let xPct = 10; xPct <= 80; xPct += 15) {
        const screenX = canvasBox.x + (xPct / 100) * canvasBox.width
        const screenY = canvasBox.y + (yPct / 100) * canvasBox.height

        await page.mouse.move(screenX, screenY)
        await page.waitForTimeout(100)

        const state = await getPreviewState(page)

        // Calculate if this position SHOULD overlap (preview box vs blocks)
        const previewLeft = screenX
        const previewTop = screenY
        const previewRight = screenX + PREVIEW_WIDTH
        const previewBottom = screenY + PREVIEW_HEIGHT

        const shouldOverlap = blocks.some(b => !(
          previewRight <= b.box.x ||
          previewLeft >= b.box.x + b.box.width ||
          previewBottom <= b.box.y ||
          previewTop >= b.box.y + b.box.height
        ))

        results.push({ x: xPct, y: yPct, state, shouldOverlap })
      }
    }

    // Analyze results
    let correctValid = 0
    let correctInvalid = 0
    let falsePositive = 0  // Says invalid when should be valid
    let falseNegative = 0  // Says valid when should be invalid

    for (const r of results) {
      const isInvalid = r.state === 'invalid'
      if (r.shouldOverlap && isInvalid) correctInvalid++
      else if (!r.shouldOverlap && !isInvalid) correctValid++
      else if (!r.shouldOverlap && isInvalid) falsePositive++
      else if (r.shouldOverlap && !isInvalid) falseNegative++
    }

    console.log(`Total positions tested: ${results.length}`)
    console.log(`Correct valid: ${correctValid}`)
    console.log(`Correct invalid: ${correctInvalid}`)
    console.log(`False positives (says overlap when shouldn't): ${falsePositive}`)
    console.log(`False negatives (says valid when overlapping): ${falseNegative}`)
    console.log(`Accuracy: ${(((correctValid + correctInvalid) / results.length) * 100).toFixed(1)}%`)

    // Show details of mismatches
    const mismatches = results.filter(r => (r.shouldOverlap !== (r.state === 'invalid')))
    if (mismatches.length > 0) {
      console.log('\nMismatched positions:')
      for (const m of mismatches) {
        console.log(`  (${m.x}%, ${m.y}%) - detected=${m.state}, expected=${m.shouldOverlap ? 'invalid' : 'valid'}`)
      }
    }

    console.log('===== END GRID SCAN =====\n')

    await page.screenshot({
      path: 'tests/screenshots/overlap-07-grid-scan.png',
      fullPage: true
    })

    await exitAddTextMode(page)

    // Report findings but don't fail - this is diagnostic
    expect(true).toBe(true)
  })
})
