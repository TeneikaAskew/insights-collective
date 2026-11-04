// ABOUTME: Common CourseCard (dashboard) shows Estimated time from estimated_hours and never the unitless legacy duration.
// ABOUTME: Display and accessibility are separate tests so an old-source control fails on behaviour, not on a new label.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import CourseCard from '@/components/common/CourseCard';
import { makeCourse } from '@/test/utils/course-fixtures';

const card = (extra: Record<string, unknown>) =>
  render(<CourseCard course={makeCourse({ id: 'c1', title: 'Card Course', category: 'Data Science', level: 'Beginner', ...extra }) as any} />);

describe('CourseCard estimated time (display)', () => {
  it('shows a whole-hour estimate without a trailing .0', () => {
    card({ estimated_hours: 4 });
    expect(screen.getByText(/^4 hours$/)).toBeInTheDocument();
    expect(screen.queryByText(/4\.0 hours/)).not.toBeInTheDocument();
  });

  it('rounds to 0.1 h and singularises one hour', () => {
    card({ estimated_hours: 1.04 });
    expect(screen.getByText(/^1 hour$/)).toBeInTheDocument();
  });

  it('keeps the camelCase estimatedHours fallback', () => {
    card({ estimated_hours: null, estimatedHours: 2.5 });
    expect(screen.getByText(/^2\.5 hours$/)).toBeInTheDocument();
  });

  it.each([null, 0])('estimated_hours=%s shows no time badge', (h) => {
    card({ estimated_hours: h });
    expect(screen.queryByText(/hours?$/)).not.toBeInTheDocument();
  });
});

describe('CourseCard legacy duration is not presented', () => {
  it.each([8, 1, '8', '6 weeks'])('duration=%j is not shown, and never as lessons', (d) => {
    card({ duration: d, estimated_hours: null });
    expect(screen.queryByText(/lessons?/)).not.toBeInTheDocument();
    expect(screen.queryByText(String(d))).not.toBeInTheDocument();
  });

  it('still shows the level when there is no difficulty', () => {
    card({ duration: 8 });
    expect(screen.getByText('Beginner')).toBeInTheDocument();
  });
});

describe('CourseCard estimated time (accessibility)', () => {
  it('labels the estimate for screen readers', () => {
    card({ estimated_hours: 4 });
    expect(screen.getByText('Estimated time:')).toHaveClass('sr-only');
  });
});
