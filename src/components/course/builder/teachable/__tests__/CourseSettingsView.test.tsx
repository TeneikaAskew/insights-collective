// ABOUTME: Covers the builder Settings tab — the discussions toggle and delete-course.
// ABOUTME: The delete path is the important one: it must not report success on a no-op.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { CourseSettingsView } from '../CourseSettingsView';
import { mockSupabaseClient, resetSupabaseMock } from '@/test/mocks/supabase';
import type { BuilderCourse } from '../types';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const COURSE: BuilderCourse = {
  id: 'course-1',
  title: 'Intro to Data Analytics',
  description: 'desc',
  thumbnail: null,
  published: true,
  settings: null,
};

/** Make `.from('courses').delete({count}).eq()` resolve to a given result. */
function mockDelete(result: { error: unknown; count: number | null }) {
  mockSupabaseClient.from.mockImplementation(() => {
    const chain: any = {
      delete: vi.fn(() => chain),
      eq: vi.fn(() => Promise.resolve(result)),
    };
    return chain;
  });
}

beforeEach(() => {
  resetSupabaseMock();
  navigate.mockClear();
  toast.mockClear();
});

describe('CourseSettingsView — discussions', () => {
  it('treats an unset value as enabled, so existing courses keep their threads', () => {
    render(<CourseSettingsView course={COURSE} onSave={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /allow discussions/i })).toBeChecked();
  });

  it('respects an explicit false', () => {
    render(
      <CourseSettingsView
        course={{ ...COURSE, settings: { discussions: { enabled: false } } }}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: /allow discussions/i })).not.toBeChecked();
  });

  it('merges into existing settings rather than replacing them', async () => {
    // The certificate block is written by a different tab. Saving here must not
    // wipe it — they share one jsonb column.
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CourseSettingsView
        course={{ ...COURSE, settings: { certificate: { enabled: true, title: 'Cert' } } }}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /allow discussions/i }));
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      settings: {
        certificate: { enabled: true, title: 'Cert' },
        discussions: { enabled: false },
      },
    });
  });
});

describe('CourseSettingsView — delete', () => {
  it('stays disabled until the course title is typed exactly', () => {
    render(<CourseSettingsView course={COURSE} onSave={vi.fn()} />);
    const button = screen.getByRole('button', { name: /delete course/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/confirm course title/i), {
      target: { value: 'Intro to Data' },
    });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/confirm course title/i), {
      target: { value: 'Intro to Data Analytics' },
    });
    expect(button).toBeEnabled();
  });

  it('deletes and navigates away', async () => {
    mockDelete({ error: null, count: 1 });
    render(<CourseSettingsView course={COURSE} onSave={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/confirm course title/i), {
      target: { value: COURSE.title },
    });
    fireEvent.click(screen.getByRole('button', { name: /delete course/i }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/course-management'));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Course deleted' }));
  });

  /**
   * The whole reason this codebase grew an audit: PostgREST answers 204 when RLS
   * filters every row, so `if (error)` passes and the UI says "deleted" for a
   * course that is still there. count=exact is what makes the difference
   * visible, and this asserts we act on it.
   */
  it('reports failure when the delete matched no rows', async () => {
    mockDelete({ error: null, count: 0 });
    render(<CourseSettingsView course={COURSE} onSave={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/confirm course title/i), {
      target: { value: COURSE.title },
    });
    fireEvent.click(screen.getByRole('button', { name: /delete course/i }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not delete course', variant: 'destructive' }),
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a database error without navigating', async () => {
    mockDelete({ error: { message: 'permission denied' }, count: null });
    render(<CourseSettingsView course={COURSE} onSave={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/confirm course title/i), {
      target: { value: COURSE.title },
    });
    fireEvent.click(screen.getByRole('button', { name: /delete course/i }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not delete course' }),
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
