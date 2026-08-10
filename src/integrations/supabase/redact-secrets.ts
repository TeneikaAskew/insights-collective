// ABOUTME: Strips bearer-like credentials out of URLs and free text before
// ABOUTME: anything writes them to a published diagnostic artifact.
//
// WHY THIS EXISTS
// The e2e console recorder (e2e/fixtures/console-errors.fixture.ts, audit mode)
// logs the URL of every non-2xx response and the text of every console error,
// and CI uploads the result as a build artifact that anyone with repository
// read access can download. Several URLs the app actually requests carry a
// credential in the query string:
//
//   - Supabase signed storage URLs — `?token=<JWT>` — created in
//     CourseMaterials.tsx, useResumeStorage.ts, useFileUpload.ts and
//     storageAssets.ts.
//   - The private calendar feed — `&token=<feed token>` — built and fetched in
//     CourseCalendarSync.tsx, which has an explicit `!response.ok` branch.
//
// A failing request is exactly when the recorder fires, so without this the
// artifact would be most likely to contain a token precisely when one of those
// requests broke.
//
// WHAT IS DELIBERATELY *NOT* STRIPPED
// Query parameters are the diagnostic value of this catalog: a PostgREST URL
// carries the table, the selected columns and the filters, which is how a
// rejected query is identified at all. Dropping the query wholesale would make
// the artifact safe and useless in the same stroke. So parameter NAMES are
// always kept — including the sensitive ones, so a reader can see that a token
// was present — and only their VALUES are replaced.
//
// This lives in src/ rather than beside the fixture for the reason stated in
// console-errors.fixture.ts: logic that decides what gets recorded has to be
// unit-testable, because untestable predicates are how the suppression lists
// drifted into hiding real defects.

/**
 * Query-parameter names whose values are credentials. Matched case-insensitively
 * against the whole name, plus a prefix rule for AWS's signing parameters
 * (`X-Amz-Signature`, `X-Amz-Credential`, `X-Amz-Security-Token`), which Supabase
 * Storage can emit when it proxies to S3-compatible backends.
 */
const SENSITIVE_PARAMS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'apikey',
  'api_key',
  'key',
  'secret',
  'client_secret',
  'password',
  'signature',
  'sig',
  'jwt',
  'auth',
  'authorization',
]);

/**
 * Substrings that make a parameter sensitive whatever it is called, so a name
 * nobody listed — `feed_token`, `calendar-token`, `client_secret` — is still
 * caught. Deliberately excludes a bare `key`: as a substring it would match
 * `keyword`, `key_id` and any PostgREST filter on a column whose name contains
 * it, redacting diagnostics for no safety gain. `key` stays an exact match
 * above instead.
 */
const SENSITIVE_STEMS = [
  'token',
  'secret',
  'password',
  'signature',
  'apikey',
  'api_key',
  'jwt',
];

const REDACTED = '[redacted]';

function isSensitiveParam(name: string): boolean {
  const lower = name.toLowerCase();
  if (SENSITIVE_PARAMS.has(lower)) return true;
  if (lower.startsWith('x-amz-')) return true;
  return SENSITIVE_STEMS.some(stem => lower.includes(stem));
}

/**
 * Any JWT, wherever it appears. Three base64url segments separated by dots,
 * anchored on the `eyJ` that a base64-encoded `{"` always produces.
 *
 * This is the backstop that makes the rest of the file safe to be wrong about.
 * Every Supabase credential — anon key, session token, storage signing token —
 * is a JWT, so this catches carriers nobody thought to enumerate: a token in a
 * path segment, in a POST body echoed into an error message, or in a parameter
 * named something this file has never heard of.
 */
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;

/**
 * `name=value` pairs in prose, for text that embeds a URL rather than being one.
 * Browsers phrase resource failures as "Failed to load resource: <url>", so the
 * credential arrives inside a sentence and never reaches redactUrl().
 */
const INLINE_PARAM_PATTERN =
  /\b(token|access_token|refresh_token|id_token|apikey|api_key|key|secret|client_secret|password|signature|sig|jwt|auth|authorization)=([^&\s"'<>)\]]+)/gi;

/**
 * Replace credential values in a URL, keeping everything else intact.
 *
 * Falls back to a whole-string scrub when the input will not parse — a relative
 * URL, a truncated one, or the empty string the fixture uses for page errors.
 * Failing to parse must never mean failing to redact.
 */
export function redactUrl(raw: string): string {
  if (!raw) return raw;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return redactText(raw);
  }

  let touched = false;
  for (const name of [...parsed.searchParams.keys()]) {
    if (isSensitiveParam(name)) {
      parsed.searchParams.set(name, REDACTED);
      touched = true;
    }
  }

  // A JWT can also sit in the path (some signed-URL schemes put it there), and
  // searchParams round-tripping re-encodes values, so scrub the assembled
  // string too rather than trusting the parameter pass alone.
  const assembled = touched ? parsed.toString() : raw;
  return assembled.replace(JWT_PATTERN, '[redacted-jwt]');
}

/**
 * Replace credential values in free text — console messages, error strings.
 */
export function redactText(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(INLINE_PARAM_PATTERN, (_match, name: string) => `${name}=${REDACTED}`)
    .replace(JWT_PATTERN, '[redacted-jwt]');
}
