const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { makeNetworkDeterministic, openSitePage } = require('../helpers');

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
  await page.locator('.skin-picker-toggle').click();
  await expect(page.locator('#skin-picker-panel')).toBeVisible();
  await expectNoImportantViolations(page);
});
