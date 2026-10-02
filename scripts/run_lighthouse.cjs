const { spawnSync } = require('node:child_process');
const { chromium } = require('@playwright/test');

const command = process.platform === 'win32' ? 'lhci.cmd' : 'lhci';
const result = spawnSync(command, ['autorun'], {
  env: {
    ...process.env,
    CHROME_PATH: chromium.executablePath(),
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
