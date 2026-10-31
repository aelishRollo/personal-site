const { test, expect } = require('@playwright/test');
const {
  makeNetworkDeterministic,
  openSitePage,
  watchRuntimeFailures,
} = require('../helpers');

const pages = [
  'index.html',
  'work.html',
  'about.html',
  'favorites.html',
  'connect.html',
  'services.html',
  'contact.html',
  'fridge-poetry.html',
  'thanks.html',
];

test.beforeEach(async ({ page }) => {
  await makeNetworkDeterministic(page);
});

for (const sitePage of pages) {
  test(`${sitePage} loads without local resource or runtime failures`, async ({ page }) => {
    const failures = watchRuntimeFailures(page);
    await openSitePage(page, `/${sitePage}?theme=portfolio-dark`);

    await expect(page.locator('main')).toBeVisible();
    await expect(page).toHaveTitle(/\S+/);
    await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'portfolio-dark');
    expect(failures).toEqual([]);
  });
}

test('favorites index lists every card and jumps to it', async ({ page }) => {
  await openSitePage(page, '/favorites.html?theme=portfolio-dark');

  const indexEntries = await page.locator('.favorites-index-list a').evaluateAll((links) =>
    links.map((link) => ({ id: link.hash.slice(1), name: link.textContent.trim() }))
  );
  const cards = await page.locator('.favorite-card').evaluateAll((items) =>
    items.map((item) => ({ id: item.id, name: item.querySelector('h2').textContent.trim() }))
  );
  expect(indexEntries).toEqual(cards);

  await page.locator('.favorites-index-list a').last().click();
  await expect(page).toHaveURL(/#favorite-whiskers-on-kittens$/);
  await expect(page.locator('#favorite-whiskers-on-kittens')).toBeInViewport({ ratio: 0.1 });
  expect(await page.locator('#favorite-whiskers-on-kittens').evaluate((item) =>
    item.getBoundingClientRect().top > document.querySelector('.site-header').getBoundingClientRect().bottom
  )).toBe(true);
});

test('favorites back-to-top appears after scrolling and returns to the top', async ({ page }) => {
  await openSitePage(page, '/favorites.html?theme=portfolio-dark');

  const backToTop = page.locator('.favorites-back-to-top');
  await expect(backToTop).toBeHidden();

  await page.locator('#favorite-whiskers-on-kittens').scrollIntoViewIfNeeded();
  await expect(backToTop).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => {
    const backToTopBox = document.querySelector('.favorites-back-to-top').getBoundingClientRect();
    const pickerBox = document.querySelector('.skin-picker').getBoundingClientRect();
    return backToTopBox.bottom <= pickerBox.top;
  })).toBe(true);

  await backToTop.click();
  await expect(page).toHaveURL(/#page-top$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(backToTop).toBeHidden();
});

test('theme picker previews and persists a selected theme', async ({ page }) => {
  const failures = watchRuntimeFailures(page);
  await openSitePage(page, '/index.html?theme=portfolio-dark');

  const pickerToggle = page.locator('.skin-picker-toggle');
  const pickerPanel = page.locator('#skin-picker-panel');
  await pickerToggle.click();
  await expect(pickerToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(pickerPanel).toBeVisible();

  await page.locator('[data-skin-choice="acid-editorial"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'acid-editorial');
  await expect(page.locator('[data-skin-choice="acid-editorial"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.locator('label[for="skin-picker-keep"]').click();
  await expect(page.locator('#skin-picker-keep')).toBeChecked();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('site-skin-v2'))).toBe(
    'acid-editorial'
  );

  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'acid-editorial');
  await expect(page.locator('html')).not.toHaveAttribute('data-skin-loading');
  expect(failures).toEqual([]);
});

test('saved theme is ready before the destination page paints', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Paint timing is checked in Chromium.');
  await openSitePage(page, '/index.html?theme=portfolio-dark');
  await page.evaluate(() => {
    localStorage.setItem('site-skin-v2', 'acid-editorial');
    sessionStorage.setItem('site-skin-session-v2', 'acid-editorial');
    sessionStorage.setItem('site-skin-session-mode-v2', 'saved');
  });
  await page.route('**/assets/css/skins/acid-editorial.css', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

  await page.goto('/work.html', { waitUntil: 'load' });
  await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'acid-editorial');
  await expect(page.locator('html')).not.toHaveAttribute('data-skin-loading');
  await expect(page.locator('#active-skin-stylesheet')).toHaveAttribute('blocking', 'render');

  const timing = await page.evaluate(() => ({
    firstContentfulPaint: performance.getEntriesByType('paint')
      .find((entry) => entry.name === 'first-contentful-paint')?.startTime,
    stylesheetResponseEnd: performance.getEntriesByType('resource')
      .find((entry) => entry.name.endsWith('/assets/css/skins/acid-editorial.css'))?.responseEnd,
  }));
  expect(timing.stylesheetResponseEnd).toBeGreaterThan(0);
  expect(timing.firstContentfulPaint).toBeGreaterThanOrEqual(timing.stylesheetResponseEnd);
});

test('every registered theme stylesheet loads and can be applied', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The full theme matrix runs once; core behavior runs in all engines.');
  const failures = watchRuntimeFailures(page);
  await openSitePage(page, '/index.html?theme=portfolio-dark');

  const themes = await page.evaluate(() => window.SiteSkins.all);
  for (const theme of themes) {
    await page.evaluate((themeId) => window.SiteSkins.preview(themeId), theme.id);
    await expect(page.locator('html')).toHaveAttribute('data-skin-id', theme.id);

    if (theme.css) {
      const stylesheet = page.locator(`[data-skin-stylesheet="${theme.id}"]`);
      await expect(stylesheet).toHaveAttribute('data-skin-ready', '');
      await expect
        .poll(() =>
          stylesheet.evaluate((link) => Boolean(link.sheet))
        )
        .toBe(true);
    }
  }

  expect(failures).toEqual([]);
});

test('fridge board reserves its layout before the component upgrades', async ({ page }) => {
  await page.route('**/assets/js/fridge-poetry.js*', (route) => route.abort('blockedbyclient'));
  await page.goto('/fridge-poetry.html?theme=portfolio-dark', { waitUntil: 'domcontentloaded' });

  const board = page.locator('fridge-poetry-board');
  await expect(board).toBeVisible();
  await expect
    .poll(() => board.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThan(700);
});

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens and closes with synchronized accessibility state', async ({ page }) => {
    await openSitePage(page, '/index.html?theme=portfolio-dark');

    const toggle = page.locator('.nav-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(page.locator('body')).toHaveClass(/nav-open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#site-nav')).toBeVisible();

    await toggle.click();
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
