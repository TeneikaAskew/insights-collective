// ABOUTME: Extract readable plain text from stored HTML, for previews and
// ABOUTME: "is there any content?" checks. Parses; never pattern-matches tags.

/**
 * Why this exists
 * ---------------
 * Five call sites turned module descriptions and lesson content into preview
 * text with `.replace(/<[^>]+>/g, '')` — the pattern CodeQL flags as
 * js/incomplete-multi-character-sanitization. As *sanitisation* it is
 * bypassable; as *text extraction* it is simply wrong (attribute values with
 * `>` truncate tags, entities render as `&amp;`). React escapes the output at
 * every one of these sites, so the practical failure was mangled previews
 * rather than injection — but the fix for both is the same: parse, don't
 * pattern-match.
 *
 * DOMParser and not `div.innerHTML`: an innerHTML assignment — even on a
 * detached element — starts image loads in real browsers, so
 * `<img src=x onerror=…>` fires while you are "just extracting text". A
 * DOMParser document has no browsing context; scripts do not run and
 * subresources do not load. (CurriculumView's local helper used innerHTML and
 * is replaced by this.)
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  // Non-DOM fallback (SSR, plain-node tooling): strip anything tag-shaped to
  // a fixed point, then neutralise any residual unclosed `<` fragment. Kept
  // sound rather than pretty — browsers with DOMParser never reach it.
  let out = html;
  for (let pass = 0; pass < 10; pass++) {
    const before = out;
    out = out.replace(/<[^>]*>/g, '');
    if (out === before) break;
  }
  return out.replace(/<[^>]*$/g, '').replace(/\s+/g, ' ').trim();
}
