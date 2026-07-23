// ABOUTME: Unit tests for Grade History Service
// ABOUTME: Verifies history/comments/sessions/notifications methods throw on
// ABOUTME: supabase errors and that getGradingStats reports real data, not placeholders.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gradeHistoryService } from '../gradeHistoryService';
import { mockSupabaseClient, supabaseError, getQueryBuilder } from '@/test/mocks/supabase';

function makeHistoryEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'h-1',
    grade_id: 'g-1',
    student_id: 's1',
    course_id: 'c1',
    change_type: 'updated',
    changed_by: 'grader-1',
    changed_at: '2026-01-10T00:00:00Z',
    created_at: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cm-1',
    submission_id: 'sub-1',
    submission_type: 'assignment',
    comment_text: 'Nice work',
    comment_type: 'feedback',
    author_id: 'grader-1',
    author_type: 'instructor',
    is_private: false,
    parent_comment_id: null,
    thread_position: 0,
    is_draft: false,
    is_edited: false,
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gs-1',
    grader_id: 'grader-1',
    course_id: 'c1',
    session_type: 'individual',
    submissions_graded: 2,
    started_at: '2026-01-10T00:00:00Z',
    ended_at: '2026-01-10T00:01:00Z',
    created_at: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

// Chainable builder that resolves `result` when the awaited chain settles.
// Used for multi-table tests via from.mockImplementation((table) => ...).
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {};
  for (const method of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'is', 'in', 'not', 'contains', 'order', 'limit',
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = vi.fn((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled)
  );
  return builder;
}

describe('gradeHistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('grade history', () => {
    it('getGradeHistory returns entries for a grade', async () => {
      const entries = [makeHistoryEntry(), makeHistoryEntry({ id: 'h-2' })];
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: entries,
        error: null,
      });

      const result = await gradeHistoryService.getGradeHistory('g-1');

      expect(result).toEqual(entries);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('grade_history');
    });

    it('getGradeHistory returns an empty array when there is no history', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(gradeHistoryService.getGradeHistory('g-1')).resolves.toEqual([]);
    });

    it('getGradeHistory rejects on query failure', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue(supabaseError('db down'));

      await expect(gradeHistoryService.getGradeHistory('g-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('getStudentGradeHistory returns entries for a student in a course', async () => {
      const entries = [makeHistoryEntry()];
      mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue({
        data: entries,
        error: null,
      });

      await expect(
        gradeHistoryService.getStudentGradeHistory('s1', 'c1')
      ).resolves.toEqual(entries);
    });

    it('getStudentGradeHistory rejects on query failure', async () => {
      mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        gradeHistoryService.getStudentGradeHistory('s1', 'c1')
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('getCourseGradeHistory returns entries limited per course', async () => {
      const entries = [makeHistoryEntry()];
      mockSupabaseClient.from().select().eq().order().limit.mockResolvedValue({
        data: entries,
        error: null,
      });

      await expect(gradeHistoryService.getCourseGradeHistory('c1')).resolves.toEqual(entries);
    });

    it('getCourseGradeHistory returns an empty array for a course with no history', async () => {
      mockSupabaseClient.from().select().eq().order().limit.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(gradeHistoryService.getCourseGradeHistory('c1')).resolves.toEqual([]);
    });

    it('getCourseGradeHistory rejects on query failure', async () => {
      mockSupabaseClient.from().select().eq().order().limit.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(gradeHistoryService.getCourseGradeHistory('c1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('createGradeHistoryEntry inserts and returns the entry', async () => {
      const entry = makeHistoryEntry();
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: entry,
        error: null,
      });

      const result = await gradeHistoryService.createGradeHistoryEntry({
        grade_id: 'g-1',
        student_id: 's1',
        course_id: 'c1',
        change_type: 'updated',
        changed_by: 'grader-1',
      });

      expect(result).toEqual(entry);
    });

    it('createGradeHistoryEntry rejects on insert failure', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        gradeHistoryService.createGradeHistoryEntry({
          grade_id: 'g-1',
          student_id: 's1',
          course_id: 'c1',
          change_type: 'updated',
          changed_by: 'grader-1',
        })
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('submission comments', () => {
    it('getSubmissionComments organizes comments into threads', async () => {
      const topLevel = makeComment();
      const reply = makeComment({ id: 'cm-2', parent_comment_id: 'cm-1', thread_position: 1 });
      mockSupabaseClient.from().select().eq().eq().is().order.mockResolvedValue({
        data: [topLevel, reply],
        error: null,
      });

      const result = await gradeHistoryService.getSubmissionComments('sub-1', 'assignment');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cm-1');
      expect(result[0].replies).toHaveLength(1);
      expect(result[0].replies?.[0].id).toBe('cm-2');
    });

    it('getSubmissionComments returns an empty array when there are no comments', async () => {
      mockSupabaseClient.from().select().eq().eq().is().order.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(
        gradeHistoryService.getSubmissionComments('sub-1', 'assignment')
      ).resolves.toEqual([]);
    });

    it('getSubmissionComments rejects on query failure', async () => {
      mockSupabaseClient.from().select().eq().eq().is().order.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        gradeHistoryService.getSubmissionComments('sub-1', 'assignment')
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('createComment inserts and returns the comment', async () => {
      const comment = makeComment();
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: comment,
        error: null,
      });

      await expect(
        gradeHistoryService.createComment(makeComment() as never)
      ).resolves.toEqual(comment);
    });

    it('createComment rejects on insert failure', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        gradeHistoryService.createComment(makeComment() as never)
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('updateComment updates and returns the comment', async () => {
      const updated = makeComment({ comment_text: 'Edited', is_edited: true });
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null,
      });

      const result = await gradeHistoryService.updateComment('cm-1', {
        comment_text: 'Edited',
      });

      expect(result.comment_text).toBe('Edited');
    });

    it('updateComment rejects on update failure', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        gradeHistoryService.updateComment('cm-1', { comment_text: 'Edited' })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('deleteComment soft-deletes without error', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue({ error: null });

      await expect(gradeHistoryService.deleteComment('cm-1')).resolves.toBeUndefined();
    });

    it('deleteComment rejects on failure', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue(supabaseError('db down'));

      await expect(gradeHistoryService.deleteComment('cm-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('grading sessions', () => {
    it('startGradingSession inserts with submissions_graded reset to 0', async () => {
      const session = makeSession({ submissions_graded: 0, ended_at: null });
      const builder = mockSupabaseClient.from();
      builder.insert().select().single.mockResolvedValue({ data: session, error: null });

      const result = await gradeHistoryService.startGradingSession({
        grader_id: 'grader-1',
        course_id: 'c1',
        session_type: 'individual',
        started_at: '2026-01-10T00:00:00Z',
      });

      expect(result).toEqual(session);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ submissions_graded: 0 })
      );
    });

    it('startGradingSession rejects on insert failure', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        gradeHistoryService.startGradingSession({
          grader_id: 'grader-1',
          course_id: 'c1',
          session_type: 'individual',
          started_at: '2026-01-10T00:00:00Z',
        })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('updateGradingSession updates and returns the session', async () => {
      const session = makeSession({ submissions_graded: 5 });
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: session,
        error: null,
      });

      const result = await gradeHistoryService.updateGradingSession('gs-1', {
        submissions_graded: 5,
      });

      expect(result.submissions_graded).toBe(5);
    });

    it('updateGradingSession rejects on failure', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        gradeHistoryService.updateGradingSession('gs-1', { submissions_graded: 5 })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('endGradingSession stamps ended_at and returns the session', async () => {
      const session = makeSession();
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: session,
        error: null,
      });

      await expect(gradeHistoryService.endGradingSession('gs-1')).resolves.toEqual(session);
    });

    it('endGradingSession rejects on failure', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(gradeHistoryService.endGradingSession('gs-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('getGradingSessions returns sessions for a grader', async () => {
      const sessions = [makeSession()];
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: sessions,
        error: null,
      });

      await expect(gradeHistoryService.getGradingSessions('grader-1')).resolves.toEqual(
        sessions
      );
    });

    it('getGradingSessions applies the optional course filter', async () => {
      const sessions = [makeSession()];
      const builder = mockSupabaseClient.from();
      builder.select().eq().eq().order.mockResolvedValue({ data: sessions, error: null });

      const result = await gradeHistoryService.getGradingSessions('grader-1', 'c1');

      expect(result).toEqual(sessions);
      expect(builder.eq).toHaveBeenCalledWith('course_id', 'c1');
    });

    it('getGradingSessions returns an empty array when there are none', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(gradeHistoryService.getGradingSessions('grader-1')).resolves.toEqual([]);
    });

    it('getGradingSessions rejects on failure', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue(supabaseError('db down'));

      await expect(gradeHistoryService.getGradingSessions('grader-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('notifications', () => {
    it('getUnreadNotifications returns unread rows', async () => {
      const notifications = [{ id: 'n-1', student_id: 's1', is_read: false }];
      mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue({
        data: notifications,
        error: null,
      });

      await expect(gradeHistoryService.getUnreadNotifications('s1')).resolves.toEqual(
        notifications
      );
    });

    it('getUnreadNotifications returns an empty array when all read', async () => {
      mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(gradeHistoryService.getUnreadNotifications('s1')).resolves.toEqual([]);
    });

    it('getUnreadNotifications rejects on failure', async () => {
      mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(gradeHistoryService.getUnreadNotifications('s1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('markNotificationAsRead resolves without error', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue({ error: null });

      await expect(
        gradeHistoryService.markNotificationAsRead('n-1')
      ).resolves.toBeUndefined();
    });

    it('markNotificationAsRead rejects on failure', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue(supabaseError('db down'));

      await expect(gradeHistoryService.markNotificationAsRead('n-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('markAllNotificationsAsRead resolves without error', async () => {
      // Chain is .update().eq().eq(): first eq must keep chaining, second resolves.
      const builder = getQueryBuilder();
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce({ error: null });

      await expect(
        gradeHistoryService.markAllNotificationsAsRead('s1')
      ).resolves.toBeUndefined();
    });

    it('markAllNotificationsAsRead rejects on failure', async () => {
      const builder = getQueryBuilder();
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce(supabaseError('db down'));

      await expect(gradeHistoryService.markAllNotificationsAsRead('s1')).rejects.toMatchObject(
        { message: 'db down' }
      );
    });
  });

  describe('getGradingStats', () => {
    const now = Date.now();
    const recent = new Date(now - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
    const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

    function mockStatsTables(
      historyResult: { data: unknown; error: unknown },
      sessionsResult: { data: unknown; error: unknown }
    ) {
      const historyBuilder = makeBuilder(historyResult);
      const sessionsBuilder = makeBuilder(sessionsResult);
      (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
        (table: string) => (table === 'grade_history' ? historyBuilder : sessionsBuilder)
      );
      return { historyBuilder, sessionsBuilder };
    }

    it('computes the most active grader from real history rows (no placeholder)', async () => {
      mockStatsTables(
        {
          data: [
            makeHistoryEntry({ id: 'h-1', changed_by: 'grader-1', changed_at: recent }),
            makeHistoryEntry({ id: 'h-2', changed_by: 'grader-1', changed_at: old }),
            makeHistoryEntry({ id: 'h-3', changed_by: 'grader-2', changed_at: recent }),
          ],
          error: null,
        },
        {
          data: [
            makeSession({
              started_at: '2026-01-10T00:00:00Z',
              ended_at: '2026-01-10T00:01:00Z',
              submissions_graded: 2,
            }),
          ],
          error: null,
        }
      );

      const stats = await gradeHistoryService.getGradingStats('c1');

      expect(stats.total_grades_changed).toBe(3);
      expect(stats.recent_changes).toBe(2);
      expect(stats.average_grading_time).toBe(30000); // 60s / 2 submissions
      expect(stats.most_active_grader).toBe('grader-1');
      expect(JSON.stringify(stats)).not.toContain('TBD');
    });

    it('returns null most_active_grader (not a placeholder) when there is no history', async () => {
      mockStatsTables({ data: [], error: null }, { data: [], error: null });

      const stats = await gradeHistoryService.getGradingStats('c1');

      expect(stats).toEqual({
        total_grades_changed: 0,
        recent_changes: 0,
        average_grading_time: 0,
        most_active_grader: null,
      });
      expect(JSON.stringify(stats)).not.toContain('TBD');
    });

    it('filters by grader when graderId is provided', async () => {
      const { historyBuilder } = mockStatsTables(
        {
          data: [makeHistoryEntry({ changed_by: 'grader-2', changed_at: recent })],
          error: null,
        },
        { data: [], error: null }
      );

      const stats = await gradeHistoryService.getGradingStats('c1', 'grader-2');

      expect(historyBuilder.eq).toHaveBeenCalledWith('changed_by', 'grader-2');
      expect(stats.most_active_grader).toBe('grader-2');
    });

    it('rejects when the history query fails', async () => {
      mockStatsTables(supabaseError('db down'), { data: [], error: null });

      await expect(gradeHistoryService.getGradingStats('c1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('rejects when the sessions query fails instead of silently reporting 0', async () => {
      mockStatsTables({ data: [], error: null }, supabaseError('sessions down'));

      await expect(gradeHistoryService.getGradingStats('c1')).rejects.toMatchObject({
        message: 'sessions down',
      });
    });
  });
});
