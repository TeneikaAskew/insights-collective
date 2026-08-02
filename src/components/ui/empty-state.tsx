// ABOUTME: The standard "there is nothing here yet" block — icon, line, optional action.
// ABOUTME: For genuine emptiness only. A failed load is an error state, not an empty one.
//
// THE DISTINCTION THIS COMPONENT EXISTS TO PROTECT
//
// An empty state asserts something: we asked, and there is nothing. Roughly a dozen
// hand-rolled versions of this block existed, and the reason it is worth having one is
// not that they looked slightly different — it is that several of them were rendered on
// the failure path too, so an outage was presented to the user as "no results". That is
// the defect class the whole silent-failure audit was about, and it hides inside a
// component this bland.
//
// So: if the read failed, render an error with a retry, not this. `describedBy` is here
// to make the honest version easy — an empty state that knows WHY it is empty ("no
// quizzes in this course yet" beats "nothing here") is usually the one worth writing.

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /** A lucide icon component, not an element — this sizes it consistently. */
  icon?: LucideIcon;
  title: string;
  /** Why it is empty, and what would fill it. */
  description?: ReactNode;
  /** Usually the button that creates the first one. */
  action?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
  'data-testid': testId,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className}`.trim()}
    >
      {Icon ? <Icon className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" /> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-prose">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
