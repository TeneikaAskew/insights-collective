import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createBuilderDb } from './fakeUnassignedBuilderDb';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import CourseBuilder from '../CourseBuilder';
import CanvasContentService from '@/services/canvasContentService';

vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: vi.fn() }));
vi.mock('@/contexts/AuthContext', async (original) => ({ ...(await original<any>()), useAuth: () => ({ user: { id: 'u1' } }) }));
let db: ReturnType<typeof createBuilderDb>;
beforeEach(() => {
  db = createBuilderDb();
  vi.mocked(useCoursePermissions).mockReturnValue({ canEdit: true, isInstructor: true, isAdmin: false, loading: false, error: null } as any);
  (mockSupabaseClient.from as any).mockImplementation((t: string) => db.client.from(t));
  vi.mocked(mockSupabaseClient.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null } as any);
  vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null } as any);
});

describe('unassigned course builder reload', () => {
  it('reloads existing null-module lessons, renders the group and opens the lesson without creating a module', async () => {
    const id = 'one';
    db.tables.courses.set(id, { id, title: 'Draft', instructor_id: 'u1', published: false, status: 'draft' });
    db.tables.content_items.set('loose', { id: 'loose', course_id: id, module_id: null, title: 'Loose lesson', type: 'page', content: '<p>Preserved text</p>', position: 7, updated_at: null });
    const view = () => render(<TooltipProvider><MemoryRouter initialEntries={[`/courses/${id}/builder?view=curriculum`]}>
      <Routes><Route path="/courses/:courseId/builder" element={<CourseBuilder />} /></Routes>
    </MemoryRouter></TooltipProvider>);
    const first = view();
    expect(await screen.findByText('Unassigned lessons')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Section actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reorder section' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Loose lesson'));
    await waitFor(() => expect(screen.getByDisplayValue('Loose lesson')).toBeInTheDocument());
    first.unmount();
    view();
    expect(await screen.findByText('Unassigned lessons')).toBeInTheDocument();
    expect(screen.getByText('Loose lesson')).toBeInTheDocument();
    expect(db.tables.modules.size).toBe(0);
    expect([...db.tables.content_items.values()][0]).toMatchObject({ module_id: null, position: 7, content: '<p>Preserved text</p>' });
  });
  it.each(['quiz', 'assignment'] as const)('opens and saves an unassigned %s lesson after reload without changing its association or child', async (type) => {
    db.tables.courses.set('assessment-course', { id: 'assessment-course', title: 'Draft', instructor_id: 'u1', published: false, status: 'draft' });
    const row = { id: 'assessment-item', course_id: 'assessment-course', module_id: null, title: 'Loose assessment', type, content: 'Keep text', position: 9, updated_at: null };
    db.tables.content_items.set(row.id, row);
    const childTable = type === 'quiz' ? 'quizzes' : 'assignments';
    db.tables[childTable].set('child', { id: 'child', content_item_id: row.id, module_id: null, title: 'Assessment', description: 'Keep settings' });
    const childBefore = JSON.stringify([...db.tables[childTable].values()]);
    render(<TooltipProvider><MemoryRouter initialEntries={['/courses/assessment-course/builder?view=curriculum']}>
      <Routes><Route path="/courses/:courseId/builder" element={<CourseBuilder />} /></Routes>
    </MemoryRouter></TooltipProvider>);
    fireEvent.click(await screen.findByText('Loose assessment'));
    const title = await screen.findByDisplayValue('Loose assessment');
    fireEvent.change(title, { target: { value: 'Edited assessment' } });
    fireEvent.blur(title);
    await waitFor(() => expect(db.tables.content_items.get(row.id).title, screen.queryByTestId('lesson-save-status')?.textContent).toBe('Edited assessment'), { timeout: 4000 });
    expect(db.tables.content_items.get(row.id)).toMatchObject({ module_id: null, position: 9, content: 'Keep text' });
    expect(JSON.stringify([...db.tables[childTable].values()])).toBe(childBefore);
  });

  it('adds Section 1 before the unassigned group and retains that order on reload', async () => {
    db.tables.courses.set('one', { id: 'one', title: 'Source', instructor_id: 'u1' });
    db.tables.content_items.set('loose', { id: 'loose', course_id: 'one', module_id: null, title: 'Loose', type: 'page', position: 3 });
    const show = () => render(<TooltipProvider><MemoryRouter initialEntries={['/courses/one/builder?view=curriculum']}>
      <Routes><Route path="/courses/:courseId/builder" element={<CourseBuilder />} /></Routes>
    </MemoryRouter></TooltipProvider>);
    const first = show();
    expect(await screen.findByText('Unassigned lessons')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reorder lesson' })).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: /^Publish$/ })[0]);
    expect(db.tables.courses.get('one').published).not.toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'New section' }));
    expect(await screen.findByText('Section 1')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Section 1', 'Unassigned lessons']);
    first.unmount(); show();
    expect(await screen.findByText('Section 1')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Section 1', 'Unassigned lessons']);
    expect(db.tables.content_items.get('loose').module_id).toBeNull();
  });

  it.each([null, 'module-one'])('allocates after the scoped maximum position for association %s', async (moduleId) => {
    const seed = (id: string, courseId: string, association: string | null, position: number) =>
      db.tables.content_items.set(id, { id, course_id: courseId, module_id: association, position, type: 'page', title: id, content: 'Preserved', published: false });
    // Deliberately unsorted: the old ascending-only fixture would choose 2 and allocate 3.
    seed('low', 'one', moduleId, 2);
    seed('high', 'one', moduleId, 9);
    seed('middle', 'one', moduleId, 5);
    seed('foreign-course', 'another-course', moduleId, 200);
    seed('other-association', 'one', moduleId === null ? 'other-module' : null, 100);
    const before = [...db.tables.content_items.entries()].map(([id, row]) => [id, JSON.stringify(row)] as const);
    const result = await CanvasContentService.createContentItem({
      course_id: 'one', module_id: moduleId, type: 'page', title: 'New synthetic lesson', content: 'New text',
    });
    expect(result).toMatchObject({ course_id: 'one', module_id: moduleId, position: 10, published: false });
    expect(db.tables.content_items.size).toBe(before.length + 1);
    for (const [id, row] of before) expect(JSON.stringify(db.tables.content_items.get(id))).toBe(row);
    // Default ascending reads must still retain saved order after the descending probe.
    const items = await CanvasContentService.getContentItems(moduleId, 'one');
    expect(items.filter((i) => i.course_id === 'one').map((i) => i.position)).toEqual([2, 5, 9, 10]);
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

});
