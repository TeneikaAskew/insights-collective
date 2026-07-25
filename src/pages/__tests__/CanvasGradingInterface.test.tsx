// Tests for the instructor grading interface (SpeedGrader):
// loading / success / error states, real submission-content rendering
// (url link, body text, genuinely-empty), and grade-save success/failure.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeSubmission } from '@/test/utils/course-fixtures';
import CanvasContentService from '@/services/canvasContentService';
import CanvasGradingInterface from '@/pages/CanvasGradingInterface';

const { toastMock, navigateMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1', contentItemId: 'item-1' }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: any) => <div>{children}</div>,
}));

// The page is wrapped with a permission HOC; unwrap it so these tests focus
// on the grading UI itself (the HOC has its own concerns).
vi.mock('@/components/course/withCoursePermission', () => ({
  withCoursePermission: (Component: any) => Component,
}));

// Hint needs a Radix TooltipProvider ancestor (mounted in App.tsx, not in tests).
vi.mock('@/components/ui/hint', () => ({
  Hint: ({ children }: any) => children,
}));

vi.mock('@/components/ui/unified-canvas-editor', () => ({
  UnifiedCanvasEditor: ({ content, onChange, readOnly, placeholder }: any) =>
    readOnly ? (
      <div data-testid="readonly-editor">{content}</div>
    ) : (
      <textarea
        data-testid="editor"
        placeholder={placeholder}
        value={content || ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

vi.mock('@/components/course/grading/SubmissionComments', () => ({
  SubmissionComments: ({ submissionId, submissionType }: any) => (
    <div
      data-testid="submission-comments"
      data-submission-id={submissionId}
      data-submission-type={submissionType}
    />
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({
    user: { id: 'grader-1', email: 'grader@example.com' },
    session: {},
    loading: false,
    error: null,
    isAuthenticated: true,
    isAdmin: true,
  }),
}));

vi.mock('@/services/canvasContentService', () => ({
  default: {
    getContentItem: vi.fn(),
  },
}));

// --- supabase query-builder helper -----------------------------------------
// Chainable thenable: every builder method returns the builder; awaiting the
// chain consumes the next queued result. An Error entry rejects; a Promise
// entry defers resolution until the test resolves it.
type TableResult = { data: unknown; error: unknown } | Error | Promise<unknown>;

function makeTableBuilder(...results: TableResult[]) {
  let call = 0;
  const builder: any = {};
  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'is',
    'order', 'limit', 'range', 'single', 'maybeSingle', 'filter', 'or', 'not',
    'match', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
  ]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled: any, onRejected: any) => {
    const r =
      results.length === 0
        ? { data: null, error: null }
        : results[Math.min(call++, results.length - 1)];
    const p = r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    return p.then(onFulfilled, onRejected);
  };
  return builder;
}

function useTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation(
    (table: string) => tables[table] ?? makeTableBuilder(),
  );
  return tables;
}
// ---------------------------------------------------------------------------

const contentItem = {
  id: 'item-1',
  type: 'assignment',
  title: 'Essay 1',
  assignment: { id: 'assignment-1', points_possible: 100 },
};

const alice = { id: 'u1', first_name: 'Alice', last_name: 'Adams' };

function makeGradingSubmission(overrides: Record<string, unknown> = {}) {
  return makeSubmission({
    id: 'sub-1',
    submission_type: 'online_text_entry',
    user: alice,
    ...overrides,
  });
}

describe('CanvasGradingInterface', () => {
  beforeEach(() => {
    toastMock.mockReset();
    navigateMock.mockReset();
    vi.mocked(CanvasContentService.getContentItem).mockReset();
  });

  it('shows a loading spinner while grading data loads', () => {
    vi.mocked(CanvasContentService.getContentItem).mockReturnValue(
      new Promise(() => {}) as any,
    );
    const { container } = render(<CanvasGradingInterface />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Essay 1')).not.toBeInTheDocument();
  });

  it('renders the submission list and grading form on success', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(contentItem as any);
    useTables({
      assignment_submissions: makeTableBuilder({
        data: [
          makeGradingSubmission({ body: 'Great essay text' }),
          makeGradingSubmission({
            id: 'sub-2',
            workflow_state: 'graded',
            grade: 90,
            user: { id: 'u2', first_name: 'Bob', last_name: 'Brown' },
          }),
        ],
        error: null,
      }),
    });

    render(<CanvasGradingInterface />);

    expect(await screen.findByText('Essay 1')).toBeInTheDocument();
    // First needs-grading submission is auto-selected (list entry + header).
    expect(screen.getAllByText('Alice Adams').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Score')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & next' })).toBeInTheDocument();
    expect(screen.getByText('1 of 2 graded • 1 still needs grading • 100 pts')).toBeInTheDocument();
  });

  it('mounts the submission comments panel for the selected submission', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(contentItem as any);
    useTables({
      assignment_submissions: makeTableBuilder({
        data: [makeGradingSubmission({ body: 'Great essay text' })],
        error: null,
      }),
    });

    render(<CanvasGradingInterface />);

    const panel = await screen.findByTestId('submission-comments');
    expect(panel).toHaveAttribute('data-submission-id', 'sub-1');
    expect(panel).toHaveAttribute('data-submission-type', 'assignment');
  });

  it('shows an error state with retry when loading fails, not a blank grading screen', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockRejectedValueOnce(
      new Error('Network exploded'),
    );
    useTables({
      assignment_submissions: makeTableBuilder({
        data: [makeGradingSubmission({ body: 'Great essay text' })],
        error: null,
      }),
    });

    render(<CanvasGradingInterface />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Error loading submissions')).toBeInTheDocument();
    expect(within(alert).getByText('Network exploded')).toBeInTheDocument();

    // REGRESSION: no half-rendered grading UI behind the error.
    expect(screen.queryByLabelText('Score')).not.toBeInTheDocument();
    expect(screen.queryByText('Select a submission to begin grading.')).not.toBeInTheDocument();

    // Retry reloads and lands on the working grading screen.
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(contentItem as any);
    fireEvent.click(within(alert).getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Essay 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Score')).toBeInTheDocument();
  });

  it('renders a clickable link for an upload submission that has a url', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(contentItem as any);
    useTables({
      assignment_submissions: makeTableBuilder({
        data: [
          makeGradingSubmission({
            submission_type: 'online_upload',
            url: 'https://files.example.com/essay.pdf',
            body: null,
          }),
        ],
        error: null,
      }),
    });

    render(<CanvasGradingInterface />);

    const link = await screen.findByRole('link', {
      name: 'https://files.example.com/essay.pdf',
    });
    expect(link).toHaveAttribute('href', 'https://files.example.com/essay.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText(/would be displayed here/i)).not.toBeInTheDocument();
  });

  it('renders the submission body text for an upload submission that has body content', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(contentItem as any);
    useTables({
      assignment_submissions: makeTableBuilder({
        data: [
          makeGradingSubmission({
            submission_type: 'online_upload',
            url: null,
            body: 'Pasted essay body content',
          }),
        ],
        error: null,
      }),
    });

    render(<CanvasGradingInterface />);

    expect(await screen.findByText('Pasted essay body content')).toBeInTheDocument();
    expect(screen.queryByText(/would be displayed here/i)).not.toBeInTheDocument();
  });

  it('says no submission content is available when a submission has neither url nor body', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(contentItem as any);
    useTables({
      assignment_submissions: makeTableBuilder({
        data: [
          makeGradingSubmission({ submission_type: 'online_upload', url: null, body: null }),
        ],
        error: null,
      }),
    });

    render(<CanvasGradingInterface />);

    expect(await screen.findByText('No submission content available')).toBeInTheDocument();
  });

  it('publishes the grade and fires the success toast only AFTER the update resolves', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(contentItem as any);
    let resolveUpdate!: (v: unknown) => void;
    const pendingUpdate = new Promise((res) => {
      resolveUpdate = res;
    });
    const subsBuilder = makeTableBuilder(
      { data: [makeGradingSubmission({ body: 'Great essay text' })], error: null },
      pendingUpdate,
    );
    useTables({ assignment_submissions: subsBuilder });

    render(<CanvasGradingInterface />);
    await screen.findByText('Essay 1');

    fireEvent.change(screen.getByLabelText('Score'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(subsBuilder.update).toHaveBeenCalled());
    expect(subsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ grade: 42, workflow_state: 'graded', grader_id: 'grader-1' }),
    );
    // Update still in flight — success toast must not have fired yet.
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Grade published' }),
    );

    resolveUpdate({ data: null, error: null });

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Grade published',
          description: 'Alice Adams: 42/100',
        }),
      ),
    );
  });

  it('shows a destructive toast when saving the grade fails', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(contentItem as any);
    const subsBuilder = makeTableBuilder(
      { data: [makeGradingSubmission({ body: 'Great essay text' })], error: null },
      new Error('DB write failed'),
    );
    useTables({ assignment_submissions: subsBuilder });

    render(<CanvasGradingInterface />);
    await screen.findByText('Essay 1');

    fireEvent.change(screen.getByLabelText('Score'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error saving grade',
          description: 'DB write failed',
          variant: 'destructive',
        }),
      ),
    );
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Grade published' }),
    );
  });
});
