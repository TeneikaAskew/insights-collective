// ABOUTME: Runtime proof for the four REAL forms that use zodResolver (ProfileForm, BlogSettings, BlogPostForm,
// ABOUTME: AssignmentSubmission): real component, real schema, real resolver; only I/O and rich editors are stubbed.
//
// The same file is run on the base tree (zod 3.25 + @hookform/resolvers 3.10) and on the dependency branch
// (zod 4.6.7 + resolvers 5.9.2) so a behaviour change is attributable to the upgrade, not to the test.
// Classification of AssignmentSubmission's `url: ''` default is recorded as a BASELINE fact (see the last block).
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }), toast }));
// Rich editors are not part of validation; a plain textarea feeds the same field.onChange.
vi.mock('@/components/blog/editor/BlogEditor', () => ({
  BlogEditor: ({ content, onChange }: { content: string; onChange: (v: string) => void }) => (
    <textarea aria-label="blog-content" value={content} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/ui/canvas-editor', () => ({
  CanvasEditor: ({ content, onChange }: { content: string; onChange: (v: string) => void }) => (
    <textarea aria-label="submission-text" value={content} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/blog/analytics/BlogPostAnalytics', () => ({ BlogPostAnalytics: () => null }));

import { ProfileForm } from '@/components/portfolio/ProfileForm';
import { BlogSettings } from '@/components/admin/blog/BlogSettings';
import { BlogPostForm } from '@/components/blog/BlogPostForm';
import { AssignmentSubmissionComponent } from '@/components/course/assignments/AssignmentSubmission';

function builder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'upsert']) b[m] = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve(result));
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.then = (ok: (v: unknown) => unknown, err: (e: unknown) => unknown) => Promise.resolve(result).then(ok, err);
  return b as Record<string, ReturnType<typeof vi.fn>>;
}
const byTable: Record<string, ReturnType<typeof builder>> = {};
function wire(tables: Record<string, { data: unknown; error: unknown }>) {
  for (const k of Object.keys(byTable)) delete byTable[k];
  (mockSupabaseClient.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((t: string) => {
    byTable[t] = byTable[t] ?? builder(tables[t] ?? { data: [], error: null });
    return byTable[t];
  });
}
const alerts = () => document.querySelectorAll('[id$="-form-item-message"]');
const messages = () => Array.from(alerts()).map((n) => n.textContent);

beforeEach(() => { toast.mockReset(); });

describe('ProfileForm (real schema + resolver)', () => {
  it('invalid: shows the three schema messages and does not call onSubmit', async () => {
    const onSubmit = vi.fn();
    render(<ProfileForm onSubmit={onSubmit} isLoading={false} />);
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(messages()).toEqual([
      'Please tell us about your interests', 'Please enter your current role', 'Please share some of your hobbies',
    ]));
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('valid: calls onSubmit once with the entered values', async () => {
    const onSubmit = vi.fn();
    render(<ProfileForm onSubmit={onSubmit} isLoading={false} />);
    const [interests, role, hobbies] = Array.from(document.querySelectorAll('input, textarea')) as HTMLInputElement[];
    fireEvent.change(interests, { target: { value: 'data engineering' } });
    fireEvent.change(role, { target: { value: 'Analyst' } });
    fireEvent.change(hobbies, { target: { value: 'climbing' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ interests: 'data engineering', currentRole: 'Analyst', hobbies: 'climbing' });
  });
});

describe('BlogSettings (real schema + resolver)', () => {
  const existing = { id: 's1', blog_title: 'IC Blog', posts_per_page: 10 };
  async function mount() {
    wire({ blog_settings: { data: existing, error: null } });
    render(<BlogSettings />);
    await waitFor(() => expect((screen.getByPlaceholderText('My Amazing Blog') as HTMLInputElement).value).toBe('IC Blog'));
  }
  it('empty title: "Blog title is required", no write', async () => {
    await mount();
    fireEvent.change(screen.getByPlaceholderText('My Amazing Blog'), { target: { value: '' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(messages()).toContain('Blog title is required'));
    expect(byTable.blog_settings.update).not.toHaveBeenCalled();
    expect(byTable.blog_settings.insert).not.toHaveBeenCalled();
  });
  it('posts_per_page out of range (0 and 51) is rejected before any write; 25 is saved', async () => {
    await mount();
    const tab = screen.getByRole('tab', { name: /publishing/i });
    fireEvent.mouseDown(tab, { button: 0, ctrlKey: false }); fireEvent.click(tab);
    const ppp = await screen.findByRole('spinbutton');
    for (const bad of ['0', '51']) {
      fireEvent.change(ppp, { target: { value: bad } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(messages().filter(Boolean).length).toBeGreaterThan(0));
      // eslint-disable-next-line no-console
      console.info(`posts_per_page=${bad} message: ${JSON.stringify(messages().filter(Boolean))}`);
      expect(byTable.blog_settings.update).not.toHaveBeenCalled();
    }
    fireEvent.change(ppp, { target: { value: '25' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(byTable.blog_settings.update).toHaveBeenCalledTimes(1));
    expect(byTable.blog_settings.update.mock.calls[0][0]).toMatchObject({ blog_title: 'IC Blog', posts_per_page: 25 });
  });
});

describe('BlogPostForm (real schema + resolver)', () => {
  beforeEach(() => {
    wire({ blog_categories: { data: [], error: null }, blog_settings: { data: null, error: null },
      blog_posts: { data: { id: 'new-post' }, error: null } });
    (mockSupabaseClient.auth.getUser as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: { user: { id: 'author-1' } }, error: null });
  });
  const mount = () => render(<MemoryRouter><BlogPostForm /></MemoryRouter>);
  it('missing title and content: both schema messages, no insert', async () => {
    mount();
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(messages()).toEqual(expect.arrayContaining(['Title is required', 'Content is required'])));
    expect(byTable.blog_posts?.insert ?? vi.fn()).not.toHaveBeenCalled();
  });
  it('valid: defaults (is_featured=false, allow_comments=true) reach the insert payload', async () => {
    mount();
    fireEvent.change(screen.getByPlaceholderText('Enter blog post title'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('blog-content'), { target: { value: 'Some body text' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(byTable.blog_posts?.insert).toHaveBeenCalledTimes(1));
    expect(byTable.blog_posts.insert.mock.calls[0][0]).toMatchObject({
      title: 'Hello', content: 'Some body text', status: 'draft', featured: false, allow_comments: true, author_id: 'author-1',
    });
  });
});

describe('AssignmentSubmission (real schema + resolver)', () => {
  const assignment = (types: string[]) => ({
    id: 'a1', course_id: 'c1', title: 'A1', submission_types: types, max_attempts: 3,
    peer_review_enabled: false, anonymous_grading: false, grading_type: 'points' as const, is_published: true,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  });
  it('url mode: an invalid URL is rejected; a valid URL is submitted', async () => {
    const onSubmit = vi.fn();
    render(<AssignmentSubmissionComponent assignment={assignment(['url'])} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('https://example.com');
    fireEvent.change(input, { target: { value: 'not a url' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(alerts().length).toBeGreaterThan(0));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'https://example.com/work' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ type: 'url', url: 'https://example.com/work' });
  });
  // BASELINE CLASSIFICATION, not a desired-behaviour assertion: the form defaults url to '' and the schema is
  // z.string().url().optional(); '' is not undefined, so the hidden url field may fail validation in text mode.
  // The observed outcome is recorded (and must be the SAME on base and upgrade, so the dependency diff neither
  // introduces nor silently fixes it). Product fix is a separate, explicitly reviewed change.
  it('text mode with valid text: records whether the hidden empty url blocks submission (must match base)', async () => {
    const onSubmit = vi.fn();
    render(<AssignmentSubmissionComponent assignment={assignment(['text_entry', 'url'])} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('submission-text'), { target: { value: 'My answer' } });
    fireEvent.submit(document.querySelector('form')!);
    await new Promise((r) => setTimeout(r, 200));
    const blocked = onSubmit.mock.calls.length === 0;
    // eslint-disable-next-line no-console
    console.info(`BASELINE-CLASSIFICATION text_entry+empty-url: ${blocked ? 'BLOCKED' : 'SUBMITTED'}`);
    expect(blocked).toBe(true);
  });
  it('cause check: the same text submission goes through when the hidden url field holds a valid URL', async () => {
    const onSubmit = vi.fn();
    const prior = { submission_data: { url: 'https://example.com/earlier' }, submitted_at: '2026-01-02T00:00:00Z', attempt_number: 1, status: 'submitted' } as never;
    render(<AssignmentSubmissionComponent assignment={assignment(['text_entry', 'url'])} submission={prior} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('submission-text'), { target: { value: 'My answer' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ type: 'text_entry', text: 'My answer' });
  });
});
