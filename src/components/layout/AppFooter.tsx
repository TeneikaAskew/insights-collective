// ABOUTME: The signed-in app's footer. One copyright line, one place.
// ABOUTME: Used by AppLayout, CourseLayout, and the bare public pages that have no shell.
//
// WHY THIS IS A COMPONENT AND NOT THREE COPIES
//
// It was one copy in AppLayout and one in the marketing Footer, and the 36 routes
// rendered by CourseLayout had none at all — so a third of the signed-in app simply
// ended without a footer, which reads as a page that failed to finish rather than as
// a deliberately different layout. Courses keep their distinct sidebar and menu; that
// is a signed-off difference. Ending mid-air is not.
//
// The year is computed per render rather than at module load. That is not pedantry:
// the module is evaluated once when the chunk loads, so a session left open across
// New Year would show the old year until a hard reload, and a prerendered or
// long-lived tab would be wrong for longer.

export const COPYRIGHT_HOLDER = 'Insights Collective';

/**
 * The copyright line, shared so the signed-in footer and the marketing footer cannot
 * drift into disagreeing about the year or the holder.
 */
export function copyrightLine(): string {
  return `© ${new Date().getFullYear()} ${COPYRIGHT_HOLDER}. All rights reserved.`;
}

interface AppFooterProps {
  /**
   * Extra classes for surfaces whose spacing differs — CourseLayout sits inside a
   * scroll container of its own, so it needs no top border doubling up on one.
   */
  className?: string;
}

export function AppFooter({ className = '' }: AppFooterProps) {
  return (
    <footer
      className={`p-4 w-full border-t text-center text-sm text-muted-foreground ${className}`.trim()}
    >
      {copyrightLine()}
    </footer>
  );
}

export default AppFooter;
