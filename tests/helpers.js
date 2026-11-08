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
      if (request.resourceType() === 'media' && /ERR_ABORTED|NS_BINDING_ABORTED/.test(detail)) {
        return;
      }
      failures.push(`request failed: ${request.method()} ${url.pathname} (${detail})`);
    }
  });

  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' &&
      !text.startsWith('Failed to load resource:') &&
      !text.includes('Cross-Origin Request Blocked:')
    ) {
      failures.push(`console error: ${text}`);
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
