const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { makeNetworkDeterministic, openSitePage } = require('../helpers');

const pages = [
  'index.html',
  'work.html',
  'favorites.html',
  'contact.html',
  'fridge-poetry.html',
  'thanks.html',
];

function importantViolations(results) {
  return results.violations
    .filter((violation) => ['critical', 'serious'].includes(violation.impact))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }));
}

async function expectNoImportantViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = importantViolations(results);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await makeNetworkDeterministic(page);
});

for (const sitePage of pages) {
  test(`${sitePage} has no serious WCAG A/AA violations`, async ({ page }) => {
    await openSitePage(page, `/${sitePage}?theme=portfolio-dark`);
    await expectNoImportantViolations(page);
  });
}

test('open theme picker has no serious WCAG A/AA violations', async ({ page }) => {
  await openSitePage(page, '/index.html?theme=portfolio-light');
  const pickerToggle = page.locator('.skin-picker-toggle');
  await pickerToggle.click();
  await expect(page.locator('#skin-picker-panel')).toBeVisible();
  await pickerToggle.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  );
  await expectNoImportantViolations(page);
});

test('Sea Glass Mosaic is accessible on narrow home and fridge pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['index.html', 'fridge-poetry.html']) {
    await openSitePage(page, `/${path}?theme=sea-glass-mosaic`);
    await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'sea-glass-mosaic');
    await expectNoImportantViolations(page);
  }
});
