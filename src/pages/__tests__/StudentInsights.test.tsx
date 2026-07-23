// ABOUTME: Tests for the StudentInsights page rendering the (fixed) StudentInsightsDashboard —
// ABOUTME: loading/success/error states, honest empty tab copy, no fabricated time-spent
// ABOUTME: metric, and no zeroed video stats when the analytics backend fails.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentInsights from '@/pages/StudentInsights';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { makeCourse, makeProfile } from '@/test/utils/course-fixtures';

const COURSE_ID = 'course-1';
const STUDENT_ID = 'student-1';

const { mockNavigate, mockGetStudentVideoSummary } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetStudentVideoSummary: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    // No studentId param → the page shows the signed-in student's own data.
    useParams: () => ({ courseId: COURSE_ID }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

vi.mock('@/services/videoAnalyticsService', () => ({
  default: { getStudentVideoSummary: mockGetStudentVideoSummary },
}));

// Route each supabase table to its own stub so individual queries can be
// shaped (or failed) independently of one another.
type StubResponse = { row?: unknown; rows?: unknown[]; error?: unknown; count?: number };

function tableStub({ row = null, rows = [], error = null, count }: StubResponse) {
  const b: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte']) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => ({ data: error ? null : row, error }));
  b.single = vi.fn(async () => ({ data: error ? null : row, error }));
  b.then = (resolve: (v: unknown) => void) =>
    resolve({ data: error ? null : rows, error, count: count ?? rows.length });
  return b;
}

const dbError = { message: 'connection refused', code: 'PGRST000', details: '', hint: '' };

let tables: Record<string, any>;

function stubHealthyTables() {
  tables = {
    courses: tableStub({
      row: makeCourse({ id: COURSE_ID, title: 'Intro to Data Analytics' }),
    }),
    profiles: tableStub({ row: makeProfile({ id: STUDENT_ID }) }),
    modules: tableStub({ rows: [{ id: 'module-1' }, { id: 'module-2' }] }),
    module_progressions: tableStub({ rows: [{ module_id: 'module-1' }] }),
    assignments: tableStub({ rows: [{ id: 'assignment-1' }, { id: 'assignment-2' }] }),
    assignment_submissions: tableStub({
      rows: [{ assignment_id: 'assignment-1', grade: 90, workflow_state: 'graded' }],
    }),
    quizzes: tableStub({ rows: [{ id: 'quiz-1', content_item_id: COURSE_ID }] }),
    quiz_submissions: tableStub({
      rows: [{ quiz_id: 'quiz-1', score: 80, workflow_state: 'complete' }],
    }),
    // Serves the last-activity lookup (maybeSingle), the recent-activity list
    // (thenable), and the seven daily count queries (count).
    content_item_progressions: tableStub({
      row: { updated_at: '2026-07-20T10:00:00Z' },
      rows: [],
      count: 2,
    }),
  };
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => tables[table] ?? tableStub({})
  );
}

const healthyVideoSummary = {
  totalVideos: 3,
  completedVideos: 1,
  totalWatchTimeMinutes: 12,
  averageCompletionPercentage: 40,
};

function renderPage() {
  return render(<StudentInsights />);
}

describe('StudentInsights page', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetStudentVideoSummary.mockReset();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: STUDENT_ID, email: 'ada@example.com', roles: ['user'] },
      loading: false,
    } as any);
    stubHealthyTables();
    mockGetStudentVideoSummary.mockResolvedValue(healthyVideoSummary);
  });

  it('shows a spinner while insights are loading', () => {
    // First query never settles → dashboard stays in its loading state.
    tables.courses.maybeSingle.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.queryByText('Student Performance Dashboard')).not.toBeInTheDocument();
  });

  it('renders the dashboard with real stats on success', async () => {
    renderPage();

    expect(await screen.findByText('Student Performance Dashboard')).toBeInTheDocument();
    // Student + course header line
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/Intro to Data Analytics/)).toBeInTheDocument();
    // Video stats come from the (mocked) analytics service, not zeros.
    // (Appears in both the stat tile and the completion breakdown.)
    expect(screen.getAllByText('1/3').length).toBeGreaterThan(0);
    expect(screen.getByText(/12 mins watched/i)).toBeInTheDocument();
    // Module completion from the stubbed tables.
    expect(screen.getAllByText('1/2').length).toBeGreaterThan(0);
    expect(screen.getByText('Back to Course')).toBeInTheDocument();
    expect(mockGetStudentVideoSummary).toHaveBeenCalledWith(STUDENT_ID, COURSE_ID);
  });

  it('REGRESSION: no fabricated time-spent metric appears anywhere', async () => {
    renderPage();

    await screen.findByText('Student Performance Dashboard');

    // There is no real time-tracking data, so nothing may claim to show it.
    expect(screen.queryByText(/time spent/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/time spent/i);
  });

  it('shows honest empty copy in the assignment and quiz tabs instead of pretend content', async () => {
    renderPage();

    await screen.findByText('Student Performance Dashboard');
    expect(document.body.textContent).not.toMatch(/would be displayed here/i);

    await userEvent.click(screen.getByRole('tab', { name: /assignments/i }));
    expect(
      await screen.findByText(/detailed assignment breakdown not yet available/i)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /quizzes/i }));
    expect(
      await screen.findByText(/detailed quiz breakdown not yet available/i)
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/would be displayed here/i);
  });

  it('surfaces a database failure as a visible error with retry', async () => {
    tables.courses = tableStub({ error: dbError });

    renderPage();

    expect(await screen.findByText('Failed to load student insights')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Student Performance Dashboard')).not.toBeInTheDocument();
  });

  it('REGRESSION: a video-analytics failure is a visible error — no zeroed video stats', async () => {
    mockGetStudentVideoSummary.mockReset();
    mockGetStudentVideoSummary.mockRejectedValueOnce(new Error('video analytics down'));

    renderPage();

    expect(await screen.findByText('Failed to load student insights')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /retry/i });

    // No dashboard content, no zeroed metrics presented as real data.
    expect(screen.queryByText('Student Performance Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/mins watched/i);
    expect(document.body.textContent).not.toMatch(/time spent/i);

    // Retry recovers once the analytics service is healthy again.
    mockGetStudentVideoSummary.mockResolvedValue(healthyVideoSummary);
    await userEvent.click(retry);

    expect(await screen.findByText('Student Performance Dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('1/3').length).toBeGreaterThan(0);
    expect(screen.queryByText('Failed to load student insights')).not.toBeInTheDocument();
    expect(mockGetStudentVideoSummary).toHaveBeenCalledTimes(2);
  });
});
