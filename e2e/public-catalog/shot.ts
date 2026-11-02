// ABOUTME: Real synthetic screenshots for the public lane at 4 fixed names, through the qualified #148 capture window
// ABOUTME: (imported blob-pinned via shot-plan.mjs). A withheld shot is recorded with a fixed reason; the run then fails.
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Page, TestInfo } from '@playwright/test';
// @ts-expect-error: plain ESM helper without type declarations
import { loadShotCore, publicShotSecrets, writePublicShot, PUBLIC_SHOT_PLAN } from '../../scripts/public-catalog-fixture/shot-plan.mjs';
// @ts-expect-error: plain ESM helper without type declarations
import { checkStackProof } from '../../scripts/public-catalog-fixture/proof.mjs';
// @ts-expect-error: plain ESM helper without type declarations
import { readPrivateFile } from '../../scripts/public-catalog-fixture/private-file.mjs';
import { API_ORIGIN } from './support';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** What the scan samples (same read-only sample as #148 observe.ts): main-document text, markup, form values, title, URL;
 *  plus image sources and the count of surfaces it cannot sample. */
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

/** The nonce comes only from this run's checked proof (the same consumer the guards use). */
function stackId(): string {
  const file = process.env.PUBLIC_ACCEPT_STACK_PROOF;
  const bad = checkStackProof(file, process.env.PUBLIC_ACCEPT_RUN_ID);
  if (bad) throw new Error('PUBLIC_SHOT_E_PROOF');
  const r = readPrivateFile(file, { max: 4096, privateMode: true });
  if (r.error) throw new Error('PUBLIC_SHOT_E_PROOF');
  return JSON.parse(r.buf.toString('utf8')).stack_id;
}

export async function shot(page: Page, info: TestInfo, name: keyof typeof PUBLIC_SHOT_PLAN) {
  const dir = process.env.PUBLIC_ACCEPT_SHOT_DIR ?? '';
  const core = await loadShotCore(ROOT);
  const secrets = publicShotSecrets(process.env, stackId());
  const base = { project: info.project.name, viewport: page.viewportSize(), appOrigin: new URL(String(info.project.use.baseURL)).origin, apiOrigin: API_ORIGIN };
  const drv = {
    watchNav: (cb: () => void) => { const on = (f: { parentFrame(): unknown }) => { if (!f.parentFrame()) cb(); }; page.on('framenavigated', on); return () => { page.off('framenavigated', on); }; },
    guard: (op: string, token: string) => page.evaluate(core.SHOT_GUARD, [op, token] as [string, string]),
    sample: () => sample(page),
    screenshot: () => page.screenshot({ fullPage: true, animations: 'disabled' }),
  };
  const { png, obs } = await core.captureShot(drv, base, randomBytes(16).toString('hex'), secrets);
  writePublicShot(dir, name, png, obs, secrets, core.scanPage);
}
