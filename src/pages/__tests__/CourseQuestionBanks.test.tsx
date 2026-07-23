// ABOUTME: Tests for the CourseQuestionBanks page — loading, loaded bank list,
// ABOUTME: empty list, and course-load-error states.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import CourseQuestionBanks from '../CourseQuestionBanks';
import { useCourseData } from '@/hooks/useCourseData';
import { useQuestionBanks } from '@/hooks/useQuestionBanks';

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

vi.mock('@/components/course/question-banks/QuestionBankManager', () => ({
  QuestionBankManager: () => <div data-testid="question-bank-manager" />,
}));

vi.mock('@/hooks/useCourseData', () => ({
  useCourseData: vi.fn(),
}));

vi.mock('@/hooks/useQuestionBanks', () => ({
  useQuestionBanks: vi.fn(),
}));

const course = {
  id: 'course-1',
  title: 'Intro to Data Analytics',
  description: 'Learn the basics.',
};

const banksHookDefaults = {
  banks: [] as any[],
  isLoading: false,
  error: null,
  createBank: vi.fn(),
  updateBank: vi.fn(),
  deleteBank: vi.fn(),
};

describe('CourseQuestionBanks', () => {
  beforeEach(() => {
    vi.mocked(useQuestionBanks).mockReturnValue({ ...banksHookDefaults } as any);
  });

  it('shows a loading state while the course is loading', () => {
    vi.mocked(useCourseData).mockReturnValue({ course: null, isLoading: true, error: null } as any);

    render(<CourseQuestionBanks />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the question bank list when data loads', () => {
    vi.mocked(useCourseData).mockReturnValue({ course, isLoading: false, error: null } as any);
    vi.mocked(useQuestionBanks).mockReturnValue({
      ...banksHookDefaults,
      banks: [
        { id: 'bank-1', title: 'Midterm Bank', description: 'Week 1-4 questions', is_shared: false },
        { id: 'bank-2', title: 'Final Bank', description: null, is_shared: true },
      ],
    } as any);

    render(<CourseQuestionBanks />);

    expect(screen.getByText('Intro to Data Analytics - Question Banks')).toBeInTheDocument();
    expect(screen.getByText('Midterm Bank')).toBeInTheDocument();
    expect(screen.getByText('Final Bank')).toBeInTheDocument();
  });

  it('shows the empty state when the course has no question banks', () => {
    vi.mocked(useCourseData).mockReturnValue({ course, isLoading: false, error: null } as any);
    vi.mocked(useQuestionBanks).mockReturnValue({ ...banksHookDefaults, banks: [] } as any);

    render(<CourseQuestionBanks />);

    expect(screen.getByText(/No question banks created yet/i)).toBeInTheDocument();
  });

  it('shows "Course not found" when the course fails to load', () => {
    vi.mocked(useCourseData).mockReturnValue({
      course: null,
      isLoading: false,
      error: 'Failed to load course details',
    } as any);

    render(<CourseQuestionBanks />);

    expect(screen.getByText('Course not found')).toBeInTheDocument();
    expect(screen.queryByText(/- Question Banks/)).not.toBeInTheDocument();
  });
});
