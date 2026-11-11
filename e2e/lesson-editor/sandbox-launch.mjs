// ABOUTME: Pure launch contract for the lesson-editor worker browser: Chromium sandbox ON (set last), closed option set, the
// ABOUTME: EFFECTIVE options Playwright 1.59.1 will merge, a bounded owned-browser argv attestation, and cleanup on every path.
//
// Playwright 1.59.1 facts this module is written against (installed sources, read 2026-11-04):
// - playwright/lib/index.js `_browserOptions` (auto worker fixture) sets playwright._defaultLaunchOptions =
//   { handleSIGINT: false, ...launchOptions, tracesDir, artifactsDir, headless }.
// - playwright-core/lib/client/browserType.js launchServer: `options = { ...this._playwright._defaultLaunchOptions, ...options }`,
//   i.e. the defaults are merged AFTER anything the fixture validated. So the incoming launchOptions are checked, AND the exact
//   effective merged object is computed and checked before launch.
// - playwright-core/lib/server/chromium/chromium.js: `if (options.chromiumSandbox !== true) chromeArguments.push("--no-sandbox")`.
// - playwright/lib/runner/workerHost.js: artifactsDir = join(outputDir, `.playwright-artifacts-${workerIndex}`); tracesDir =
//   join(artifactsDir, 'traces') (worker/testTracing.js).
// - playwright-core/lib/browserServerImpl.js launchServer: `controller.run(async (progress) => ...)` is called WITHOUT a timeout
//   argument, so the `timeout` launch option bounds nothing here; and `server.listen(...)` runs AFTER the browser started, so a
//   listen failure rejects with no handle to a running browser. The launch is therefore bounded HERE (LAUNCH_BOUND_MS, then a
//   LATE_GRACE_MS wait for a late handle, which is closed and, failing that, killed, both awaited and bounded). A launch that
//   is rejected, hangs, or settles late leaves the owned browser's state UNKNOWN unless a late handle was closed; nothing
//   claims absence. Containment of anything left is the lane container's own PID-namespace teardown, not this module.
// AppArmor (worker-side, authentic lane): the worker's own label is gated BEFORE launch (exact docker-default (enforce), else
// no launch), the owned browser's label right after attestation, and both again after the test (postrunAppArmor). Pre and
// post must be ENFORCE and equal. The fixed line `PRE <w> <b> POST <w> <b>` is published as the test annotation
// `lane-apparmor`, which the supervisor copies into lane.txt's validated grammar. Unknown, unconfined, complain, other or an
// unreadable label fails closed. No policy is set or changed.
// Claim of the attestation, exactly: at attestation time the OWNED browser process (BrowserServer.process()) was the pinned
// binary, launched with chromiumSandbox: true, and its argv carried none of FORBIDDEN_FLAGS. Nothing about child processes
// (zygote, renderers, utility), which sandbox layer is active, or any process absence is claimed. No /proc enumeration, no
// children walk, no freeze, no ptrace, no extra privilege.
import path from 'node:path';
import { apparmorGate } from '../../scripts/e2e/le-iso/expect.mjs';

export const RESOLVER_ARG = '--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost,EXCLUDE 127.0.0.1';
export const FORBIDDEN_FLAGS = Object.freeze(['--no-sandbox', '--disable-setuid-sandbox', '--disable-namespace-sandbox',
  '--disable-seccomp-filter-sandbox', '--no-zygote', '--single-process']);
export const LAUNCH_BOUND_MS = 60000;
export const LATE_GRACE_MS = 15000;
export const CLOSE_TIMEOUT_MS = 10000;
export const AA_ENFORCE = 'APPARMOR_DOCKER_DEFAULT_ENFORCE';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * The config's `launchOptions` (incoming): keys within { executablePath, args, chromiumSandbox }; chromiumSandbox ABSENT or
 * exactly true; args EXACTLY [RESOLVER_ARG]; executablePath equal to `shell` when a shell is bound. Returns a code or null.
 */
export function incomingProblem(lo, { shell }) {
  if (!lo || typeof lo !== 'object' || Array.isArray(lo)) return 'LANE_E_SANDBOX_OPTION';
  for (const k of Object.keys(lo)) if (!['executablePath', 'args', 'chromiumSandbox'].includes(k)) return 'LANE_E_SANDBOX_OPTION';
  if (own(lo, 'chromiumSandbox') && lo.chromiumSandbox !== true) return 'LANE_E_SANDBOX_OPTION';
  if (!Array.isArray(lo.args) || lo.args.length !== 1 || lo.args[0] !== RESOLVER_ARG) return 'LANE_E_SANDBOX_OPTION';
  if (shell ? lo.executablePath !== shell : own(lo, 'executablePath') && typeof lo.executablePath !== 'string') return 'LANE_E_SANDBOX_OPTION';
  return null;
}

/**
 * Our launchServer options. chromiumSandbox: true is written LAST (it overrides any merged default); no ignoreDefaultArgs key.
 * No `timeout` key: launchServer ignores it (see the header); the bound is LAUNCH_BOUND_MS in boundedLaunch.
 */
export function serverOptions({ shell, proxyUrl }) {
  const o = {};
  if (shell) o.executablePath = shell;
  o.args = [RESOLVER_ARG];
  if (proxyUrl) o.proxy = { server: proxyUrl, bypass: '<-loopback>' };
  o.env = { HOME: '/tmp', TMPDIR: '/tmp' };
  o.host = '127.0.0.1';
  o.port = 0;
  o.chromiumSandbox = true;
  return o;
}

/** Exactly what playwright-core 1.59.1 launchServer will use (client/browserType.js). */
export const effectiveOptions = (defaults, ours) => ({ ...defaults, ...ours });

/**
 * The auto fixture's defaults: exactly { handleSIGINT: false, executablePath?, args, chromiumSandbox?: true, tracesDir,
 * artifactsDir, headless: true }, with artifacts confined to `outputDir/.playwright-artifacts-<n>` when outputDir is bound.
 */
export function defaultsProblem(def, { shell, outputDir }) {
  if (!def || typeof def !== 'object' || Array.isArray(def)) return 'LANE_E_SANDBOX_DEFAULTS';
  const allowed = ['handleSIGINT', 'executablePath', 'args', 'chromiumSandbox', 'tracesDir', 'artifactsDir', 'headless'];
  for (const k of Object.keys(def)) if (!allowed.includes(k)) return 'LANE_E_SANDBOX_DEFAULTS';
  if (def.handleSIGINT !== false || def.headless !== true) return 'LANE_E_SANDBOX_DEFAULTS';
  const { tracesDir, artifactsDir, ...rest } = def;
  delete rest.handleSIGINT; delete rest.headless;
  if (incomingProblem(rest, { shell })) return 'LANE_E_SANDBOX_DEFAULTS';
  if (typeof artifactsDir !== 'string' || tracesDir !== path.join(artifactsDir, 'traces')) return 'LANE_E_SANDBOX_ARTIFACTS';
  if (outputDir && !/^\.playwright-artifacts-\d{1,3}$/.test(path.relative(outputDir, artifactsDir))) return 'LANE_E_SANDBOX_ARTIFACTS';
  return null;
}

const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

/**
 * The merged effective object must equal, key for key (order-independent), the explicit expectation below, built from fixed
 * values and the already validated artifact paths, NOT from the merge itself. chromiumSandbox must be exactly true in it.
 */
export function effectiveProblem(eff, { shell, proxyUrl, defaults }) {
  const want = { handleSIGINT: false, ...(shell ? { executablePath: shell } : {}), args: [RESOLVER_ARG], tracesDir: defaults?.tracesDir,
    artifactsDir: defaults?.artifactsDir, headless: true, ...(proxyUrl ? { proxy: { server: proxyUrl, bypass: '<-loopback>' } } : {}),
    env: { HOME: '/tmp', TMPDIR: '/tmp' }, host: '127.0.0.1', port: 0, chromiumSandbox: true };
  if (!eff || typeof eff !== 'object' || eff.chromiumSandbox !== true || canon(eff) !== canon(want)) return 'LANE_E_SANDBOX_EFFECTIVE';
  return null;
}

/** Owned-browser argv attestation (the tested probe method): one cmdline read of the server's own process. */
export function attestArgv(pid, readCmdline, shell) {
  if (!Number.isInteger(pid) || pid <= 0) return 'LANE_E_SANDBOX_PID';
  let argv;
  try { argv = String(readCmdline(pid)).split('\0').filter((a, i, all) => !(a === '' && i === all.length - 1)); } catch { return 'LANE_E_SANDBOX_UNREAD'; }
  if (argv.length < 2) return 'LANE_E_SANDBOX_UNREAD';
  if (shell && argv[0] !== shell) return 'LANE_E_SANDBOX_EXE';
  for (const a of argv) {
    const flag = a.toLowerCase().split('=')[0];
    if (FORBIDDEN_FLAGS.includes(flag)) return 'LANE_E_SANDBOX_OFF';
  }
  return null;
}

export class SandboxLaunchError extends Error {
  constructor(code, extra = {}) { super(code); this.code = code; Object.assign(this, extra); }
}

/** Rejects after `ms` (fixed code); never leaves the timer running. */
export function bounded(p, ms, code) {
  let t;
  return Promise.race([Promise.resolve(p).finally(() => clearTimeout(t)), new Promise((_, rej) => { t = setTimeout(() => rej(new SandboxLaunchError(code)), ms); })]);
}

const defaultSleep = (ms) => new Promise((r) => { const t = setTimeout(r, ms); t.unref?.(); });

/** Close a BrowserServer: bounded close, then (only if that failed) an awaited bounded kill. { ok, marks }. */
export async function closeServer(server) {
  const marks = [];
  try { await bounded(server.close(), CLOSE_TIMEOUT_MS, 'LANE_E_SERVER_CLOSE'); return { ok: true, marks }; } catch { marks.push('LANE_E_SERVER_CLOSE'); }
  try { await bounded(server.kill(), CLOSE_TIMEOUT_MS, 'LANE_E_SERVER_KILL'); return { ok: true, marks }; } catch { marks.push('LANE_E_SERVER_KILL'); }
  return { ok: false, marks };
}

/**
 * launchServer under OUR bound. Returns { server } or { code, browserState, marks }:
 *   rejected (any time)             -> LANE_E_LAUNCH_REJECTED, UNKNOWN (it may have failed after the browser started)
 *   bound passed, handle in grace   -> handle closed/killed (awaited, bounded): LANE_E_LAUNCH_LATE, LATE_HANDLE_CLOSED or UNKNOWN
 *   bound passed, rejected in grace -> LANE_E_LAUNCH_LATE_REJECTED, UNKNOWN
 *   bound and grace passed          -> LANE_E_LAUNCH_HUNG, UNKNOWN. A handle arriving even later is still closed when it arrives,
 *                                      but that is not awaited here and nothing is claimed from it.
 */
export async function boundedLaunch(chromium, ours, sleep = defaultSleep) {
  const settled = Promise.resolve().then(() => chromium.launchServer(ours)).then((server) => ({ kind: 'ok', server }), () => ({ kind: 'rejected' }));
  const first = await Promise.race([settled, sleep(LAUNCH_BOUND_MS).then(() => ({ kind: 'timeout' }))]);
  if (first.kind === 'ok') return { server: first.server };
  if (first.kind === 'rejected') return { code: 'LANE_E_LAUNCH_REJECTED', browserState: 'UNKNOWN', marks: [] };
  const late = await Promise.race([settled, sleep(LATE_GRACE_MS).then(() => ({ kind: 'hung' }))]);
  if (late.kind === 'ok') {
    const c = await closeServer(late.server);
    return { code: 'LANE_E_LAUNCH_LATE', browserState: c.ok ? 'LATE_HANDLE_CLOSED' : 'UNKNOWN', marks: c.marks };
  }
  if (late.kind === 'rejected') return { code: 'LANE_E_LAUNCH_LATE_REJECTED', browserState: 'UNKNOWN', marks: [] };
  settled.then((r) => (r.kind === 'ok' ? closeServer(r.server) : null)).catch(() => {});
  return { code: 'LANE_E_LAUNCH_HUNG', browserState: 'UNKNOWN', marks: [] };
}

/** One AppArmor label read to a closed code; an unreadable label is APPARMOR_E_UNKNOWN. `note` (diagnostic only) is passed to
 *  readLabel only when given, so the call without it is exactly the original one. */
export function labelCode(readLabel, who, note) {
  let t = null;
  try { t = note ? readLabel(who, note) : readLabel(who); } catch { t = null; }
  return apparmorGate(t);
}

// E1 diagnostics r2 (closed tokens only; DIAGNOSTIC, never acceptance). Nothing here reads /proc, retries a read or changes a
// gate: the read outcomes are noted from the SAME attempts readLabel already makes, and the exit observation reads only the
// ChildProcess handle launchServer returned.
/** One label-file attempt: OK (text read, non-blank after apparmorLabel's own normalisation), BLANK (read, blank), a closed
 *  errno class, OTHER (any other throw), NOT_TRIED (an earlier attempt already returned). UNKNOWN = no outcome was noted. */
export const READ_OUTCOMES = Object.freeze(['OK', 'BLANK', 'ENOENT', 'EACCES', 'EPERM', 'ESRCH', 'OTHER', 'NOT_TRIED', 'UNKNOWN']);
/** Exit of the OWNED launch process, as observed by this worker: never ALIVE (no exit seen is not liveness). */
export const EXIT_OBSERVATIONS = Object.freeze(['EXIT_OBSERVED', 'NO_EXIT_OBSERVED', 'UNKNOWN']);
const ERRNO_CLASSES = new Set(['ENOENT', 'EACCES', 'EPERM', 'ESRCH']);
/** A successful read's text to OK or BLANK (the same normalisation as expect.mjs apparmorLabel: NULs removed, trimmed). */
export function readTextOutcome(text) {
  return typeof text === 'string' && text.replace(/\0/g, '').trim() !== '' ? 'OK' : 'BLANK';
}
/** A thrown read to its closed class. Only an own string `code` is consulted; the message is never read. */
export function readErrorOutcome(e) {
  try {
    const d = e && typeof e === 'object' ? Object.getOwnPropertyDescriptor(e, 'code') : undefined;
    return d && 'value' in d && typeof d.value === 'string' && ERRNO_CLASSES.has(d.value) ? d.value : 'OTHER';
  } catch { return 'OTHER'; }
}
/**
 * The label read itself (egress-test.ts readLabel binds readFile to readFileSync(p, 'utf8')): /proc/<who>/attr/apparmor/current,
 * then /proc/<who>/attr/current ONLY if the first threw. The first successful read is returned as is, even blank; null if both
 * threw. `note`, when given, receives [primary, fallback] outcomes of THESE attempts (NOT_TRIED for an attempt not made); it
 * adds no read and a throwing note changes nothing.
 * @param {(p: string) => string} readFile
 * @param {number | 'self'} who
 * @param {((outcomes: string[]) => void) | undefined} note
 * @returns {string | null}
 */
export function readLabelAttempts(readFile, who, note) {
  const outcomes = ['NOT_TRIED', 'NOT_TRIED'];
  let text = null;
  const files = ['attr/apparmor/current', 'attr/current'];
  for (let i = 0; i < files.length; i++) {
    try { text = readFile(`/proc/${who}/${files[i]}`); outcomes[i] = readTextOutcome(text); break; } catch (e) { text = null; outcomes[i] = readErrorOutcome(e); /* next */ }
  }
  if (note) { try { note(outcomes); } catch { /* diagnostic only */ } }
  return text;
}
const outcomePair = (v) => (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'string' && READ_OUTCOMES.includes(x)) ? [v[0], v[1]] : ['UNKNOWN', 'UNKNOWN']);

/**
 * Passive exit observer for the owned launch process (BrowserServer.process()). Registers one `exit` listener and, at each
 * sample, also reads the handle's exitCode/signalCode, so an exit that happened BEFORE the listener was registered is still
 * observed. EXIT_OBSERVED: the listener fired, or exactly one of a valid exit code (integer 0..255) and a SIG* signal name is
 * set with the other exactly null. NO_EXIT_OBSERVED: a registered listener has not fired
 * and both fields are exactly null; this is NOT a liveness claim (an exit not yet delivered to Node reads the same).
 * UNKNOWN: no usable handle, registration failed, malformed or incompatible fields (E1 diagnostics r2.1), or any throw.
 */
export function exitObserver(child) {
  let seen = false, registered = false;
  try { if (child && typeof child === 'object' && typeof child.once === 'function') { child.once('exit', () => { seen = true; }); registered = true; } } catch { registered = false; }
  return () => {
    try {
      if (seen) return 'EXIT_OBSERVED';
      if (!child || typeof child !== 'object') return 'UNKNOWN';
      const code = child.exitCode, signal = child.signalCode;
      // Without an event, only a well-typed, compatible pair counts: an exit code 0..255 with no signal, or a SIG* name
      // with no code (Node's ChildProcess sets one or the other). Any other shape is UNKNOWN, never an exit or a no-exit.
      const codeOk = Number.isInteger(code) && code >= 0 && code <= 255, signalOk = typeof signal === 'string' && /^SIG[A-Z0-9]+$/.test(signal);
      if ((codeOk && signal === null) || (signalOk && code === null)) return 'EXIT_OBSERVED';
      return registered && code === null && signal === null ? 'NO_EXIT_OBSERVED' : 'UNKNOWN';
    } catch { return 'UNKNOWN'; }
  };
}

/**
 * E1 diagnostics r3: HOW the owned browser exited, as one closed token, the first CHECKPOINT at which Node had observed it, and
 * the page's state at the first checkpoint. Diagnostic only: no gate, refusal, acceptance, cleanup or upload decision reads them.
 * Checkpoints are sampling points in Node observation order, never OS exit times (an exit event or field can lag the exit):
 *   PAGE_TEARDOWN_START: this page wrapper's teardown-start checkpoint, after finish callbacks and afterEach hooks and, in the
 *     current E1 fixture graph, before its underlying page and context are released;
 *   GATE_POST: the test-scoped gate's post-run sample, after the page, boundary and context teardowns. The gate's `await use()`
 *     spans test setup, the body AND those teardowns, so GATE_POST alone never places an exit inside the body.
 *   shape: CODE_<0..255> (Node's exit code) | a signal name from EXIT_SIGNALS | SIG_OTHER (any other SIG* name) | NONE (the
 *     listener is registered and neither field is set yet; NOT a liveness claim) | UNKNOWN (anything else). Node sets a code
 *     or a signal, never both.
 *   page (BODY_END_PAGES): the spec's page state at this page wrapper's teardown-start checkpoint (PAGE_TEARDOWN_START above);
 *     CLOSED means the page was already closed (the spec never closes it), CRASHED that it emitted 'crash' (renderer).
 */
export const EXIT_SIGNALS = Object.freeze(['SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGHUP', 'SIGILL', 'SIGINT', 'SIGKILL', 'SIGPIPE', 'SIGSEGV', 'SIGSYS', 'SIGTERM', 'SIGTRAP']);
export const BODY_END_PAGES = Object.freeze(['OPEN', 'CLOSED', 'CRASHED', 'CRASHED_CLOSED', 'UNKNOWN']);
export const EXIT_CHECKPOINTS = Object.freeze(['PAGE_TEARDOWN_START', 'GATE_POST', 'NOT_SEEN', 'UNKNOWN']);
const EXIT_SHAPE_RE = new RegExp(`^(CODE_(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)|${EXIT_SIGNALS.join('|')}|SIG_OTHER|NONE|UNKNOWN)$`);
/** One exit (code, signal) pair as a closed shape; a malformed or conflicting pair is UNKNOWN. */
export function exitShape(code, signal) {
  const codeOk = Number.isInteger(code) && code >= 0 && code <= 255, signalOk = typeof signal === 'string' && /^SIG[A-Z0-9]+$/.test(signal);
  if (codeOk && signal === null) return `CODE_${code}`;
  if (signalOk && code === null) return EXIT_SIGNALS.includes(signal) ? signal : 'SIG_OTHER';
  return 'UNKNOWN';
}
/** A passive 'exit' listener on the owned ChildProcess; the sampler returns the shape (the event first, then the fields). */
export function exitRecorder(child) {
  let seen = null, registered = false;
  try { if (child && typeof child === 'object' && typeof child.once === 'function') { child.once('exit', (code, signal) => { seen = exitShape(code, signal); }); registered = true; } } catch { registered = false; }
  return () => {
    try {
      if (seen !== null) return seen;
      if (!child || typeof child !== 'object') return 'UNKNOWN';
      const code = child.exitCode, signal = child.signalCode;
      if (code === null && signal === null) return registered ? 'NONE' : 'UNKNOWN';
      return exitShape(code, signal);
    } catch { return 'UNKNOWN'; }
  };
}
/** The page's state at the start of its fixture teardown; `crashed` is what a passive 'crash' listener recorded. */
export function pageEndState(page, crashed) {
  try {
    const closed = page.isClosed();
    if (typeof closed !== 'boolean' || typeof crashed !== 'boolean') return 'UNKNOWN';
    return crashed ? (closed ? 'CRASHED_CLOSED' : 'CRASHED') : closed ? 'CLOSED' : 'OPEN';
  } catch { return 'UNKNOWN'; }
}
/** One sample of the state's exit recorder as a closed shape; a missing, throwing or out-of-grammar sampler is UNKNOWN. */
export function sampleExitShape(state) {
  try { const v = typeof state?.exitShape === 'function' ? state.exitShape() : 'UNKNOWN'; return typeof v === 'string' && EXIT_SHAPE_RE.test(v) ? v : 'UNKNOWN'; } catch { return 'UNKNOWN'; }
}
/** The page wrapper's checkpoint record: the exit sample first, then the page state, both closed. */
export function pageTeardownRecord(state, page, crashed) {
  const exit = sampleExitShape(state);
  return { exit, page: pageEndState(page, crashed) };
}
/**
 * The test-scoped gate's `lane-browser-exit` annotation: `SHAPE <shape> FIRST_SEEN <checkpoint> BODY_END_PAGE <page>`.
 * An exit seen at PAGE_TEARDOWN_START is first seen there; one first seen at GATE_POST needs a PAGE_TEARDOWN_START sample of
 * exactly NONE (else UNKNOWN); NOT_SEEN needs NONE at GATE_POST; two different exit values are UNKNOWN for both.
 */
export function browserExitLine(state, pageTeardown) {
  const seen = (s) => s.startsWith('CODE_') || s.startsWith('SIG');
  const w0 = pageTeardown && typeof pageTeardown === 'object' ? pageTeardown.exit : undefined;
  const w = typeof w0 === 'string' && EXIT_SHAPE_RE.test(w0) ? w0 : 'UNKNOWN';
  const g = sampleExitShape(state);
  let shape, first;
  if (seen(w) && seen(g) && w !== g) { shape = 'UNKNOWN'; first = 'UNKNOWN'; }
  else if (seen(w)) { shape = w; first = 'PAGE_TEARDOWN_START'; }
  else if (seen(g)) { shape = g; first = w === 'NONE' ? 'GATE_POST' : 'UNKNOWN'; }
  else if (g === 'NONE') { shape = 'NONE'; first = 'NOT_SEEN'; }
  else { shape = 'UNKNOWN'; first = 'UNKNOWN'; }
  const p0 = pageTeardown && typeof pageTeardown === 'object' ? pageTeardown.page : undefined;
  const page = typeof p0 === 'string' && BODY_END_PAGES.includes(p0) ? p0 : 'UNKNOWN';
  return `SHAPE ${shape} FIRST_SEEN ${first} BODY_END_PAGE ${page}`;
}

/**
 * E1 browser-log r1: ONE closed code saying whether the owned browser's stderr carried a Chromium FATAL record, read passively and
 * bounded. Diagnostic only: no gate, refusal, acceptance, cleanup or upload decision reads it. The bytes of the current unfinished
 * line are held transiently in one owned buffer of at most MAX_LINE bytes until the sample or a failure releases it; besides that,
 * only record counters are kept. Only the fixed codes are emitted; no path, line number, PID, message or raw byte leaves this module.
 *   GPU_UNUSABLE_REPORTED: exactly one fatal record, and it is the pinned Chrome for Testing 147.0.7727.15 record
 *     `[<stamp>:FATAL:content/browser/gpu/gpu_data_manager_impl_private.cc:417] GPU process isn't usable. Goodbye.`
 *     (IntentionallyCrashBrowserForUnusableGpuProcess). It names a terminal path, never the upstream reason the GPU fallback ran out.
 *   OTHER_FATAL_REPORTED: exactly one fatal record of any other form (official-build CHECK failures write none at all).
 *   NO_MATCH: no complete, newline-terminated record matching this grammar, from the owned pid or without one, was observed from
 *     attachment (after launchServer returned; startup records are not seen) up to the first sample, within the byte budget. It is
 *     NOT proof that no fatal path ran or that every FATAL form or crash path was observable here.
 *   MULTIPLE: more than one fatal record. TRUNCATED: the byte budget or the per-line bound was exceeded (a record could be
 *     hidden), and no MULTIPLE was already established. UNAVAILABLE: no stderr stream, not already flowing (attaching would change
 *     consumption), non-Buffer data, an errored stream, or a throwing classifier.
 * Records whose prefix carries a process id other than the owned browser's pid are ignored; a record without one counts.
 * The first sample freezes the result; later bytes are ignored (late records never change an emitted code).
 * Grammar (r1.4): the producer is base/logging.cc LogMessage::Init at tag 147.0.7727.15 (L946-L1003, non-ChromeOS branch):
 * `[` [prefix:] [pid:] [tid:] MMDD/HHMMSS.uuuuuu: [tickcount:] SEVERITY `:` <file, leading ../../ stripped> `:` <line> `] `.
 * Headless calls InitLogging only with --enable-logging (headless_content_main_delegate.cc L285-L296), which this launch never
 * passes, so the defaults hold: no prefix, pid, tid or tickcount, timestamp on, and LOG_DEFAULT includes LOG_TO_STDERR on POSIX.
 * The omitted form and the pid:tid form are recognized; other prefix combinations are not (they count as NO_MATCH).
 */
export const BROWSER_LOG_CODES = Object.freeze(['GPU_UNUSABLE_REPORTED', 'OTHER_FATAL_REPORTED', 'NO_MATCH', 'UNAVAILABLE', 'TRUNCATED', 'MULTIPLE']);
/**
 * Browser-log component r1 (SYNTHETIC lane only; E1's lines and annotations are unchanged). ONE closed code naming the source-path
 * prefix of the single record behind OTHER_FATAL_REPORTED. Only the code leaves the classifier: never the path, file, line,
 * message, pid, stamp or any other stderr byte. DIAGNOSTIC ONLY: no gate, refusal, acceptance or cleanup decision reads it.
 * Every other log code (GPU_UNUSABLE_REPORTED, NO_MATCH, MULTIPLE, TRUNCATED, UNAVAILABLE) has component NONE; a path outside the
 * closed grammar is UNPARSED; a valid path outside the table is OTHER_PATH.
 */
export const BROWSER_LOG_COMPONENTS = Object.freeze(['GPU_BROWSER', 'GPU', 'ZYGOTE', 'SANDBOX_LINUX', 'RENDERER_HOST', 'RENDERER',
  'CONTENT_BROWSER', 'CONTENT_OTHER', 'MOJO', 'IPC', 'BASE', 'COMPONENTS', 'HEADLESS', 'UI_GRAPHICS', 'NETWORK', 'OTHER_PATH',
  'UNPARSED', 'NONE']);
// Longest prefix first, so content/browser/gpu/ wins over content/browser/ and content/.
const COMPONENT_PREFIXES = Object.freeze([
  ['content/browser/renderer_host/', 'RENDERER_HOST'], ['content/browser/zygote_host/', 'ZYGOTE'], ['content/browser/gpu/', 'GPU_BROWSER'],
  ['sandbox/policy/linux/', 'SANDBOX_LINUX'], ['services/network/', 'NETWORK'], ['content/renderer/', 'RENDERER'],
  ['third_party/blink/', 'RENDERER'], ['content/browser/', 'CONTENT_BROWSER'], ['content/zygote/', 'ZYGOTE'],
  ['sandbox/linux/', 'SANDBOX_LINUX'], ['components/', 'COMPONENTS'], ['headless/', 'HEADLESS'], ['content/', 'CONTENT_OTHER'],
  ['ui/ozone/', 'UI_GRAPHICS'], ['ui/gfx/', 'UI_GRAPHICS'], ['ui/gl/', 'UI_GRAPHICS'], ['mojo/', 'MOJO'], ['base/', 'BASE'],
  ['gpu/', 'GPU'], ['ipc/', 'IPC'], ['net/', 'NETWORK'],
].sort((a, b) => b[0].length - a[0].length));
// 1 to 16 segments, each starting [a-z0-9_] (so `.` and `..` segments, absolute paths, upper case, spaces and NUL never match),
// ending .cc, .h or .mm.
const COMPONENT_PATH = /^[a-z0-9_][a-z0-9_.-]*(?:\/[a-z0-9_][a-z0-9_.-]*){0,15}$/;
const COMPONENT_EXT = /\.(?:cc|h|mm)$/;
/** Pure: the closed component code of a FATAL record's path text (leading `../` runs stripped). Exported for the fake controls. */
export function browserLogComponentOf(raw) {
  if (typeof raw !== 'string') return 'UNPARSED';
  const p = raw.replace(/^(?:\.\.\/)+/, '');
  if (!COMPONENT_PATH.test(p) || !COMPONENT_EXT.test(p)) return 'UNPARSED';
  for (const [prefix, code] of COMPONENT_PREFIXES) if (p.startsWith(prefix)) return code;
  return 'OTHER_PATH';
}
/**
 * Browser-log path reason r1 (SYNTHETIC lane only, diagnostic only). For a path browserLogComponentOf marks UNPARSED: the FIRST
 * failing rule in this fixed order, and the closed class of the last segment's extension. Only these codes leave: never the path,
 * a segment, a character, a length or a count. The accepted grammar above is unchanged: browserLogPathReasonOf is NONE exactly
 * when browserLogComponentOf is not UNPARSED (a static control pins the agreement). UNAVAILABLE: the accessor failed.
 */
export const BROWSER_LOG_PATH_REASONS = Object.freeze(['NONE', 'NOT_STRING', 'EMPTY', 'ABSOLUTE', 'BACKSLASH', 'CONTROL', 'SPACE',
  'NON_ASCII', 'UPPER', 'OTHER_CHAR', 'EMPTY_SEGMENT', 'DOT_SEGMENT', 'SEGMENT_START', 'DEPTH', 'EXTENSION', 'UNAVAILABLE']);
export const BROWSER_LOG_PATH_EXTS = Object.freeze(['NONE', 'CC', 'H', 'MM', 'C', 'CPP', 'CXX', 'HPP', 'HH', 'INC', 'M', 'NO_EXT',
  'OTHER', 'UNAVAILABLE']);
const PATH_EXT_MAP = Object.freeze({ cc: 'CC', h: 'H', mm: 'MM', c: 'C', cpp: 'CPP', cxx: 'CXX', hpp: 'HPP', hh: 'HH', inc: 'INC', m: 'M' });
/** Pure: the first failing grammar rule of a FATAL record's path text (after the same leading `../` strip), or NONE. */
export function browserLogPathReasonOf(raw) {
  if (typeof raw !== 'string') return 'NOT_STRING';
  const p = raw.replace(/^(?:\.\.\/)+/, '');
  if (p.length === 0) return 'EMPTY';
  if (p[0] === '/') return 'ABSOLUTE';
  if (p.includes('\\')) return 'BACKSLASH';
  if (/[\x00-\x1f\x7f]/.test(p)) return 'CONTROL';
  if (p.includes(' ')) return 'SPACE';
  if (/[^\x00-\x7f]/.test(p)) return 'NON_ASCII';
  if (/[A-Z]/.test(p)) return 'UPPER';
  if (/[^a-z0-9_.\-/]/.test(p)) return 'OTHER_CHAR';
  const segs = p.split('/');
  if (segs.some((x) => x === '')) return 'EMPTY_SEGMENT';
  if (segs.some((x) => x === '.' || x === '..')) return 'DOT_SEGMENT';
  if (segs.some((x) => !/^[a-z0-9_]/.test(x))) return 'SEGMENT_START';
  if (segs.length > 16) return 'DEPTH';
  if (!COMPONENT_EXT.test(p)) return 'EXTENSION';
  return 'NONE';
}
/** Pure: the closed class of the last segment's extension (case-insensitive), never the extension text. */
export function browserLogPathExtOf(raw) {
  if (typeof raw !== 'string') return 'OTHER';
  const last = raw.split(/[\\/]/).pop() ?? '';
  const i = last.lastIndexOf('.');
  if (i <= 0 || i === last.length - 1) return 'NO_EXT';
  return Object.prototype.hasOwnProperty.call(PATH_EXT_MAP, last.slice(i + 1).toLowerCase()) ? PATH_EXT_MAP[last.slice(i + 1).toLowerCase()] : 'OTHER';
}
export const BROWSER_LOG_LIMITS = Object.freeze({ MAX_BYTES: 1_048_576, MAX_LINE: 4096 });
const LOG_FATAL_PREFIX = String.raw`^\[(?:(\d{1,10}):\d{1,10}:)?\d{4}/\d{6}\.\d{6}:FATAL:`;
const GPU_UNUSABLE_RECORD = new RegExp(`${LOG_FATAL_PREFIX}content/browser/gpu/gpu_data_manager_impl_private\\.cc:417\\] GPU process isn't usable\\. Goodbye\\.$`);
const FATAL_RECORD = new RegExp(`${LOG_FATAL_PREFIX}([^\\]]{1,512}):\\d{1,6}\\] `); // group 1 stays the pid; group 2 is the path, read only by browserLogComponentOf
/** The pure, bounded classifier: push(Buffer) per chunk, sample() once. Exported for the fake controls. */
export function browserLogClassifier(browserPid, limits = BROWSER_LOG_LIMITS) {
  let bytes = 0, pend = null, lineLen = 0, skipping = false, truncated = false, broken = false, frozen = null, gpu = 0, other = 0;
  let component = 'NONE', frozenComponent = 'NONE'; // only a closed code is kept, never the path text
  let pathReason = 'NONE', pathExt = 'NONE', frozenPath = { reason: 'NONE', ext: 'NONE' }; // closed codes only
  const judge = (buf) => {
    let s = buf.toString('latin1');
    if (s.endsWith('\r')) s = s.slice(0, -1);
    const g = GPU_UNUSABLE_RECORD.exec(s);
    const f = g ?? FATAL_RECORD.exec(s);
    if (!f) return;
    if (f[1] !== undefined && Number(f[1]) !== browserPid) return;
    if (g) gpu += 1; else {
      other += 1; component = browserLogComponentOf(f[2]);
      if (component === 'UNPARSED') { pathReason = browserLogPathReasonOf(f[2]); pathExt = browserLogPathExtOf(f[2]); } else { pathReason = 'NONE'; pathExt = 'NONE'; }
    }
  };
  const piece = (b) => {
    if (skipping) return;
    if (lineLen + b.length > limits.MAX_LINE) { truncated = true; skipping = true; lineLen = 0; return; }
    // Bounds are checked first; only the permitted fragment is copied into owned storage (no view of a caller buffer is kept).
    if (b.length) { if (!pend) pend = Buffer.alloc(limits.MAX_LINE); b.copy(pend, lineLen); lineLen += b.length; }
  };
  const endLine = () => { if (!skipping && lineLen) judge(pend.subarray(0, lineLen)); lineLen = 0; skipping = false; };
  const release = () => { pend = null; lineLen = 0; skipping = false; };
  const result = (n) => (broken ? 'UNAVAILABLE' : n > 1 ? 'MULTIPLE' : truncated ? 'TRUNCATED' : gpu === 1 ? 'GPU_UNUSABLE_REPORTED' : other === 1 ? 'OTHER_FATAL_REPORTED' : 'NO_MATCH');
  const api = {
    push(chunk) {
      if (frozen !== null || broken) return;
      if (!Buffer.isBuffer(chunk)) { broken = true; release(); return; }
      if (truncated && bytes >= limits.MAX_BYTES) return;
      let c = chunk;
      if (bytes + c.length > limits.MAX_BYTES) { c = c.subarray(0, limits.MAX_BYTES - bytes); truncated = true; }
      bytes += c.length;
      let at = 0;
      for (let nl = c.indexOf(0x0a, at); nl !== -1; nl = c.indexOf(0x0a, at)) { piece(c.subarray(at, nl)); endLine(); at = nl + 1; }
      piece(c.subarray(at));
    },
    fail() { broken = true; release(); },
    sample() {
      if (frozen !== null) return frozen;
      // The sample is a checkpoint, not EOF: only newline-complete records count; the unfinished suffix is discarded unread.
      release();
      frozen = result(gpu + other);
      frozenComponent = frozen === 'OTHER_FATAL_REPORTED' ? component : 'NONE';
      frozenPath = frozenComponent === 'UNPARSED' ? { reason: pathReason, ext: pathExt } : { reason: 'NONE', ext: 'NONE' };
      return frozen;
    },
    /** The component fixed by the SAME sample (taking it first if needed): a code only with OTHER_FATAL_REPORTED, else NONE. */
    component() {
      if (frozen === null) api.sample();
      return frozenComponent;
    },
    /** The path reason and extension class fixed by the SAME sample: codes only when the component is UNPARSED, else NONE. */
    pathDiag() {
      if (frozen === null) api.sample();
      return { reason: frozenPath.reason, ext: frozenPath.ext };
    },
  };
  return api;
}
/** A passive 'data' listener on the owned ChildProcess's stderr (already flowing: Playwright's readline consumes it). */
export function browserLogRecorder(child) {
  const pid = child && typeof child === 'object' ? child.pid : undefined;
  const c = browserLogClassifier(Number.isInteger(pid) ? pid : -1);
  let stream = null, attached = false;
  try {
    stream = child && typeof child === 'object' ? child.stderr : null;
    if (stream && typeof stream.on === 'function' && stream.readableFlowing === true) {
      stream.on('data', (d) => { try { c.push(d); } catch { try { c.fail(); } catch { /* observation only */ } } });
      attached = true;
    }
  } catch { attached = false; }
  const read = () => {
    try {
      if (!attached) return 'UNAVAILABLE';
      if (stream.errored) { c.fail(); }
      const v = c.sample();
      return BROWSER_LOG_CODES.includes(v) ? v : 'UNAVAILABLE';
    } catch { return 'UNAVAILABLE'; }
  };
  // Separate accessor (the code `read` returns is unchanged for E1): the component of the same frozen sample.
  read.component = () => {
    if (read() !== 'OTHER_FATAL_REPORTED') return 'NONE';
    try { const k = c.component(); return BROWSER_LOG_COMPONENTS.includes(k) && k !== 'NONE' ? k : 'UNPARSED'; } catch { return 'UNPARSED'; }
  };
  read.pathDiag = () => {
    try { return read.component() === 'UNPARSED' ? c.pathDiag() : { reason: 'NONE', ext: 'NONE' }; } catch { return { reason: 'UNAVAILABLE', ext: 'UNAVAILABLE' }; }
  };
  return read;
}
/** The synthetic arm's LOG_COMPONENT: a component code iff browserLogLine is OTHER_FATAL_REPORTED (UNPARSED when the accessor is
 *  missing, throws or answers outside the set), otherwise NONE. */
export function browserLogComponentLine(state) {
  let log;
  try { log = browserLogLine(state); } catch { return 'NONE'; }
  if (log !== 'OTHER_FATAL_REPORTED') return 'NONE';
  try {
    const f = state.browserLog.component;
    const k = typeof f === 'function' ? f() : 'UNPARSED';
    return BROWSER_LOG_COMPONENTS.includes(k) && k !== 'NONE' ? k : 'UNPARSED';
  } catch { return 'UNPARSED'; }
}
/** The synthetic arm's LOG_PATH_REASON and LOG_PATH_EXT: NONE/NONE unless browserLogComponentLine is UNPARSED; then the sampled
 *  codes, or UNAVAILABLE/UNAVAILABLE when the accessor is missing, throws, answers outside the sets or answers incoherently. */
export function browserLogPathLine(state) {
  const none = { reason: 'NONE', ext: 'NONE' }, unavailable = { reason: 'UNAVAILABLE', ext: 'UNAVAILABLE' };
  if (browserLogComponentLine(state) !== 'UNPARSED') return none;
  try {
    // The codes must come from the accessor that itself reported UNPARSED (not an UNPARSED caused by a missing component accessor).
    const k = typeof state.browserLog.component === 'function' ? state.browserLog.component() : null;
    if (k !== 'UNPARSED') return unavailable;
    const f = state.browserLog.pathDiag;
    const d = typeof f === 'function' ? f() : null;
    const reason = d?.reason, ext = d?.ext;
    if (!BROWSER_LOG_PATH_REASONS.includes(reason) || ['NONE', 'UNAVAILABLE'].includes(reason)) return unavailable;
    if (!BROWSER_LOG_PATH_EXTS.includes(ext) || ['NONE', 'UNAVAILABLE'].includes(ext)) return unavailable;
    return { reason, ext };
  } catch { return unavailable; }
}
/** The test-scoped gate's `lane-browser-log` annotation: one BROWSER_LOG_CODES code; a missing or throwing sampler is UNAVAILABLE. */
export function browserLogLine(state) {
  try { const v = typeof state?.browserLog === 'function' ? state.browserLog() : 'UNAVAILABLE'; return BROWSER_LOG_CODES.includes(v) ? v : 'UNAVAILABLE'; } catch { return 'UNAVAILABLE'; }
}

/**
 * Post-run evidence for the worker and the owned browser; ok only if all four are ENFORCE (pre equal to post).
 * @param {{ pid: number, readLabel: (who: number | 'self', note?: (outcomes: string[]) => void) => string | null, exitObservation?: () => string, pre: { worker: string, browser: string } }} state
 */
export function postrunAppArmor(state) {
  const worker = labelCode(state.readLabel, 'self'), browser = labelCode(state.readLabel, state.pid);
  const ok = [state.pre.worker, state.pre.browser, worker, browser].every((c) => c === AA_ENFORCE) && worker === state.pre.worker && browser === state.pre.browser;
  return { worker, browser, ok, line: `PRE ${state.pre.worker} ${state.pre.browser} POST ${worker} ${browser}` };
}

/**
 * E1 diagnostics r2: the SAME post-run evaluation as postrunAppArmor (same two reads, same order, same worker/browser/ok/line),
 * plus `observed`, a closed line for the test-scoped gate's annotation ONLY (the worker-teardown POST keeps postrunAppArmor):
 *   WORKER_READ <primary> <fallback> BROWSER_READ <primary> <fallback> EXIT <before reads> <after reads>
 * Read outcomes are noted by readLabel from its own attempts (no extra read); EXIT is sampled from the owned handle only.
 * `observed` decides nothing.
 * @param {Parameters<typeof postrunAppArmor>[0]} state
 */
export function postrunAppArmorObserved(state) {
  const exitOf = typeof state.exitObservation === 'function' ? state.exitObservation : () => 'UNKNOWN';
  const sample = () => { try { const v = exitOf(); return EXIT_OBSERVATIONS.includes(v) ? v : 'UNKNOWN'; } catch { return 'UNKNOWN'; } };
  let wr = null, br = null;
  const before = sample();
  const worker = labelCode(state.readLabel, 'self', (o) => { wr = o; }), browser = labelCode(state.readLabel, state.pid, (o) => { br = o; });
  const after = sample();
  const ok = [state.pre.worker, state.pre.browser, worker, browser].every((c) => c === AA_ENFORCE) && worker === state.pre.worker && browser === state.pre.browser;
  const [w1, w2] = outcomePair(wr), [b1, b2] = outcomePair(br);
  return { worker, browser, ok, line: `PRE ${state.pre.worker} ${state.pre.browser} POST ${worker} ${browser}`,
    observed: `WORKER_READ ${w1} ${w2} BROWSER_READ ${b1} ${b2} EXIT ${before} ${after}` };
}

/**
 * Launch (bounded), attest, gate AppArmor (when readLabel is bound), connect, use, and clean up on EVERY path. A failed close
 * is recorded (marks) and followed by an AWAITED, bounded server.kill(); nothing is fire-and-forget. The first error (or a
 * cleanup failure) is rethrown as a fixed code.
 * @param {any} chromium
 * @param {{ launchOptions: any, defaults: any, shell?: string, outputDir?: string, proxyUrl?: string | null, readCmdline: (pid: number) => string,
 *   readLabel?: (who: number | 'self', note?: (outcomes: string[]) => void) => string | null, onAppArmor?: (state: any) => void, sleep?: (ms: number) => Promise<unknown> }} o
 * @param {(browser: any) => Promise<unknown>} use
 */
export async function withSandboxedBrowser(chromium, { launchOptions, defaults, shell, outputDir, proxyUrl, readCmdline, readLabel, onAppArmor, sleep }, use) {
  const marks = [];
  const p1 = incomingProblem(launchOptions, { shell }) ?? defaultsProblem(defaults, { shell, outputDir });
  if (p1) throw new SandboxLaunchError(p1);
  const ours = serverOptions({ shell, proxyUrl });
  const p2 = effectiveProblem(effectiveOptions(defaults, ours), { shell, proxyUrl, defaults });
  if (p2) throw new SandboxLaunchError(p2);
  let preWorker = null;
  if (readLabel) { preWorker = labelCode(readLabel, 'self'); if (preWorker !== AA_ENFORCE) throw new SandboxLaunchError('LANE_E_APPARMOR_PRE', { apparmor: preWorker }); }
  const l = await boundedLaunch(chromium, ours, sleep);
  if (!l.server) throw new SandboxLaunchError(l.code, { browserState: l.browserState, laneMarks: l.marks });
  const server = l.server;
  let primary = null;
  try {
    const child = server.process();
    const pid = child?.pid;
    const exitObservation = exitObserver(child); // passive, diagnostic only (postrunAppArmorObserved)
    const exitShapeOf = exitRecorder(child); // passive, diagnostic only (browserExitLine, E1 diagnostics r3)
    const browserLogOf = browserLogRecorder(child); // passive, bounded, diagnostic only (browserLogLine, E1 browser-log r1)
    const a = attestArgv(pid, readCmdline, shell);
    if (a) throw new SandboxLaunchError(a);
    let state = null;
    if (readLabel) {
      state = { pid, readLabel, exitObservation, exitShape: exitShapeOf, browserLog: browserLogOf, pre: { worker: preWorker, browser: labelCode(readLabel, pid) } };
      if (state.pre.browser !== AA_ENFORCE) throw new SandboxLaunchError('LANE_E_APPARMOR_PRE', { apparmor: state.pre.browser });
      onAppArmor?.(state);
    }
    let browser;
    try { browser = await chromium.connect(server.wsEndpoint(), { timeout: 15000 }); } catch { throw new SandboxLaunchError('LANE_E_CONNECT'); }
    try { await use(browser); } finally {
      if (state && !postrunAppArmor(state).ok) marks.push('LANE_E_APPARMOR_POST');
      try { await bounded(browser.close(), CLOSE_TIMEOUT_MS, 'LANE_E_BROWSER_CLOSE'); } catch { marks.push('LANE_E_BROWSER_CLOSE'); }
    }
  } catch (e) { primary = e; } finally {
    const c = await closeServer(server);
    marks.push(...c.marks);
  }
  if (primary) throw Object.assign(primary, { laneMarks: marks });
  if (marks.length) throw new SandboxLaunchError(marks[0], { laneMarks: marks });
  return marks;
}
