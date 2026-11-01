// ABOUTME: Read-only observation helpers for the journey lane (UNRUN proposal). The journey never SENDS a write itself:
// ABOUTME: it clicks the app's own controls and checks the exact request the app sent and the row the real API returned.
import { createHash } from 'node:crypto';
import { expect, type Page, type Response, type TestInfo } from '@playwright/test';
import { BINDING } from '../fixture';

type Method = 'POST' | 'PATCH' | 'PUT' | 'GET';

/** A predicate for one of the app's own requests to the approved API: exact method and path prefix, optional query part. */
export const appCall = (method: Method, pathPrefix: string, queryPart?: string) => (r: Response) => {
  const req = r.request();
  const url = req.url();
  return req.method() === method && url.startsWith(`${BINDING.api.origin}${pathPrefix}`) && (queryPart ? url.includes(queryPart) : true);
};

/** Wait for the app's own write while performing the UI action that should cause it. Never retries the action. */
export async function uiWrite(page: Page, action: () => Promise<unknown>, method: Method, pathPrefix: string, queryPart?: string): Promise<Response> {
  const p = page.waitForResponse(appCall(method, pathPrefix, queryPart), { timeout: 30_000 });
  await action();
  return p;
}

/** The returned representation of a PostgREST write: exactly one row, or the test fails. */
export async function oneRow(res: Response, what: string): Promise<Record<string, unknown>> {
  expect(res.status(), `${what}: HTTP status`).toBeGreaterThanOrEqual(200);
  expect(res.status(), `${what}: HTTP status`).toBeLessThan(300);
  const body = await res.json();
  const rows = Array.isArray(body) ? body : [body];
  expect(rows, `${what}: exactly one row came back`).toHaveLength(1);
  return rows[0] as Record<string, unknown>;
}

export const sha256 = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Count of the app's own requests matching a predicate during an action (used for "no write happened" checks). */
export async function countCalls(page: Page, pred: (r: Response) => boolean, action: () => Promise<unknown>): Promise<number> {
  let n = 0;
  const on = (r: Response) => { if (pred(r)) n++; };
  page.on('response', on);
  try { await action(); } finally { page.off('response', on); }
  return n;
}

export async function shot(page: Page, info: TestInfo, name: string) {
  await info.attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
