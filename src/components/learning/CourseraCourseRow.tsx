// ABOUTME: The shared course row for every recommendation surface — role detail,
// ABOUTME: skill-gap chart, pathway report, quiz results. Ledger-row treatment:
// ABOUTME: linked title (external mark for Coursera), quiet provider meta, an
// ABOUTME: outlined level chip and a star rating. Platform courses use the same
// ABOUTME: row with an internal link and no rating.

import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS } from '@/data/learningSubjects';
import type { ResolvedCourse } from '@/lib/roleCourseResolver';

export interface CourseraCourseRowProps {
  /** Skill surfaces pass a SkillCourse, which adds `format`; role surfaces pass a plain ResolvedCourse. */
  course: ResolvedCourse & { format?: string };
  /** 'row' is the full ledger row; 'compact' is a one-line row for tight spots (report meters). */
  variant?: 'row' | 'compact';
  showDescription?: boolean;
  showSubjects?: boolean;
}

function Rating({ rating, reviews }: { rating: number | null; reviews: number | null }) {
  if (rating === null || rating === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <Star className="h-3 w-3 fill-ss-peach-deep text-ss-peach-deep" aria-hidden="true" />
      <span className="tabular-nums">
        {rating.toFixed(1)}
        {reviews ? ` (${reviews.toLocaleString()})` : ''}
      </span>
    </span>
  );
}

export const CourseraCourseRow: React.FC<CourseraCourseRowProps> = ({
  course,
  variant = 'row',
  showDescription = false,
  showSubjects = false,
}) => {
  const meta = [course.provider, course.format].filter(Boolean).join(' · ');

  const body =
    variant === 'compact' ? (
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-primary">
          {course.title}
          {course.external && (
            <ExternalLink className="ml-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
          )}
        </span>
        <span className="truncate text-xs text-muted-foreground">{course.provider}</span>
        <span className="ml-auto shrink-0">
          <Rating rating={course.rating} reviews={null} />
        </span>
      </div>
    ) : (
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-medium text-primary">
            {course.title}
            {course.external && (
              <ExternalLink className="ml-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
            )}
          </span>
          <div className="text-xs text-muted-foreground">{meta}</div>
          {showDescription && course.description && (
            <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
          )}
          {showSubjects && course.matchedSubjects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {course.matchedSubjects.slice(0, 3).map((subject) => (
                <Badge key={subject} variant="outline">
                  {SUBJECT_LABELS[subject]}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          {course.level && <Badge variant="outline">{course.level}</Badge>}
          <Rating rating={course.rating} reviews={course.reviews} />
        </div>
      </div>
    );

  const className =
    variant === 'compact'
      ? 'block rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-accent/50'
      : 'block rounded-2xl border bg-card p-3 transition-colors hover:bg-accent/50';

  if (course.external) {
    return (
      <a href={course.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link to={course.href} className={className}>
      {body}
    </Link>
  );
};
