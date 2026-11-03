// ABOUTME: Exact lesson-body oracle for the lesson-editor spec: one normalized-text rule for the returned row, the DB row and the
// ABOUTME: reloaded TipTap surface, compared with a body the test computes independently from the fixture (never read back).
//
// Why exact: a "contains the appended text" check passes when the seeded text is lost (Body A dropped, only " E1 body" kept).
// Normalization (deliberately small, applied identically to all three sources):
//   HTML -> text: every tag is removed and block/line boundaries (</p>, </h1-6>, </li>, </blockquote>, <br>) become one space;
//   the six entities TipTap emits (&amp; &lt; &gt; &quot; &#39; &nbsp;) are decoded; NBSP and every whitespace run become one
//   space; leading and trailing space is trimmed. Plain text (innerText) gets the same whitespace rule.
// Not claimed: markup identity (marks, paragraph count) beyond what the text shows. The HTML of the returned row and the DB row
// is compared byte-for-byte by the spec separately.

/** The fixture's seeded body for lesson A (fixture.sql) and its exact HTML, pinned so a changed fixture fails loudly. */
export const SEEDED_A_HTML = '<p>Body A</p>';
export const SEEDED_A_TEXT = 'Body A';
/** What E1 types at the end of the body (keyboard End, then this text). */
export const E1_APPEND = ' E1 body';
/** The independently expected full body after E1: seeded text followed by the appended text. */
export const E1_EXPECTED_TEXT = normText(SEEDED_A_TEXT + E1_APPEND);

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** Whitespace rule shared by every source: NBSP and any run of whitespace -> one space, trimmed. */
export function normText(s) {
  if (typeof s !== 'string') throw new TypeError('body oracle: text must be a string');
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** Text content of stored/returned lesson HTML under the rule above. */
export function htmlText(html) {
  if (typeof html !== 'string') throw new TypeError('body oracle: html must be a string');
  const spaced = html.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>/gi, ' ');
  const stripped = spaced.replace(/<[^>]*>/g, '');
  return normText(stripped.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m]));
}

/**
 * The E1 verdict for one source. Returns { ok, got } with `got` the normalized text (fixture text only, never user data).
 * kind: 'html' for the returned row and DB row content, 'text' for the reloaded editor's innerText.
 */
export function e1Body(kind, value) {
  const got = kind === 'html' ? htmlText(value) : kind === 'text' ? normText(value) : (() => { throw new TypeError('body oracle: kind'); })();
  return { ok: got === E1_EXPECTED_TEXT, got };
}
