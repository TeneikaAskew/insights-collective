// ABOUTME: Per-worker egress records for the sealed video lane (ADDENDUM r2.1 C2): the closed file-name and content grammar the
// ABOUTME: worker fixture writes, and the pure aggregation lane-entry runs after Playwright exits. No I/O here.
//
// Why per worker: `workers: 1` bounds concurrency, not the number of worker processes. Playwright starts a replacement
// worker after a failure, so one run can have several workers, each with its own ledger lifetime (setup, every test,
// teardown, launch failure). Each worker writes `<stem>.start` BEFORE any browser launch and `<stem>.end` at teardown.
// The video kind has no proxy: the ledger counts the context-level observer's events (non-GET/HEAD requests, WebSockets),
// so `forwarded` is always 0 there.

export const MAX_RECORDS = 32;
export const MAX_REFUSED_LINES = 16;
export const RECORD_MAX_BYTES = 4096;
export const STEM_RE = /^w-(\d{1,4})-(\d{1,4})-([1-9]\d{0,9})-([0-9a-f]{16})$/;
const NAME_RE = /^(w-\d{1,4}-\d{1,4}-[1-9]\d{0,9}-[0-9a-f]{16})\.(start|end)$/;
export const START_TEXT = 'EGRESS_WORKER_START\n';
const HEAD_RE = /^refused=(\d{1,6}) forwarded=(\d{1,9}) tests=(\d{1,6}) closed=([01])$/;
export const REFUSED_REASONS = Object.freeze(['method', 'websocket', 'proxy']);
const ORIGIN_RE = /^(?:(?:https?|wss?):\/\/[a-z0-9.-]{1,253}(?::\d{1,5})?|<opaque>)$/;
const REFUSED_RE = new RegExp(`^REFUSED (${REFUSED_REASONS.join('|')}) ([A-Z]{1,12}|-) (\\S+)$`);

/** The record stem for one worker. Throws on anything outside the grammar (the fixture then fails before any launch). */
export function egressStem({ workerIndex, parallelIndex, pid, nonce }) {
  const s = `w-${workerIndex}-${parallelIndex}-${pid}-${nonce}`;
  if (!STEM_RE.test(s)) throw new Error('egress: stem');
  return s;
}

/** A refusal's origin, reduced to the closed grammar: scheme://host[:port] in lower case, otherwise `<opaque>`. */
export function refusalOrigin(url) {
  try { const o = new URL(url).origin.toLowerCase(); return ORIGIN_RE.test(o) && o !== '<opaque>' ? o : '<opaque>'; } catch { return '<opaque>'; }
}

/** One closed REFUSED line. method: an upper-case HTTP method for `method`, '-' otherwise. */
export function refusedLine(reason, method, url) {
  if (!REFUSED_REASONS.includes(reason)) throw new Error('egress: reason');
  const m = reason === 'method' && /^[A-Z]{1,12}$/.test(method ?? '') ? method : '-';
  return `REFUSED ${reason} ${m} ${refusalOrigin(url)}`;
}

/** The `.end` content: the counter line, then at most MAX_REFUSED_LINES refusal lines (the count stays exact). */
export function egressEndText({ refused, forwarded, tests, closed, lines }) {
  for (const n of [refused, forwarded, tests]) if (!Number.isSafeInteger(n) || n < 0) throw new Error('egress: counter');
  const body = (lines ?? []).slice(0, MAX_REFUSED_LINES);
  for (const l of body) if (!REFUSED_RE.test(l)) throw new Error('egress: line');
  return [`refused=${refused} forwarded=${forwarded} tests=${tests} closed=${closed ? 1 : 0}`, ...body].map((l) => `${l}\n`).join('');
}

/** Parse one `.end` text; null when malformed (any line outside the grammar, a line-count mismatch, or no trailing newline). */
export function parseEndText(text) {
  if (typeof text !== 'string' || text.length > RECORD_MAX_BYTES || !text.endsWith('\n')) return null;
  const ls = text.slice(0, -1).split('\n');
  const h = HEAD_RE.exec(ls[0]);
  if (!h) return null;
  const rec = { refused: Number(h[1]), forwarded: Number(h[2]), tests: Number(h[3]), closed: Number(h[4]), lines: ls.slice(1) };
  if (rec.lines.length > MAX_REFUSED_LINES || rec.lines.some((l) => !REFUSED_RE.test(l))) return null;
  if (rec.lines.length !== Math.min(rec.refused, MAX_REFUSED_LINES)) return null;
  return rec;
}

/**
 * Aggregate the egress directory after Playwright exited. `names` is the directory listing; `read(name)` returns the file
 * text or null (unreadable/refused). `declared` is the lane's declared test count. Returns { ok, code, workers, refused, tests }.
 * Fails on: an unknown name; more than MAX_RECORDS workers; a .start without its .end or an .end without its .start; a
 * duplicate worker index (two processes cannot share one); unreadable or malformed content; closed != 1; refused > 0; and a
 * tests sum different from `declared` (LANE_E_EGRESS_COVERAGE). Zero records is a coverage failure, never a pass.
 */
export function aggregateEgress(names, read, declared) {
  const res = (code, extra = {}) => ({ ok: code === 'LANE_EGRESS_OK', code, ...extra });
  if (!Array.isArray(names) || !Number.isSafeInteger(declared) || declared < 1) return res('LANE_E_EGRESS_INPUT');
  if (names.length > 2 * MAX_RECORDS) return res('LANE_E_EGRESS_TOO_MANY');
  const starts = new Set(), ends = new Set();
  for (const n of names) {
    const m = typeof n === 'string' ? NAME_RE.exec(n) : null;
    if (!m) return res('LANE_E_EGRESS_UNKNOWN_FILE');
    (m[2] === 'start' ? starts : ends).add(m[1]);
  }
  if (starts.size > MAX_RECORDS) return res('LANE_E_EGRESS_TOO_MANY');
  for (const s of starts) if (!ends.has(s)) return res('LANE_E_EGRESS_UNMATCHED');
  for (const e of ends) if (!starts.has(e)) return res('LANE_E_EGRESS_UNMATCHED');
  const workers = new Set();
  let refused = 0, tests = 0, forwarded = 0;
  for (const s of [...starts].sort()) {
    const wi = STEM_RE.exec(s)[1];
    if (workers.has(wi)) return res('LANE_E_EGRESS_DUPLICATE');
    workers.add(wi);
    if (read(`${s}.start`) !== START_TEXT) return res('LANE_E_EGRESS_MALFORMED');
    const r = parseEndText(read(`${s}.end`));
    if (!r) return res('LANE_E_EGRESS_MALFORMED');
    if (r.closed !== 1) return res('LANE_E_EGRESS_OPEN');
    refused += r.refused; tests += r.tests; forwarded += r.forwarded;
  }
  if (refused > 0) return res('LANE_E_EGRESS_REFUSED', { workers: workers.size, refused, tests });
  if (tests !== declared) return res('LANE_E_EGRESS_COVERAGE', { workers: workers.size, refused, tests });
  return res('LANE_EGRESS_OK', { workers: workers.size, refused, tests, forwarded });
}
