// ABOUTME: Tests for the AssignmentDetail page — loading, loaded assignment,
// ABOUTME: not-found, query-error, and logged-out states.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import AssignmentDetail from '../AssignmentDetail';
import { useAssignment, useSubmission, useSubmitAssignment } from '@/hooks/useAssignments';
import { useAuth } from '@/contexts/AuthContext';
import { makeSubmission } from '@/test/utils/course-fixtures';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1', moduleId: 'module-1', assignmentId: 'assignment-1' }),
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

vi.mock('@/components/course/assignments/AssignmentSubmission', () => ({
  AssignmentSubmissionComponent: ({ assignment, submission }: any) => (
    <div data-testid="assignment-submission">
      <span>{assignment.title}</span>
      {submission && <span data-testid="existing-submission">{submission.id}</span>}
    </div>
  ),
}));

vi.mock('@/hooks/useAssignments', () => ({
  useAssignment: vi.fn(),
  useSubmission: vi.fn(),
  useSubmitAssignment: vi.fn(),
}));

const assignment = {
  id: 'assignment-1',
  title: 'Essay 1: Data Cleaning',
  description: 'Clean the dataset',
  points_possible: 100,
};

const authedUser = { id: 'user-1', email: 'student@example.com' };

function setAuthUser(user: any) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    session: user ? { user } : null,
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    googleSignIn: vi.fn(),
    githubSignIn: vi.fn(),
    twitterSignIn: vi.fn(),
    isAuthenticated: !!user,
    isAdmin: false,
    isAdminAuthenticated: false,
    storeRedirectPath: vi.fn(),
    handleRedirectAfterLogin: vi.fn(),
  } as any);
}

describe('AssignmentDetail', () => {
  beforeEach(() => {
    setAuthUser(authedUser);
    vi.mocked(useSubmission).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useSubmitAssignment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);
  });

  it('shows loading skeletons while the assignment loads', () => {
    vi.mocked(useAssignment).mockReturnValue({ data: undefined, isLoading: true } as any);

    const { container } = render(<AssignmentDetail />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('Assignment Not Found')).not.toBeInTheDocument();
  });

  it('renders the assignment and existing submission on success', () => {
    vi.mocked(useAssignment).mockReturnValue({ data: assignment, isLoading: false } as any);
    const submission = makeSubmission({ id: 'submission-9' });
    vi.mocked(useSubmission).mockReturnValue({ data: submission, isLoading: false } as any);

    render(<AssignmentDetail />);

    expect(screen.getByTestId('assignment-submission')).toBeInTheDocument();
    expect(screen.getByText('Essay 1: Data Cleaning')).toBeInTheDocument();
    expect(screen.getByTestId('existing-submission')).toHaveTextContent('submission-9');
    expect(screen.getByText('Back to Module')).toBeInTheDocument();
  });

  it('shows the not-found state when the assignment does not exist', () => {
    vi.mocked(useAssignment).mockReturnValue({ data: null, isLoading: false } as any);

    render(<AssignmentDetail />);

    expect(screen.getByText('Assignment Not Found')).toBeInTheDocument();
    expect(
      screen.getByText(/The assignment you're looking for doesn't exist or has been removed/i),
    ).toBeInTheDocument();
  });

  it('falls back to the not-found copy when the assignment query errors', () => {
    vi.mocked(useAssignment).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
    } as any);

    render(<AssignmentDetail />);

    // The page treats a failed load the same as a missing assignment
    expect(screen.getByText('Assignment Not Found')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-submission')).not.toBeInTheDocument();
  });

  it('asks the visitor to log in when there is no user', () => {
    setAuthUser(null);
    vi.mocked(useAssignment).mockReturnValue({ data: assignment, isLoading: false } as any);

    render(<AssignmentDetail />);

    expect(screen.getByText(/Please log in to view and submit assignments/i)).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-submission')).not.toBeInTheDocument();
  });
});
