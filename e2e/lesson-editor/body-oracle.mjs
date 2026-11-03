// ABOUTME: Exact lesson-body oracle for the lesson-editor spec: one normalized-text rule for the returned row, the DB row and the
// ABOUTME: reloaded TipTap surface, compared with a body the test computes independently from the fixture (never read back).
//
// Why exact: a "contains the appended text" check passes when the seeded text is lost (Body A dropped, only " E1 body" kept).
// Normalization (deliberately small, applied identically to all three sources):
//   HTML -> text (one-pass tokenizer, see htmlText): every tag is removed and block/line boundaries (</p>, </h1-6>, </li>,
//   </blockquote>, </pre>, </div>, <br>) become one space;
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

const BOUNDARY = new Set(['/p', '/h1', '/h2', '/h3', '/h4', '/h5', '/h6', '/li', '/blockquote', '/pre', '/div', 'br', 'br/']);

/**
 * Text content of stored/returned lesson HTML under the rule above. One left-to-right pass of a small tokenizer, not a regex
 * strip: outside a tag every character is text; `<` opens a tag that ends at the first `>` outside a quoted attribute value.
 * A tag's characters are never re-scanned, so a nested or split opener (`<<p>p>`, `<scr<b>ipt>`) cannot reassemble into
 * a tag, and its leftover characters stay visible text (which then fails the exact comparison). An unterminated tag
 * contributes nothing and marks the input malformed, so the verdict is refused. This is a test oracle, not a sanitizer.
 */
export function htmlText(html) {
  if (typeof html !== 'string') throw new TypeError('body oracle: html must be a string');
  let out = '', tag = '', inTag = false, quote = '';
  for (const ch of html) {
    if (!inTag) {
      if (ch === '<') { inTag = true; tag = ''; } else out += ch;
      continue;
    }
    if (quote) { if (ch === quote) quote = ''; tag += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; tag += ch; continue; }
    if (ch === '>') {
      inTag = false;
      const name = (tag.trim().match(/^\/?[A-Za-z][A-Za-z0-9]*\/?/) ?? [''])[0].toLowerCase();
      if (BOUNDARY.has(name)) out += ' ';
      continue;
    }
    tag += ch;
  }
  if (inTag) return '\u0000malformed';
  return normText(out.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m]));
}

/**
 * The E1 verdict for one source. Returns { ok, got } with `got` the normalized text (fixture text only, never user data).
 * kind: 'html' for the returned row and DB row content, 'text' for the reloaded editor's innerText.
 */
export function e1Body(kind, value) {
  const got = kind === 'html' ? htmlText(value) : kind === 'text' ? normText(value) : (() => { throw new TypeError('body oracle: kind'); })();
  return { ok: got === E1_EXPECTED_TEXT, got };
}
