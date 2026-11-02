// ABOUTME: T-18. The wizard offers no outline method that does nothing: "Copy from another course" copies
// ABOUTME: the chosen course's sections and lessons, and "Bulk upload" (never implemented) is not offered.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewCourseWizard } from '../NewCourseWizard';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createFakeDb, type FakeDb } from '@/components/course/builder/__tests__/fakeCreationDb';

let db: FakeDb;

beforeEach(() => {
  db = createFakeDb();
  db.tables.courses.set('src-1', { id: 'src-1', title: 'Source course', instructor_id: 'u1' });
  db.tables.courses.set('other', { id: 'other', title: 'Someone else', instructor_id: 'u2' });
  db.tables.modules.set('sm2', { id: 'sm2', course_id: 'src-1', title: 'Second', position: 1 });
  db.tables.modules.set('sm1', { id: 'sm1', course_id: 'src-1', title: 'First', position: 0 });
  db.tables.content_items.set('i3', { id: 'i3', course_id: 'src-1', module_id: 'sm2', title: 'Essay', type: 'assignment', content: '<p>Write</p>', position: 0 });
  db.tables.content_items.set('i2', { id: 'i2', course_id: 'src-1', module_id: 'sm1', title: 'Two', type: 'quiz', content: '', position: 1 });
  db.tables.content_items.set('i1', { id: 'i1', course_id: 'src-1', module_id: 'sm1', title: 'One', type: 'page', content: '<p>Hello</p>', position: 0 });
  (mockSupabaseClient.from as any).mockImplementation((t: string) => db.client.from(t));
  (mockSupabaseClient.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
});

function toOutlineStep() {
  fireEvent.change(screen.getByPlaceholderText('Give it a name'), { target: { value: 'Copied course' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Outline your course')).toBeInTheDocument();
}

describe('T-18 wizard outline methods', () => {
  it('K1 "Bulk upload" is not offered', () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={vi.fn()} />);
    toOutlineStep();
    expect(screen.queryByText('Bulk upload')).not.toBeInTheDocument();
  });

  it('K2 copy lists only my courses, and creating passes the source sections, lessons and lesson text in order', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={onFinish} />);
    toOutlineStep();
    fireEvent.click(screen.getByText('Copy from another course'));
    const select = (await screen.findByLabelText('Course to copy')) as HTMLSelectElement;
    await waitFor(() => expect(select.disabled).toBe(false));
    expect([...select.options].map((o) => o.textContent)).toEqual(['Choose a course', 'Source course']);
    fireEvent.change(select, { target: { value: 'src-1' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Review and create')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create course' }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    const result = onFinish.mock.calls[0][0];
    expect(result.outlineMethod).toBe('copy');
    expect(result.outline).toEqual([
      { title: 'First', lessons: [{ title: 'One', type: 'page', content: '<p>Hello</p>' }, { title: 'Two', type: 'quiz', content: '' }] },
      { title: 'Second', lessons: [{ title: 'Essay', type: 'assignment', content: '<p>Write</p>' }] },
    ]);
  });

  it('K3 copy with no course chosen cannot continue (no empty "success")', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={onFinish} />);
    toOutlineStep();
    fireEvent.click(screen.getByText('Copy from another course'));
    await screen.findByLabelText('Course to copy');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('K4 a course list that fails to load is shown as an error, and continuing stays blocked', async () => {
    const base = db.client.from;
    (mockSupabaseClient.from as any).mockImplementation((t: string) => {
      if (t !== 'courses') return base(t);
      const b = base(t);
      b.then = (ok: any, bad: any) => Promise.resolve({ data: null, error: { message: 'permission denied' } }).then(ok, bad);
      return b;
    });
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={vi.fn()} />);
    toOutlineStep();
    fireEvent.click(screen.getByText('Copy from another course'));
    expect(await screen.findByText('permission denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
