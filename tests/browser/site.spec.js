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
  expect(failures).toEqual([]);
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
