// ABOUTME: Real-runner probe for pw-summary: fixture-teardown checks through the shipped failed-check.mjs, body steps through
// ABOUTME: test.step. Runs only under pw.probe.config.cjs; uses no page fixture, so no browser is launched.
const base = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const helper = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'failed-check.mjs')).href);
const t = base.test.extend({
  net: async ({}, use, testInfo) => {
    const { check } = await helper();
    await use({});
    await check(testInfo, 'net_settled', async () => {});
    if (testInfo.title.startsWith('P2')) await check(testInfo, 'net_foreign', async () => { base.expect(['https://secret.invalid'], 'no foreign').toEqual([]); });
    if (testInfo.title.startsWith('P4')) await check(testInfo, 'net_bogus', async () => {});
  },
});
t('P1 all pass', async ({ net }) => { await t.step('a8_load', async () => { void net; }); });
t('P2 body passes, teardown net_foreign fails', async ({ net }) => { await t.step('a8_load', async () => { void net; }); });
t('P3 body step fails', async ({ net }) => { void net; await t.step('a8_estimate', async () => { base.expect('secret value', 'secret').toBe('other'); }); });
t('P4 an unlisted teardown title is refused before it runs', async ({ net }) => { void net; });
