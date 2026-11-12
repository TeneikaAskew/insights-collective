// ABOUTME: Regression tests for the course publish contract: both columns written together, failed
// ABOUTME: or zero-row updates reported as failures, catalog reads the canonical column, readiness guard.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const result: { data: any; error: any; throws?: Error } = { data: null, error: null };
const calls: { update?: any; eq?: [string, any] } = {};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (patch: any) => {
        calls.update = patch;
        return {
          eq: (col: string, val: any) => {
            calls.eq = [col, val];
            return {
              select: () => ({
                maybeSingle: async () => {
                  if (result.throws) throw result.throws;
                  return { data: result.data, error: result.error };
                },
              }),
            };
          },
        };
      },
    }),
  },
}));

import { publishPatch, publishReadinessIssues, updateCourse, PUBLISHED_COLUMN } from '../coursePublish';

beforeEach(() => {
  result.data = null; result.error = null; result.throws = undefined;
});

describe('publishPatch', () => {
  it('publish sets published=true and status=published', () => {
    expect(publishPatch(true)).toEqual({ published: true, status: 'published' });
  });
  it('unpublish sets published=false and status=draft', () => {
    expect(publishPatch(false)).toEqual({ published: false, status: 'draft' });
  });
  // This only pins the constant's value. That the catalog actually FILTERS on it (and not on the legacy status mirror)
  // is proven by the query-aware contract in src/pages/__tests__/CourseList.test.tsx.
  it('PUBLISHED_COLUMN names the published column', () => {
    expect(PUBLISHED_COLUMN).toBe('published');
  });
});

describe('updateCourse', () => {
  it('succeeds when the row comes back', async () => {
    result.data = { id: 'c1', published: true, status: 'published' };
    const r = await updateCourse('c1', publishPatch(true));
    expect(r.ok).toBe(true);
    expect(calls.update).toMatchObject({ published: true, status: 'published' });
    expect(calls.eq).toEqual(['id', 'c1']);
  });
  it('fails on a database error', async () => {
    result.error = { message: 'permission denied' };
    const r = await updateCourse('c1', { title: 'x' });
    expect(r).toEqual({ ok: false, error: 'permission denied' });
  });
  it('fails when zero rows were updated', async () => {
    const r = await updateCourse('c1', { title: 'x' });
    expect(r.ok).toBe(false);
  });
  it('fails on a network exception instead of throwing', async () => {
    result.throws = new Error('Failed to fetch');
    const r = await updateCourse('c1', { title: 'x' });
    expect(r).toEqual({ ok: false, error: 'Failed to fetch' });
  });
});

describe('publishReadinessIssues', () => {
  it('blocks a course with no sections', () => {
    expect(publishReadinessIssues({ title: 'A' }, [])).toHaveLength(1);
  });
  it('blocks a course whose lessons are all unpublished', () => {
    expect(publishReadinessIssues({ title: 'A' }, [{ published: true, items: [{ published: false }] }])).toHaveLength(1);
  });
  it('blocks a published lesson inside an unpublished section', () => {
    expect(publishReadinessIssues({ title: 'A' }, [{ published: false, items: [{ published: true }] }])).toHaveLength(1);
  });
  it('allows a course with one published lesson in a published section', () => {
    expect(publishReadinessIssues({ title: 'A' }, [{ published: true, items: [{ published: true }] }])).toEqual([]);
  });
});


describe('unassigned lessons match student curriculum readiness', () => {
  it.each([false, true])('does not treat an unassigned display group as a delivered section (published=%s)', (published) => {
    expect(publishReadinessIssues({ title: 'A' }, [{ unassigned: true, published, items: [{ published: true }] }])).toEqual([
      'Unassigned lessons are preserved, but students can only see lessons in published sections. Add a section with a published lesson before publishing this course.',
    ]);
  });
  it('allows a mixed course only when a real published section has published content', () => {
    const loose = { unassigned: true, published: true, items: [{ published: true }] };
    expect(publishReadinessIssues({ title: 'A' }, [loose, { published: true, items: [] }])).not.toEqual([]);
    expect(publishReadinessIssues({ title: 'A' }, [loose, { published: true, items: [{ published: true }] }])).toEqual([]);
  });
});
