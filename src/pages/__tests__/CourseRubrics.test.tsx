// ABOUTME: Tests for the CourseRubrics page — loading, loaded rubric list,
// ABOUTME: empty list, and course-load-error states.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import CourseRubrics from '../CourseRubrics';
import { useCourseData } from '@/hooks/useCourseData';
import { useRubrics } from '@/hooks/useRubrics';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1' }),
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

vi.mock('@/hooks/useCourseData', () => ({
  useCourseData: vi.fn(),
}));

vi.mock('@/hooks/useRubrics', () => ({
  useRubrics: vi.fn(),
  useRubric: vi.fn(),
  useAssignmentRubrics: vi.fn(),
}));

const course = {
  id: 'course-1',
  title: 'Intro to Data Analytics',
  description: 'Learn the basics.',
};

const rubricsHookDefaults = {
  rubrics: [] as any[],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  createRubric: vi.fn(),
  updateRubric: vi.fn(),
  deleteRubric: vi.fn(),
};

describe('CourseRubrics', () => {
  beforeEach(() => {
    vi.mocked(useRubrics).mockReturnValue({ ...rubricsHookDefaults } as any);
  });

  it('shows a loading state while the course is loading', () => {
    vi.mocked(useCourseData).mockReturnValue({ course: null, isLoading: true, error: null } as any);

    render(<CourseRubrics />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the rubric list when course and rubrics load', () => {
    vi.mocked(useCourseData).mockReturnValue({ course, isLoading: false, error: null } as any);
    vi.mocked(useRubrics).mockReturnValue({
      ...rubricsHookDefaults,
      rubrics: [
        { id: 'rubric-1', title: 'Essay Rubric', description: 'Grading guide', criteria: [] },
        { id: 'rubric-2', title: 'Project Rubric', description: null, criteria: [] },
      ],
    } as any);

    render(<CourseRubrics />);

    expect(screen.getByText('Intro to Data Analytics - Rubrics')).toBeInTheDocument();
    expect(screen.getByText('Essay Rubric')).toBeInTheDocument();
    expect(screen.getByText('Project Rubric')).toBeInTheDocument();
    expect(screen.getByText('Grading guide')).toBeInTheDocument();
  });

  it('shows the empty state when the course has no rubrics', () => {
    vi.mocked(useCourseData).mockReturnValue({ course, isLoading: false, error: null } as any);
    vi.mocked(useRubrics).mockReturnValue({ ...rubricsHookDefaults, rubrics: [] } as any);

    render(<CourseRubrics />);

    expect(screen.getByText(/No rubrics created yet/i)).toBeInTheDocument();
  });

  it('shows "Course not found" only when the course is genuinely missing (no error)', () => {
    vi.mocked(useCourseData).mockReturnValue({
      course: null,
      isLoading: false,
      error: null,
    } as any);

    render(<CourseRubrics />);

    expect(screen.getByText('Course not found')).toBeInTheDocument();
    expect(screen.queryByText(/- Rubrics/)).not.toBeInTheDocument();
  });

  it('REGRESSION: a course fetch error shows the error state, not "Course not found"', () => {
    vi.mocked(useCourseData).mockReturnValue({
      course: null,
      isLoading: false,
      error: 'Failed to load course details',
    } as any);

    render(<CourseRubrics />);

    expect(screen.getByText('Failed to load course')).toBeInTheDocument();
    expect(screen.getByText('Failed to load course details')).toBeInTheDocument();
    expect(screen.queryByText('Course not found')).not.toBeInTheDocument();
    expect(screen.queryByText(/- Rubrics/)).not.toBeInTheDocument();
  });

  it('REGRESSION: a rubrics query error shows an error + retry, not the empty state', () => {
    vi.mocked(useCourseData).mockReturnValue({ course, isLoading: false, error: null } as any);
    const refetch = vi.fn();
    vi.mocked(useRubrics).mockReturnValue({
      ...rubricsHookDefaults,
      rubrics: undefined,
      error: new Error('rubrics fetch failed'),
      refetch,
    } as any);

    render(<CourseRubrics />);

    expect(screen.getByText('Failed to load rubrics')).toBeInTheDocument();
    expect(screen.getByText('rubrics fetch failed')).toBeInTheDocument();
    expect(screen.queryByText(/No rubrics created yet/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
