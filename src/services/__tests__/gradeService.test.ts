// ABOUTME: Unit tests for Grade Service
// ABOUTME: Verifies every method throws on supabase errors (the grades table is
// ABOUTME: absent from the schema), returns honest totals, and never fakes success.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gradeService } from '../gradeService';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';

function makeGradeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g-1',
    course_id: 'c1',
    student_id: 's1',
    assignment_id: 'a1',
    quiz_id: null,
    grade_type: 'assignment',
    points_earned: 80,
    points_possible: 100,
    percentage: 80,
    letter_grade: 'B',
    weight: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('gradeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGradesByCourse', () => {
    it('returns grade rows for a course', async () => {
      const rows = [makeGradeRow(), makeGradeRow({ id: 'g-2', student_id: 's2' })];
      mockSupabaseClient.from().select().eq.mockResolvedValue({ data: rows, error: null });

      const result = await gradeService.getGradesByCourse('c1');

      expect(result).toEqual(rows);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('grades');
    });

    it('returns an empty array when the course has no grades', async () => {
      mockSupabaseClient.from().select().eq.mockResolvedValue({ data: [], error: null });

      await expect(gradeService.getGradesByCourse('c1')).resolves.toEqual([]);
    });

    it('rejects when the query fails', async () => {
      mockSupabaseClient.from().select().eq.mockResolvedValue(supabaseError('db down'));

      await expect(gradeService.getGradesByCourse('c1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('getStudentGrades', () => {
    it('returns grades for a student in a course', async () => {
      const rows = [makeGradeRow()];
      mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue({
        data: rows,
        error: null,
      });

      const result = await gradeService.getStudentGrades('c1', 's1');

      expect(result).toEqual(rows);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('grades');
    });

    it('returns an empty array for a student with no grades', async () => {
      mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(gradeService.getStudentGrades('c1', 's1')).resolves.toEqual([]);
    });

    it('rejects when the query fails', async () => {
      mockSupabaseClient.from().select().eq().eq().order.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(gradeService.getStudentGrades('c1', 's1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('upsertGrade', () => {
    it('upserts and returns the grade', async () => {
      const row = makeGradeRow();
      mockSupabaseClient.from().upsert().select().single.mockResolvedValue({
        data: row,
        error: null,
      });

      const result = await gradeService.upsertGrade({ course_id: 'c1', student_id: 's1' });

      expect(result).toEqual(row);
    });

    it('rejects when the upsert fails', async () => {
      mockSupabaseClient.from().upsert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        gradeService.upsertGrade({ course_id: 'c1', student_id: 's1' })
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('bulkUpdateGrades', () => {
    it('upserts and returns all grades', async () => {
      const rows = [makeGradeRow(), makeGradeRow({ id: 'g-2' })];
      mockSupabaseClient.from().upsert().select.mockResolvedValue({ data: rows, error: null });

      const result = await gradeService.bulkUpdateGrades([{}, {}]);

      expect(result).toEqual(rows);
    });

    it('rejects when the bulk upsert fails', async () => {
      mockSupabaseClient.from().upsert().select.mockResolvedValue(supabaseError('db down'));

      await expect(gradeService.bulkUpdateGrades([{}])).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('calculateCourseGrade', () => {
    // The chain is `.select('*').eq().eq()` awaited directly, so we resolve
    // the awaited builder via its mock `then`.
    function resolveGradesWith(result: { data: unknown; error: unknown }) {
      const builder = mockSupabaseClient.from();
      builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled)
      );
    }

    it('accumulates totalPossible and totalEarned across multiple grade rows', async () => {
      resolveGradesWith({
        data: [
          makeGradeRow({ points_earned: 80, points_possible: 100, weight: 1 }),
          makeGradeRow({ id: 'g-2', points_earned: 40, points_possible: 50, weight: 1 }),
        ],
        error: null,
      });

      const result = await gradeService.calculateCourseGrade('c1', 's1');

      expect(result.totalEarned).toBe(120);
      expect(result.totalPossible).toBe(150);
      expect(result.percentage).toBeCloseTo(80);
      expect(result.letterGrade).toBe('B');
    });

    it('weights the percentage but keeps raw point totals honest', async () => {
      resolveGradesWith({
        data: [
          makeGradeRow({ points_earned: 90, points_possible: 100, weight: 3 }),
          makeGradeRow({ id: 'g-2', points_earned: 50, points_possible: 100, weight: 1 }),
        ],
        error: null,
      });

      const result = await gradeService.calculateCourseGrade('c1', 's1');

      // Weighted: (0.9 * 3 + 0.5 * 1) / 4 = 80%
      expect(result.percentage).toBeCloseTo(80);
      expect(result.totalEarned).toBe(140);
      expect(result.totalPossible).toBe(200);
    });

    it('returns the zero result without error for a student with no grade rows', async () => {
      resolveGradesWith({ data: [], error: null });

      const result = await gradeService.calculateCourseGrade('c1', 's1');

      expect(result).toEqual({
        percentage: 0,
        letterGrade: 'F',
        totalEarned: 0,
        totalPossible: 0,
      });
    });

    it('skips rows with missing points instead of corrupting the totals', async () => {
      resolveGradesWith({
        data: [
          makeGradeRow({ points_earned: 90, points_possible: 100, weight: 1 }),
          makeGradeRow({ id: 'g-2', points_earned: null, points_possible: 100, weight: 1 }),
          makeGradeRow({ id: 'g-3', points_earned: 5, points_possible: null, weight: 1 }),
        ],
        error: null,
      });

      const result = await gradeService.calculateCourseGrade('c1', 's1');

      expect(result.totalEarned).toBe(90);
      expect(result.totalPossible).toBe(100);
      expect(result.percentage).toBeCloseTo(90);
      expect(result.letterGrade).toBe('A');
    });

    it('rejects when the query fails', async () => {
      resolveGradesWith(supabaseError('db down'));

      await expect(gradeService.calculateCourseGrade('c1', 's1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('getLetterGrade', () => {
    it('maps percentages to letter grades at the boundaries', () => {
      expect(gradeService.getLetterGrade(95)).toBe('A');
      expect(gradeService.getLetterGrade(90)).toBe('A');
      expect(gradeService.getLetterGrade(89.9)).toBe('B');
      expect(gradeService.getLetterGrade(80)).toBe('B');
      expect(gradeService.getLetterGrade(70)).toBe('C');
      expect(gradeService.getLetterGrade(60)).toBe('D');
      expect(gradeService.getLetterGrade(59.9)).toBe('F');
      expect(gradeService.getLetterGrade(0)).toBe('F');
    });
  });

  describe('exportGradesToCSV', () => {
    it('builds a CSV with a header and one row per grade', async () => {
      mockSupabaseClient.from().select().eq.mockResolvedValue({
        data: [
          makeGradeRow({
            student: { first_name: 'Ada', last_name: 'Lovelace' },
            assignment: { title: 'Essay 1' },
            quiz: null,
          }),
        ],
        error: null,
      });

      const csv = await gradeService.exportGradesToCSV('c1');
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Student Name');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('Ada Lovelace');
      expect(lines[1]).toContain('Essay 1');
    });

    it('returns only the header when there are no grades', async () => {
      mockSupabaseClient.from().select().eq.mockResolvedValue({ data: [], error: null });

      const csv = await gradeService.exportGradesToCSV('c1');

      expect(csv.split('\n')).toHaveLength(1);
    });

    it('rejects when the query fails', async () => {
      mockSupabaseClient.from().select().eq.mockResolvedValue(supabaseError('db down'));

      await expect(gradeService.exportGradesToCSV('c1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('importGradesFromCSV', () => {
    it('rejects with a "not available" error instead of fake-succeeding', async () => {
      await expect(
        gradeService.importGradesFromCSV('c1', 'header\nrow', 'grader-1')
      ).rejects.toThrow(
        'Grade CSV import is not available: the grades table does not exist in the current schema'
      );
    });

    it('never touches the database', async () => {
      await expect(
        gradeService.importGradesFromCSV('c1', 'header\nrow', 'grader-1')
      ).rejects.toThrow('not available');

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('getCourseStatistics', () => {
    it('computes average, median, highest, lowest, and standard deviation', async () => {
      mockSupabaseClient.from().select().eq().not.mockResolvedValue({
        data: [{ percentage: 80 }, { percentage: 90 }, { percentage: 100 }],
        error: null,
      });

      const stats = await gradeService.getCourseStatistics('c1');

      expect(stats.average).toBeCloseTo(90);
      expect(stats.median).toBe(90);
      expect(stats.highest).toBe(100);
      expect(stats.lowest).toBe(80);
      expect(stats.standardDeviation).toBeCloseTo(8.165, 3);
    });

    it('computes the median for an even number of rows', async () => {
      mockSupabaseClient.from().select().eq().not.mockResolvedValue({
        data: [{ percentage: 80 }, { percentage: 90 }, { percentage: 100 }, { percentage: 110 }],
        error: null,
      });

      const stats = await gradeService.getCourseStatistics('c1');

      expect(stats.median).toBe(95);
    });

    it('returns zeros only when the course genuinely has no graded rows', async () => {
      mockSupabaseClient.from().select().eq().not.mockResolvedValue({ data: [], error: null });

      const stats = await gradeService.getCourseStatistics('c1');

      expect(stats).toEqual({
        average: 0,
        median: 0,
        highest: 0,
        lowest: 0,
        standardDeviation: 0,
      });
    });

    it('rejects when the query fails instead of returning zeros', async () => {
      mockSupabaseClient.from().select().eq().not.mockResolvedValue(supabaseError('db down'));

      await expect(gradeService.getCourseStatistics('c1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });
});
