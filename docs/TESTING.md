# Testing Documentation

## Overview

The Reno Dev Space project uses Playwright for end-to-end testing. Tests focus on critical user flows and complex interactions.

## Test Suite Structure

```
tests/
├── property-voting.spec.ts    # Property voting behavior
├── drag-jitter.spec.ts        # Gallery drag optimization
├── font-size-input.spec.ts    # Font size input validation
├── effects-visual.spec.ts     # Vote celebration effects
└── property-mobile.spec.ts    # Mobile-specific property tests
```

## Running Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/property-voting.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run with UI mode (interactive)
npx playwright test --ui
```

## Property Voting Tests

**File**: `tests/property-voting.spec.ts`

### Test Cases

#### 1. Upvoting (+5)
```typescript
test('should allow upvoting a property (+5)', async ({ page }) => {
  const initialBrightness = parseInt(brightnessText || '50')
  await page.click('[aria-label="Vote up"]')
  await page.waitForTimeout(1000)

  const newBrightness = parseInt(newBrightnessText || '50')
  expect(newBrightness).toBe(initialBrightness + 5)
})
```

#### 2. Downvoting (-5)
Tests that downvoting decreases brightness by 5 and activates the down button.

#### 3. Same-Direction No-op
```typescript
test('should NOT neutralize upvote when clicking same button again (no-op)', async ({ page }) => {
  await page.click('[aria-label="Vote up"]')  // +5
  await page.click('[aria-label="Remove upvote"]')  // No-op

  // Should STAY at +5, not return to initial
  expect(currentBrightness).toBe(initialBrightness + 5)
})
```

#### 4. Opposite-Direction Neutralization
```typescript
test('should neutralize upvote by voting down (opposite direction)', async ({ page }) => {
  await page.click('[aria-label="Vote up"]')    // +5
  await page.click('[aria-label="Vote down"]')  // Neutralize

  // Should return to initial brightness (neutral)
  expect(currentBrightness).toBe(initialBrightness)
})
```

#### 5. Vote Switching
Tests full cycle: neutral → upvote → neutral → downvote

#### 6. Max Vote Enforcement
Verifies users can't vote multiple times in same direction.

## Test Configuration

**File**: `playwright.config.ts`

```typescript
export default defineConfig({
  testDir: './tests',
  workers: 1,                    // Single worker (avoid conflicts)
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',            // Capture on failure
    trace: 'on-first-retry',     // Debug traces
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
```

## Known Test Challenges

### 1. Authentication Required

**Problem**: Vote controls only appear for authenticated users

**Workaround** (manual):
```typescript
// Sign in before tests
await page.goto('http://localhost:3000')
await page.click('button:has-text("Sign In")')
await page.fill('input[type="email"]', 'test@example.com')
await page.fill('input[type="password"]', 'testpassword123')
await page.click('button:has-text("Sign In")')
await page.waitForTimeout(3000)
```

**Future solution**:
- Create test Firebase project
- Seed test user via Admin SDK
- Use custom token for auth

### 2. Dev Server Port Conflicts

**Problem**: Multiple Next.js instances occupy ports 3000-3007

**Solution**:
```bash
# Kill all node processes before tests
killall -9 node
npx playwright test
```

### 3. Firestore Async Updates

**Problem**: Vote button click → Firestore update → UI update (delay)

**Solution**: Use `waitForTimeout(1000)` after mutations

**Better approach** (future):
```typescript
// Wait for specific state
await page.waitForSelector('[aria-label="Remove upvote"]', { timeout: 5000 })
```

## Testing Best Practices

### 1. Selectors

**Prefer** (in order):
1. `aria-label` attributes (most semantic)
2. `data-testid` attributes (explicit test hooks)
3. Text content (`text=Sign In`)
4. CSS classes (last resort, brittle)

```typescript
// Good
await page.click('[aria-label="Vote up"]')

// Better
await page.click('[data-testid="vote-up-button"]')

// Avoid
await page.click('.bg-green-600.hover\\:bg-green-700')
```

### 2. Waiting Strategies

```typescript
// ❌ BAD: Fixed timeout (flaky)
await page.waitForTimeout(1000)

// ✅ GOOD: Wait for selector
await page.waitForSelector('[aria-label="Remove upvote"]')

// ✅ GOOD: Wait for network idle
await page.waitForLoadState('networkidle')

// ✅ GOOD: Wait for specific text
await page.waitForSelector('text=55')  // Wait for brightness update
```

### 3. Assertions

```typescript
// ✅ Explicit expectations
expect(newBrightness).toBe(initialBrightness + 5)

// ✅ Element state checks
await expect(upvoteButton).toHaveClass(/bg-green-600/)

// ✅ Visibility checks
await expect(page.locator('[aria-label="Vote up"]')).toBeVisible()
```

## Visual Regression Testing

**Future enhancement**: Add visual comparison tests

```typescript
test('property card layout', async ({ page }) => {
  await page.goto('/properties')
  await expect(page).toHaveScreenshot('property-card.png')
})
```

## CI/CD Integration

**GitHub Actions workflow** (future):

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Data Management

### Seed Data Strategy

**Option 1**: Use Firestore emulator
```bash
firebase emulators:start --only firestore
```

**Option 2**: Create dedicated test collection
```typescript
const TEST_COLLECTION = process.env.NODE_ENV === 'test'
  ? 'rentalProperties_test'
  : 'rentalProperties'
```

**Option 3**: Clean up after tests
```typescript
afterEach(async () => {
  // Delete test properties
  const testProperties = await getDocs(
    query(collection(db, 'rentalProperties'), where('createdBy', '==', TEST_USER_ID))
  )
  await Promise.all(testProperties.docs.map(doc => deleteDoc(doc.ref)))
})
```

## Debugging Failed Tests

### 1. View Screenshots
```bash
open test-results/property-voting-*/test-failed-1.png
```

### 2. View Traces
```bash
npx playwright show-trace test-results/property-voting-*/trace.zip
```

### 3. Run in Debug Mode
```bash
PWDEBUG=1 npx playwright test tests/property-voting.spec.ts
```

### 4. Increase Verbosity
```bash
npx playwright test --reporter=list
```

## Coverage Goals

**Current coverage**: ~15% (property voting only)

**Target coverage**:
- ✅ Property voting (upvote, downvote, neutralize)
- ⏳ Property creation flow
- ⏳ Email template editing
- ⏳ Content CMS editing
- ⏳ Campaign timer controls
- ⏳ Chat functionality
- ⏳ Admin user management

## Performance Benchmarks

**Target metrics**:
- Page load: < 2s
- Vote interaction: < 500ms
- Modal open: < 300ms
- Real-time update: < 1s

**Future**: Add performance tests with Lighthouse CI

## Resources

- [Playwright Docs](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging](https://playwright.dev/docs/debug)
