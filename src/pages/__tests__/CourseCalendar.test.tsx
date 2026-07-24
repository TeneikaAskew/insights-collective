// ABOUTME: Tests for the CourseCalendar page — loading, loaded events, empty
// ABOUTME: calendar, and the regression that a failed load shows an error, not an empty calendar.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import CourseCalendar from '../CourseCalendar';
import { useCourseCalendar } from '@/hooks/useCourseCalendar';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1' }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: vi.fn(),
}));

vi.mock('@/hooks/useCourseCalendar', () => ({
  useCourseCalendar: vi.fn(),
  useCalendarEventMutations: vi.fn(() => ({
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  })),
}));

describe('CourseCalendar', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: false,
      isInstructor: false,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);
  });

  it('shows a loading skeleton while events are loading', () => {
    vi.mocked(useCourseCalendar).mockReturnValue({
      events: undefined,
      isLoading: true,
      error: null,
    } as any);

    const { container } = render(<CourseCalendar />);

    expect(screen.queryByText('Course Calendar')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders loaded events in the upcoming list', () => {
    vi.mocked(useCourseCalendar).mockReturnValue({
      events: [
        {
          id: 'event-1',
          type: 'event',
          title: 'Live Q&A Session',
          description: 'Bring your questions',
          start_date: '2027-01-15T10:00:00Z',
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    render(<CourseCalendar />);

    expect(screen.getByText('Course Calendar')).toBeInTheDocument();
    expect(screen.getByText('Live Q&A Session')).toBeInTheDocument();
    expect(screen.queryByText('No upcoming events')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no events', () => {
    vi.mocked(useCourseCalendar).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
    } as any);

    render(<CourseCalendar />);

    expect(screen.getByText('Course Calendar')).toBeInTheDocument();
    expect(screen.getByText('No upcoming events')).toBeInTheDocument();
  });

  // REGRESSION: assignment/quiz events used to deep-link to
  // `/courses/:id/assignments/:relatedId` and `/courses/:id/quizzes/:relatedId`
  // — neither route is registered, so every click 404'd. Event clicks must
  // target routes that actually exist.
  it('navigates assignment events to the real assignments route', () => {
    vi.mocked(useCourseCalendar).mockReturnValue({
      events: [
        {
          id: 'assignment-due-a1',
          type: 'assignment',
          title: 'Essay 1 - Due',
          start_date: '2027-01-15T10:00:00Z',
          related_id: 'a1',
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    render(<CourseCalendar />);

    fireEvent.click(screen.getByText('Essay 1 - Due'));

    expect(navigateMock).toHaveBeenCalledWith('/courses/course-1/assignments');
    // Never the dead per-assignment deep link.
    expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('/assignments/a1'));
  });

  it('navigates quiz events to the real modules route', () => {
    vi.mocked(useCourseCalendar).mockReturnValue({
      events: [
        {
          id: 'quiz-due-q1',
          type: 'quiz',
          title: 'Week 1 Quiz - Due',
          start_date: '2027-01-20T10:00:00Z',
          related_id: 'q1',
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    render(<CourseCalendar />);

    fireEvent.click(screen.getByText('Week 1 Quiz - Due'));

    expect(navigateMock).toHaveBeenCalledWith('/courses/course-1/modules');
    expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('/quizzes/'));
  });

  // REGRESSION: courseCalendarService throws on any source failure. The page
  // must surface that as a visible error — never render an empty calendar that
  // is indistinguishable from "no events".
  it('shows an error state (not an empty calendar) when the calendar load fails', () => {
    vi.mocked(useCourseCalendar).mockReturnValue({
      events: undefined,
      isLoading: false,
      error: new Error('Failed to fetch course assignments: connection refused'),
    } as any);

    render(<CourseCalendar />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to load calendar');
    expect(alert).toHaveTextContent('Failed to fetch course assignments: connection refused');
    // The regular calendar UI must not render as if the course simply had no events
    expect(screen.queryByText('No upcoming events')).not.toBeInTheDocument();
    expect(screen.queryByText('Calendar View')).not.toBeInTheDocument();
  });
});
