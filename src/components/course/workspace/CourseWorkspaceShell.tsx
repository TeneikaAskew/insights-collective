// ABOUTME: Shared visual shell for the student learn player + instructor builder.
// ABOUTME: Renders the Teachable-inspired sidebar + top bar + main + floating footer layout.

import type { ReactNode } from 'react';

interface CourseWorkspaceShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function CourseWorkspaceShell({
  sidebar,
  header,
  children,
  footer,
}: CourseWorkspaceShellProps) {
  return (
    <div className="fixed inset-0 flex font-sans bg-background text-foreground">
      {/* Left curriculum rail */}
      <aside className="w-80 flex-shrink-0 flex flex-col bg-card border-r border-border">
        {sidebar}
      </aside>

      {/* Main workspace column */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 bg-card px-6 md:px-8 flex items-center justify-between sticky top-0 z-10 border-b border-border">
          {header}
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="sticky bottom-0 left-0 right-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto">{footer}</div>
          </div>
        )}
      </main>
    </div>
  );
}

export default CourseWorkspaceShell;
