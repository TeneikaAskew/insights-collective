// ABOUTME: Fixed-enum classification of the origin guard's blocked list for the journey setup's refusal code. Pure, no I/O.
// ABOUTME: Only enum values leave this module: never a URL, host, port, path, query, method or any recorded text.
//
// The origin guard (../origin-guard.mjs) records { origin, kind } for SIX different reasons, and only some are foreign:
//   kind = resource type (or 'websocket'), origin = a non-approved origin   -> foreign, OR loopback under another spelling/port
//   kind = '<type>-redirect', origin = a non-approved 3xx target           -> redirect to a non-approved origin
//   kind = 'redirect-on-<METHOD>', origin = an APPROVED target             -> NOT foreign (3xx answered a write)
//   origin = 'redirect-unresolvable'                                        -> NOT foreign (no Location, or > 5 hops)
//   origin = 'unparseable'                                                  -> NOT foreign (URL could not be parsed)
// The class keeps those apart, so a refusal is never reported as an external delivery it may not be.

export const BLOCKED_PREFIX = 'JOURNEY_SETUP_E_FOREIGN_ORIGIN_BLOCKED';
export const ROLES = Object.freeze(['INSTRUCTOR', 'MEMBER']);
// GOTO: non-empty right after goto; SETTLE: first non-empty after the 2 s settle; STATE: first non-empty after storageState.
export const PHASES = Object.freeze(['GOTO', 'SETTLE', 'STATE']);
const TYPES = ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'xhr', 'fetch', 'eventsource', 'websocket', 'manifest'];
export const KINDS = Object.freeze([
  ...TYPES.map((t) => t.toUpperCase()), 'OTHER',
  ...TYPES.filter((t) => t !== 'websocket').map((t) => `${t.toUpperCase()}_REDIRECT`), 'OTHER_REDIRECT',
  'REDIRECT_ON_WRITE', 'REDIRECT_UNRESOLVABLE', 'UNPARSEABLE',
]);
// Host classes come from the repository's own source inventory (absolute hosts the app or its build can reference).
// A host matches its listed domain exactly or as a subdomain of it; everything else public is PUBLIC_OTHER.
const HOSTS = [
  ['GOOGLETAGMANAGER', ['googletagmanager.com']],
  ['PRAVATAR', ['pravatar.cc']],
  ['FONTS_GOOGLEAPIS', ['fonts.googleapis.com']],
  ['FONTS_GSTATIC', ['fonts.gstatic.com']],
  ['GPTENG', ['gpteng.co']],
  ['SUPABASE_CO', ['supabase.co']],
  ['JSDELIVR', ['jsdelivr.net']],
  ['YOUTUBE', ['youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'youtu.be']],
  ['VIMEO', ['vimeo.com', 'vimeocdn.com']],
  ['UNSPLASH', ['unsplash.com']],
];
export const CLASSES = Object.freeze([
  'APP_OR_API', 'LOOPBACK_OTHER_SPELLING', 'LOOPBACK_OTHER_PORT', 'NONE', 'NON_HTTP_SCHEME',
  ...HOSTS.map(([c]) => c), 'PUBLIC_OTHER',
]);
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** @param {unknown} kind @returns {string} a KINDS value */
export function kindOf(kind) {
  if (typeof kind !== 'string') return 'OTHER';
  if (/^redirect-on-[A-Z]+$/.test(kind)) return 'REDIRECT_ON_WRITE';
  const m = /^([a-z]+)(-redirect)?$/.exec(kind);
  if (!m) return 'OTHER';
  const base = TYPES.includes(m[1]) ? m[1].toUpperCase() : 'OTHER';
  if (!m[2]) return base;
  return base === 'WEBSOCKET' ? 'OTHER_REDIRECT' : `${base}_REDIRECT`;
}

/** @param {unknown} origin @param {string[]} approved exact approved origins @returns {string} a CLASSES value */
export function classOf(origin, approved) {
  if (typeof origin !== 'string') return 'NONE';
  let u;
  try { u = new URL(origin); } catch { return 'NONE'; }
  const ok = new Set(approved.map((o) => { try { return new URL(o).origin; } catch { return null; } }).filter(Boolean));
  if (ok.has(u.origin)) return 'APP_OR_API';
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'NON_HTTP_SCHEME';
  const host = u.hostname.toLowerCase();
  if (LOOPBACK.has(host)) {
    const ports = new Set([...ok].map((o) => new URL(o).port));
    return ports.has(u.port) ? 'LOOPBACK_OTHER_SPELLING' : 'LOOPBACK_OTHER_PORT';
  }
  for (const [c, domains] of HOSTS) if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return c;
  return 'PUBLIC_OTHER';
}

/** First entry's kind and class; the non-foreign guard records are named as such, never given a foreign class. */
export function entryClass(entry, approved) {
  const e = entry && typeof entry === 'object' ? entry : {};
  if (e.origin === 'redirect-unresolvable') return { kind: 'REDIRECT_UNRESOLVABLE', cls: 'NONE' };
  if (e.origin === 'unparseable') return { kind: 'UNPARSEABLE', cls: 'NONE' };
  const kind = kindOf(e.kind);
  return { kind, cls: kind === 'REDIRECT_ON_WRITE' ? 'APP_OR_API' : classOf(e.origin, approved) };
}

/**
 * The refusal code for a non-empty blocked list. Never throws: any internal failure returns the bare BLOCKED_PREFIX.
 * @param {{ role: string, phase: string, blocked: unknown[], approved: string[] }} a
 */
export function blockedCode(a) {
  try {
    const { role, phase, blocked, approved } = a;
    if (!ROLES.includes(role) || !PHASES.includes(phase) || !Array.isArray(blocked) || blocked.length === 0) return BLOCKED_PREFIX;
    const { kind, cls } = entryClass(blocked[0], approved);
    if (!KINDS.includes(kind) || !CLASSES.includes(cls)) return BLOCKED_PREFIX;
    return `${BLOCKED_PREFIX}_${role}_${phase}_${kind}_${cls}_N${Math.min(blocked.length, 9)}`;
  } catch { return BLOCKED_PREFIX; }
}

const alt = (xs) => xs.map((x) => x.replace(/[^A-Z0-9_]/g, '')).join('|');
/** The exact grammar of every code blockedCode can return besides the bare prefix. */
export const BLOCKED_CODE_RE = new RegExp(`^${BLOCKED_PREFIX}_(?:${alt(ROLES)})_(?:${alt(PHASES)})_(?:${alt(KINDS)})_(?:${alt(CLASSES)})_N[1-9]$`);
