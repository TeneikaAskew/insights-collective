// ABOUTME: Opt-in workaround for sandboxes where the browser has no outbound egress.
// ABOUTME: Off by default — normal runs talk to Supabase directly and never touch this.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

const run = promisify(execFile);

/**
 * Some CI sandboxes and dev containers allow outbound HTTPS from the shell but
 * not from a browser process, so every Supabase call from the page fails with
 * ERR_CONNECTION_RESET while `curl` against the same host succeeds. That makes
 * data-dependent specs fail for reasons that have nothing to do with the code.
 *
 * When `E2E_SUPABASE_BRIDGE=1`, non-local requests are relayed through curl and
 * fulfilled back into the page. Requests to the dev server itself are untouched.
 *
 * This is deliberately opt-in: a bridge that engaged automatically would hide a
 * genuine network regression.
 */
export async function installSupabaseBridge(page: Page): Promise<void> {
  if (process.env.E2E_SUPABASE_BRIDGE !== '1') return;

  await page.route('**/*', async (route, request) => {
    const url = request.url();
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') ||
        url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }

    // Headers and body go to separate files. Reading `curl -i` from stdout and
    // splitting on the first blank line breaks through an HTTPS proxy, where the
    // CONNECT response is its own header block ahead of the real one — that
    // truncates the body and loses Content-Type, which then fails MIME checks
    // on module scripts and mangles JSON.
    const dir = mkdtempSync(join(tmpdir(), 'e2e-bridge-'));
    const headPath = join(dir, 'head');
    const bodyPath = join(dir, 'body');
    const args = ['-sS', '--max-time', '30', '-D', headPath, '-o', bodyPath, '-X', request.method()];
    for (const [k, v] of Object.entries(request.headers())) {
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(k.toLowerCase())) continue;
      args.push('-H', `${k}: ${v}`);
    }
    const body = request.postData();
    if (body) args.push('--data-binary', body);
    args.push(url);

    try {
      await run('curl', args, { maxBuffer: 64 * 1024 * 1024 });
      const payload = readFileSync(bodyPath);
      const blocks = readFileSync(headPath, 'utf8').trim().split(/\r?\n\r?\n/);
      const [statusLine, ...headerLines] = blocks[blocks.length - 1].split(/\r?\n/);

      const status = Number(statusLine.split(' ')[1]) || 200;
      const headers: Record<string, string> = { 'access-control-allow-origin': '*' };
      for (const line of headerLines) {
        const i = line.indexOf(':');
        if (i < 0) continue;
        const key = line.slice(0, i).trim().toLowerCase();
        if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key)) continue;
        headers[key] = line.slice(i + 1).trim();
      }
      await route.fulfill({ status, headers, body: payload });
    } catch {
      await route.abort('failed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
