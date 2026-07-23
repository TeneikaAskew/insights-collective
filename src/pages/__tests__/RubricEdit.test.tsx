// ABOUTME: Tests for the RubricEdit page — loading, loaded edit form,
// ABOUTME: not-found, and query-error states.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import RubricEdit from '../RubricEdit';
import { useRubric } from '@/hooks/useRubrics';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1', rubricId: 'rubric-1' }),
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

vi.mock('@/components/course/rubrics/RubricBuilder', () => ({
  RubricBuilder: ({ rubricId }: { rubricId: string }) => (
    <div data-testid="rubric-builder">{rubricId}</div>
  ),
}));

vi.mock('@/hooks/useRubrics', () => ({
  useRubrics: vi.fn(),
  useRubric: vi.fn(),
  useAssignmentRubrics: vi.fn(),
}));

const rubricHookDefaults = {
  rubric: undefined,
  isLoading: false,
  error: null,
  createCriteria: vi.fn(),
  updateCriteria: vi.fn(),
  deleteCriteria: vi.fn(),
  reorderCriteria: vi.fn(),
};

describe('RubricEdit', () => {
  it('shows a loading state while the rubric is loading', () => {
    vi.mocked(useRubric).mockReturnValue({ ...rubricHookDefaults, isLoading: true } as any);

    render(<RubricEdit />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the edit form when the rubric loads', () => {
    vi.mocked(useRubric).mockReturnValue({
      ...rubricHookDefaults,
      rubric: { id: 'rubric-1', title: 'Essay Rubric', description: 'Grading guide', criteria: [] },
    } as any);

    render(<RubricEdit />);

    expect(screen.getByText('Edit Rubric')).toBeInTheDocument();
    expect(screen.getByText('Back to Rubrics')).toBeInTheDocument();
    expect(screen.getByTestId('rubric-builder')).toHaveTextContent('rubric-1');
  });

  it('shows "Rubric not found" when no rubric exists for the id', () => {
    vi.mocked(useRubric).mockReturnValue({ ...rubricHookDefaults, rubric: null } as any);

    render(<RubricEdit />);

    expect(screen.getByText('Rubric not found')).toBeInTheDocument();
    expect(screen.queryByTestId('rubric-builder')).not.toBeInTheDocument();
  });

  it('shows "Rubric not found" (not the edit form) when the rubric query errors', () => {
    vi.mocked(useRubric).mockReturnValue({
      ...rubricHookDefaults,
      rubric: undefined,
      error: new Error('boom'),
    } as any);

    render(<RubricEdit />);

    expect(screen.getByText('Rubric not found')).toBeInTheDocument();
    expect(screen.queryByTestId('rubric-builder')).not.toBeInTheDocument();
  });
});
