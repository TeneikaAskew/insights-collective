// ABOUTME: Safe, allowlisted diagnostics for a failed learner sign-in in the quiz-lifecycle browser setup: what the auth
// ABOUTME: response said (status, allowlisted error code, user-id PRESENCE) and which fixed UI message showed. Never values.
//
// Recorded: method, path, HTTP status, an allowlisted GoTrue error_code (else "other"/"none"), whether a user id was
// PRESENT (boolean), the page's URL PATH (no query), and which entry of a fixed UI-message allowlist was visible.
// Never recorded: response bodies, tokens, user ids, headers, cookies, the password, the email, query strings, traces or
// any DOM dump. The screenshot (taken by the caller) masks the email and password inputs.
import fs from 'node:fs';
import path from 'node:path';
import { ERROR_CODE_ALLOWLIST, classifyErrorCode, PATH as TOKEN_PATH } from './learner-auth-probe.mjs';

export { ERROR_CODE_ALLOWLIST };
// Exact user-facing strings the Login page or the auth client can show for a failed sign-in.
export const UI_MESSAGE_ALLOWLIST = Object.freeze([
  'Invalid login credentials',
  'Email not confirmed',
  'Please enter both email and password',
  'Failed to fetch',
  'Database error querying schema',
  'Request rate limit reached',
]);

/** true for the sign-in request: POST to <origin>/auth/v1/token with grant_type=password. */
export function isPasswordGrant(method, url) {
  if (String(method).toUpperCase() !== 'POST') return false;
  try {
    const u = new URL(url);
    return u.pathname === TOKEN_PATH && u.searchParams.get('grant_type') === 'password';
  } catch { return false; }
}

/** Reduce a parsed token response to fixed fields; the input is never retained or echoed. */
export function summarizeTokenResponse(status, json) {
  const uidPresent = Boolean(json && typeof json === 'object' && json.user && typeof json.user === 'object' && typeof json.user.id === 'string' && json.user.id.length > 0);
  return { status: Number.isInteger(status) ? status : 'none', errorCode: status === 200 ? 'none' : classifyErrorCode(json), uidPresent };
}

/** Which allowlisted UI messages occur in the visible text (the text itself is not returned). */
export function matchUiMessages(visibleText) {
  const t = typeof visibleText === 'string' ? visibleText : '';
  const hits = UI_MESSAGE_ALLOWLIST.filter((m) => t.includes(m));
  return hits.length ? hits : ['none'];
}

/** URL path only (no origin, query or fragment); unparsable becomes a fixed marker. */
export function pathOnly(url) {
  try { return new URL(url).pathname; } catch { return 'unparsable'; }
}

/** Test titles become a fixed-charset slug so the line and the file name carry no free text. */
export function slug(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
}

/** One fixed-format line. Only allowlisted tokens, integers, booleans and the slug reach it. */
export function diagnosticLine({ test, urlPath, attempts, last, transportFailures, ui }) {
  const l = last ?? { status: 'none', errorCode: 'none', uidPresent: false };
  const p = /^\/[a-z0-9/_-]{0,80}$/i.test(urlPath) ? urlPath : 'other';
  return [
    'login-setup', `test=${slug(test)}`, `url_path=${p}`, `token_requests=${attempts}`, `transport_failures=${transportFailures}`,
    `method=POST path=${TOKEN_PATH} grant=password`, `last_status=${l.status}`, `error_code=${l.errorCode}`,
    `uid_present=${l.uidPresent ? 'true' : 'false'}`, `ui_message=${ui.map((m) => (m === 'none' ? 'none' : slug(m))).join(',')}`,
  ].join(' ');
}

/**
 * Bounded, SAFE capture for a sign-in that never left /login: one fixed-format line (allowlisted fields only) and one
 * viewport screenshot of the synthetic local login form with BOTH inputs masked. No trace, no DOM dump, no token, body
 * or header. The visible text is read only to test it against the fixed allowlist; the text itself is never written.
 * Files: <out>/login-diagnostics/<slug>.txt (0600) and <out>/screens/login-setup/<slug>-<sha>.png.
 */
export async function captureLoginFailure(page, { out, sha, title, attempts, transportFailures, last }) {
  const name = slug(title);
  let ui = ['none'];
  try { ui = matchUiMessages(await page.locator('body').innerText({ timeout: 2000 })); } catch { ui = ['unreadable']; }
  const line = diagnosticLine({ test: title, urlPath: pathOnly(page.url()), attempts, last, transportFailures, ui });
  const dir = path.join(out, 'login-diagnostics');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, `${name}.txt`), `${line}\n`, { mode: 0o600 });
  const shots = path.join(out, 'screens', 'login-setup');
  fs.mkdirSync(shots, { recursive: true });
  const shaToken = /^[0-9a-z]{1,12}$/.test(String(sha)) ? sha : 'local';
  try {
    await page.screenshot({
      path: path.join(shots, `${name}-${shaToken}.png`), fullPage: false,
      mask: [page.locator('#email'), page.locator('#password')], maskColor: '#000000',
    });
  } catch {
    fs.writeFileSync(path.join(dir, `${name}.screenshot-failed.txt`), 'login-setup screenshot=failed\n', { mode: 0o600 });
  }
  return line;
}
