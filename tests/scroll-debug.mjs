import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/reno-dev-space/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Dismiss intro
  const browseBtn = page.getByText('Browse First');
  if (await browseBtn.isVisible()) {
    await browseBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check scroll container dimensions
  const info = await page.evaluate(() => {
    const scrollEl = document.querySelector('.overflow-y-auto');
    if (!scrollEl) return { error: 'no scroll container found' };
    const styles = getComputedStyle(scrollEl);
    return {
      height: styles.height,
      minHeight: styles.minHeight,
      maxHeight: styles.maxHeight,
      overflow: styles.overflowY,
      offsetHeight: scrollEl.offsetHeight,
      scrollHeight: scrollEl.scrollHeight,
      clientHeight: scrollEl.clientHeight,
      canScroll: scrollEl.scrollHeight > scrollEl.clientHeight,
    };
  });
  console.log('Scroll container:', JSON.stringify(info, null, 2));

  await browser.close();
})();
