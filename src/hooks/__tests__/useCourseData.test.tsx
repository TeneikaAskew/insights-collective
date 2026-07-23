// ABOUTME: Unit tests for the useCourseData hook (course detail fetch + field mapping).
// ABOUTME: Covers success mapping, not-found, query errors, and the enrollment-count error path.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCourseData } from '../useCourseData';
import {
  mockSupabaseClient,
  supabaseError,
  getQueryBuilder,
} from '@/test/mocks/supabase';
import { makeCourse } from '@/test/utils/course-fixtures';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const COURSE_ID = '123e4567-e89b-12d3-a456-426614174000';

function makeCourseRow(overrides: Record<string, unknown> = {}) {
  return makeCourse({
    id: COURSE_ID,
    title: 'Intro to Data Analytics',
    description: 'Learn the basics of data analytics.',
    category: 'Data',
    level: 'Beginner',
    image_url: 'https://example.com/course.png',
    enrollment_status: 'open',
    tags: ['data'],
    published: true,
    status: 'published',
    instructor_id: 'instructor-1',
    instructor: {
      id: 'instructor-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      avatar_url: null,
    },
    ...overrides,
  });
}

// The courses query ends in .single(); the enrollments count query is awaited
// directly on the builder chain, so it resolves through the thenable `then`.
function stubCourseQuery(singleResult: unknown, countResult?: unknown) {
  const builder = getQueryBuilder();
  builder.single.mockResolvedValue(singleResult);
  if (countResult !== undefined) {
    builder.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve(countResult)
    );
  }
  return builder;
}

describe('useCourseData', () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  it('maps database fields to the frontend Course model on success', async () => {
    stubCourseQuery(
      { data: makeCourseRow(), error: null },
      { count: 7, error: null }
    );

    const { result } = renderHook(() => useCourseData(COURSE_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.course).toMatchObject({
      id: COURSE_ID,
      title: 'Intro to Data Analytics',
      description: 'Learn the basics of data analytics.',
      category: 'Data',
      level: 'Beginner',
      imageUrl: 'https://example.com/course.png',
      thumbnail: 'https://example.com/course.png',
      enrollmentStatus: 'open',
      published: true,
      status: 'published',
      instructor_id: 'instructor-1',
      enrollmentCount: 7,
    });
    expect(result.current.course?.instructor).toMatchObject({
      id: 'instructor-1',
      name: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('courses');
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('enrollments');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('sets an error when the course is not found', async () => {
    stubCourseQuery({ data: null, error: null });

    const { result } = renderHook(() => useCourseData(COURSE_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.course).toBeNull();
    expect(result.current.error).toBe('Course not found');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('sets error state and keeps course null when the course query fails', async () => {
    stubCourseQuery(supabaseError('course fetch failed'));

    const { result } = renderHook(() => useCourseData(COURSE_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.course).toBeNull();
    expect(result.current.error).toBe('course fetch failed');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('sets error state when the enrollment count query fails (regression)', async () => {
    stubCourseQuery(
      { data: makeCourseRow(), error: null },
      { count: null, error: { message: 'count failed', code: 'PGRST000' } }
    );

    const { result } = renderHook(() => useCourseData(COURSE_ID));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.course).toBeNull();
    expect(result.current.error).toBe('count failed');
  });

  it('skips fetching for a missing or "new" courseId', async () => {
    // from.mock.calls accumulates across tests in this file; start clean.
    vi.mocked(mockSupabaseClient.from).mockClear();
    const { result } = renderHook(() => useCourseData('new'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.course).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('courses');
  });
});
