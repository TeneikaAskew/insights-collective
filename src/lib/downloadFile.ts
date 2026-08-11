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
  const revoke = () => window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

  if (isFramed() || !supportsDownloadAttribute()) {
    // `noopener` matters: without it the opened tab gets a handle on this one.
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    revoke();
    if (opened) return 'new-tab';
    // Popup blocked. Fall through and try the download anyway — it is the only
    // remaining option, and on some webviews it does work.
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  revoke();
  return 'download';
}
