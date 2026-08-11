// ABOUTME: Hands a generated file to the browser in a way that survives phones
// ABOUTME: and embedded webviews, where a plain programmatic download is
// ABOUTME: discarded silently rather than reported as an error.

export type DeliveryMethod = 'download' | 'new-tab';

/**
 * Is this page running inside an iframe?
 *
 * Cross-origin framing makes `window.top` unreadable, which throws — and a
 * throw here means we are definitely framed. The Lovable preview is the case
 * that matters: an iframe without `allow-downloads` drops a download with no
 * error at all, so the reader taps the button and nothing whatsoever happens.
 */
export const isFramed = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

/**
 * Does this browser honour the `download` attribute?
 *
 * iOS Safari does not, in any version: it navigates to the blob instead of
 * saving it, and inside a webview it frequently does nothing. Feature-detected
 * rather than sniffed for the user agent, except that iOS has to be named —
 * every iOS browser is Safari underneath, so the attribute is present in the
 * DOM and still ignored.
 */
export const supportsDownloadAttribute = (): boolean => {
  if (typeof document === 'undefined') return false;
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return false;
  return 'download' in document.createElement('a');
};

/**
 * Deliver `blob` to the reader, and say which way it went.
 *
 * Where a real download works, that is what happens. Where it would be dropped
 * on the floor — an iframe, or a browser that ignores the download attribute —
 * the file opens in a new tab instead, so the reader still gets it and can save
 * or share it from their own viewer. Returning the method lets the caller tell
 * them which one they got rather than leaving them guessing.
 *
 * The object URL is revoked on a timer, not immediately: revoking it in the
 * same tick cancels the navigation it was just handed to.
 */
export function deliverBlob(blob: Blob, filename: string): DeliveryMethod {
  const url = URL.createObjectURL(blob);

  // Both routes are an anchor click, which matters.
  //
  // The new-tab route was `window.open(url, '_blank', 'noopener,noreferrer')`,
  // and its return value was read to decide whether the popup had been blocked.
  // That check cannot work: per spec `noopener` makes a SUCCESSFUL open return
  // null, precisely so the new context is unreachable. So success and failure
  // looked identical, the code fell through on every success, clicked a second
  // anchor, reported 'download' and swallowed the toast — and on a browser that
  // ignores the download attribute that second anchor could navigate the
  // current page to the blob, replacing the app with a PDF.
  //
  // An anchor carrying target="_blank" rel="noopener noreferrer" gets the same
  // isolation with no handle to misread, and popup blockers treat a real anchor
  // click inside a user gesture more permissively than window.open.
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.style.display = 'none';

  const openInTab = isFramed() || !supportsDownloadAttribute();
  if (openInTab) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  } else {
    anchor.download = filename;
    anchor.rel = 'noopener';
  }

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revoked on a timer, not in this tick: revoking immediately cancels the
  // navigation the URL was just handed to.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return openInTab ? 'new-tab' : 'download';
}
