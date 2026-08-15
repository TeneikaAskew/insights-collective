// ABOUTME: Unit tests for Course Calendar Service
// ABOUTME: Verifies event aggregation across sources and that every query error is thrown, never swallowed

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { courseCalendarService } from '../courseCalendarService';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';
import { CourseCalendarEvent } from '@/types/course';

// Builds a standalone chainable builder that resolves to `result` whether the
// chain terminates in `.single()` or is awaited directly (via `.then`).
// getCourseCalendarEvents calls `from()` once per table, so each table gets
// its own builder and `from` is mocked with an implementation keyed by table.
function createBuilder(result: { data: any; error: any } = { data: null, error: null }) {
  const builder: any = {};
  for (const method of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'not', 'in', 'is', 'order', 'limit',
  ]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = vi.fn((onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  );
  return builder;
}

function mockTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation((table: string) => {
    const builder = tables[table];
    if (!builder) {
      throw new Error(`Unexpected query to table "${table}" in this test`);
    }
    return builder;
  });
}

const COURSE_ID = 'course-1';

const fixtureCourse = { title: 'Intro to Data Analytics' };

const fixtureAssignments = [
  {
    id: 'a1',
    title: 'Essay',
    description: 'Write an essay',
    due_date: '2026-03-01T00:00:00Z',
    points: 100,
    course_id: COURSE_ID,
  },
];

const fixtureQuizzes = [
  {
    id: 'q1',
    title: 'Quiz 1',
    description: null,
    due_at: '2026-03-05T00:00:00Z',
    unlock_at: '2026-03-02T00:00:00Z',
    lock_at: '2026-03-06T00:00:00Z',
    time_limit: 30,
    allowed_attempts: 1,
    content_items: { course_id: COURSE_ID, module_id: 'm1' },
  },
];

const fixtureAnnouncements = [
  {
    id: 'an1',
    title: 'Welcome',
    content: 'Hello class',
    created_at: '2026-02-20T00:00:00Z',
    is_pinned: true,
  },
];

const fixtureCustomEvents = [
  {
    id: 'e1',
    title: 'Office Hours',
    description: 'Weekly office hours',
    date: '2026-03-03',
    // events.end_time is a clock-only time column in the real schema
    end_time: '01:00:00',
    location: null,
    link: 'https://zoom.us/j/1',
    zoom_meeting_id: 123,
    zoom_start_url: 'https://zoom.us/s/1',
    zoom_recurrence: null,
  },
];

// One healthy builder per table getCourseCalendarEvents touches; tests
// override individual tables to inject failures or empty results.
function happyTables(overrides: Record<string, any> = {}) {
  return {
    courses: createBuilder({ data: fixtureCourse, error: null }),
    assignments: createBuilder({ data: fixtureAssignments, error: null }),
    quizzes: createBuilder({ data: fixtureQuizzes, error: null }),
    course_announcements: createBuilder({ data: fixtureAnnouncements, error: null }),
    events: createBuilder({ data: fixtureCustomEvents, error: null }),
    ...overrides,
  };
}

function emptyTables() {
  return happyTables({
    assignments: createBuilder({ data: [], error: null }),
    quizzes: createBuilder({ data: [], error: null }),
    course_announcements: createBuilder({ data: [], error: null }),
    events: createBuilder({ data: [], error: null }),
  });
}

describe('courseCalendarService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCourseCalendarEvents', () => {
    it('combines assignments, quizzes, announcements and custom events, sorted by date', async () => {
      mockTables(happyTables());

      const result = await courseCalendarService.getCourseCalendarEvents(COURSE_ID);

      // 1 assignment + 3 quiz events (due/unlock/lock) + 1 announcement + 1 custom event
      expect(result).toHaveLength(6);

      const types = result.map(e => e.type);
      expect(types).toContain('assignment');
      expect(types).toContain('quiz');
      expect(types).toContain('announcement');
      expect(types).toContain('event');

      // Every event carries the real course title, never a fallback
      expect(result.every(e => e.course_title === 'Intro to Data Analytics')).toBe(true);
      expect(result.some(e => e.course_title === 'Unknown Course')).toBe(false);

      // Sorted ascending by start_date — the Feb 20 announcement comes first
      expect(result[0].id).toBe('announcement-an1');
      const times = result.map(e => new Date(e.start_date).getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));

      // Quiz produced all three events
      expect(result.map(e => e.id)).toEqual(
        expect.arrayContaining(['quiz-due-q1', 'quiz-unlock-q1', 'quiz-lock-q1'])
      );

      // Custom event carries through its link/zoom fields and maps the
      // end_time column back to end_date (read/write symmetry)
      const custom = result.find(e => e.id === 'event-e1')!;
      expect(custom.link).toBe('https://zoom.us/j/1');
      expect(custom.zoom_meeting_id).toBe(123);
      // clock-only end_time is combined with the event date so new Date() parses
      expect(custom.end_date).toBe('2026-03-03T01:00:00');
    });

    it('respects type filters and skips unrequested sources', async () => {
      // Only courses + assignments are provided; querying any other table throws
      mockTables({
        courses: createBuilder({ data: fixtureCourse, error: null }),
        assignments: createBuilder({ data: fixtureAssignments, error: null }),
      });

      const result = await courseCalendarService.getCourseCalendarEvents(COURSE_ID, {
        types: ['assignment'],
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('assignment');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('quizzes');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('course_announcements');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('events');
    });

    it('applies the date-range filter', async () => {
      mockTables(happyTables());

      const result = await courseCalendarService.getCourseCalendarEvents(COURSE_ID, {
        startDate: new Date('2026-03-04T00:00:00Z'),
      });

      // Only quiz due (03-05) and quiz lock (03-06) remain
      expect(result.map(e => e.id)).toEqual(['quiz-due-q1', 'quiz-lock-q1']);
    });

    it('throws when the course lookup fails', async () => {
      mockTables(happyTables({
        courses: createBuilder(supabaseError('course fetch failed')),
      }));

      await expect(
        courseCalendarService.getCourseCalendarEvents(COURSE_ID)
      ).rejects.toMatchObject({ message: 'course fetch failed' });
    });

    it('returns no events when the course row is not visible to the caller', async () => {
      // A null row here is RLS, not a data error: an enrollment can point at a
      // course whose `courses` row the caller cannot read (e.g. unpublished).
      // This used to throw — and because getUserCalendarEvents fans out over
      // every enrollment, one hidden course rejected the user's entire calendar.
      mockTables(happyTables({
        courses: createBuilder({ data: null, error: null }),
      }));

      await expect(
        courseCalendarService.getCourseCalendarEvents(COURSE_ID)
      ).resolves.toEqual([]);
    });

    it('throws when the assignments query fails', async () => {
      mockTables(happyTables({
        assignments: createBuilder(supabaseError('assignments query failed')),
      }));

      await expect(
        courseCalendarService.getCourseCalendarEvents(COURSE_ID)
      ).rejects.toMatchObject({ message: 'assignments query failed' });
    });

    it('throws when the quizzes query fails', async () => {
      mockTables(happyTables({
        quizzes: createBuilder(supabaseError('quizzes query failed')),
      }));

      await expect(
        courseCalendarService.getCourseCalendarEvents(COURSE_ID)
      ).rejects.toMatchObject({ message: 'quizzes query failed' });
    });

    it('throws when the announcements query fails', async () => {
      mockTables(happyTables({
        course_announcements: createBuilder(supabaseError('announcements query failed')),
      }));

      await expect(
        courseCalendarService.getCourseCalendarEvents(COURSE_ID)
      ).rejects.toMatchObject({ message: 'announcements query failed' });
    });

    it('throws when the custom events query fails', async () => {
      mockTables(happyTables({
        events: createBuilder(supabaseError('events query failed')),
      }));

      await expect(
        courseCalendarService.getCourseCalendarEvents(COURSE_ID)
      ).rejects.toMatchObject({ message: 'events query failed' });
    });

    it('returns an empty array when every source is legitimately empty', async () => {
      mockTables(emptyTables());

      const result = await courseCalendarService.getCourseCalendarEvents(COURSE_ID);

      expect(result).toEqual([]);
    });
  });

  describe('getMultiCourseCalendarEvents', () => {
    it('merges and sorts events from all courses', async () => {
      const c1Events: CourseCalendarEvent[] = [
        {
          id: 'assignment-due-a1',
          title: 'Essay - Due',
          start_date: '2026-03-10T00:00:00Z',
          type: 'assignment',
          course_id: 'c1',
          course_title: 'Course One',
        },
      ];
      const c2Events: CourseCalendarEvent[] = [
        {
          id: 'quiz-due-q9',
          title: 'Quiz - Due',
          start_date: '2026-03-01T00:00:00Z',
          type: 'quiz',
          course_id: 'c2',
          course_title: 'Course Two',
        },
      ];

      const spy = vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockResolvedValueOnce(c1Events)
        .mockResolvedValueOnce(c2Events);

      const result = await courseCalendarService.getMultiCourseCalendarEvents(['c1', 'c2']);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, 'c1', undefined);
      expect(spy).toHaveBeenNthCalledWith(2, 'c2', undefined);
      // Sorted across courses: c2's earlier quiz comes first
      expect(result.map(e => e.id)).toEqual(['quiz-due-q9', 'assignment-due-a1']);
    });

    // REGRESSION: one unreadable course used to empty the entire calendar.
    //
    // getCourseCalendarEvents opens with .single() on courses, and the
    // student-facing RLS policy is `published = true`. A student enrolled in a
    // course that is unpublished gets PGRST116 for that course alone — and
    // because this loop let the rejection propagate, React Query failed the
    // whole query and every OTHER course's events vanished with it. Observed on
    // the E2E member (enrolled in one draft fixture course): zero upcoming
    // events while a quiz sat two days out in a course they could read.
    it('keeps the readable courses when one course fails', async () => {
      const readable: CourseCalendarEvent[] = [
        {
          id: 'quiz-due-q9',
          title: 'Quiz - Due',
          start_date: '2026-03-01T00:00:00Z',
          type: 'quiz',
          course_id: 'c2',
          course_title: 'Course Two',
        },
      ];
      vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockRejectedValueOnce(Object.assign(new Error('no rows'), { code: 'PGRST116' }))
        .mockResolvedValueOnce(readable);

      const result = await courseCalendarService.getMultiCourseCalendarEvents(['c1', 'c2']);

      expect(result.map((e) => e.id)).toEqual(['quiz-due-q9']);
    });

    // Partial is fine; total silence is not. The panel renders an error for a
    // rejection and an empty state for [], so a real outage must still reject —
    // otherwise it reads to the student as "nothing scheduled".
    it('still rejects when every course fails', async () => {
      vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'));

      await expect(
        courseCalendarService.getMultiCourseCalendarEvents(['c1', 'c2'])
      ).rejects.toThrow('boom');
    });

    it('returns an empty array for an empty course list', async () => {
      const spy = vi.spyOn(courseCalendarService, 'getCourseCalendarEvents');

      const result = await courseCalendarService.getMultiCourseCalendarEvents([]);

      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getUserCalendarEvents', () => {
    it('fetches events for all enrolled courses', async () => {
      mockTables({
        enrollments: createBuilder({
          data: [{ course_id: 'c1' }, { course_id: 'c2' }],
          error: null,
        }),
      });

      const events: CourseCalendarEvent[] = [
        {
          id: 'assignment-due-a1',
          title: 'Essay - Due',
          start_date: '2026-03-10T00:00:00Z',
          type: 'assignment',
          course_id: 'c1',
          course_title: 'Course One',
        },
      ];
      const multiSpy = vi.spyOn(courseCalendarService, 'getMultiCourseCalendarEvents')
        .mockResolvedValue(events);

      const result = await courseCalendarService.getUserCalendarEvents('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('enrollments');
      expect(multiSpy).toHaveBeenCalledWith(['c1', 'c2'], undefined);
      expect(result).toEqual(events);
    });

    it('restricts to the requested course ids when filters.courseIds is set', async () => {
      mockTables({
        enrollments: createBuilder({
          data: [{ course_id: 'c1' }, { course_id: 'c2' }],
          error: null,
        }),
      });

      const multiSpy = vi.spyOn(courseCalendarService, 'getMultiCourseCalendarEvents')
        .mockResolvedValue([]);

      const filters = { courseIds: ['c2'] };
      await courseCalendarService.getUserCalendarEvents('user-1', filters);

      expect(multiSpy).toHaveBeenCalledWith(['c2'], filters);
    });

    it('throws when the enrollments query fails instead of returning []', async () => {
      mockTables({
        enrollments: createBuilder(supabaseError('enrollments query failed')),
      });

      const multiSpy = vi.spyOn(courseCalendarService, 'getMultiCourseCalendarEvents');

      await expect(
        courseCalendarService.getUserCalendarEvents('user-1')
      ).rejects.toMatchObject({ message: 'enrollments query failed' });

      expect(multiSpy).not.toHaveBeenCalled();
    });

    it('returns an empty array when the user genuinely has no enrollments', async () => {
      mockTables({
        enrollments: createBuilder({ data: [], error: null }),
      });

      const result = await courseCalendarService.getUserCalendarEvents('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('createCalendarEvent', () => {
    const input = {
      course_id: COURSE_ID,
      title: 'Guest Lecture',
      start_date: '2026-04-01T00:00:00Z',
    };

    it('inserts into events and returns the created row', async () => {
      const created = { id: 'e9', title: 'Guest Lecture' };
      const builder = createBuilder({ data: created, error: null });
      mockTables({ events: builder });

      const result = await courseCalendarService.createCalendarEvent(input);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('events');
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Guest Lecture', course_id: COURSE_ID })
      );
      expect(result).toEqual(created);
    });

    it('throws when the insert fails', async () => {
      mockTables({ events: createBuilder(supabaseError('insert failed')) });

      await expect(
        courseCalendarService.createCalendarEvent(input)
      ).rejects.toMatchObject({ message: 'insert failed' });
    });

    it('REGRESSION: persists the end date to the end_time column, never end_date', async () => {
      const builder = createBuilder({ data: { id: 'e9' }, error: null });
      mockTables({ events: builder });

      await courseCalendarService.createCalendarEvent({
        ...input,
        end_date: '2026-04-01T02:00:00Z',
      });

      const payload = builder.insert.mock.calls[0][0];
      // a full timestamp input is normalized to the clock portion (time column)
      expect(payload.end_time).toBe('02:00:00');
      expect(payload).not.toHaveProperty('end_date');
    });
  });

  describe('updateCalendarEvent', () => {
    it('updates the event and returns the row', async () => {
      const updated = { id: 'e1', title: 'Renamed' };
      const builder = createBuilder({ data: updated, error: null });
      mockTables({ events: builder });

      const result = await courseCalendarService.updateCalendarEvent('e1', { title: 'Renamed' });

      expect(builder.eq).toHaveBeenCalledWith('id', 'e1');
      expect(result).toEqual(updated);
    });

    it('throws when the update fails', async () => {
      mockTables({ events: createBuilder(supabaseError('update failed')) });

      await expect(
        courseCalendarService.updateCalendarEvent('e1', { title: 'Renamed' })
      ).rejects.toMatchObject({ message: 'update failed' });
    });

    it('REGRESSION: writes the end date to the end_time column, never end_date (which does not exist and 400s)', async () => {
      const builder = createBuilder({ data: { id: 'e1' }, error: null });
      mockTables({ events: builder });

      await courseCalendarService.updateCalendarEvent('e1', {
        title: 'Renamed',
        start_date: '2026-04-01T00:00:00Z',
        end_date: '2026-04-01T02:00:00Z',
      });

      const payload = builder.update.mock.calls[0][0];
      // a full timestamp input is normalized to the clock portion (time column)
      expect(payload.end_time).toBe('02:00:00');
      expect(payload).not.toHaveProperty('end_date');
    });
  });

  describe('deleteCalendarEvent', () => {
    it('deletes the event', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockTables({ events: builder });

      await expect(
        courseCalendarService.deleteCalendarEvent('e1')
      ).resolves.toBeUndefined();
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'e1');
    });

    it('throws when the delete fails', async () => {
      mockTables({ events: createBuilder(supabaseError('delete failed')) });

      await expect(
        courseCalendarService.deleteCalendarEvent('e1')
      ).rejects.toMatchObject({ message: 'delete failed' });
    });
  });

  describe('getUpcomingEvents', () => {
    it('delegates to getCourseCalendarEvents with a date window', async () => {
      const spy = vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockResolvedValue([]);

      const result = await courseCalendarService.getUpcomingEvents(COURSE_ID, 7);

      expect(spy).toHaveBeenCalledWith(COURSE_ID, {
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
      const { startDate, endDate } = spy.mock.calls[0][1]!;
      const daysApart = (endDate!.getTime() - startDate!.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(daysApart)).toBe(7);
      expect(result).toEqual([]);
    });

    it('propagates failures', async () => {
      vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockRejectedValue(new Error('boom'));

      await expect(
        courseCalendarService.getUpcomingEvents(COURSE_ID)
      ).rejects.toThrow('boom');
    });
  });

  describe('getEventsForDate', () => {
    it('delegates with start and end of the requested day', async () => {
      const spy = vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockResolvedValue([]);

      const date = new Date('2026-03-05T12:00:00');
      await courseCalendarService.getEventsForDate(COURSE_ID, date);

      const { startDate, endDate } = spy.mock.calls[0][1]!;
      expect(startDate!.getHours()).toBe(0);
      expect(startDate!.getMinutes()).toBe(0);
      expect(endDate!.getHours()).toBe(23);
      expect(endDate!.getMinutes()).toBe(59);
    });
  });

  describe('getCalendarStats', () => {
    const day = 24 * 60 * 60 * 1000;

    it('computes totals, upcoming and overdue counts', async () => {
      const events: CourseCalendarEvent[] = [
        {
          id: 'assignment-due-a1', title: 'Essay - Due',
          start_date: new Date(Date.now() + day).toISOString(),
          type: 'assignment', course_id: COURSE_ID, course_title: 'C',
        },
        {
          id: 'quiz-due-q1', title: 'Quiz 1 - Due',
          start_date: new Date(Date.now() + 2 * day).toISOString(),
          type: 'quiz', course_id: COURSE_ID, course_title: 'C',
        },
        {
          id: 'assignment-due-a2', title: 'Old Essay - Due',
          start_date: new Date(Date.now() - day).toISOString(),
          type: 'assignment', course_id: COURSE_ID, course_title: 'C',
        },
        {
          id: 'announcement-an1', title: 'Welcome',
          start_date: new Date(Date.now() - 2 * day).toISOString(),
          type: 'announcement', course_id: COURSE_ID, course_title: 'C',
        },
      ];
      vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockResolvedValue(events);

      const stats = await courseCalendarService.getCalendarStats(COURSE_ID);

      expect(stats).toEqual({
        total_events: 4,
        upcoming_assignments: 1,
        upcoming_quizzes: 1,
        overdue_items: 1,
      });
    });

    it('returns zeros for an empty calendar', async () => {
      vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockResolvedValue([]);

      const stats = await courseCalendarService.getCalendarStats(COURSE_ID);

      expect(stats).toEqual({
        total_events: 0,
        upcoming_assignments: 0,
        upcoming_quizzes: 0,
        overdue_items: 0,
      });
    });

    it('propagates failures', async () => {
      vi.spyOn(courseCalendarService, 'getCourseCalendarEvents')
        .mockRejectedValue(new Error('boom'));

      await expect(
        courseCalendarService.getCalendarStats(COURSE_ID)
      ).rejects.toThrow('boom');
    });
  });
});
