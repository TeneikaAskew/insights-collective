// ABOUTME: Unit tests for the landing page's Featured Courses cards. Pins the
// ABOUTME: omit-rather-than-fabricate rule: the card must not claim "0 lessons"
// ABOUTME: for a course whose modules were never loaded (it always did, because
// ABOUTME: no caller has ever passed modules), and must not render an empty
// ABOUTME: level badge or a bare clock icon for the nullable columns.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FeaturedCourses, { FeaturedCourse } from '../FeaturedCourses';

function renderCards(courses: FeaturedCourse[]) {
  return render(
    <BrowserRouter>
      <FeaturedCourses courses={courses} />
    </BrowserRouter>
  );
}

const course: FeaturedCourse = {
  id: 'course-1',
  title: 'Business Analytics with Python',
  description: 'Learn the fundamentals',
  category: 'Analytics',
};

describe('FeaturedCourses', () => {
  it('renders nothing when there are no courses', () => {
    const { container } = renderCards([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a card linking to the course detail page', () => {
    renderCards([course]);

    expect(screen.getByText('Business Analytics with Python')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Business Analytics with Python/ })).toHaveAttribute(
      'href',
      '/courses/course-1'
    );
  });

  it('omits the lesson count when modules were not loaded', () => {
    renderCards([course]);
    expect(screen.queryByText(/lessons/)).not.toBeInTheDocument();
  });

  // `modules` are modules (Courses -> Modules -> Lessons), so the count is labelled as modules.
  // The old assertion pinned "3 lessons" for three modules, which no lesson data backs.
  it('labels a loaded module count as modules, never as lessons', () => {
    renderCards([{ ...course, modules: [{}, {}, {}] }]);
    expect(screen.getByText('3 modules')).toBeInTheDocument();
    expect(screen.queryByText(/lessons?/)).not.toBeInTheDocument();
  });

  it('uses the singular for one module', () => {
    renderCards([{ ...course, modules: [{}] }]);
    expect(screen.getByText('1 module')).toBeInTheDocument();
  });

  it('shows the estimate from estimated_hours without a trailing .0', () => {
    renderCards([{ ...course, estimated_hours: 4 }]);
    expect(screen.getByText(/^4 hours$/)).toBeInTheDocument();
    expect(screen.queryByText(/4\.0 hours/)).not.toBeInTheDocument();
  });

  it('labels the estimate "Estimated time" for screen readers (accessibility)', () => {
    renderCards([{ ...course, estimated_hours: 4 }]);
    expect(screen.getByText('Estimated time:')).toHaveClass('sr-only');
  });

  it.each([0, null, Number.NaN])('shows no time badge and no stray number for estimated_hours=%s', (h) => {
    const { container } = renderCards([{ ...course, estimated_hours: h as any }]);
    expect(screen.queryByText(/hours?$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Estimated time:')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b0\b/);
  });

  it('omits the level badge when the course does not carry one', () => {
    renderCards([course]);
    expect(screen.queryByText('Beginner')).not.toBeInTheDocument();
  });

  it('renders the level badge when present', () => {
    renderCards([{ ...course, level: 'Beginner' }]);
    expect(screen.getByText('Beginner')).toBeInTheDocument();
  });

  // The local label map had gone stale against the live catalog: it mapped
  // 'Data Science' to "Data Engineering" outright, and defaulted everything it
  // didn't recognize — which is every category the catalog actually uses — to
  // "Data Engineering" too. Both cases relabelled real courses.
  it.each(['Analytics & BI', 'Data Science', 'ML/AI', 'Data Engineering'])(
    'shows %s as itself rather than relabelling it',
    category => {
      renderCards([{ ...course, category }]);
      expect(screen.getByText(category)).toBeInTheDocument();
    }
  );

  it('renders the estimated hours badge only when the value is set', () => {
    const { rerender } = renderCards([course]);
    expect(screen.queryByText(/hours/)).not.toBeInTheDocument();

    rerender(
      <BrowserRouter>
        <FeaturedCourses courses={[{ ...course, estimated_hours: 12.5 }]} />
      </BrowserRouter>
    );
    expect(screen.getByText('12.5 hours')).toBeInTheDocument();
  });
});
