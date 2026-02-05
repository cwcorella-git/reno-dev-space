import { test, expect, Page } from '@playwright/test'

// ── Constants ────────────────────────────────────────────────────

const AUTH_EMAIL = process.env.TEST_ADMIN_EMAIL ?? ''
const AUTH_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? ''
const HAS_AUTH = AUTH_EMAIL.length > 0 && AUTH_PASSWORD.length > 0

// ── Helpers ──────────────────────────────────────────────────────

async function waitForBlocks(page: Page, timeout = 10000) {
  try {
    await page.locator('[data-block-id]').first().waitFor({ timeout })
  } catch { return 0 }
  return page.locator('[data-block-id]').count()
}

async function dismissIntro(page: Page) {
  const btn = page.locator('button:has-text("Browse First")')
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click()
    await page.waitForTimeout(500)
  }
}

async function login(page: Page) {
  // Open auth modal
  const signInBtn = page.locator('button:has-text("Sign In")')
  if (await signInBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await signInBtn.click()
    await page.waitForTimeout(500)
  }

  // Fill credentials
  await page.fill('input[type="email"]', AUTH_EMAIL)
  await page.fill('input[type="password"]', AUTH_PASSWORD)
  await page.locator('button:has-text("Sign In")').last().click()
  await page.waitForTimeout(2000)
}

/** Inject a frame-by-frame recorder that logs canvas height & scroll position. */
async function installBounceRecorder(page: Page) {
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement
    const canvas = document.querySelector('div.relative.bg-brand-dark') as HTMLElement
    if (!scrollContainer || !canvas) return

    const records: {
      t: number
      scrollTop: number
      canvasH: number
      canvasMinH: string
    }[] = []

    let recording = false
    let startTime = 0

    ;(window as any).__bounceRecorder = {
      start() {
        records.length = 0
        recording = true
        startTime = performance.now()
        tick()
      },
      stop() {
        recording = false
        return records
      },
      get records() { return records },
    }

    function tick() {
      if (!recording) return
      records.push({
        t: Math.round(performance.now() - startTime),
        scrollTop: Math.round(scrollContainer.scrollTop),
        canvasH: Math.round(canvas.getBoundingClientRect().height),
        canvasMinH: canvas.style.minHeight,
      })
      requestAnimationFrame(tick)
    }
  })
}

/** Install a PerformanceObserver to capture Cumulative Layout Shift. */
async function installCLSRecorder(page: Page) {
  await page.evaluate(() => {
    const entries: { t: number; value: number; sources: string[] }[] = []
    ;(window as any).__clsEntries = entries

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const le = entry as any // LayoutShift
        if (!le.hadRecentInput) {
          entries.push({
            t: Math.round(entry.startTime),
            value: le.value,
            sources: (le.sources ?? []).map((s: any) =>
              s.node?.tagName + (s.node?.getAttribute?.('data-block-id')?.slice(0, 8) ?? '')
            ),
          })
        }
      }
    })
    observer.observe({ type: 'layout-shift', buffered: true })
  })
}

// ── Tests ────────────────────────────────────────────────────────

test.describe('Drag Bounce Investigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reno-dev-space/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)
    await dismissIntro(page)
  })

  test('measure canvas height stability on page load', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount === 0) return test.skip()

    await installBounceRecorder(page)

    // Record 2 seconds of idle behavior
    await page.evaluate(() => (window as any).__bounceRecorder.start())
    await page.waitForTimeout(2000)
    const records = await page.evaluate(() => (window as any).__bounceRecorder.stop())

    // Analyze height changes
    const heights = records.map((r: any) => r.canvasH)
    const uniqueHeights = [...new Set(heights)]
    const scrollTops = records.map((r: any) => r.scrollTop)
    const uniqueScrolls = [...new Set(scrollTops)]

    console.log('\n===== CANVAS HEIGHT STABILITY (IDLE) =====')
    console.log(`Frames recorded: ${records.length}`)
    console.log(`Unique canvas heights: ${uniqueHeights.length} → ${uniqueHeights.join(', ')}`)
    console.log(`Unique scroll positions: ${uniqueScrolls.length} → ${uniqueScrolls.slice(0, 10).join(', ')}`)

    if (uniqueHeights.length > 1) {
      console.log('⚠ Canvas height changed during idle — possible oscillation')
      // Find transitions
      for (let i = 1; i < records.length; i++) {
        if (records[i].canvasH !== records[i - 1].canvasH) {
          console.log(`  ${records[i - 1].t}ms: ${records[i - 1].canvasH}px → ${records[i].t}ms: ${records[i].canvasH}px`)
        }
      }
    } else {
      console.log('✓ Canvas height stable during idle')
    }
    console.log('===== END =====\n')

    await page.screenshot({ path: 'tests/screenshots/bounce-01-idle.png', fullPage: true })
    expect(records.length).toBeGreaterThan(0)
  })

  test('measure layout shift (CLS) during scroll to bottom', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount === 0) return test.skip()

    await installCLSRecorder(page)
    await installBounceRecorder(page)

    // Start recording then scroll to the very bottom
    await page.evaluate(() => (window as any).__bounceRecorder.start())

    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' })
      }
    })
    await page.waitForTimeout(2000) // let scroll finish + settle

    const records = await page.evaluate(() => (window as any).__bounceRecorder.stop())
    const clsEntries = await page.evaluate(() => (window as any).__clsEntries)

    // Analyze
    const heights = records.map((r: any) => r.canvasH)
    const uniqueHeights = [...new Set(heights)]

    console.log('\n===== SCROLL-TO-BOTTOM STABILITY =====')
    console.log(`Frames: ${records.length}`)
    console.log(`Unique canvas heights: ${uniqueHeights.length} → ${uniqueHeights.join(', ')}`)

    // Check if scroll position oscillates after reaching bottom
    const lastThird = records.slice(Math.floor(records.length * 0.66))
    const scrollsInLastThird = [...new Set(lastThird.map((r: any) => r.scrollTop))]
    console.log(`Scroll positions in final third: ${scrollsInLastThird.length}`)
    if (scrollsInLastThird.length > 3) {
      console.log('⚠ Scroll position bouncing after reaching bottom')
      scrollsInLastThird.forEach(s => console.log(`  scrollTop=${s}`))
    }

    console.log(`\nLayout shift entries: ${clsEntries.length}`)
    const totalCLS = clsEntries.reduce((sum: number, e: any) => sum + e.value, 0)
    console.log(`Total CLS: ${totalCLS.toFixed(4)}`)
    clsEntries.slice(0, 10).forEach((e: any) =>
      console.log(`  t=${e.t}ms shift=${e.value.toFixed(4)} sources=[${e.sources.join(', ')}]`)
    )
    console.log('===== END =====\n')

    await page.screenshot({ path: 'tests/screenshots/bounce-02-scroll-bottom.png', fullPage: true })
    expect(records.length).toBeGreaterThan(0)
  })

  test('measure what happens when the lowest block is simulated lower', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount === 0) return test.skip()

    await installBounceRecorder(page)
    await installCLSRecorder(page)

    // Find the lowest block in the DOM
    const lowestBlockInfo = await page.evaluate(() => {
      const blocks = document.querySelectorAll<HTMLElement>('[data-block-id]')
      let lowest: HTMLElement | null = null
      let maxBottom = 0
      blocks.forEach(el => {
        const bottom = el.offsetTop + el.offsetHeight
        if (bottom > maxBottom) { maxBottom = bottom; lowest = el }
      })
      if (!lowest) return null
      return {
        id: lowest.getAttribute('data-block-id'),
        offsetTop: lowest.offsetTop,
        offsetHeight: lowest.offsetHeight,
        style: lowest.style.top,
      }
    })

    if (!lowestBlockInfo) return test.skip()
    console.log('\n===== SIMULATE BLOCK MOVING LOWER =====')
    console.log(`Lowest block: ${lowestBlockInfo.id?.slice(0, 8)}... at offsetTop=${lowestBlockInfo.offsetTop}, height=${lowestBlockInfo.offsetHeight}`)
    console.log(`CSS top: ${lowestBlockInfo.style}`)

    // Scroll to show the lowest block area
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement
      if (scrollContainer) scrollContainer.scrollTo({ top: scrollContainer.scrollHeight - 800, behavior: 'instant' as any })
    })
    await page.waitForTimeout(500)

    // Start recording, then move the lowest block down via DOM manipulation
    // This simulates what happens when a block is dropped at a new lower position
    await page.evaluate(() => (window as any).__bounceRecorder.start())

    await page.evaluate((blockId) => {
      const el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement
      if (!el) return

      // Move it 200px lower by adjusting top% (simulates Firestore update)
      const currentTop = parseFloat(el.style.top) || 0
      el.style.top = `${currentTop + 10}%` // push 10% lower
    }, lowestBlockInfo.id)

    await page.waitForTimeout(2000) // observe the aftermath

    const records = await page.evaluate(() => (window as any).__bounceRecorder.stop())
    const clsEntries = await page.evaluate(() => (window as any).__clsEntries)

    // Analyze height changes
    const heights = records.map((r: any) => r.canvasH)
    const uniqueHeights = [...new Set(heights)]
    const scrollTops = records.map((r: any) => r.scrollTop)
    const uniqueScrolls = [...new Set(scrollTops)]

    console.log(`\nFrames: ${records.length}`)
    console.log(`Unique canvas heights: ${uniqueHeights.length} → ${uniqueHeights.join(', ')}`)
    console.log(`Unique scroll positions: ${uniqueScrolls.length}`)

    // Show frame-by-frame transitions for height changes
    let heightChanges = 0
    for (let i = 1; i < records.length; i++) {
      if (records[i].canvasH !== records[i - 1].canvasH) {
        heightChanges++
        if (heightChanges <= 10) {
          console.log(`  ${records[i - 1].t}ms: h=${records[i - 1].canvasH} scroll=${records[i - 1].scrollTop}`)
          console.log(`  ${records[i].t}ms: h=${records[i].canvasH} scroll=${records[i].scrollTop}`)
        }
      }
    }
    console.log(`Total height changes: ${heightChanges}`)

    // CLS
    const totalCLS = clsEntries.reduce((sum: number, e: any) => sum + e.value, 0)
    console.log(`Layout shifts: ${clsEntries.length}, total CLS: ${totalCLS.toFixed(4)}`)

    console.log('===== END =====\n')

    await page.screenshot({ path: 'tests/screenshots/bounce-03-simulated-move.png', fullPage: true })
    expect(records.length).toBeGreaterThan(0)
  })

  // This test requires admin auth — set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars
  test('measure bounce during real drag of lowest block', async ({ page }) => {
    if (!HAS_AUTH) {
      console.log('Skipping: set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars')
      return test.skip()
    }

    await login(page)
    const blockCount = await waitForBlocks(page)
    if (blockCount === 0) return test.skip()

    await installBounceRecorder(page)
    await installCLSRecorder(page)

    // Find the lowest block on screen
    const blocks = await page.evaluate(() => {
      const els = document.querySelectorAll<HTMLElement>('[data-block-id]')
      return [...els].map(el => ({
        id: el.getAttribute('data-block-id')!,
        rect: el.getBoundingClientRect(),
        offsetTop: el.offsetTop,
        offsetHeight: el.offsetHeight,
      })).sort((a, b) => b.rect.bottom - a.rect.bottom)
    })

    if (blocks.length === 0) return test.skip()

    // Scroll so the lowest block is visible
    const lowest = blocks[0]
    await page.evaluate((scrollTo) => {
      const sc = document.querySelector('.overflow-y-auto') as HTMLElement
      if (sc) sc.scrollTo({ top: scrollTo, behavior: 'instant' as any })
    }, Math.max(0, lowest.offsetTop - 300))
    await page.waitForTimeout(500)

    // Get updated screen position after scroll
    const target = await page.evaluate((id) => {
      const el = document.querySelector(`[data-block-id="${id}"]`) as HTMLElement
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
    }, lowest.id)

    if (!target) return test.skip()

    console.log('\n===== REAL DRAG BOUNCE TEST =====')
    console.log(`Dragging block ${lowest.id.slice(0, 8)}... from center (${target.x.toFixed(0)}, ${target.y.toFixed(0)})`)

    // Click to select first
    await page.mouse.click(target.x, target.y)
    await page.waitForTimeout(300)

    // Start recording
    await page.evaluate(() => (window as any).__bounceRecorder.start())

    // Drag downward in steps (200px over 20 steps = 10px/step)
    const dragDistance = 200
    const steps = 20
    await page.mouse.move(target.x, target.y)
    await page.mouse.down()

    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(target.x, target.y + (dragDistance * i / steps))
      await page.waitForTimeout(50) // 50ms per step = 1 second total drag
    }

    // Hold at bottom for a moment
    await page.waitForTimeout(300)

    // Release
    await page.mouse.up()

    // Watch the aftermath (Firestore roundtrip + height recalc)
    await page.waitForTimeout(3000)

    const records = await page.evaluate(() => (window as any).__bounceRecorder.stop())
    const clsEntries = await page.evaluate(() => (window as any).__clsEntries)

    // Analyze
    const heights = records.map((r: any) => r.canvasH)
    const uniqueHeights = [...new Set(heights)]
    const scrollTops = records.map((r: any) => r.scrollTop)

    console.log(`Frames: ${records.length}`)
    console.log(`Unique canvas heights: ${uniqueHeights.length}`)
    uniqueHeights.forEach(h => console.log(`  ${h}px`))

    // Find the "release" frame (~1300ms in) and check aftermath
    const releaseFrame = records.findIndex((r: any) => r.t > 1400)
    if (releaseFrame > 0) {
      const aftermath = records.slice(releaseFrame)
      const afterHeights = [...new Set(aftermath.map((r: any) => r.canvasH))]
      const afterScrolls = [...new Set(aftermath.map((r: any) => r.scrollTop))]

      console.log(`\nAfter release:`)
      console.log(`  Height values: ${afterHeights.length} → ${afterHeights.join(', ')}`)
      console.log(`  Scroll values: ${afterScrolls.length}`)

      if (afterHeights.length > 2) {
        console.log('  ⚠ Canvas height oscillating after drop!')
      }
      if (afterScrolls.length > 3) {
        console.log('  ⚠ Scroll position bouncing after drop!')
      }
    }

    // Detect scroll "jumps" (>5px change between frames)
    let scrollJumps = 0
    for (let i = 1; i < records.length; i++) {
      const delta = Math.abs(scrollTops[i] - scrollTops[i - 1])
      if (delta > 5) {
        scrollJumps++
        if (scrollJumps <= 5) {
          console.log(`  Scroll jump at ${records[i].t}ms: ${scrollTops[i - 1]} → ${scrollTops[i]} (Δ${delta})`)
        }
      }
    }
    console.log(`Total scroll jumps (>5px): ${scrollJumps}`)

    // CLS
    const totalCLS = clsEntries.reduce((sum: number, e: any) => sum + e.value, 0)
    console.log(`\nLayout shifts: ${clsEntries.length}, total CLS: ${totalCLS.toFixed(4)}`)
    clsEntries.slice(0, 5).forEach((e: any) =>
      console.log(`  t=${e.t}ms shift=${e.value.toFixed(4)} sources=[${e.sources.join(', ')}]`)
    )

    console.log('===== END =====\n')

    await page.screenshot({ path: 'tests/screenshots/bounce-04-real-drag.png', fullPage: true })
    expect(records.length).toBeGreaterThan(0)
  })

  test('diagnostic: height calculation components', async ({ page }) => {
    const blockCount = await waitForBlocks(page)
    if (blockCount === 0) return test.skip()

    // Read the internal height state by measuring what we can from outside
    const diagnostics = await page.evaluate(() => {
      const canvas = document.querySelector('div.relative.bg-brand-dark') as HTMLElement
      const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement
      if (!canvas || !scrollContainer) return null

      const canvasRect = canvas.getBoundingClientRect()
      const blockEls = canvas.querySelectorAll<HTMLElement>('[data-block-id]')

      // Measure all blocks' positions
      const blockData = [...blockEls].map(el => {
        const id = el.getAttribute('data-block-id') ?? '?'
        return {
          id: id.slice(0, 8),
          offsetTop: el.offsetTop,
          offsetHeight: el.offsetHeight,
          bottom: el.offsetTop + el.offsetHeight,
          cssTop: el.style.top,
          cssLeft: el.style.left,
        }
      }).sort((a, b) => b.bottom - a.bottom)

      return {
        canvasMinHeight: canvas.style.minHeight,
        canvasBCR: {
          width: Math.round(canvasRect.width),
          height: Math.round(canvasRect.height),
        },
        scrollContainerHeight: scrollContainer.clientHeight,
        scrollHeight: scrollContainer.scrollHeight,
        blockCount: blockEls.length,
        lowestBlocks: blockData.slice(0, 5), // top 5 lowest blocks
        heightFromBlocks: blockData.length > 0 ? blockData[0].bottom : 0,
      }
    })

    if (!diagnostics) return test.skip()

    console.log('\n===== HEIGHT DIAGNOSTIC =====')
    console.log(`Canvas minHeight: ${diagnostics.canvasMinHeight}`)
    console.log(`Canvas BCR: ${diagnostics.canvasBCR.width}x${diagnostics.canvasBCR.height}`)
    console.log(`Scroll container: clientH=${diagnostics.scrollContainerHeight}, scrollH=${diagnostics.scrollHeight}`)
    console.log(`Blocks: ${diagnostics.blockCount}`)
    console.log(`\nLowest 5 blocks:`)
    diagnostics.lowestBlocks.forEach((b: any) =>
      console.log(`  ${b.id}... top=${b.cssTop} offsetTop=${b.offsetTop} h=${b.offsetHeight} bottom=${b.bottom}`)
    )

    const minHeightNum = parseInt(diagnostics.canvasMinHeight)
    const actualLowest = diagnostics.heightFromBlocks
    const padding = minHeightNum - actualLowest
    console.log(`\nLowest block bottom: ${actualLowest}px`)
    console.log(`Canvas minHeight: ${minHeightNum}px`)
    console.log(`Padding below lowest block: ${padding}px (expect ~900px = DESIGN_HEIGHT)`)

    if (Math.abs(padding - 900) > 50) {
      console.log(`⚠ Padding deviates from DESIGN_HEIGHT (900) by ${Math.abs(padding - 900)}px`)
    }
    console.log('===== END =====\n')

    expect(diagnostics.blockCount).toBeGreaterThan(0)
  })
})
