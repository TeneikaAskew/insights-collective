// ABOUTME: Read/write the collapsed-or-open state of a sidebar, persisted in a cookie.
// ABOUTME: Shared by AppLayout and CourseLayout, which each keep their own cookie name.
//
// These were two byte-identical copies, one per layout. That is the cheapest kind of
// duplication to leave alone and the easiest to get wrong later: the max-age, the path
// and the `=== 'true'` parse have to agree between them or a sidebar remembers its state
// on one surface and forgets it on the other, which reads as a flaky UI rather than as a
// bug anyone would file.
//
// The cookie NAME stays with each layout. They are deliberately separate keys — the
// course sidebar and the app sidebar have different defaults (courses open on the course
// home, the app starts collapsed) and must not overwrite each other.

/** A week. Long enough to feel remembered, short enough to expire on a shared machine. */
const SIDEBAR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Both helpers no-op when `document` is absent rather than throwing, so a layout can be
 * rendered outside a browser — jsdom without cookie support, or any server-side pass —
 * and simply gets the fallback.
 */
export function readSidebarCookie(cookieName: string, fallback: boolean): boolean {
  if (typeof document === 'undefined') return fallback;

  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${cookieName}=`));

  if (!match) return fallback;

  return match.split('=')[1] === 'true';
}

export function writeSidebarCookie(cookieName: string, value: boolean): void {
  if (typeof document === 'undefined') return;

  document.cookie = `${cookieName}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE_SECONDS}`;
}
