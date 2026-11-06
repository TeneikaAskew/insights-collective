// ABOUTME: Planned real screenshots for builder-authoring (UNRUN): the gradebook journey's qualified capture window, guard and
// ABOUTME: page scan (shot-core.mjs, unchanged) with the builder's own plan; kept only when provably clean, else WITHHELD.
import { randomBytes } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';
import { BINDING } from './guarded-test';
import { SHOT_GUARD, captureShot, shotSecrets } from '../gradebook-roles/journey/shot-core.mjs';
import { assertPairingProof } from '../gradebook-roles/journey/pairing-proof.mjs';
import { writeBaShot } from '../../scripts/builder-authoring-fixture/shot-plan.mjs';
import { SHOT_PLAN } from './ids';

/** Same read-only sample as the journey's observe.ts: main-document text, markup, form values, title, URL, image sources,
 *  and the count of surfaces the scan cannot sample. */
async function sample(page: Page) {
  const values: string[] = [];
  for (const f of await page.locator('input, textarea, select').all()) values.push(await f.inputValue());
  const images: string[] = [];
  for (const i of await page.locator('img').all()) images.push((await i.getAttribute('src')) ?? '');
  return {
    url: page.url(),
    texts: [await page.locator('body').innerText(), await page.content(), values.join('\n'), await page.title(), page.url()],
    images,
    surfaces: await page.locator('iframe, canvas, video, embed, object').count(),
  };
}

/**
 * Capture `name` of the plan on the current page, which must be exactly `expected` (path plus its one query). Taken only
 * after the UI and the stored rows have settled. The spec's own assertions never depend on the outcome.
 */
export async function shot(page: Page, info: TestInfo, name: string, expected: string) {
  if (!Object.prototype.hasOwnProperty.call(SHOT_PLAN, name)) throw new Error('BA_SHOT_E_NAME');
  const dir = process.env.BA_SHOT_DIR ?? '';
  const proof = assertPairingProof(process.env.BA_PAIRING_PROOF, { sessionDir: process.env.BA_SESSION_DIR ?? '' });
  const secrets = shotSecrets(process.env, proof);
  const u = new URL(expected, BINDING.app.origin);
  const base = { project: info.project.name, expectedPath: u.pathname, expectedSearch: u.search, appOrigin: BINDING.app.origin, apiOrigin: BINDING.api.origin };
  const drv = {
    watchNav: (cb: () => void) => { const on = (f: { parentFrame(): unknown }) => { if (!f.parentFrame()) cb(); }; page.on('framenavigated', on); return () => { page.off('framenavigated', on); }; },
    guard: (op: string, token: string) => page.evaluate(SHOT_GUARD, [op, token] as [string, string]),
    sample: () => sample(page),
    screenshot: () => page.screenshot({ fullPage: true, animations: 'disabled' }),
  };
  const { png, obs } = await captureShot(drv, base, randomBytes(16).toString('hex'), secrets);
  writeBaShot(dir, name, png, obs, secrets);
}
