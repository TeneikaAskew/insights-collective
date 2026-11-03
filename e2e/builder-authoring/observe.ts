// ABOUTME: Request-level observation for builder-authoring specs: the gradebook journey's qualified observe-core (recorder,
// ABOUTME: settle, exact origin/method/path/query, exact count, terminal status), imported unchanged and bound to this lane.
import { expect, type Page, type Request } from '@playwright/test';
import { BINDING } from './guarded-test';
import { createRecorder, evaluate, settled } from '../gradebook-roles/journey/observe-core.mjs';

export type CallSpec = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; query?: Record<string, string> };
export type Call = { req: Request; url: URL; method: string; seq: number; status: number | null; failed: boolean; done: boolean };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a UI action and require EXACTLY `count` app requests started that match `spec`, each terminal with an allowed status,
 * and no near-miss. Settles before judging, so a late duplicate fails. Same rules as the journey's expectCalls.
 */
export async function expectCalls(page: Page, spec: CallSpec, action: () => Promise<unknown>, opts: { count?: number; status?: number[]; settleMs?: number } = {}): Promise<Call[]> {
  const want = [{ spec, count: opts.count ?? 1, status: opts.status }];
  const rec = createRecorder(page) as { calls: Call[]; stop(): void };
  try {
    await action();
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !settled(rec.calls, want, BINDING.api.origin)) await sleep(100);
    await sleep(opts.settleMs ?? 1_500);
    const { failures, matched } = evaluate(rec.calls, want, { origin: BINDING.api.origin });
    expect(failures, 'request-level expectations (fixed codes)').toEqual([]);
    return (matched as Call[][])[0];
  } finally { rec.stop(); }
}

/** The JSON body of one finished call. */
export async function bodyOf(c: Call): Promise<unknown> {
  const res = await c.req.response();
  expect(res, 'a response object').not.toBeNull();
  return res!.json();
}
