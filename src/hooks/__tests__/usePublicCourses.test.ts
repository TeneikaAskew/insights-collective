import { describe, it, expect, vi, beforeEach } from 'vitest';

const orderMock = vi.fn();
const limitMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { fetchPublicCourses } from '../usePublicCourses';

/** Builds the chainable query object the hook walks: from().select().eq().order() */
function mockQuery(result: { data?: unknown[]; error?: unknown }) {
  const terminal = {
    ...result,
    limit: limitMock.mockResolvedValue(result),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  orderMock.mockReturnValue(terminal);
  eqMock.mockReturnValue({ order: orderMock });
  selectMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ select: selectMock });
}

describe('fetchPublicCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads published courses from the courses table', async () => {
    mockQuery({ data: [], error: null });
    await fetchPublicCourses();

    expect(fromMock).toHaveBeenCalledWith('courses');
    // The landing page must only ever surface published rows.
    expect(eqMock).toHaveBeenCalledWith('status', 'published');
  });

  it('formats an instructor name and falls back when the join is empty', async () => {
    mockQuery({
      data: [
        {
          id: 'c1',
          title: 'SQL for Data Analysis',
          created_at: '2026-01-01',
          instructor: { id: 'u1', first_name: 'Ada', last_name: 'Lovelace', avatar_url: 'a.png' },
        },
        { id: 'c2', title: 'Untitled', created_at: '2026-01-02', instructor: null },
      ],
      error: null,
    });

    const courses = await fetchPublicCourses();

    expect(courses).toHaveLength(2);
    expect(courses[0].instructor.name).toBe('Ada Lovelace');
    expect(courses[1].instructor.name).toBe('Instructor');
    // Every card needs an image, even when the row has none.
    expect(courses[1].thumbnail).toContain('http');
  });

  it('applies a limit only when one is given', async () => {
    mockQuery({ data: [], error: null });
    await fetchPublicCourses(3);
    expect(limitMock).toHaveBeenCalledWith(3);

    vi.clearAllMocks();
    mockQuery({ data: [], error: null });
    await fetchPublicCourses();
    expect(limitMock).not.toHaveBeenCalled();
  });

  it('throws when supabase returns an error so React Query can surface it', async () => {
    mockQuery({ data: null, error: { message: 'permission denied' } });
    await expect(fetchPublicCourses()).rejects.toEqual({ message: 'permission denied' });
  });
});
