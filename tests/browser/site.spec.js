const { test, expect } = require('@playwright/test');
const {
  makeNetworkDeterministic,
  openSitePage,
  watchRuntimeFailures,
} = require('../helpers');

const pages = [
  'index.html',
  'work.html',
  'favorites.html',
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

test('hero title and Jeff Dean quote arrows browse independently', async ({ page }) => {
  await openSitePage(page, '/index.html?theme=browser-archaeology');
  await expect(page.locator('.hero-title-intro')).toHaveText('Who I am:');
  await expect(page.locator('.page-hero h1 .hero-title-role').nth(0)).toHaveText('Software Engineer.');
  await expect(page.locator('.page-hero h1 .hero-title-role').nth(1)).toHaveText('Musician.');
  await expect(page.locator('.page-hero h1 .hero-title-role').nth(2)).toHaveText('Collaborator.');
  const title = page.locator('#hero-silly-title');
  const quote = page.locator('#hero-splash-text');
  await expect(quote).not.toHaveText('Alec Rollison can get 1s out of `/dev/zero`.');
  await expect(page.locator('.hero-splash-close, .hero-splash-notice-icon')).toHaveCount(0);

  const initialTitle = await title.textContent();
  const initialQuote = await quote.textContent();
  await page.getByRole('button', { name: 'Next hero title' }).click();
  await expect(title).not.toHaveText(initialTitle);
  await expect(quote).toHaveText(initialQuote);
  await page.getByRole('button', { name: 'Previous hero title' }).click();
  await expect(title).toHaveText(initialTitle);

  const seenTitles = new Set([initialTitle]);
  for (let step = 0; step < 65; step += 1) {
    seenTitles.add(await page.evaluate(() =>
      window.navigateAlecSillyTitle(document.getElementById('hero-silly-title'), 1)
    ));
  }
  expect(seenTitles.has('Has never went to Ovoo Javer')).toBe(true);
  await page.evaluate((target) => {
    const el = document.getElementById('hero-silly-title');
    while (el.textContent !== target) {
      window.navigateAlecSillyTitle(el, 1);
    }
  }, initialTitle);

  await page.getByRole('button', { name: 'Next Jeff Dean quote' }).click();
  await expect(quote).not.toHaveText(initialQuote);
  await expect(title).toHaveText(initialTitle);
  await page.getByRole('button', { name: 'Previous Jeff Dean quote' }).click();
  await expect(quote).toHaveText(initialQuote);
});

test('quote arrows remain usable in themed mobile layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['nutrition-facts', 'ms-dos-prompt', 'op-art-monochrome']) {
    await openSitePage(page, `/index.html?theme=${theme}`);
    const quote = page.locator('#hero-splash-text');
    await expect(quote).not.toHaveText('Alec Rollison can get 1s out of `/dev/zero`.');
    const previous = await quote.textContent();
    await page.getByRole('button', { name: 'Next Jeff Dean quote' }).click();
    await expect(quote).not.toHaveText(previous);
    await page.getByRole('button', { name: 'Previous Jeff Dean quote' }).click();
    await expect(quote).toHaveText(previous);
  }
});

test('Afterimage text contrasts with both the page and the artwork', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await openSitePage(page, '/favorites.html?theme=op-art-monochrome');
  await expect(page.locator('html')).not.toHaveAttribute('data-skin-loading');

  const lead = page.locator('.favorites-hero .lead');
  const box = await lead.boundingBox();
  const clip = {
    x: Math.floor(box.x),
    y: Math.floor(box.y),
    width: Math.ceil(box.width),
    height: Math.ceil(box.height),
  };
  const withText = await page.screenshot({ clip, scale: 'css' });
  await lead.evaluate((element) => { element.style.visibility = 'hidden'; });
  const withoutText = await page.screenshot({ clip, scale: 'css' });

  // Compare the rendered pixels with the same area without text. This checks
  // the actual result of compositing, including the white lines in the artwork.
  const contrast = await page.evaluate(async ([visible, hidden]) => {
    async function pixels(base64) {
      const image = new Image();
      image.src = 'data:image/png;base64,' + base64;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    }

    const foreground = await pixels(visible);
    const background = await pixels(hidden);
    let darkOnLight = 0;
    let lightOnDark = 0;
    for (let i = 0; i < foreground.length; i += 4) {
      const before = (background[i] + background[i + 1] + background[i + 2]) / 3;
      const after = (foreground[i] + foreground[i + 1] + foreground[i + 2]) / 3;
      if (before > 220 && after < 100) darkOnLight++;
      if (before < 50 && after > 150) lightOnDark++;
    }
    return { darkOnLight, lightOnDark };
  }, [withText.toString('base64'), withoutText.toString('base64')]);

  expect(contrast.darkOnLight).toBeGreaterThan(20);
  expect(contrast.lightOnDark).toBeGreaterThan(20);
});

for (const [legacyPage, destination] of [
  ['about.html', 'index.html'],
  ['connect.html', 'contact.html'],
  ['services.html', 'contact.html'],
]) {
  test(`${legacyPage} forwards old links and preserves the requested theme`, async ({ page }) => {
    await page.goto(`/${legacyPage}?theme=portfolio-light`);
    await expect(page).toHaveURL(new RegExp(`/${destination.replace('.', '\\.')}\\?theme=portfolio-light$`));
    await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'portfolio-light');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('#site-nav a')).toHaveCount(4);
  });
}

test('contact form submits its fields and keeps theme controls clear on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSitePage(page, '/contact.html?theme=portfolio-light');
  await expect(page.locator('.skin-contact-charm')).toHaveCount(0);

  const form = page.getByRole('form', { name: 'Send a message' });
  await form.getByLabel('Name', { exact: true }).fill('Local preview');
  await form.getByLabel('Your Email').fill('preview@example.com');
  await form.getByLabel('Message', { exact: true }).fill('Testing the contact form locally.');
  await form.getByRole('button', { name: 'Send message' }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => {
    const formBox = document.querySelector('.contact-form-grid').getBoundingClientRect();
    const pickerBox = document.querySelector('.skin-picker').getBoundingClientRect();
    return pickerBox.top >= formBox.bottom;
  })).toBe(true);

  await page.locator('.skin-picker-toggle').click();
  await expect(page.locator('#skin-picker-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Close theme picker' }).click();

  // Intercept the POST: this verifies the form without sending a message.
  await page.route('**/thanks.html', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<main>Local form submission received.</main>',
  }));
  const submitted = page.waitForRequest((request) =>
    request.method() === 'POST' && new URL(request.url()).pathname === '/thanks.html'
  );
  await form.getByRole('button', { name: 'Send message' }).click();
  const fields = new URLSearchParams((await submitted).postData());
  expect(Object.fromEntries(fields)).toEqual({
    'form-name': 'contact-form',
    'bot-field': '',
    subject: 'New portfolio inquiry',
    name: 'Local preview',
    email: 'preview@example.com',
    message: 'Testing the contact form locally.',
  });
});

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

  await page.waitForLoadState('networkidle');
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

test('unseen themes warm automatically before their first selection', async ({ page, browserName }) => {
  const themeRequests = [];
  page.on('request', (request) => {
    if (/assets\/css\/skins\/|assets\/images\//.test(request.url())) {
      themeRequests.push(request.url());
    }
  });
  await openSitePage(page, '/index.html?theme=portfolio-dark');
  const themes = await page.evaluate(() => window.SiteSkins.all.filter((theme) => theme.css));
  for (const theme of themes) {
    await expect(page.locator(`[data-skin-stylesheet="${theme.id}"]`)).toHaveAttribute('data-skin-ready', '');
  }
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'portfolio-dark');
  await expect(page.locator('[data-skin-stylesheet][media="all"]')).toHaveCount(0);
  expect(themeRequests.some((url) => url.endsWith('/sea-glass-mosaic.webp'))).toBe(true);

  // WebKit revalidates nonmatching-media CSS when it becomes active on this
  // test server (which supplies no cache lifetime). Other engines can also
  // verify the first application with the network entirely unavailable.
  if (browserName !== 'webkit') await page.context().setOffline(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.SiteSkins.preview('sea-glass-mosaic'));
  await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'sea-glass-mosaic');
  await expect(page.locator('[data-skin-stylesheet][media="all"]')).toHaveCount(1);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(241, 237, 227)');
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

test('Photo Carousel preloads photos upon site load, shows one immediately on visit, steps forward/back, and auto-cycles', async ({ page }) => {
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  let photoCount = 0;

  await page.route('https://picsum.photos/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/info')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          id: '101',
          author: 'Test Photographer',
          url: 'https://unsplash.com/photos/test',
        }),
      });
      return;
    }

    photoCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'Picsum-Id',
        'picsum-id': String(100 + photoCount),
      },
      body: onePixelPng,
    });
  });

  // Load on another theme first: several Pretty Calc photos should preload automatically.
  await openSitePage(page, '/index.html?theme=portfolio-dark');
  await expect.poll(() => photoCount).toBeGreaterThanOrEqual(5);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.SiteSkins.preview('pretty-calc'));
  await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'pretty-calc');
  await expect(page.locator('html')).toHaveAttribute('data-pretty-calc-photo', 'ready');
  await expect(page.locator('[data-skin-choice="pretty-calc"]')).toHaveText('Photo Carousel');

  const prevButton = page.getByRole('button', { name: 'Back', exact: true });
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  const cycleBubble = page.locator('[data-pretty-calc-cycle-toggle]');
  await expect(page.locator('.pretty-calc-controls button')).toHaveText([
    'Back',
    'Photos Cycling',
    'Next',
  ]);
  await expect(prevButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();
  await expect(cycleBubble).toHaveText('Photos Cycling');
  await expect(cycleBubble).toHaveAttribute('aria-pressed', 'true');

  // The bottom-left control dock sits in the left margin without overlapping main content.
  const horizontalClearance = await page.evaluate(() => {
    const controlsRect = document.querySelector('.pretty-calc-controls').getBoundingClientRect();
    const shellRect = document.querySelector('.site-main .site-shell').getBoundingClientRect();
    return shellRect.left - controlsRect.right;
  });
  expect(horizontalClearance).toBeGreaterThanOrEqual(4);

  const photo = page.locator('.pretty-calc-photo.is-visible');
  await expect(photo).toHaveCount(1);
  const initialSrc = await photo.getAttribute('src');
  const initialSource = await photo.getAttribute('data-photo-source');
  expect(initialSrc).toMatch(/^blob:/);
  expect(initialSource).toMatch(/^https:\/\/picsum\.photos\//);
  await expect(page.locator('.pretty-calc-credit')).toContainText('Test Photographer');

  const initialHue = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--pc-h')
  );
  expect(initialHue).not.toBe('');

  // Changing the photo on the home page also changes the hero title and Jeff Dean quote.
  const homeTitle = page.locator('#hero-silly-title');
  const homeQuote = page.locator('#hero-splash-text');
  await expect(homeQuote).not.toHaveText('Alec Rollison can get 1s out of `/dev/zero`.');
  const firstHomeTitle = await homeTitle.textContent();
  const firstHomeQuote = await homeQuote.textContent();
  await nextButton.click();
  await expect(prevButton).toBeEnabled();
  await expect(homeTitle).not.toHaveText(firstHomeTitle);
  await expect(homeQuote).not.toHaveText(firstHomeQuote);
  await prevButton.click();
  await expect(prevButton).toBeDisabled();
  await expect(homeTitle).toHaveText(firstHomeTitle);
  await expect(homeQuote).toHaveText(firstHomeQuote);

  // Navigating to another page should keep the exact same photo, palette, and disabled Previous state.
  await page.locator('#site-nav a[href="work.html"]').click();
  await page.waitForURL('**/work.html');
  await expect(page.locator('html')).toHaveAttribute('data-skin-id', 'pretty-calc');
  await expect(page.locator('html')).toHaveAttribute('data-pretty-calc-photo', 'ready');
  await expect(page.locator('.skin-picker-current')).toHaveText('Photo Carousel');
  await expect(page.locator('.pretty-calc-photo.is-visible')).toHaveAttribute(
    'data-photo-source',
    initialSource
  );
  await expect(prevButton).toBeDisabled();
  await expect(page.locator('.pretty-calc-credit')).toContainText('Test Photographer');
  const hueAfterNavigation = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--pc-h')
  );
  expect(hueAfterNavigation).toBe(initialHue);

  // Content images and root scrolling should be ready upfront without lazy-load scroll delay.
  const scrollReadiness = await page.evaluate(() => ({
    bodyOverflowY: window.getComputedStyle(document.body).overflowY,
    allEagerAndComplete: Array.from(document.querySelectorAll('main img')).every(
      (img) => img.loading === 'eager' && img.complete && img.naturalWidth > 0
    ),
  }));
  expect(scrollReadiness).toEqual({
    bodyOverflowY: 'visible',
    allEagerAndComplete: true,
  });

  // Clicking Next advances to a second photo/palette and enables Previous.
  await nextButton.click();
  await expect(prevButton).toBeEnabled();
  const secondSource = await page.locator('.pretty-calc-photo.is-visible').last().getAttribute('data-photo-source');
  expect(secondSource).not.toBe(initialSource);

  // Clicking Previous returns to the first set and greys out Previous again.
  await prevButton.click();
  await expect(prevButton).toBeDisabled();
  await expect(page.locator('.pretty-calc-photo.is-visible').last()).toHaveAttribute(
    'data-photo-source',
    initialSource
  );
  const restoredHue = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--pc-h')
  );
  expect(restoredHue).toBe(initialHue);

  // Track 30000ms (30s) auto-cycle timers and step forward to the second photo in history.
  await page.evaluate(() => {
    window.__prettyCalcCycles = [];
    const realSetTimeout = window.setTimeout.bind(window);
    const realClearTimeout = window.clearTimeout.bind(window);
    window.setTimeout = function (fn, delay, ...args) {
      if (delay === 30000) {
        const id = realSetTimeout(() => {}, 30000);
        window.__prettyCalcCycles.push({ id, fn, delay, cleared: false });
        return id;
      }
      return realSetTimeout(fn, delay, ...args);
    };
    window.clearTimeout = function (id) {
      for (const entry of window.__prettyCalcCycles) {
        if (entry.id === id) entry.cleared = true;
      }
      return realClearTimeout(id);
    };
  });

  await nextButton.click();
  await expect(prevButton).toBeEnabled();
  await expect(page.locator('.pretty-calc-photo.is-visible').last()).toHaveAttribute(
    'data-photo-source',
    secondSource
  );

  // Verify a 30000ms auto-cycle timer is active and advances to a third photo when it fires.
  const activeCycleDelays = await page.evaluate(() =>
    window.__prettyCalcCycles.filter((entry) => !entry.cleared).map((entry) => entry.delay)
  );
  expect(activeCycleDelays).toEqual([30000]);
  await page.evaluate(() => {
    const active = window.__prettyCalcCycles.find((entry) => !entry.cleared);
    active.cleared = true;
    active.fn();
  });
  await expect
    .poll(() => page.locator('.pretty-calc-photo.is-visible').last().getAttribute('data-photo-source'))
    .not.toBe(secondSource);

  // Clicking the cycle bubble pauses photo and color cycling and clears the 60s timer.
  const pausedSource = await page
    .locator('.pretty-calc-photo.is-visible')
    .last()
    .getAttribute('data-photo-source');
  const pausedHue = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--pc-h')
  );
  await cycleBubble.click();
  await expect(cycleBubble).toHaveText('Photos Cycling');
  await expect(cycleBubble).toHaveAttribute('aria-pressed', 'false');
  await expect(cycleBubble).toHaveClass(/is-paused/);
  await expect(cycleBubble).toHaveCSS('text-decoration-line', /line-through/);
  const remainingCycleDelays = await page.evaluate(() =>
    window.__prettyCalcCycles.filter((entry) => !entry.cleared).map((entry) => entry.delay)
  );
  expect(remainingCycleDelays).toEqual([]);
  await expect(page.locator('.pretty-calc-photo.is-visible').last()).toHaveAttribute(
    'data-photo-source',
    pausedSource
  );
  const hueWhilePaused = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--pc-h')
  );
  expect(hueWhilePaused).toBe(pausedHue);

  await page.evaluate(() => window.SiteSkins.preview('portfolio-dark'));
  await expect(page.locator('.pretty-calc-stage, .pretty-calc-controls, .pretty-calc-credit')).toHaveCount(0);
});

test('MS-DOS Prompt renders multi-column TUI panes on desktop and stacks cleanly on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await openSitePage(page, '/index.html?theme=ms-dos-prompt');

  const homeLayout = await page.evaluate(() => {
    const shell = document.querySelector('.page-hero > .site-shell').getBoundingClientRect();
    const h1 = document.querySelector('.page-hero h1').getBoundingClientRect();
    const media = document.querySelector('.hero-copy .hero-media').getBoundingClientRect();
    const quests = Array.from(document.querySelectorAll('.quest-card')).map((el) =>
      el.getBoundingClientRect()
    );
    return {
      shellWidth: shell.width,
      shellLeft: shell.left,
      shellRightGap: window.innerWidth - shell.right,
      mediaBesideHeading: media.left >= h1.right - 4,
      questTops: quests.map((q) => Math.round(q.top)),
      questLefts: quests.map((q) => Math.round(q.left)),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  expect(homeLayout.shellWidth).toBeGreaterThan(1000);
  expect(Math.abs(homeLayout.shellLeft - homeLayout.shellRightGap)).toBeLessThanOrEqual(2);
  expect(homeLayout.mediaBesideHeading).toBe(true);
  expect(homeLayout.questTops[0]).toBe(homeLayout.questTops[1]);
  expect(homeLayout.questTops[1]).toBe(homeLayout.questTops[2]);
  expect(homeLayout.questLefts[0]).toBeLessThan(homeLayout.questLefts[1]);
  expect(homeLayout.questLefts[1]).toBeLessThan(homeLayout.questLefts[2]);
  expect(homeLayout.overflow).toBeLessThanOrEqual(0);

  await openSitePage(page, '/work.html?theme=ms-dos-prompt');
  const workLayout = await page.evaluate(() => {
    const featured = document.querySelector('.features--showcase .featured-project');
    const featuredImage = featured.querySelector('.image').getBoundingClientRect();
    const featuredInner = featured.querySelector('.inner').getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll('.features--showcase > article:not(.featured-project)')).map(
      (el) => el.getBoundingClientRect()
    );
    return {
      featuredImageHeight: featuredImage.height,
      featuredTwoCol: featuredInner.left >= featuredImage.right - 4,
      rowAligned: Math.round(cards[0].top) === Math.round(cards[1].top),
      twoColCards: cards[0].left < cards[1].left,
    };
  });

  expect(workLayout.featuredImageHeight).toBeGreaterThan(180);
  expect(workLayout.featuredTwoCol).toBe(true);
  expect(workLayout.rowAligned).toBe(true);
  expect(workLayout.twoColCards).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await openSitePage(page, '/index.html?theme=ms-dos-prompt');
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(mobileOverflow).toBeLessThanOrEqual(0);
});

test('8-Bit Overworld renders its bespoke reverse-split RPG hero, Bento quest map, and 6-column cartridge rack', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await openSitePage(page, '/index.html?theme=eight-bit-overworld');

  const homeLayout = await page.evaluate(() => {
    const h1 = document.querySelector('.page-hero h1').getBoundingClientRect();
    const media = document.querySelector('.hero-copy .hero-media').getBoundingClientRect();
    const roles = Array.from(document.querySelectorAll('.page-hero h1 .hero-title-role')).map((el) =>
      el.getBoundingClientRect()
    );
    const roleSprites = Array.from(document.querySelectorAll('.page-hero h1 .hero-title-role')).map(
      (el) => window.getComputedStyle(el).backgroundImage
    );
    const quests = Array.from(document.querySelectorAll('.quest-card')).map((el) =>
      el.getBoundingClientRect()
    );
    const brandHearts = window.getComputedStyle(document.querySelector('.brand'), '::after').backgroundImage;
    const bodyBg = window.getComputedStyle(document.body).backgroundImage;
    const heroShellStyle = window.getComputedStyle(document.querySelector('.page-hero > .site-shell'));
    const cardStyle = window.getComputedStyle(document.querySelector('.panel-card'));
    const sillyStyle = window.getComputedStyle(document.getElementById('hero-silly-title'));
    const roleBeforeContent = window.getComputedStyle(document.querySelector('.hero-title-role'), '::before').content;
    return {
      mediaLeftOfHeading: media.right <= h1.left + 4,
      roleGridTwoByTwo:
        Math.round(roles[0].top) === Math.round(roles[1].top) &&
        roles[0].left < roles[1].left &&
        Math.round(roles[2].top) === Math.round(roles[3].top) &&
        roles[2].left < roles[3].left,
      hasDistinctRoleSprites: new Set(roleSprites).size === 4 && roleSprites.every((bg) => bg.includes('data:image/svg+xml')),
      sillyTitleIconUnclipped: sillyStyle.backgroundClip === 'border-box',
      hasHudHeartsAndOverworldMural:
        brandHearts.includes('data:image/svg+xml') && heroShellStyle.backgroundImage.includes('data:image/svg+xml'),
      distinctBackgroundAndContainers:
        bodyBg !== heroShellStyle.backgroundImage && heroShellStyle.backgroundColor !== cardStyle.backgroundColor,
      noExtraneousRoleBanner: roleBeforeContent === 'none',
      bentoLeftStacked:
        Math.round(quests[0].left) === Math.round(quests[2].left) &&
        quests[0].bottom <= quests[2].top + 4,
      bentoRightSpanning:
        quests[1].left >= quests[0].right - 4 &&
        Math.round(quests[1].top) === Math.round(quests[0].top) &&
        Math.round(quests[1].bottom) === Math.round(quests[2].bottom),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  expect(homeLayout.mediaLeftOfHeading).toBe(true);
  expect(homeLayout.roleGridTwoByTwo).toBe(true);
  expect(homeLayout.hasDistinctRoleSprites).toBe(true);
  expect(homeLayout.sillyTitleIconUnclipped).toBe(true);
  expect(homeLayout.hasHudHeartsAndOverworldMural).toBe(true);
  expect(homeLayout.distinctBackgroundAndContainers).toBe(true);
  expect(homeLayout.noExtraneousRoleBanner).toBe(true);
  expect(homeLayout.bentoLeftStacked).toBe(true);
  expect(homeLayout.bentoRightSpanning).toBe(true);
  expect(homeLayout.overflow).toBeLessThanOrEqual(0);

  await openSitePage(page, '/work.html?theme=eight-bit-overworld');
  const workLayout = await page.evaluate(() => {
    const featured = document.querySelector('.features--showcase .featured-project');
    const featuredImage = featured.querySelector('.image').getBoundingClientRect();
    const featuredInner = featured.querySelector('.inner').getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll('.features--showcase > article:not(.featured-project)')).map(
      (el) => el.getBoundingClientRect()
    );
    const manualNotes = Array.from(document.querySelectorAll('.work-background > p:not(:last-child)')).map(
      (el) => el.getBoundingClientRect()
    );
    return {
      featuredCopyLeftOfImage: featuredInner.right <= featuredImage.left + 4,
      twoAcrossSecondRow:
        Math.round(cards[0].top) === Math.round(cards[1].top) &&
        cards[0].left < cards[1].left,
      twoAcrossThirdRow:
        Math.round(cards[2].top) === Math.round(cards[3].top) &&
        cards[2].left < cards[3].left,
      twoColumnManual:
        Math.round(manualNotes[0].top) === Math.round(manualNotes[1].top) &&
        manualNotes[0].left < manualNotes[1].left,
    };
  });

  expect(workLayout.featuredCopyLeftOfImage).toBe(true);
  expect(workLayout.twoAcrossSecondRow).toBe(true);
  expect(workLayout.twoAcrossThirdRow).toBe(true);
  expect(workLayout.twoColumnManual).toBe(true);

  await openSitePage(page, '/contact.html?theme=eight-bit-overworld');
  const contactSwapped = await page.evaluate(() => {
    const form = document.querySelector('.contact-form-grid').getBoundingClientRect();
    const intro = document.querySelector('.contact-intro').getBoundingClientRect();
    return form.right <= intro.left + 4;
  });
  expect(contactSwapped).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await openSitePage(page, '/index.html?theme=eight-bit-overworld');
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(mobileOverflow).toBeLessThanOrEqual(0);
});

test('keeps root scrolling, upfront paint, and eager image decoding across skins and pages', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSitePage(page, '/index.html?theme=portfolio-dark');

  const skinIds = await page.evaluate(() => window.SiteSkins.all.map((skin) => skin.id));
  for (const id of skinIds) {
    const metrics = await page.evaluate(async (skinId) => {
      window.SiteSkins.preview(skinId);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const link = document.getElementById('active-skin-stylesheet');
      if (link && !link.sheet) {
        await new Promise((resolve) => {
          link.addEventListener('load', resolve, { once: true });
          link.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 1000);
        });
      }
      const bodyStyle = window.getComputedStyle(document.body);
      const headerStyle = window.getComputedStyle(document.querySelector('.site-header'));
      const cardStyle = window.getComputedStyle(document.querySelector('.panel-card'));
      return {
        skinId,
        bodyOverflowY: bodyStyle.overflowY,
        bodyBgAttachment: bodyStyle.backgroundAttachment,
        headerBackdropFilter: headerStyle.backdropFilter || headerStyle.webkitBackdropFilter || 'none',
        cardContain: cardStyle.contain,
        cardContentVisibility: cardStyle.contentVisibility,
      };
    }, id);

    expect(metrics.bodyOverflowY, `${id} should keep root scrolling on html`).toBe('visible');
    expect(metrics.bodyBgAttachment, `${id} should avoid fixed body backgrounds`).not.toContain('fixed');
    expect(metrics.headerBackdropFilter, `${id} should avoid sticky header backdrop blur`).toBe('none');
    expect(metrics.cardContain, `${id} should not defer off-screen card paint`).not.toContain('paint');
    expect(metrics.cardContentVisibility, `${id} should not defer off-screen card layout`).not.toBe('auto');
  }

  for (const pagePath of ['/index.html', '/work.html', '/favorites.html', '/fridge-poetry.html', '/thanks.html']) {
    await page.goto(`${pagePath}?theme=ms-dos-prompt`, { waitUntil: 'load' });
    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main img')).map((img) => ({
        src: img.getAttribute('src'),
        loading: img.loading,
        decoding: img.decoding,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
      }))
    );

    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.loading, `${pagePath} ${img.src} should load eagerly`).toBe('eager');
      expect(img.decoding, `${pagePath} ${img.src} should decode synchronously`).toBe('sync');
      expect(img.complete, `${pagePath} ${img.src} should be loaded before scrolling`).toBe(true);
      expect(img.naturalWidth, `${pagePath} ${img.src} should be decoded before scrolling`).toBeGreaterThan(0);
    }

    if (pagePath === '/favorites.html') {
      await expect(page.locator('body')).toHaveAttribute('data-favorites-view', 'compact');
      await expect(page.locator('[data-favorites-view-choice="compact"]')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      const compactHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(compactHeight).toBeLessThan(3800);

      await page.locator('[data-favorites-view-choice="two-column"]').click();
      await expect(page.locator('body')).toHaveAttribute('data-favorites-view', 'two-column');
      await expect(page.locator('[data-favorites-view-choice="two-column"]')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      const twoColumnHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(twoColumnHeight).toBeLessThan(3800);

      await page.locator('[data-favorites-view-choice="compact"]').click();
      await expect(page.locator('body')).toHaveAttribute('data-favorites-view', 'compact');
      await expect(page.locator('#favorites-fixed-bg')).toHaveCount(1);

      const parkedWithinRetinaBudget = await page.evaluate(() => {
        const vh = window.innerHeight;
        return Array.from(document.querySelectorAll('.favorite-card')).every((card) => {
          const rect = card.getBoundingClientRect();
          return rect.top >= -1560 && rect.bottom <= vh + 1560;
        });
      });
      expect(parkedWithinRetinaBudget).toBe(true);
    }
  }
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
