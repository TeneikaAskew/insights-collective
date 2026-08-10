// ABOUTME: The standard title block for a tool page — title, optional subtitle, optional
// ABOUTME: actions on the right. Not for hero pages, which keep their display serif.
//
// THERE ARE TWO HEADING CONVENTIONS IN THIS APP, ON PURPOSE
//
// 1. HERO pages — CourseList, CourseDetail, ExploreDataCareers — open with a large
//    display-serif title over a wash. They are the front doors of a section and are
//    meant to feel like arrivals. They do NOT use this component.
//
// 2. TOOL pages — Dashboard, Messages, Resources, the admin screens — open with a plain
//    `text-3xl font-bold tracking-tight` title and a muted one-line subtitle. That is
//    what this component is, taken from Dashboard.tsx, which is the version most other
//    pages were already approximating.
//
// Writing the convention down is most of the point. The audit found three heading
// systems and a tail of one-off deviants — `text-2xl` here, no `tracking-tight` there, a
// subtitle rendered as a sibling `<p>` in a different color — none of which were
// decisions, just drift. A component means the next page inherits the answer instead of
// picking one.
//
// It renders a real `<h1>`. Several tool pages had no h1 at all, which is a landmark
// problem for screen readers before it is a visual one: "navigate to the main heading"
// had nowhere to go.

import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** One line. If it needs two, it is body copy and belongs under the header. */
  subtitle?: ReactNode;
  /** Buttons, usually. Right-aligned on desktop, stacked underneath on mobile. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}
    >
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export default PageHeader;
