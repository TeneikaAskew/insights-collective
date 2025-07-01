import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCourseData } from '../useCourseData';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useCourseData', () => {
  const mockCourse = {
    id: '1',
    title: 'Test Course',
    description: 'Test Description',
    category: 'Programming',
    level: 'Beginner',
    instructor_id: '123',
    modules: [
      {
        id: 'm1',
        title: 'Module 1',
        order_index: 0,
        lessons: [
          {
            id: 'l1',
            title: 'Lesson 1',
            content: 'Content 1',
            order_index: 0,
          },
        ],
      },
    ],
    students: [{ user_id: 'u1' }, { user_id: 'u2' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch course data successfully', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
    });

    const { result } = renderHook(() => useCourseData('1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.course).toEqual(mockCourse);
      expect(result.current.error).toBe(null);
    });

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('courses');
  });

  it('should handle fetch error', async () => {
    const error = new Error('Failed to fetch course');
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error }),
    });

    const { result } = renderHook(() => useCourseData('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.course).toBe(null);
      expect(result.current.error).toEqual(error);
    });
  });

  it('should not fetch if no courseId provided', () => {
    const { result } = renderHook(() => useCourseData(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.course).toBe(null);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('should calculate enrollment status', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
    });

    const { result } = renderHook(() => useCourseData('1', 'u1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isEnrolled).toBe(true);
    });
  });

  it('should refetch course data', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
    });

    const { result } = renderHook(() => useCourseData('1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refetch();

    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
  });
});