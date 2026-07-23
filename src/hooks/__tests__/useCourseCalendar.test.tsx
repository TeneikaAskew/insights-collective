// ABOUTME: Unit tests for useCourseCalendar (and sibling calendar hooks)
// ABOUTME: The hooks wrap courseCalendarService via React Query, so the
// ABOUTME: service is mocked; courseCalendarService THROWS on any source
// ABOUTME: error, and these tests assert that rejection reaches hook.error.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useCourseCalendar,
  useMultiCourseCalendar,
  useUpcomingEvents,
} from '../useCourseCalendar';
import { courseCalendarService } from '@/services/courseCalendarService';
import { createHookWrapper } from '@/test/utils/course-fixtures';

vi.mock('@/services/courseCalendarService', () => ({
  courseCalendarService: {
    getCourseCalendarEvents: vi.fn(),
    getMultiCourseCalendarEvents: vi.fn(),
    getUserCalendarEvents: vi.fn(),
    getUpcomingEvents: vi.fn(),
    getEventsForDate: vi.fn(),
    getCalendarStats: vi.fn(),
    createCalendarEvent: vi.fn(),
    updateCalendarEvent: vi.fn(),
    deleteCalendarEvent: vi.fn(),
  },
}));

const calendarEvents = [
  {
    id: 'assignment-due-a1',
    title: 'Essay - Due',
    start_date: '2026-08-01T00:00:00Z',
    type: 'assignment',
    course_id: 'course-1',
    course_title: 'Intro to Data Analytics',
    related_id: 'a1',
    course_color: '#3b82f6',
  },
  {
    id: 'quiz-due-q1',
    title: 'Quiz 1 - Due',
    start_date: '2026-08-05T00:00:00Z',
    type: 'quiz',
    course_id: 'course-1',
    course_title: 'Intro to Data Analytics',
    related_id: 'q1',
    course_color: '#8b5cf6',
  },
];

describe('useCourseCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns events from the calendar service', async () => {
    vi.mocked(courseCalendarService.getCourseCalendarEvents).mockResolvedValue(
      calendarEvents as any
    );

    const { result } = renderHook(() => useCourseCalendar('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events).toEqual(calendarEvents);
    expect(result.current.error).toBeNull();
    expect(courseCalendarService.getCourseCalendarEvents).toHaveBeenCalledWith(
      'course-1',
      undefined
    );
  });

  it('treats an empty event list as success, not an error', async () => {
    vi.mocked(courseCalendarService.getCourseCalendarEvents).mockResolvedValue([]);

    const { result } = renderHook(() => useCourseCalendar('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a service rejection (service throws on any source error) as hook error', async () => {
    vi.mocked(courseCalendarService.getCourseCalendarEvents).mockRejectedValue(
      new Error('calendar source failed')
    );

    const { result } = renderHook(() => useCourseCalendar('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect((result.current.error as Error).message).toBe('calendar source failed');
    expect(result.current.events).toBeUndefined();
  });

  it('does not query without a courseId', async () => {
    const { result } = renderHook(() => useCourseCalendar(undefined), {
      wrapper: createHookWrapper(),
    });

    expect(courseCalendarService.getCourseCalendarEvents).not.toHaveBeenCalled();
    expect(result.current.events).toBeUndefined();
    expect(result.current.error).toBeNull();
  });
});

describe('useMultiCourseCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns merged events for multiple courses', async () => {
    vi.mocked(courseCalendarService.getMultiCourseCalendarEvents).mockResolvedValue(
      calendarEvents as any
    );

    const { result } = renderHook(
      () => useMultiCourseCalendar(['course-1', 'course-2']),
      { wrapper: createHookWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events).toEqual(calendarEvents);
    expect(courseCalendarService.getMultiCourseCalendarEvents).toHaveBeenCalledWith(
      ['course-1', 'course-2'],
      undefined
    );
  });

  it('propagates a failure from any course in the batch', async () => {
    vi.mocked(courseCalendarService.getMultiCourseCalendarEvents).mockRejectedValue(
      new Error('one course failed')
    );

    const { result } = renderHook(
      () => useMultiCourseCalendar(['course-1', 'course-2']),
      { wrapper: createHookWrapper() }
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect((result.current.error as Error).message).toBe('one course failed');
    expect(result.current.events).toBeUndefined();
  });

  it('does not query with an empty course list', () => {
    renderHook(() => useMultiCourseCalendar([]), {
      wrapper: createHookWrapper(),
    });

    expect(courseCalendarService.getMultiCourseCalendarEvents).not.toHaveBeenCalled();
  });
});

describe('useUpcomingEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns upcoming events for the requested window', async () => {
    vi.mocked(courseCalendarService.getUpcomingEvents).mockResolvedValue(
      [calendarEvents[0]] as any
    );

    const { result } = renderHook(() => useUpcomingEvents('course-1', 14), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.events).toEqual([calendarEvents[0]]);
    expect(courseCalendarService.getUpcomingEvents).toHaveBeenCalledWith('course-1', 14);
  });

  it('surfaces upcoming-events failures as hook error', async () => {
    vi.mocked(courseCalendarService.getUpcomingEvents).mockRejectedValue(
      new Error('upcoming failed')
    );

    const { result } = renderHook(() => useUpcomingEvents('course-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect((result.current.error as Error).message).toBe('upcoming failed');
  });
});
