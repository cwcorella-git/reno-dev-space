import { test, expect } from '@playwright/test'

/**
 * Font Size Input Reliability Tests
 *
 * Probes the font size <input type="number"> in EditorTab for common UX issues:
 *  - Backspace mid-edit (e.g. 1.5 → 1. → 1.2)
 *  - Decimal entry (typing "1.75" character by character)
 *  - Clearing the field and retyping
 *  - Step buttons (up/down arrows)
 *  - Out-of-range values and clamping on blur
 */

const FONT_SIZE_SELECTOR = 'input[type="number"][step="0.25"]'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/reno-dev-space')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000) // Let Firestore listeners initialize

  const signInButton = page.locator('button:has-text("Sign In")')
  if (await signInButton.isVisible()) {
    await signInButton.click()
    await page.waitForTimeout(500)

    // Modal defaults to signup mode — switch to login
    const signInLink = page.locator('button:has-text("Sign in")').last()
    if (await signInLink.isVisible()) {
      await signInLink.click()
      await page.waitForTimeout(300)
    }

    const email = process.env.ADMIN_EMAIL || 'christopher@corella.com'
    const password = process.env.ADMIN_PASSWORD || ''
    if (!password) {
      console.log('⚠  No ADMIN_PASSWORD set — skipping')
      return false
    }

    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
  }
  return true
}

async function selectFirstBlock(page: import('@playwright/test').Page) {
  const block = page.locator('[data-block-id]').first()
  await expect(block).toBeVisible({ timeout: 5000 })
  await block.click()
  await page.waitForTimeout(300)
  return block
}

/** Read the font size input's current value */
async function getFontSizeValue(page: import('@playwright/test').Page): Promise<string> {
  return page.locator(FONT_SIZE_SELECTOR).inputValue()
}

/** Read the actual applied font-size from the block's DOM style */
async function getBlockFontSize(page: import('@playwright/test').Page, blockId: string): Promise<string> {
  return page.locator(`[data-block-id="${blockId}"] > div`).first().evaluate(
    (el) => el.style.fontSize
  )
}

test.describe('Font Size Input Reliability', () => {
  test('probe all interaction patterns', async ({ page }) => {
    test.setTimeout(60000)
    const loggedIn = await login(page)
    if (!loggedIn) {
      test.skip()
      return
    }

    // Select a block to make the Editor tab active
    const block = await selectFirstBlock(page)
    const blockId = await block.getAttribute('data-block-id')
    expect(blockId).toBeTruthy()

    const input = page.locator(FONT_SIZE_SELECTOR)
    await expect(input).toBeVisible({ timeout: 3000 })

    const initialValue = await getFontSizeValue(page)
    const initialApplied = await getBlockFontSize(page, blockId!)
    console.log(`\n═══ Initial State ═══`)
    console.log(`  Input value: "${initialValue}"`)
    console.log(`  Applied fontSize: "${initialApplied}"`)

    /** Helper: clear input then type a value (triple-click to select all) */
    async function clearAndType(value: string) {
      await input.click({ clickCount: 3 })
      await page.waitForTimeout(100)
      await page.keyboard.press('Backspace')
      await page.waitForTimeout(100)
      await input.pressSequentially(value, { delay: 80 })
      await page.waitForTimeout(200)
    }

    /** Helper: blur the input and re-select the block */
    async function blurAndReselect() {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(300)
      await block.click()
      await page.waitForTimeout(300)
    }

    // ─── Test 1: Clear → type "2" → blur (commit-on-blur) ───
    console.log(`\n═══ Test 1: Type "2" → blur ═══`)
    await clearAndType('2')
    const t1_before_blur = await getFontSizeValue(page)
    const t1_applied_before = await getBlockFontSize(page, blockId!)
    console.log(`  Before blur: input="${t1_before_blur}", applied="${t1_applied_before}"`)
    console.log(`  Should NOT apply yet: ${t1_applied_before === initialApplied ? '✅ No premature apply' : '⚠️  Applied before blur!'}`)

    await blurAndReselect()
    const t1_value = await getFontSizeValue(page)
    const t1_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After blur: input="${t1_value}", applied="${t1_applied}"`)
    console.log(`  Match: ${t1_applied === '2rem' ? '✅' : '❌'} (expected "2rem")`)

    // ─── Test 2: Type "1.5" → blur ───
    console.log(`\n═══ Test 2: Type "1.5" → blur ═══`)
    await input.click()
    await clearAndType('1.5')
    const t2_before = await getBlockFontSize(page, blockId!)
    console.log(`  Before blur: applied="${t2_before}" (should still be 2rem)`)

    await blurAndReselect()
    const t2_value = await getFontSizeValue(page)
    const t2_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After blur: input="${t2_value}", applied="${t2_applied}"`)
    console.log(`  Match: ${t2_applied === '1.5rem' ? '✅' : '❌'} (expected "1.5rem")`)

    // ─── Test 3: Backspace "1.5" → "1." mid-edit (no intermediate flash) ───
    console.log(`\n═══ Test 3: Backspace mid-edit (1.5 → 1. → 1.2) ═══`)
    await input.click()
    await input.press('End')
    await input.press('Backspace')
    await page.waitForTimeout(150)
    const t3a_input = await getFontSizeValue(page)
    const t3a_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After Backspace: input="${t3a_input}", applied="${t3a_applied}"`)
    console.log(`  No intermediate flash: ${t3a_applied === '1.5rem' ? '✅ Still 1.5rem' : '⚠️  Changed to ' + t3a_applied}`)

    await input.pressSequentially('2', { delay: 100 })
    await page.waitForTimeout(150)
    const t3b_input = await getFontSizeValue(page)
    const t3b_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After "2": input="${t3b_input}", applied="${t3b_applied}" (should still be 1.5rem until blur)`)

    await blurAndReselect()
    const t3c_value = await getFontSizeValue(page)
    const t3c_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After blur: input="${t3c_value}", applied="${t3c_applied}"`)
    console.log(`  Match: ${t3c_applied === '1.2rem' ? '✅' : '❌'} (expected "1.2rem")`)

    // ─── Test 4: Enter commits (same as blur) ───
    console.log(`\n═══ Test 4: Type "3" → Enter (commit) ═══`)
    await input.click()
    await clearAndType('3')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await block.click()
    await page.waitForTimeout(300)
    const t4_value = await getFontSizeValue(page)
    const t4_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After Enter: input="${t4_value}", applied="${t4_applied}"`)
    console.log(`  Match: ${t4_applied === '3rem' ? '✅' : '❌'} (expected "3rem")`)

    // ─── Test 5: Out-of-range "99" → blur → clamps to 8 ───
    console.log(`\n═══ Test 5: Type "99" → blur (clamp to 8) ═══`)
    await input.click()
    await clearAndType('99')
    const t5_before = await getFontSizeValue(page)
    console.log(`  Before blur: input="${t5_before}"`)

    await blurAndReselect()
    const t5_value = await getFontSizeValue(page)
    const t5_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After blur: input="${t5_value}", applied="${t5_applied}"`)
    console.log(`  Clamped: ${parseFloat(t5_value) <= 8 ? '✅' : '❌'} (expected ≤ 8)`)

    // ─── Test 6: Arrow Up / Down stepping ───
    console.log(`\n═══ Test 6: Arrow keys from known value ═══`)
    await input.click()
    await clearAndType('2')
    await blurAndReselect()
    await input.click()

    await input.press('ArrowUp')
    await page.waitForTimeout(200)
    const t6a_input = await getFontSizeValue(page)
    console.log(`  After ArrowUp from 2: input="${t6a_input}"`)

    await blurAndReselect()
    const t6a_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After blur: applied="${t6a_applied}"`)
    console.log(`  Stepped: ${t6a_applied === '2.25rem' ? '✅' : '❌'} (expected "2.25rem")`)

    await input.click()
    await input.press('ArrowDown')
    await page.waitForTimeout(200)
    await blurAndReselect()
    const t6b_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After ArrowDown + blur: applied="${t6b_applied}"`)
    console.log(`  Stepped back: ${t6b_applied === '2rem' ? '✅' : '❌'} (expected "2rem")`)

    // ─── Test 7: Rapid typing "0.75" character by character ───
    console.log(`\n═══ Test 7: Type "0.75" char by char → blur ═══`)
    await input.click()
    await clearAndType('')
    const chars = ['0', '.', '7', '5']
    for (const char of chars) {
      await input.pressSequentially(char, { delay: 50 })
      await page.waitForTimeout(100)
      const stepVal = await getFontSizeValue(page)
      const stepApplied = await getBlockFontSize(page, blockId!)
      console.log(`  After "${char}": input="${stepVal}", applied="${stepApplied}" (should NOT change until blur)`)
    }
    await blurAndReselect()
    const t7_applied = await getBlockFontSize(page, blockId!)
    console.log(`  After blur: applied="${t7_applied}"`)
    console.log(`  Match: ${t7_applied === '0.75rem' ? '✅' : '❌'} (expected "0.75rem")`)

    // ─── Test 8: Repeated backspaces while editing (no style churn) ───
    console.log(`\n═══ Test 8: Backspaces don't churn styles ═══`)
    await input.click()
    await clearAndType('3.5')
    await blurAndReselect()
    const t8_baseline = await getBlockFontSize(page, blockId!)
    console.log(`  Baseline: applied="${t8_baseline}"`)

    await input.click()
    await input.press('End')
    for (let i = 0; i < 3; i++) {
      await input.press('Backspace')
      await page.waitForTimeout(100)
      const applied = await getBlockFontSize(page, blockId!)
      console.log(`  Backspace ${i + 1}: applied="${applied}" (should stay ${t8_baseline})`)
    }

    // ─── Restore ───
    console.log(`\n═══ Cleanup: Restoring to 1 ═══`)
    await input.click()
    await clearAndType('1')
    await blurAndReselect()
    const cleanup_applied = await getBlockFontSize(page, blockId!)
    console.log(`  Final: applied="${cleanup_applied}"`)

    // ─── Summary ───
    console.log(`\n═══════════════════════════════════════`)
    console.log(`  Test complete. Review logs above for ❌ and ⚠️ markers.`)
    console.log(`═══════════════════════════════════════\n`)
  })
})
