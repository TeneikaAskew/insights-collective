import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FeaturedCourses from '../FeaturedCourses';

const course = {
  id: 'c1',
  title: 'SQL for Data Analysis',
  description: 'Master SQL queries for retrieving and manipulating data.',
  category: 'Analytics',
  thumbnail: 'https://example.test/a.png',
  rating: 4.5,
  instructor: { id: 'u1', name: 'Ada Lovelace', email: '', role: 'instructor', avatar: '' },
} as any;

const renderWith = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('FeaturedCourses', () => {
  it('renders a card per course', () => {
    renderWith(<FeaturedCourses courses={[course]} />);
    expect(screen.getByText('SQL for Data Analysis')).toBeInTheDocument();
    expect(screen.queryByText(/New courses are on the way/i)).not.toBeInTheDocument();
  });

  it('shows an empty state instead of a bare heading when there are no courses', () => {
    // The previous build rendered the heading above a permanently blank grid.
    renderWith(<FeaturedCourses courses={[]} />);
    expect(screen.getByText(/New courses are on the way/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse all courses/i })).toBeInTheDocument();
  });

  it('shows skeletons while loading, not the empty state', () => {
    renderWith(<FeaturedCourses courses={[]} isLoading />);
    expect(screen.queryByText(/New courses are on the way/i)).not.toBeInTheDocument();
    expect(screen.getByText('Featured Courses')).toBeInTheDocument();
  });
});
