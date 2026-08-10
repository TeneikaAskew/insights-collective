// Tests for the assignment submission page: loading / success / error states,
// submit success gated on the real insert resolving, submit failure surfacing
// a destructive toast (no fake success), and the regression that the
// media-recording option is a visibly disabled, honest unavailable state.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import CanvasContentService from '@/services/canvasContentService';
import CanvasAssignmentSubmission from '@/pages/CanvasAssignmentSubmission';
import { AssignmentSubmissionComponent } from '@/components/course/assignments/AssignmentSubmission';

const { toastMock, navigateMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({
      courseId: 'course-1',
      moduleId: 'module-1',
      contentItemId: 'item-1',
    }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: any) => <div>{children}</div>,
}));

// The real module exports this component twice, named and default. The page
// reaches it through React.lazy, which reads `default` and nothing else — a mock
// with only the named export made every render throw. Both are defined here, and
// they are the SAME component reference, so the two entry points cannot drift
// into testing different things.
const MockCanvasEditor = ({ content, onChange, readOnly, placeholder }: any) =>
  readOnly ? (
    <div data-testid="readonly-editor">{content}</div>
  ) : (
    <textarea
      data-testid="editor"
      placeholder={placeholder}
      value={content || ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );

vi.mock('@/components/ui/unified-canvas-editor', () => ({
  UnifiedCanvasEditor: MockCanvasEditor,
  default: MockCanvasEditor,
}));

// The standalone assignment component (media regression test) uses CanvasEditor.
vi.mock('@/components/ui/canvas-editor', () => ({
  CanvasEditor: ({ content, onChange, placeholder }: any) => (
    <textarea
      data-testid="canvas-editor"
      placeholder={placeholder}
      value={content || ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock('@/components/course/content/FileUploadZone', () => ({
  default: ({ onFileUploaded }: any) => (
    <button
      type="button"
      data-testid="file-upload-zone"
      onClick={() =>
        onFileUploaded?.({
          name: 'essay.pdf',
          type: 'application/pdf',
          size: 2048,
          url: 'https://example.com/essay.pdf',
        })
      }
    >
      mock upload
    </button>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({
    user: { id: 'user-1', email: 'student@example.com' },
    session: {},
    loading: false,
    error: null,
    isAuthenticated: true,
    isAdmin: false,
  }),
}));

vi.mock('@/services/canvasContentService', () => ({
  default: {
    getContentItem: vi.fn(),
    submitAssignment: vi.fn(),
  },
}));

// --- supabase query-builder helper (see CanvasGradingInterface.test.tsx) ----
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

const assignmentItem = {
  id: 'item-1',
  type: 'assignment',
  title: 'Homework 1',
  content: 'Write a short essay.',
  assignment: {
    id: 'assignment-1',
    points_possible: 50,
    submission_types: ['online_text_entry'],
    allowed_attempts: 3,
    due_at: null,
    lock_at: null,
  },
};

describe('CanvasAssignmentSubmission', () => {
  beforeEach(() => {
    toastMock.mockReset();
    navigateMock.mockReset();
    vi.mocked(CanvasContentService.getContentItem).mockReset();
    vi.mocked(CanvasContentService.submitAssignment).mockReset();
  });

  it('shows a loading spinner while the assignment loads', () => {
    vi.mocked(CanvasContentService.getContentItem).mockReturnValue(
      new Promise(() => {}) as any,
    );
    const { container } = render(<CanvasAssignmentSubmission />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Homework 1')).not.toBeInTheDocument();
  });

  it('renders the assignment and submission form on success', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(assignmentItem as any);
    useTables({ assignment_submissions: makeTableBuilder({ data: [], error: null }) });

    render(<CanvasAssignmentSubmission />);

    expect(await screen.findByText('Homework 1')).toBeInTheDocument();
    expect(screen.getByText('50 points')).toBeInTheDocument();
    // findBy, not getBy: the editor is loaded lazily now, so it lands a tick
    // after the assignment body it sits under. Awaiting it is the assertion —
    // it still fails if the editor never arrives.
    expect(
      await screen.findByPlaceholderText('Write your assignment submission here...'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Assignment' })).toBeInTheDocument();
  });

  it('shows a destructive toast and a not-found screen when loading fails', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(null as any);

    render(<CanvasAssignmentSubmission />);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error loading assignment',
          description: 'Assignment not found',
          variant: 'destructive',
        }),
      ),
    );
    expect(await screen.findByText('Assignment Not Found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Assignment' })).not.toBeInTheDocument();
  });

  it('reports submit success only after the real insert resolves', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(assignmentItem as any);
    useTables({ assignment_submissions: makeTableBuilder({ data: [], error: null }) });

    let resolveSubmit!: (v: unknown) => void;
    vi.mocked(CanvasContentService.submitAssignment).mockReturnValue(
      new Promise((res) => {
        resolveSubmit = res;
      }) as any,
    );

    render(<CanvasAssignmentSubmission />);
    fireEvent.change(
      await screen.findByPlaceholderText('Write your assignment submission here...'),
      { target: { value: 'My homework answer' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit Assignment' }));

    // Insert is still in flight: no success toast, no navigation.
    expect(await screen.findByRole('button', { name: 'Submitting...' })).toBeDisabled();
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Assignment submitted' }),
    );
    expect(navigateMock).not.toHaveBeenCalled();

    resolveSubmit({ id: 'new-sub' });

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Assignment submitted',
          description: 'Your assignment has been submitted successfully.',
        }),
      ),
    );
    expect(CanvasContentService.submitAssignment).toHaveBeenCalledWith(
      'assignment-1',
      expect.objectContaining({
        submission_type: 'online_text_entry',
        body: 'My homework answer',
        url: null,
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith('/courses/course-1/modules/module-1');
  });

  it('shows a destructive toast and no success state when the submit fails', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(assignmentItem as any);
    useTables({ assignment_submissions: makeTableBuilder({ data: [], error: null }) });
    vi.mocked(CanvasContentService.submitAssignment).mockRejectedValue(
      new Error('Storage offline'),
    );

    render(<CanvasAssignmentSubmission />);
    fireEvent.change(
      await screen.findByPlaceholderText('Write your assignment submission here...'),
      { target: { value: 'My homework answer' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit Assignment' }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error submitting assignment',
          description: 'Storage offline',
          variant: 'destructive',
        }),
      ),
    );
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Assignment submitted' }),
    );
    expect(navigateMock).not.toHaveBeenCalled();
    // The form is still usable for another attempt.
    expect(screen.getByRole('button', { name: 'Submit Assignment' })).toBeEnabled();
  });

  // REGRESSION: a failed prior-submission lookup must render an error state,
  // not the submission form with fabricated "no prior submission" state.
  it('renders an error state (not the form) when the prior-submission fetch fails', async () => {
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(assignmentItem as any);
    useTables({
      assignment_submissions: makeTableBuilder({
        data: null,
        error: { message: 'submissions unavailable' },
      }),
    });

    render(<CanvasAssignmentSubmission />);

    expect(await screen.findByText("Couldn't load assignment")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Assignment Not Found')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Assignment' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error loading assignment',
          description: 'submissions unavailable',
          variant: 'destructive',
        }),
      ),
    );
  });

  // REGRESSION: a failed attachment insert must produce a qualified toast
  // ("saved, but N attachment(s) failed"), never an unqualified success.
  it('reports a qualified failure toast when an attachment insert fails', async () => {
    const uploadItem = {
      ...assignmentItem,
      assignment: {
        ...assignmentItem.assignment,
        submission_types: ['online_upload'],
      },
    };
    vi.mocked(CanvasContentService.getContentItem).mockResolvedValue(uploadItem as any);
    vi.mocked(CanvasContentService.submitAssignment).mockResolvedValue({ id: 'new-sub' } as any);
    const attachmentsBuilder = makeTableBuilder({
      data: null,
      error: { message: 'attachment insert failed' },
    });
    useTables({
      assignment_submissions: makeTableBuilder({ data: [], error: null }),
      submission_attachments: attachmentsBuilder,
    });

    render(<CanvasAssignmentSubmission />);
    fireEvent.click(await screen.findByTestId('file-upload-zone'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Assignment' }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Submission saved, but 1 attachment(s) failed to record',
          variant: 'destructive',
        }),
      ),
    );
    expect(attachmentsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ submission_id: 'new-sub', filename: 'essay.pdf' }),
    );
    // No unqualified success toast.
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Assignment submitted' }),
    );
  });

  // REGRESSION: the media-recording option must be a disabled, honestly
  // labeled unavailable state — not a selectable tab that dead-ends.
  it('renders the media recording option disabled and never defaults to it', () => {
    const assignment = {
      id: 'a-1',
      title: 'Podcast assignment',
      description: 'Record or upload your episode',
      submission_types: ['media_recording', 'file_upload'],
      max_attempts: 3,
      points: 10,
      due_date: null,
      instructions: null,
      allowed_file_extensions: null,
      late_policy: null,
    } as any;

    render(<AssignmentSubmissionComponent assignment={assignment} onSubmit={vi.fn()} />);

    const mediaTab = screen.getByRole('tab', { name: /media \(unavailable\)/i });
    expect(mediaTab).toBeDisabled();
    expect(mediaTab).toHaveAttribute('title', 'Media recording is not yet available');

    // Even though media_recording is listed first, the form defaults to a
    // working submission type instead of the unavailable one.
    expect(screen.getByRole('tab', { name: /file upload/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(mediaTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});
