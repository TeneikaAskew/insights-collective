// ABOUTME: Tests for the grader's uploaded-files panel: real file metadata, signed-URL
// ABOUTME: previews per type, download, comment seeding, and a loud load-error state.
//
// The panel is the only place an instructor can see what a student actually
// handed in, so the regressions worth guarding are the silent ones: a failed
// attachment query rendering as "no files" (indistinguishable from a student
// who uploaded nothing), and a preview that opens without a signed URL (private
// bucket — an unsigned src renders a broken image, not an error).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { SubmissionAttachments, formatFileSize } from '@/components/course/grading/SubmissionAttachments';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

// jsdom has no DOMMatrix/OffscreenCanvas, so the real pdf.js cannot even be
// imported here. The rendering itself is covered end to end (the Playwright spec
// reads pixels off the canvas); this stub keeps the unit test on the panel's own
// behaviour: PDFs are downloaded and handed to a canvas, never an iframe.
// The mocked specifiers must match PdfPreview's imports exactly — it loads the
// legacy build (its polyfills are what make older/headless Chromium work).
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.mjs' }));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      destroy: vi.fn(),
      getPage: () =>
        Promise.resolve({
          getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
          render: () => ({ promise: Promise.resolve() }),
        }),
    }),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

type QueryResult = { data: unknown; error: unknown };

function makeAttachmentsQuery(result: QueryResult) {
  const builder: any = {};
  for (const m of ['select', 'eq', 'order']) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

const imageRow = {
  id: 'att-image',
  filename: 'chart.png',
  content_type: 'image/png',
  size: 6234,
  url: 'submissions/course-1/student-1/chart.png',
  created_at: '2026-08-10T10:00:00Z',
};

const pdfRow = {
  id: 'att-pdf',
  filename: 'writeup.pdf',
  content_type: 'application/pdf',
  size: 1843,
  url: 'submissions/course-1/student-1/writeup.pdf',
  created_at: '2026-08-10T10:01:00Z',
};

const zipRow = {
  id: 'att-zip',
  filename: 'notebook.zip',
  content_type: 'application/zip',
  size: 2 * 1024 * 1024,
  url: 'submissions/course-1/student-1/notebook.zip',
  created_at: '2026-08-10T10:02:00Z',
};

function useAttachments(rows: unknown[], error: unknown = null) {
  (mockSupabaseClient.from as any).mockImplementation((table: string) => {
    // Other tables (page_visibility etc.) are queried by the test providers.
    if (table !== 'submission_attachments') return makeAttachmentsQuery({ data: [], error: null });
    return makeAttachmentsQuery({ data: error ? null : rows, error });
  });
}

const createSignedUrl = vi.fn();
const download = vi.fn();

beforeEach(() => {
  toastMock.mockReset();
  createSignedUrl.mockReset();
  download.mockReset();
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.example/signed?token=abc' },
    error: null,
  });
  (mockSupabaseClient as any).storage = {
    from: vi.fn().mockReturnValue({ createSignedUrl, download }),
  };
});

describe('formatFileSize', () => {
  it('renders real byte counts, and nothing for a missing size', () => {
    expect(formatFileSize(6234)).toBe('6.1 KB');
    expect(formatFileSize(1843)).toBe('1.8 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatFileSize(512)).toBe('512 B');
    // No size on the row must show nothing rather than a fabricated "0 B".
    expect(formatFileSize(null)).toBe('');
    expect(formatFileSize(0)).toBe('');
  });
});

describe('SubmissionAttachments', () => {
  it('lists every uploaded file with its real name, type and size', async () => {
    useAttachments([imageRow, pdfRow]);
    render(<SubmissionAttachments submissionId="sub-1" />);

    expect(await screen.findByText('Uploaded files')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('chart.png')).toBeInTheDocument();
    expect(screen.getByText('image/png • 6.1 KB')).toBeInTheDocument();
    expect(screen.getByText('writeup.pdf')).toBeInTheDocument();
    expect(screen.getByText('application/pdf • 1.8 KB')).toBeInTheDocument();
  });

  it('renders nothing when the student uploaded no files', async () => {
    useAttachments([]);
    render(<SubmissionAttachments submissionId="sub-1" />);
    await waitFor(() => expect(screen.queryByLabelText('Loading files')).not.toBeInTheDocument());
    expect(screen.queryByText('Uploaded files')).not.toBeInTheDocument();
  });

  // REGRESSION: a failed query must NOT look like "no files uploaded" — the
  // grader would score a student as having submitted nothing.
  it('surfaces a load failure instead of silently showing no files', async () => {
    useAttachments([], { message: 'permission denied for table submission_attachments' });
    render(<SubmissionAttachments submissionId="sub-1" />);

    expect(
      await screen.findByText(/Could not load uploaded files: permission denied/i),
    ).toBeInTheDocument();
  });

  it('previews an image inline with a freshly signed URL', async () => {
    useAttachments([imageRow]);
    render(<SubmissionAttachments submissionId="sub-1" />);
    await screen.findByText('chart.png');

    await userEvent.click(screen.getByRole('button', { name: /preview/i }));

    const img = await screen.findByAltText('Preview of chart.png');
    expect(createSignedUrl).toHaveBeenCalledWith(imageRow.url, 600);
    expect(img).toHaveAttribute('src', 'https://storage.example/signed?token=abc');

    // Toggling closed removes the preview (and its signed URL) again.
    await userEvent.click(screen.getByRole('button', { name: /hide/i }));
    await waitFor(() =>
      expect(screen.queryByAltText('Preview of chart.png')).not.toBeInTheDocument(),
    );
  });

  // Not an <iframe>: that depends on a native PDF plugin (absent in headless
  // Chromium, so the pane painted nothing) and a signed supabase.co URL is
  // refused by the app's CSP frame-src. The bytes are downloaded and painted to
  // a canvas by pdf.js instead.
  it('previews a PDF on a pdf.js canvas rather than as an image or an iframe', async () => {
    useAttachments([pdfRow]);
    download.mockResolvedValue({ data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), error: null });
    render(<SubmissionAttachments submissionId="sub-1" />);
    await screen.findByText('writeup.pdf');

    await userEvent.click(screen.getByRole('button', { name: /preview/i }));

    const canvas = await screen.findByLabelText('Preview of writeup.pdf');
    expect(canvas.tagName).toBe('CANVAS');
    expect(document.querySelector('iframe')).toBeNull();
    expect(download).toHaveBeenCalledWith(pdfRow.url);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });


  it('offers Open (new tab) instead of an inline preview for non-previewable types', async () => {
    useAttachments([zipRow]);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<SubmissionAttachments submissionId="sub-1" />);
    await screen.findByText('notebook.zip');

    expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /open/i }));

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        'https://storage.example/signed?token=abc',
        '_blank',
        'noopener,noreferrer',
      ),
    );
    openSpy.mockRestore();
  });

  it('reports a preview failure instead of opening an empty pane', async () => {
    useAttachments([imageRow]);
    createSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    render(<SubmissionAttachments submissionId="sub-1" />);
    await screen.findByText('chart.png');

    await userEvent.click(screen.getByRole('button', { name: /preview/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not open file', variant: 'destructive' }),
      ),
    );
    expect(screen.queryByAltText('Preview of chart.png')).not.toBeInTheDocument();
  });

  it('downloads the real file bytes under the original filename', async () => {
    useAttachments([pdfRow]);
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    download.mockResolvedValue({ data: blob, error: null });
    const createObjectURL = vi.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = vi.fn();
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = revokeObjectURL;
    const clicks: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push(this.download);
      });

    render(<SubmissionAttachments submissionId="sub-1" />);
    await screen.findByText('writeup.pdf');
    await userEvent.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => expect(download).toHaveBeenCalledWith(pdfRow.url));
    expect(clicks).toEqual(['writeup.pdf']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    clickSpy.mockRestore();
  });

  it('reports a download failure rather than failing silently', async () => {
    useAttachments([pdfRow]);
    download.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    render(<SubmissionAttachments submissionId="sub-1" />);
    await screen.findByText('writeup.pdf');

    await userEvent.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Download failed', variant: 'destructive' }),
      ),
    );
  });

  it('hands the filename to the comment composer when Comment is clicked', async () => {
    useAttachments([imageRow, pdfRow]);
    const onCommentOnFile = vi.fn();
    render(<SubmissionAttachments submissionId="sub-1" onCommentOnFile={onCommentOnFile} />);
    await screen.findByText('writeup.pdf');

    await userEvent.click(screen.getAllByRole('button', { name: /comment/i })[1]);

    expect(onCommentOnFile).toHaveBeenCalledWith('writeup.pdf');
  });

  it('omits the Comment action when no handler is wired', async () => {
    useAttachments([imageRow]);
    render(<SubmissionAttachments submissionId="sub-1" />);
    await screen.findByText('chart.png');

    expect(screen.queryByRole('button', { name: /comment/i })).not.toBeInTheDocument();
  });
});
