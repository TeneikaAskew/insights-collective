// ABOUTME: Reusable breadcrumb for Teachable-style course builder & lesson views.
// ABOUTME: Renders real react-router Links so "Courses" and course title navigate.

import { Link } from 'react-router-dom';

interface TeachableBreadcrumbProps {
  courseId?: string;
  courseTitle: string;
  current?: string;
  className?: string;
}

export function TeachableBreadcrumb({
  courseId,
  courseTitle,
  current,
  className,
}: TeachableBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={
        'text-xs uppercase tracking-widest text-muted-foreground mb-3 ' + (className ?? '')
      }
    >
      <Link
        to="/courses"
        className="underline underline-offset-4 hover:text-foreground transition-colors"
      >
        Courses
      </Link>
      <span className="mx-2 opacity-50">|</span>
      {courseId ? (
        <Link
          to={`/courses/${courseId}`}
          className="underline underline-offset-4 hover:text-foreground transition-colors"
        >
          {courseTitle}
        </Link>
      ) : (
        <span>{courseTitle}</span>
      )}
      {current && (
        <>
          <span className="mx-2 opacity-50">|</span>
          <span aria-current="page">{current}</span>
        </>
      )}
    </nav>
  );
}

export default TeachableBreadcrumb;
