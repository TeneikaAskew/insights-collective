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
 * Records the password-grant responses of one page. Each response is reduced to fixed fields in memory; the body is
 * dropped. settle() waits (bounded) for every pending reduction, so a capture never sees attempts>0 with last=null or
 * a stale last.
 */
export function createGrantRecorder(page) {
  const pending = new Set();
  const state = { attempts: 0, transportFailures: 0, last: null };
  const onResponse = (r) => {
    if (!isPasswordGrant(r.request().method(), r.url())) return;
    state.attempts += 1;
    const n = state.attempts;
    const p = (async () => {
      let json = null;
      try { json = await r.json(); } catch { json = null; }
      const s = summarizeTokenResponse(r.status(), json);
      if (n === state.attempts) state.last = s; // only the newest attempt's reduction is kept
    })();
    pending.add(p);
    p.finally(() => pending.delete(p));
  };
  const onFailed = (r) => { if (isPasswordGrant(r.method(), r.url())) state.transportFailures += 1; };
  page.on('response', onResponse);
  page.on('requestfailed', onFailed);
  return {
    async settle(timeoutMs = 3000) {
      let timer;
      const all = Promise.allSettled([...pending]).then(() => true);
      const out = await Promise.race([all, new Promise((r) => { timer = setTimeout(() => r(false), timeoutMs); })]);
      clearTimeout(timer);
      return { ...state, settled: out === true && pending.size === 0 };
    },
    detach() { page.off('response', onResponse); page.off('requestfailed', onFailed); },
  };
}

// The exact static text of the approved synthetic login page. Any other visible text (the raw auth error message that
// Login.tsx renders, a toast, anything reflected) is masked before the screenshot. Unknown text is masked, never shown.
export const APPROVED_LOGIN_TEXT = Object.freeze([
  'Insights Collective', 'Welcome back', 'Sign in to your Insights Collective account', 'Sign in with Google',
  'Or continue with', 'OR CONTINUE WITH', 'Email', 'Password', 'Forgot password?', 'Sign In',
  "Don't have an account?", 'Don’t have an account?', 'Create account',
]);
const REDACT_ATTR = 'data-qlc-redact';

/**
 * In the page: confirm this is the approved login page (the exact form controls exist) and mark every visible element
 * whose own text is not in the static allowlist. Returns counts only; no text leaves the page.
 */
export async function prepareLoginPageForCapture(page, appOrigin) {
  let u;
  try { u = new URL(page.url()); } catch { return { approved: false, reason: 'url' }; }
  if (u.pathname !== '/login' || (appOrigin && u.origin !== appOrigin)) return { approved: false, reason: 'not-login' };
  return page.evaluate(({ allow, attr }) => {
    const form = document.querySelector('#email') && document.querySelector('#password')
      && [...document.querySelectorAll('button[type="submit"]')].some((b) => b.textContent.trim() === 'Sign In');
    if (!form) return { approved: false, reason: 'form' };
    const allowed = new Set(allow);
    let redacted = 0;
    const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    for (const el of document.body.querySelectorAll('*')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
      if (!own || !visible(el) || allowed.has(own)) continue;
      el.setAttribute(attr, '1'); redacted += 1;
    }
    return { approved: true, reason: 'ok', redacted };
  }, { allow: [...APPROVED_LOGIN_TEXT], attr: REDACT_ATTR });
}

/**
 * Bounded, SAFE capture for a sign-in that never left /login: one fixed-format line (allowlisted fields only) and, only
 * on the approved login page, one viewport screenshot with BOTH inputs and EVERY non-allowlisted visible text masked.
 * No trace, no DOM dump, no token, body or header. Files: <out>/login-diagnostics/<slug>.txt (0600) and
 * <out>/screens/login-setup/<slug>-<sha>.png. The visible text is only tested against fixed allowlists, never written.
 */
export async function captureLoginFailure(page, { out, sha, title, recorder, appOrigin }) {
  const name = slug(title);
  const r = await recorder.settle();
  let ui = ['none'];
  try { ui = matchUiMessages(await page.locator('body').innerText({ timeout: 2000 })); } catch { ui = ['unreadable']; }
  const prep = await prepareLoginPageForCapture(page, appOrigin).catch(() => ({ approved: false, reason: 'evaluate' }));
  const shot = prep.approved ? 'masked' : `withheld-${prep.reason}`;
  const line = `${diagnosticLine({ test: title, urlPath: pathOnly(page.url()), attempts: r.attempts, last: r.last, transportFailures: r.transportFailures, ui })} reductions_settled=${r.settled ? 'true' : 'false'} screenshot=${shot}`;
  const dir = path.join(out, 'login-diagnostics');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, `${name}.txt`), `${line}\n`, { mode: 0o600 });
  if (!prep.approved) return line;
  const shots = path.join(out, 'screens', 'login-setup');
  fs.mkdirSync(shots, { recursive: true });
  const shaToken = /^[0-9a-z]{1,12}$/.test(String(sha)) ? sha : 'local';
  try {
    await page.screenshot({
      path: path.join(shots, `${name}-${shaToken}.png`), fullPage: false, animations: 'disabled',
      mask: [page.locator('#email'), page.locator('#password'), page.locator(`[${REDACT_ATTR}]`)], maskColor: '#000000',
    });
  } catch {
    fs.writeFileSync(path.join(dir, `${name}.screenshot-failed.txt`), 'login-setup screenshot=failed\n', { mode: 0o600 });
  }
  return line;
}
