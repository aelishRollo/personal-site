module.exports = {
  ci: {
    collect: {
      startServerCommand: 'python3 -u -m http.server 4174 --bind 127.0.0.1',
      startServerReadyPattern: 'Serving HTTP',
      url: [
        'http://127.0.0.1:4174/index.html?theme=portfolio-dark',
        'http://127.0.0.1:4174/work.html?theme=portfolio-dark',
        'http://127.0.0.1:4174/fridge-poetry.html?theme=portfolio-dark',
      ],
      numberOfRuns: process.env.CI ? 2 : 1,
      settings: {
        preset: 'desktop',
        chromeFlags: '--headless --no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:best-practices': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'first-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3500, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
        'total-blocking-time': ['error', { maxNumericValue: 300, aggregationMethod: 'median' }],
        'resource-summary:script:size': ['error', { maxNumericValue: 225000 }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 250000 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/reports',
    },
  },
};
