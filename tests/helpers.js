const { expect } = require('@playwright/test');

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

async function makeNetworkDeterministic(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !LOCAL_HOSTS.has(url.hostname)) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
}

function watchRuntimeFailures(page) {
  const failures = [];

  page.on('pageerror', (error) => {
    failures.push(`page error: ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (LOCAL_HOSTS.has(url.hostname)) {
      const detail = request.failure() ? request.failure().errorText : 'unknown error';
      failures.push(`request failed: ${request.method()} ${url.pathname} (${detail})`);
    }
  });

  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      failures.push(`console error: ${message.text()}`);
    }
  });

  return failures;
}

async function openSitePage(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `Expected a document response for ${path}`).not.toBeNull();
  expect(response.ok(), `Expected ${path} to return a successful status`).toBeTruthy();
  await page.waitForFunction(() => Boolean(window.SiteSkins));
}

module.exports = {
  makeNetworkDeterministic,
  openSitePage,
  watchRuntimeFailures,
};
