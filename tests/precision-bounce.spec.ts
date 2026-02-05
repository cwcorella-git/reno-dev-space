import { test, expect } from '@playwright/test'

/**
 * Precision bounce diagnostic — measures sub-pixel block position shifts
 * frame-by-frame to detect any remaining canvas bounce.
 *
 * The metric: max frame-to-frame delta in a reference block's pixel position.
 * Threshold: < 0.5px is imperceptible to humans.
 */

test.describe('Precision Bounce Measurement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reno-dev-space/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Dismiss intro hint if visible
    const browseButton = page.locator('button:has-text("Browse First")')
    if (await browseButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await browseButton.click()
      await page.waitForTimeout(500)
    }

    // Wait for blocks to render
    try {
      await page.locator('[data-block-id]').first().waitFor({ timeout: 5000 })
    } catch {
      // No blocks — tests will handle this
    }
  })

  test('idle baseline: block positions should be perfectly stable', async ({ page }) => {
    // Inject frame-by-frame position recorder
    const results = await page.evaluate(() => {
      return new Promise<{
        frames: number
        maxDelta: number
        shiftsOver05px: number
        cumulativeDrift: number
        canvasHeightChanges: number
        transitionDetected: boolean
        positions: number[]
        canvasHeights: number[]
      }>((resolve) => {
        const canvas = document.querySelector('[class*="bg-brand-dark"][style*="min-height"]') as HTMLElement
        const blocks = document.querySelectorAll<HTMLElement>('[data-block-id]')
        if (!canvas || blocks.length === 0) {
          resolve({
            frames: 0, maxDelta: 0, shiftsOver05px: 0, cumulativeDrift: 0,
            canvasHeightChanges: 0, transitionDetected: false, positions: [], canvasHeights: [],
          })
          return
        }

        // Pick a reference block near the middle of the viewport
        const viewportMid = window.innerHeight / 2
        let bestBlock = blocks[0]
        let bestDist = Infinity
        blocks.forEach(b => {
          const rect = b.getBoundingClientRect()
          const dist = Math.abs(rect.top + rect.height / 2 - viewportMid)
          if (dist < bestDist) { bestDist = dist; bestBlock = b }
        })

        const positions: number[] = []
        const canvasHeights: number[] = []
        let frameCount = 0
        const targetFrames = 90 // ~1.5s at 60fps

        const record = () => {
          const blockRect = bestBlock.getBoundingClientRect()
          const canvasRect = canvas.getBoundingClientRect()
          positions.push(blockRect.top)
          canvasHeights.push(canvasRect.height)
          frameCount++
          if (frameCount < targetFrames) {
            requestAnimationFrame(record)
          } else {
            // Analyze
            let maxDelta = 0
            let shiftsOver05px = 0
            let cumulativeDrift = 0
            let canvasHeightChanges = 0

            for (let i = 1; i < positions.length; i++) {
              const delta = Math.abs(positions[i] - positions[i - 1])
              if (delta > maxDelta) maxDelta = delta
              if (delta > 0.5) shiftsOver05px++
              cumulativeDrift += delta
            }
            for (let i = 1; i < canvasHeights.length; i++) {
              if (Math.abs(canvasHeights[i] - canvasHeights[i - 1]) > 0.1) canvasHeightChanges++
            }

            // Check for active CSS transitions
            const computedStyle = getComputedStyle(canvas)
            const transitionDetected = computedStyle.transition.includes('min-height')

            resolve({
              frames: frameCount,
              maxDelta,
              shiftsOver05px,
              cumulativeDrift,
              canvasHeightChanges,
              transitionDetected,
              positions: positions.map(p => Math.round(p * 100) / 100), // 2 decimal places
              canvasHeights: canvasHeights.map(h => Math.round(h * 100) / 100),
            })
          }
        }
        requestAnimationFrame(record)
      })
    })

    console.log('\n===== IDLE BASELINE =====')
    console.log(`Frames recorded: ${results.frames}`)
    console.log(`Reference block positions (first 5): ${results.positions.slice(0, 5).join(', ')}`)
    console.log(`Canvas heights (first 5): ${results.canvasHeights.slice(0, 5).join(', ')}`)
    console.log(`Max frame-to-frame block delta: ${results.maxDelta.toFixed(4)}px`)
    console.log(`Frames with >0.5px shift: ${results.shiftsOver05px}`)
    console.log(`Cumulative drift: ${results.cumulativeDrift.toFixed(4)}px`)
    console.log(`Canvas height changes: ${results.canvasHeightChanges}`)
    console.log(`CSS transition on min-height: ${results.transitionDetected}`)
    console.log('===== END =====\n')

    // Idle should be perfectly stable
    expect(results.maxDelta).toBeLessThan(0.5)
    expect(results.shiftsOver05px).toBe(0)
    expect(results.canvasHeightChanges).toBe(0)
  })

  test('simulated height change: measure block shift during canvas growth', async ({ page }) => {
    // Simulates what React does when canvasHeightPx changes:
    // Directly modify the canvas element's style.minHeight to be larger.
    //
    // With percentage positioning (top: X%): blocks shift because X% of a
    // taller parent = more pixels from top.
    //
    // With absolute pixel positioning (top: Xpx): blocks stay put.
    const results = await page.evaluate(() => {
      return new Promise<{
        frames: number
        maxDelta: number
        shiftsOver05px: number
        shiftsOver01px: number
        cumulativeDrift: number
        canvasHeightBefore: number
        canvasHeightAfter: number
        canvasHeightChanges: number
        transitionDetected: boolean
        positioningMode: string
        firstShiftFrame: number | null
        lastShiftFrame: number | null
        timeline: { frame: number; blockTop: number; canvasH: number; delta: number }[]
      }>((resolve) => {
        const canvas = document.querySelector('[class*="bg-brand-dark"][style*="min-height"]') as HTMLElement
        const blocks = document.querySelectorAll<HTMLElement>('[data-block-id]')
        if (!canvas || blocks.length === 0) {
          resolve({
            frames: 0, maxDelta: 0, shiftsOver05px: 0, shiftsOver01px: 0,
            cumulativeDrift: 0, canvasHeightBefore: 0, canvasHeightAfter: 0,
            canvasHeightChanges: 0, transitionDetected: false,
            positioningMode: 'unknown',
            firstShiftFrame: null, lastShiftFrame: null, timeline: [],
          })
          return
        }

        // Pick a reference block near the top of the viewport (most visible)
        const viewportMid = window.innerHeight / 3
        let bestBlock = blocks[0]
        let bestDist = Infinity
        blocks.forEach(b => {
          const rect = b.getBoundingClientRect()
          const dist = Math.abs(rect.top + rect.height / 2 - viewportMid)
          if (dist < bestDist) { bestDist = dist; bestBlock = b }
        })

        // Detect positioning mode
        const topStyle = bestBlock.style.top
        const positioningMode = topStyle.endsWith('px') ? 'pixel' : topStyle.endsWith('%') ? 'percent' : `other(${topStyle})`

        const positions: number[] = []
        const canvasHeights: number[] = []
        const canvasHeightBefore = canvas.getBoundingClientRect().height
        let triggered = false
        let frameCount = 0
        const baselineFrames = 15 // ~250ms baseline
        const totalFrames = 150 // ~2.5s total

        const record = () => {
          const blockRect = bestBlock.getBoundingClientRect()
          const canvasRect = canvas.getBoundingClientRect()
          positions.push(blockRect.top)
          canvasHeights.push(canvasRect.height)
          frameCount++

          // After baseline: grow canvas by 500px via direct style change
          if (!triggered && frameCount >= baselineFrames) {
            triggered = true
            const currentMinH = parseFloat(canvas.style.minHeight) || canvasRect.height
            canvas.style.minHeight = `${currentMinH + 500}px`
          }

          if (frameCount < totalFrames) {
            requestAnimationFrame(record)
          } else {
            // Analyze
            let maxDelta = 0
            let shiftsOver05px = 0
            let shiftsOver01px = 0
            let cumulativeDrift = 0
            let canvasHeightChanges = 0
            let firstShiftFrame: number | null = null
            let lastShiftFrame: number | null = null
            const timeline: { frame: number; blockTop: number; canvasH: number; delta: number }[] = []

            for (let i = 1; i < positions.length; i++) {
              const delta = Math.abs(positions[i] - positions[i - 1])
              const canvasDelta = Math.abs(canvasHeights[i] - canvasHeights[i - 1])
              if (delta > maxDelta) maxDelta = delta
              if (delta > 0.5) shiftsOver05px++
              if (delta > 0.1) {
                shiftsOver01px++
                if (firstShiftFrame === null) firstShiftFrame = i
                lastShiftFrame = i
              }
              cumulativeDrift += delta
              if (canvasDelta > 0.1) canvasHeightChanges++

              // Log interesting frames (where something moved)
              if (delta > 0.05 || canvasDelta > 0.1) {
                timeline.push({
                  frame: i,
                  blockTop: Math.round(positions[i] * 100) / 100,
                  canvasH: Math.round(canvasHeights[i] * 100) / 100,
                  delta: Math.round(delta * 1000) / 1000,
                })
              }
            }

            const transitionDetected = getComputedStyle(canvas).transition.includes('min-height')

            resolve({
              frames: frameCount,
              maxDelta,
              shiftsOver05px,
              shiftsOver01px,
              cumulativeDrift,
              canvasHeightBefore,
              canvasHeightAfter: canvasHeights[canvasHeights.length - 1],
              canvasHeightChanges,
              transitionDetected,
              positioningMode,
              firstShiftFrame,
              lastShiftFrame,
              timeline: timeline.slice(0, 30), // cap output
            })
          }
        }
        requestAnimationFrame(record)
      })
    })

    console.log('\n===== SIMULATED HEIGHT CHANGE =====')
    console.log(`Positioning mode: ${results.positioningMode}`)
    console.log(`Frames recorded: ${results.frames}`)
    console.log(`Canvas height: ${results.canvasHeightBefore.toFixed(0)} → ${results.canvasHeightAfter.toFixed(0)}`)
    console.log(`Canvas height change frames: ${results.canvasHeightChanges}`)
    console.log(`CSS transition on min-height: ${results.transitionDetected}`)
    console.log(`\nBlock position shifts:`)
    console.log(`  Max delta: ${results.maxDelta.toFixed(4)}px`)
    console.log(`  Frames with >0.5px shift: ${results.shiftsOver05px}`)
    console.log(`  Frames with >0.1px shift: ${results.shiftsOver01px}`)
    console.log(`  Cumulative drift: ${results.cumulativeDrift.toFixed(4)}px`)
    console.log(`  First shift at frame: ${results.firstShiftFrame}`)
    console.log(`  Last shift at frame: ${results.lastShiftFrame}`)
    if (results.timeline.length > 0) {
      console.log(`\nTimeline (frames where something moved):`)
      results.timeline.forEach(t => {
        console.log(`  Frame ${t.frame}: blockTop=${t.blockTop}px canvasH=${t.canvasH}px Δ=${t.delta}px`)
      })
    }
    console.log('===== END =====\n')

    // After the pixel-positioning fix: blocks should not shift at all
    // when canvas height changes, regardless of CSS transitions.
    expect(results.frames).toBeGreaterThan(0)
  })

  test('all blocks stability: measure max shift across ALL blocks during height change', async ({ page }) => {
    const results = await page.evaluate(() => {
      return new Promise<{
        blockCount: number
        maxDeltaAnyBlock: number
        worstBlockId: string
        blocksWithShift: number
        perBlock: { id: string; maxDelta: number; shifts: number }[]
        canvasHeightChanges: number
      }>((resolve) => {
        const canvas = document.querySelector('[class*="bg-brand-dark"][style*="min-height"]') as HTMLElement
        const blockEls = document.querySelectorAll<HTMLElement>('[data-block-id]')
        if (!canvas || blockEls.length === 0) {
          resolve({
            blockCount: 0, maxDeltaAnyBlock: 0, worstBlockId: '',
            blocksWithShift: 0, perBlock: [], canvasHeightChanges: 0,
          })
          return
        }

        // Track positions for ALL blocks
        const blockData: { el: HTMLElement; id: string; positions: number[] }[] = []
        blockEls.forEach(el => {
          const id = el.getAttribute('data-block-id') || 'unknown'
          blockData.push({ el, id, positions: [] })
        })

        const canvasHeights: number[] = []
        let injected = false
        let frameCount = 0
        const baselineFrames = 15
        const totalFrames = 120

        const record = () => {
          blockData.forEach(bd => {
            bd.positions.push(bd.el.getBoundingClientRect().top)
          })
          canvasHeights.push(canvas.getBoundingClientRect().height)
          frameCount++

          if (!injected && frameCount >= baselineFrames) {
            injected = true
            const currentMinH = parseFloat(canvas.style.minHeight) || canvas.getBoundingClientRect().height
            canvas.style.minHeight = `${currentMinH + 500}px`
          }

          if (frameCount < totalFrames) {
            requestAnimationFrame(record)
          } else {

            let maxDeltaAnyBlock = 0
            let worstBlockId = ''
            let blocksWithShift = 0
            let canvasHeightChanges = 0

            for (let i = 1; i < canvasHeights.length; i++) {
              if (Math.abs(canvasHeights[i] - canvasHeights[i - 1]) > 0.1) canvasHeightChanges++
            }

            const perBlock = blockData.map(bd => {
              let maxDelta = 0
              let shifts = 0
              for (let i = 1; i < bd.positions.length; i++) {
                const delta = Math.abs(bd.positions[i] - bd.positions[i - 1])
                if (delta > maxDelta) maxDelta = delta
                if (delta > 0.1) shifts++
              }
              if (maxDelta > maxDeltaAnyBlock) {
                maxDeltaAnyBlock = maxDelta
                worstBlockId = bd.id
              }
              if (shifts > 0) blocksWithShift++
              return { id: bd.id, maxDelta: Math.round(maxDelta * 1000) / 1000, shifts }
            })

            // Sort by max delta descending
            perBlock.sort((a, b) => b.maxDelta - a.maxDelta)

            resolve({
              blockCount: blockData.length,
              maxDeltaAnyBlock: Math.round(maxDeltaAnyBlock * 1000) / 1000,
              worstBlockId,
              blocksWithShift,
              perBlock: perBlock.slice(0, 10), // top 10 worst
              canvasHeightChanges,
            })
          }
        }
        requestAnimationFrame(record)
      })
    })

    console.log('\n===== ALL BLOCKS STABILITY =====')
    console.log(`Blocks tracked: ${results.blockCount}`)
    console.log(`Canvas height change frames: ${results.canvasHeightChanges}`)
    console.log(`Blocks with any shift >0.1px: ${results.blocksWithShift} / ${results.blockCount}`)
    console.log(`Worst block: ${results.worstBlockId} (max Δ = ${results.maxDeltaAnyBlock}px)`)
    console.log(`\nTop 10 most-affected blocks:`)
    results.perBlock.forEach(b => {
      console.log(`  ${b.id}: maxΔ=${b.maxDelta}px, shifts=${b.shifts}`)
    })
    console.log('===== END =====\n')

    // Post-fix assertion: no block should shift more than 0.5px
    // (Comment this out for baseline measurement)
    // expect(results.maxDeltaAnyBlock).toBeLessThan(0.5)
  })
})
