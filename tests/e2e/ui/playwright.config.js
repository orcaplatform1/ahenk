const { defineConfig } = require('@playwright/test');
const ART = process.env.AHENK_TEST_ARTIFACTS || '/root/ahenk-test-artifacts';
module.exports = defineConfig({ testDir: __dirname, testMatch: /.*\.spec\.js/, workers: 1, fullyParallel: false, timeout: 60000, retries: 0, outputDir: ART + '/pw-output',
  reporter: [['list'], ['json', { outputFile: ART + '/ui-results.json' }]], globalSetup: __dirname + '/seed.js',
  use: { baseURL: 'http://127.0.0.1:3104', locale: 'tr-TR', timezoneId: 'Europe/Istanbul', trace: 'off', screenshot: 'only-on-failure' } });
