// ABOUTME: Tests for CourseMaterials covering access gate, loading/success/empty/error states,
// ABOUTME: and the regression where a failed query must render an error, not an empty folder.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import CourseMaterials from '@/pages/CourseMaterials';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1' }),
  };
});

vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: () => ({
    canEdit: false,
    isInstructor: false,
    isAdmin: false,
    loading: false,
  }),
}));

// The course shell (navbar + sidebar) is out of scope for these tests.
vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: (props: { children?: React.ReactNode }) => props.children,
}));

type TableResult = { data: unknown; error: { message: string } | null };

function tableBuilder(result: TableResult | 'pending') {
  const builder: any = {};
  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not', 'or',
    'order', 'limit', 'filter', 'match', 'contains',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  if (result === 'pending') {
    builder.single = vi.fn(() => new Promise(() => undefined));
    builder.maybeSingle = vi.fn(() => new Promise(() => undefined));
    builder.then = () => undefined;
  } else {
    const first = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
    builder.single = vi.fn().mockResolvedValue({ data: first, error: result.error });
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: first, error: result.error });
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
  }
  return builder;
}

function mockTables(tables: Record<string, TableResult | 'pending'>) {
  (mockSupabaseClient.from as Mock).mockImplementation((table: string) =>
    tableBuilder(tables[table] ?? { data: [], error: null }),
  );
}

const folderRow = { id: 'folder-1', parent_id: null, name: 'Week 1', course_id: 'course-1' };
const fileRow = {
  id: 'file-1',
  folder_id: null,
  name: 'syllabus.pdf',
  storage_path: 'course-1/root/syllabus.pdf',
  bucket: 'course-documents',
  mime_type: 'application/pdf',
  size_bytes: 2048,
  created_at: '2026-01-01T00:00:00Z',
};

const successTables = (): Record<string, TableResult> => ({
  course_material_folders: { data: [folderRow], error: null },
  course_material_files: { data: [fileRow], error: null },
});

describe('CourseMaterials', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({
        user: { id: 'user-1', email: 'student@example.com' },
        isAuthenticated: true,
      }) as any,
    );
    // Enrolled by default; individual tests override
    (mockSupabaseClient.rpc as Mock).mockResolvedValue({ data: true, error: null });
  });

  it('shows the loading state while the access check is pending', () => {
    (mockSupabaseClient.rpc as Mock).mockReturnValue(new Promise(() => undefined));
    mockTables({});
    render(<CourseMaterials />);

    expect(screen.getByText(/Loading…/)).toBeInTheDocument();
  });

  it('keeps the fail-closed access gate when the user is not enrolled', async () => {
    (mockSupabaseClient.rpc as Mock).mockResolvedValue({ data: false, error: null });
    mockTables(successTables());
    render(<CourseMaterials />);

    expect(
      await screen.findByText(/You must be enrolled in this course to view its materials/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Week 1')).not.toBeInTheDocument();
  });

  it('renders folders and files on success', async () => {
    mockTables(successTables());
    render(<CourseMaterials />);

    expect(await screen.findByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('syllabus.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it('renders the empty-folder copy when there are genuinely no materials', async () => {
    mockTables({
      course_material_folders: { data: [], error: null },
      course_material_files: { data: [], error: null },
    });
    render(<CourseMaterials />);

    expect(await screen.findByText('No materials here yet.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an error state — NOT the empty folder — when loading fails, and retries', async () => {
    mockTables({
      course_material_folders: { data: null, error: { message: 'folders query failed' } },
      course_material_files: { data: [fileRow], error: null },
    });
    render(<CourseMaterials />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error loading materials')).toBeInTheDocument();
    expect(screen.getByText('folders query failed')).toBeInTheDocument();
    // The regression: a failed query must never masquerade as an empty folder,
    // and partial results from the other query must not render either.
    expect(screen.queryByText('No materials here yet.')).not.toBeInTheDocument();
    expect(screen.queryByText(/This folder is empty/)).not.toBeInTheDocument();
    expect(screen.queryByText('syllabus.pdf')).not.toBeInTheDocument();

    // Retry refetches and renders the real contents
    mockTables(successTables());
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Week 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('also errors when only the files query fails', async () => {
    mockTables({
      course_material_folders: { data: [folderRow], error: null },
      course_material_files: { data: null, error: { message: 'files query failed' } },
    });
    render(<CourseMaterials />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('files query failed')).toBeInTheDocument();
    expect(screen.queryByText('Week 1')).not.toBeInTheDocument();
  });
});
