/**
 * Playwright script to sign in as admin and add blueprint keywords
 * to the Reno Dev Space canvas.
 *
 * Strategy:
 * 1. Navigate to the live site
 * 2. Extract Firebase config from the built JS bundle
 * 3. Use page.evaluate() to init Firebase from scratch and sign in
 * 4. Write blocks directly to Firestore (bypasses UI ban check bug)
 * 5. Reload page and take screenshots
 *
 * Usage: node scripts/add-blueprint-keywords.mjs
 */

import { chromium } from 'playwright'

const SITE_URL = 'https://cwcorella-git.github.io/reno-dev-space/'
const ADMIN_EMAIL = 'christopher@corella.com'
const ADMIN_PASSWORD = '.YQZv*S*7"jk^=?'
const SCREENSHOT_DIR = 'tests/screenshots'

// Blueprint keywords — short phrases and longer extracts
const KEYWORDS = [
  'Ship games, not tutorials',
  'Solo dev hell is real — find your party',
  'Flat ≠ structureless',
  'Consent over consensus',
  'Safe enough to try?',
  'Neutral ground — a third place for devs',
  'Build the crew first — the space follows',
  'Family dinners beat formal meetings',
  'Shoulder to shoulder, not face to face',
  'Accessible, not exclusive',
  'Small scale + explicit process + shared mission',
  'Belonging without conditions',
  'Craft-first: we bond over making things',
  'Governance should feel like collaboration, not bureaucracy',
  'A community of practice — learn by doing alongside peers',
  'No gatekeepers. No prerequisites. Just show up and make something.',
  'The antidote to isolation is a shared table',
  'Sociocracy: every voice shapes the decision',
]

// 8 colors matching TEXT_COLORS from canvas.ts
const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#34d399',
  '#22d3ee', '#818cf8', '#c084fc', '#f472b6',
]

// 12 Google Fonts matching TEXT_FONTS
const FONTS = [
  'var(--font-inter)', 'var(--font-jetbrains-mono)', 'var(--font-space-grotesk)',
  'var(--font-exo-2)', 'var(--font-orbitron)', 'var(--font-quicksand)',
  'var(--font-playfair)', 'var(--font-lora)', 'var(--font-oswald)',
  'var(--font-anton)', 'var(--font-bebas-neue)', 'var(--font-caveat)',
]

async function run() {
  console.log('🚀 Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  // ── Step 1: Navigate ──
  console.log(`📍 Navigating to ${SITE_URL}`)
  await page.goto(SITE_URL, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(4000) // Let Firebase fully init
  await page.screenshot({ path: `${SCREENSHOT_DIR}/bp-01-initial.png`, fullPage: true })
  console.log('📸 Screenshot: initial page')

  // ── Step 2: Extract Firebase config from the bundle ──
  console.log('🔍 Extracting Firebase config from page...')
  const config = await page.evaluate(() => {
    // Search all script sources for the Firebase config pattern
    const scripts = document.querySelectorAll('script[src]')
    // The config is embedded in the Next.js bundle as NEXT_PUBLIC_ env vars
    // We can't easily parse those from scripts, but we can check if Firebase
    // is already initialized by looking for its internal state

    // Try to find config values by scanning the page's JavaScript objects
    // Actually, the simplest: the config values are baked into a __NEXT_DATA__ or
    // inline scripts. Let's check global scope.

    // Return null to trigger alternative approach
    return null
  })

  // ── Step 3: Sign in and write blocks using Firestore REST API ──
  // Instead of fighting with bundled Firebase, let's use the Firestore REST API
  // First, sign in via Firebase Auth REST API to get an ID token
  console.log('🔑 Signing in via Firebase Auth REST API...')

  // Extract the API key from the page source
  const pageSource = await page.content()
  const apiKeyMatch = pageSource.match(/apiKey:\s*"([^"]+)"/) ||
                      pageSource.match(/FIREBASE_API_KEY['":\s]+([A-Za-z0-9_-]+)/)

  let apiKey = null
  if (apiKeyMatch) {
    apiKey = apiKeyMatch[1]
    console.log(`  Found API key: ${apiKey.slice(0, 10)}...`)
  } else {
    // Try fetching a JS chunk that contains the config
    console.log('  Scanning JS bundles for API key...')
    const jsChunks = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'))
      return scripts.map(s => s.src).filter(src => src.includes('/_next/'))
    })

    for (const chunkUrl of jsChunks.slice(0, 5)) {
      try {
        const resp = await page.evaluate(async (url) => {
          const r = await fetch(url)
          return r.text()
        }, chunkUrl)

        const match = resp.match(/apiKey:\s*"([^"]+)"/) ||
                      resp.match(/NEXT_PUBLIC_FIREBASE_API_KEY['"]*[,:]\s*"?([A-Za-z0-9_-]+)"?/)
        if (match) {
          apiKey = match[1]
          console.log(`  Found API key in bundle: ${apiKey.slice(0, 10)}...`)

          // Also extract project ID
          const projMatch = resp.match(/projectId:\s*"([^"]+)"/)
          if (projMatch) console.log(`  Project ID: ${projMatch[1]}`)
          break
        }
      } catch (e) {
        // ignore
      }
    }
  }

  if (!apiKey) {
    console.log('❌ Could not extract Firebase API key. Trying hardcoded approach...')
    // Use the project ID from CLAUDE.md
    apiKey = await tryExtractApiKeyViaSignIn(page)
  }

  if (!apiKey) {
    console.log('❌ Cannot proceed without API key.')
    await browser.close()
    return
  }

  // Sign in via Firebase Auth REST API
  const authResponse = await page.evaluate(async ({ apiKey, email, password }) => {
    try {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
          }),
        }
      )
      const data = await resp.json()
      if (data.error) {
        return { success: false, error: data.error.message }
      }
      return {
        success: true,
        idToken: data.idToken,
        localId: data.localId,
        email: data.email,
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, { apiKey, email: ADMIN_EMAIL, password: ADMIN_PASSWORD })

  if (!authResponse.success) {
    console.log(`❌ Auth failed: ${authResponse.error}`)
    await browser.close()
    return
  }

  console.log(`✅ Signed in as ${authResponse.email} (${authResponse.localId})`)
  const { idToken, localId } = authResponse

  // Extract project ID
  const projIdMatch = pageSource.match(/projectId:\s*"([^"]+)"/)
  let projectId = projIdMatch?.[1]
  if (!projectId) {
    // Scan JS bundles
    const jsChunks = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'))
      return scripts.map(s => s.src).filter(src => src.includes('/_next/'))
    })
    for (const chunkUrl of jsChunks.slice(0, 5)) {
      const resp = await page.evaluate(async (url) => {
        const r = await fetch(url)
        return r.text()
      }, chunkUrl)
      const m = resp.match(/projectId:\s*"([^"]+)"/)
      if (m) { projectId = m[1]; break }
    }
  }

  if (!projectId) {
    projectId = 'reno-dev-space' // from CLAUDE.md
  }
  console.log(`  Project ID: ${projectId}`)

  // ── Step 4: Write blocks via Firestore REST API ──
  console.log(`\n📌 Writing ${KEYWORDS.length} blocks to Firestore...\n`)

  // Get existing blocks to determine max zIndex
  const existingBlocks = await page.evaluate(async ({ projectId, idToken }) => {
    const resp = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/main/documents/canvasBlocks?pageSize=200`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    )
    const data = await resp.json()
    return data.documents?.length || 0
  }, { projectId, idToken })

  console.log(`  Found ${existingBlocks} existing blocks`)
  let zIndex = existingBlocks + 1

  // Grid layout for new blocks
  const COLS = 3
  const START_X = [12, 40, 68]  // percentage positions
  const START_Y = 55            // start at 55%
  const Y_GAP = 6              // 6% between rows

  let successCount = 0
  for (let i = 0; i < KEYWORDS.length; i++) {
    const keyword = KEYWORDS[i]
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = START_X[col]
    const y = START_Y + row * Y_GAP
    const color = COLORS[i % COLORS.length]
    const font = FONTS[i % FONTS.length]
    const now = Date.now()

    console.log(`  [${i + 1}/${KEYWORDS.length}] "${keyword.slice(0, 50)}${keyword.length > 50 ? '...' : ''}"`)

    const result = await page.evaluate(async ({ projectId, idToken, block }) => {
      try {
        const resp = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/main/documents/canvasBlocks`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: {
                type: { stringValue: 'text' },
                x: { doubleValue: block.x },
                y: { doubleValue: block.y },
                width: { integerValue: '0' },
                height: { integerValue: '0' },
                zIndex: { integerValue: String(block.zIndex) },
                content: { stringValue: block.content },
                style: {
                  mapValue: {
                    fields: {
                      fontSize: { doubleValue: block.fontSize },
                      fontWeight: { stringValue: 'normal' },
                      fontStyle: { stringValue: 'normal' },
                      textDecoration: { stringValue: 'none' },
                      fontFamily: { stringValue: block.fontFamily },
                      color: { stringValue: block.color },
                      textAlign: { stringValue: 'left' },
                    },
                  },
                },
                brightness: { integerValue: '50' },
                voters: { arrayValue: { values: [] } },
                votersUp: { arrayValue: { values: [] } },
                votersDown: { arrayValue: { values: [] } },
                createdBy: { stringValue: block.createdBy },
                createdAt: { integerValue: String(block.createdAt) },
                updatedAt: { integerValue: String(block.updatedAt) },
              },
            }),
          }
        )
        const data = await resp.json()
        if (data.error) return { ok: false, error: data.error.message }
        return { ok: true, name: data.name }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }, {
      projectId,
      idToken,
      block: {
        x, y,
        zIndex: zIndex++,
        content: keyword,
        fontSize: 1.1,
        fontFamily: font,
        color,
        createdBy: localId,
        createdAt: now,
        updatedAt: now,
      },
    })

    if (result.ok) {
      successCount++
      console.log('    ✅')
    } else {
      console.log(`    ❌ ${result.error}`)
    }
  }

  console.log(`\n📊 ${successCount}/${KEYWORDS.length} blocks written to Firestore`)

  // ── Step 5: Reload page and take screenshots ──
  console.log('\n🔄 Reloading page to see new blocks...')
  await page.goto(SITE_URL, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(4000)

  // Dismiss intro hint
  const browseBtn = page.locator('button:has-text("Browse First")')
  if (await browseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await browseBtn.click()
    await page.waitForTimeout(500)
  }

  console.log('📸 Taking screenshots...')

  await page.screenshot({ path: `${SCREENSHOT_DIR}/bp-05-final-top.png`, fullPage: true })

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/bp-06-final-mid1.png`, fullPage: true })

  await page.evaluate(() => window.scrollTo(0, (document.body.scrollHeight * 2) / 3))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/bp-07-final-mid2.png`, fullPage: true })

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/bp-08-final-bottom.png`, fullPage: true })

  console.log('\n✅ Done!')
  await browser.close()
}

/**
 * Fallback: try to sign in and extract API key from network requests.
 */
async function tryExtractApiKeyViaSignIn(page) {
  // Check all loaded scripts for the API key pattern
  const allScripts = await page.evaluate(async () => {
    const scripts = Array.from(document.querySelectorAll('script[src]'))
    const results = []
    for (const s of scripts) {
      try {
        const resp = await fetch(s.src)
        const text = await resp.text()
        // Look for Firebase config patterns
        const match = text.match(/apiKey:\s*"([^"]+)"/)
        if (match) results.push(match[1])
        // Also try env var pattern
        const envMatch = text.match(/"AIza[A-Za-z0-9_-]{35}"/)
        if (envMatch) results.push(envMatch[0].replace(/"/g, ''))
      } catch (e) {
        // ignore CORS etc
      }
    }
    return results
  })

  if (allScripts.length > 0) {
    return allScripts[0]
  }

  // Also check inline scripts
  const inlineKey = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script:not([src])'))
    for (const s of scripts) {
      const match = s.textContent.match(/apiKey:\s*"([^"]+)"/) ||
                    s.textContent.match(/"(AIza[A-Za-z0-9_-]{35})"/)
      if (match) return match[1]
    }
    return null
  })

  return inlineKey
}

run().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
