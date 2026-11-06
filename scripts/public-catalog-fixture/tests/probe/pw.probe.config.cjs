// ABOUTME: Browserless Playwright runner config for pw-summary-controls: the REAL JSON reporter on stdout over teardown.probe.cjs.
// ABOUTME: No page, no browser, no listener; outputDir must be the control's own fresh temp root (PCA_PROBE_OUT).
if (!process.env.PCA_PROBE_OUT) throw new Error('PCA_PROBE_OUT (the control own temp root) is required');
module.exports = { testDir: __dirname, testMatch: /teardown\.probe\.cjs$/, reporter: [['json']], workers: 1, retries: 0, outputDir: process.env.PCA_PROBE_OUT, use: {} };
