// ABOUTME: Unit tests for the Lesson Completion Service
// ABOUTME: Covers completion CRUD, requirement checking, and error propagation

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { lessonCompletionService } from '../lessonCompletionService';
import { mockSupabaseClient, supabaseError, getQueryBuilder } from '@/test/mocks/supabase';
import { makeSubmission } from '@/test/utils/course-fixtures';

// Builds a standalone chainable query builder for multi-table tests where
// `from` is re-routed per table via from.mockImplementation((table) => builder).
function makeBuilder() {
  const builder: any = {};
  for (const key of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not', 'is',
    'order', 'limit',
  ]) {
    builder[key] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return builder;
}

// Routes each supabase table to its own builder so multi-table flows
// (requirements fetch + per-requirement sub-queries) can be stubbed apart.
function routeTables(builders: Record<string, any>) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => {
      if (!builders[table]) {
        throw new Error(`Unexpected table queried in test: ${table}`);
      }
      return builders[table];
    }
  );
  return builders;
}

function makeRequirement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    lesson_id: 'lesson-1',
    requirement_type: 'view',
    requirement_data: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('lessonCompletionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('markLessonComplete', () => {
    it('should insert a completion and return it', async () => {
      const completion = { id: 'lc-1', lesson_id: 'lesson-1', student_id: 'student-1' };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: completion,
        error: null,
      });

      const result = await lessonCompletionService.markLessonComplete('lesson-1', 'student-1');

      expect(result).toEqual({ data: completion, alreadyCompleted: false });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('lesson_completions');
      expect(getQueryBuilder().insert).toHaveBeenCalledWith({
        lesson_id: 'lesson-1',
        student_id: 'student-1',
        completion_method: 'manual',
      });
    });

    it('should resolve gracefully on 23505 unique violation (already completed)', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint', code: '23505' },
      });

      await expect(
        lessonCompletionService.markLessonComplete('lesson-1', 'student-1')
      ).resolves.toEqual({ data: null, alreadyCompleted: true });
    });

    it('should throw on any other insert error', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('insert failed')
      );

      await expect(
        lessonCompletionService.markLessonComplete('lesson-1', 'student-1')
      ).rejects.toThrow();
    });
  });

  describe('markLessonIncomplete', () => {
    it('should delete the completion record', async () => {
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockImplementationOnce(() => builder);
      (builder.eq as any).mockResolvedValueOnce({ error: null });

      await expect(
        lessonCompletionService.markLessonIncomplete('lesson-1', 'student-1')
      ).resolves.not.toThrow();
      expect(builder.delete).toHaveBeenCalled();
    });

    it('should throw on delete error', async () => {
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockImplementationOnce(() => builder);
      (builder.eq as any).mockResolvedValueOnce({ error: { message: 'delete failed' } });

      await expect(
        lessonCompletionService.markLessonIncomplete('lesson-1', 'student-1')
      ).rejects.toThrow();
    });
  });

  describe('getLessonCompletion', () => {
    it('should return the completion record', async () => {
      const completion = { id: 'lc-1', lesson_id: 'lesson-1', student_id: 'student-1' };

      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue({
        data: completion,
        error: null,
      });

      const result = await lessonCompletionService.getLessonCompletion('lesson-1', 'student-1');

      expect(result).toEqual(completion);
    });

    it('should return null when no record exists (PGRST116)', async () => {
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
      });

      const result = await lessonCompletionService.getLessonCompletion('lesson-1', 'student-1');

      expect(result).toBeNull();
    });

    it('should throw on any other query error', async () => {
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue(
        supabaseError('connection refused')
      );

      await expect(
        lessonCompletionService.getLessonCompletion('lesson-1', 'student-1')
      ).rejects.toThrow();
    });
  });

  describe('getModuleCompletions', () => {
    it('should return completions for the module', async () => {
      const completions = [{ id: 'lc-1' }, { id: 'lc-2' }];
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockImplementationOnce(() => builder);
      (builder.eq as any).mockResolvedValueOnce({ data: completions, error: null });

      const result = await lessonCompletionService.getModuleCompletions('module-1', 'student-1');

      expect(result).toEqual(completions);
    });

    it('should throw on query error', async () => {
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockImplementationOnce(() => builder);
      (builder.eq as any).mockResolvedValueOnce(supabaseError('boom'));

      await expect(
        lessonCompletionService.getModuleCompletions('module-1', 'student-1')
      ).rejects.toThrow();
    });
  });

  describe('getCourseCompletions', () => {
    it('should return completions for the course', async () => {
      const completions = [{ id: 'lc-1' }];
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockImplementationOnce(() => builder);
      (builder.eq as any).mockResolvedValueOnce({ data: completions, error: null });

      const result = await lessonCompletionService.getCourseCompletions('course-1', 'student-1');

      expect(result).toEqual(completions);
    });

    it('should throw on query error', async () => {
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockImplementationOnce(() => builder);
      (builder.eq as any).mockResolvedValueOnce(supabaseError('boom'));

      await expect(
        lessonCompletionService.getCourseCompletions('course-1', 'student-1')
      ).rejects.toThrow();
    });
  });

  describe('setLessonRequirements', () => {
    it('should delete existing requirements and insert new ones', async () => {
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockResolvedValueOnce({ error: null }); // delete chain
      (builder.insert as any).mockResolvedValueOnce({ error: null });

      await expect(
        lessonCompletionService.setLessonRequirements('lesson-1', [
          { requirement_type: 'mark_done' } as any,
        ])
      ).resolves.not.toThrow();

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.insert).toHaveBeenCalledWith([
        { requirement_type: 'mark_done', lesson_id: 'lesson-1' },
      ]);
    });

    it('should only delete when no requirements are given', async () => {
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockResolvedValueOnce({ error: null });

      await expect(
        lessonCompletionService.setLessonRequirements('lesson-1', [])
      ).resolves.not.toThrow();

      expect(builder.insert).not.toHaveBeenCalled();
    });

    it('should throw on insert error', async () => {
      const builder = mockSupabaseClient.from();
      (builder.eq as any).mockResolvedValueOnce({ error: null });
      (builder.insert as any).mockResolvedValueOnce({ error: { message: 'insert failed' } });

      await expect(
        lessonCompletionService.setLessonRequirements('lesson-1', [
          { requirement_type: 'view' } as any,
        ])
      ).rejects.toThrow();
    });
  });

  describe('getLessonRequirements', () => {
    it('should return requirements for the lesson', async () => {
      const requirements = [makeRequirement()];
      mockSupabaseClient.from().select().eq.mockResolvedValue({
        data: requirements,
        error: null,
      });

      const result = await lessonCompletionService.getLessonRequirements('lesson-1');

      expect(result).toEqual(requirements);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('lesson_completion_requirements');
    });

    it('should throw on query error', async () => {
      mockSupabaseClient.from().select().eq.mockResolvedValue(supabaseError('boom'));

      await expect(
        lessonCompletionService.getLessonRequirements('lesson-1')
      ).rejects.toThrow();
    });
  });

  describe('checkLessonRequirements', () => {
    function stubRequirements(requirements: any[]) {
      const reqBuilder = makeBuilder();
      reqBuilder.eq.mockResolvedValue({ data: requirements, error: null });
      return reqBuilder;
    }

    it('should report met when there are no requirements', async () => {
      routeTables({
        lesson_completion_requirements: stubRequirements([]),
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result).toEqual({ requirementsMet: true, requirements: [] });
    });

    it('should throw when fetching requirements fails', async () => {
      const reqBuilder = makeBuilder();
      reqBuilder.eq.mockResolvedValue(supabaseError('requirements fetch failed'));
      routeTables({ lesson_completion_requirements: reqBuilder });

      await expect(
        lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1')
      ).rejects.toThrow();
    });

    it("should mark a 'view' requirement met when progress exists", async () => {
      const progressBuilder = makeBuilder();
      progressBuilder.maybeSingle.mockResolvedValue({
        data: { lesson_id: 'lesson-1', user_id: 'student-1' },
        error: null,
      });

      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({ requirement_type: 'view' }),
        ]),
        content_progress: progressBuilder,
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result.requirementsMet).toBe(true);
      expect(result.requirements[0]).toMatchObject({ type: 'view', met: true });
      expect(result.requirements[0].unavailable).toBeUndefined();
    });

    it("should mark a 'view' requirement unmet when no progress exists", async () => {
      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({ requirement_type: 'view' }),
        ]),
        content_progress: makeBuilder(), // maybeSingle defaults to { data: null }
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result.requirementsMet).toBe(false);
      expect(result.requirements[0]).toMatchObject({ type: 'view', met: false });
    });

    it("should REJECT when the 'view' sub-query fails, not report met=false", async () => {
      const progressBuilder = makeBuilder();
      progressBuilder.maybeSingle.mockResolvedValue(supabaseError('view sub-query failed'));

      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({ requirement_type: 'view' }),
        ]),
        content_progress: progressBuilder,
      });

      await expect(
        lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1')
      ).rejects.toThrow();
    });

    it("should flag 'participate' as not evaluable (met=false, unavailable=true)", async () => {
      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({ requirement_type: 'participate' }),
        ]),
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result.requirementsMet).toBe(false);
      expect(result.requirements[0]).toMatchObject({
        type: 'participate',
        met: false,
        unavailable: true,
      });
    });

    // Simulates the database's filtering: maybeSingle resolves against the
    // provided submissions honoring the eq/in filters the service applied.
    function makeFilteringSubmissionBuilder(submissions: any[]) {
      const builder = makeBuilder();
      const filters: Record<string, any> = {};
      builder.eq.mockImplementation((column: string, value: any) => {
        filters[column] = value;
        return builder;
      });
      builder.in.mockImplementation((column: string, values: any[]) => {
        filters[`in:${column}`] = values;
        return builder;
      });
      builder.maybeSingle.mockImplementation(async () => {
        const match = submissions.find((s) => {
          if (filters['student_id'] && s.student_id !== filters['student_id']) return false;
          if (filters['assignment_id'] && s.assignment_id !== filters['assignment_id']) return false;
          if (filters['in:status'] && !filters['in:status'].includes(s.status)) return false;
          return true;
        });
        return { data: match ?? null, error: null };
      });
      return builder;
    }

    it("should mark 'submit' met only for a submission on the requirement's assignment", async () => {
      const submissionBuilder = makeFilteringSubmissionBuilder([
        makeSubmission({
          assignment_id: 'assignment-1',
          student_id: 'student-1',
          status: 'submitted',
        }),
      ]);

      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({
            requirement_type: 'submit',
            requirement_data: { assignment_id: 'assignment-1' },
          }),
        ]),
        assignment_submissions: submissionBuilder,
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result.requirementsMet).toBe(true);
      expect(result.requirements[0]).toMatchObject({ type: 'submit', met: true });
      // Regression: the query must be scoped to the requirement's assignment
      expect(submissionBuilder.eq).toHaveBeenCalledWith('assignment_id', 'assignment-1');
      expect(submissionBuilder.eq).toHaveBeenCalledWith('student_id', 'student-1');
    });

    it("should NOT mark 'submit' met when the only submission is for a different assignment", async () => {
      const submissionBuilder = makeFilteringSubmissionBuilder([
        makeSubmission({
          assignment_id: 'some-other-assignment',
          student_id: 'student-1',
          status: 'submitted',
        }),
      ]);

      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({
            requirement_type: 'submit',
            requirement_data: { assignment_id: 'assignment-1' },
          }),
        ]),
        assignment_submissions: submissionBuilder,
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result.requirementsMet).toBe(false);
      expect(result.requirements[0]).toMatchObject({ type: 'submit', met: false });
    });

    it("should flag 'submit' as unavailable when the requirement has no assignment reference", async () => {
      const submissionBuilder = makeBuilder();

      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({ requirement_type: 'submit', requirement_data: {} }),
        ]),
        assignment_submissions: submissionBuilder,
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result.requirements[0]).toMatchObject({
        type: 'submit',
        met: false,
        unavailable: true,
      });
      // No unscoped query should have been fired at all
      expect(submissionBuilder.maybeSingle).not.toHaveBeenCalled();
    });

    it("should REJECT when the 'submit' sub-query fails", async () => {
      const submissionBuilder = makeBuilder();
      submissionBuilder.maybeSingle.mockResolvedValue(supabaseError('submissions unavailable'));

      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({
            requirement_type: 'submit',
            requirement_data: { assignment_id: 'assignment-1' },
          }),
        ]),
        assignment_submissions: submissionBuilder,
      });

      await expect(
        lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1')
      ).rejects.toThrow();
    });

    it("should check 'minimum_score' against graded assignment_submissions, not a grades table", async () => {
      const submissionBuilder = makeBuilder();
      submissionBuilder.maybeSingle.mockResolvedValue({
        data: { grade: 92 },
        error: null,
      });

      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({
            requirement_type: 'minimum_score',
            requirement_data: { minimum_score: 80, assignment_id: 'assignment-1' },
          }),
        ]),
        assignment_submissions: submissionBuilder,
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result.requirementsMet).toBe(true);
      expect(result.requirements[0]).toMatchObject({ type: 'minimum_score', met: true });
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('grades');
      expect(submissionBuilder.eq).toHaveBeenCalledWith('assignment_id', 'assignment-1');
      expect(submissionBuilder.not).toHaveBeenCalledWith('grade', 'is', null);
      expect(submissionBuilder.gte).toHaveBeenCalledWith('grade', 80);
    });

    it("should REJECT when the 'minimum_score' sub-query fails", async () => {
      const submissionBuilder = makeBuilder();
      submissionBuilder.maybeSingle.mockResolvedValue(supabaseError('grade lookup failed'));

      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({
            requirement_type: 'minimum_score',
            requirement_data: { minimum_score: 80, assignment_id: 'assignment-1' },
          }),
        ]),
        assignment_submissions: submissionBuilder,
      });

      await expect(
        lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1')
      ).rejects.toThrow();
    });

    it("should treat 'mark_done' as always met", async () => {
      routeTables({
        lesson_completion_requirements: stubRequirements([
          makeRequirement({ requirement_type: 'mark_done' }),
        ]),
      });

      const result = await lessonCompletionService.checkLessonRequirements('lesson-1', 'student-1');

      expect(result.requirementsMet).toBe(true);
      expect(result.requirements[0]).toMatchObject({ type: 'mark_done', met: true });
    });
  });

  describe('autoCompleteLessonIfEligible', () => {
    it('should mark the lesson complete when requirements are met and no completion exists', async () => {
      const reqBuilder = makeBuilder();
      reqBuilder.eq.mockResolvedValue({ data: [], error: null }); // no requirements => met

      const completionsBuilder = makeBuilder();
      // getLessonCompletion -> no record yet
      completionsBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'no rows', code: 'PGRST116' },
      });
      // markLessonComplete insert
      completionsBuilder.single.mockResolvedValueOnce({
        data: { id: 'lc-1', completion_method: 'automatic' },
        error: null,
      });

      routeTables({
        lesson_completion_requirements: reqBuilder,
        lesson_completions: completionsBuilder,
      });

      const result = await lessonCompletionService.autoCompleteLessonIfEligible('lesson-1', 'student-1');

      expect(result).toEqual({
        data: { id: 'lc-1', completion_method: 'automatic' },
        alreadyCompleted: false,
      });
      expect(completionsBuilder.insert).toHaveBeenCalledWith({
        lesson_id: 'lesson-1',
        student_id: 'student-1',
        completion_method: 'automatic',
      });
    });

    it('should return null when the lesson is already completed', async () => {
      const reqBuilder = makeBuilder();
      reqBuilder.eq.mockResolvedValue({ data: [], error: null });

      const completionsBuilder = makeBuilder();
      completionsBuilder.single.mockResolvedValue({
        data: { id: 'lc-1' },
        error: null,
      });

      routeTables({
        lesson_completion_requirements: reqBuilder,
        lesson_completions: completionsBuilder,
      });

      const result = await lessonCompletionService.autoCompleteLessonIfEligible('lesson-1', 'student-1');

      expect(result).toBeNull();
      expect(completionsBuilder.insert).not.toHaveBeenCalled();
    });

    it('should return null when requirements are not met', async () => {
      const reqBuilder = makeBuilder();
      reqBuilder.eq.mockResolvedValue({
        data: [makeRequirement({ requirement_type: 'participate' })],
        error: null,
      });

      routeTables({
        lesson_completion_requirements: reqBuilder,
      });

      const result = await lessonCompletionService.autoCompleteLessonIfEligible('lesson-1', 'student-1');

      expect(result).toBeNull();
    });
  });

  describe('trackLessonView', () => {
    it('should upsert progress and attempt auto-completion', async () => {
      const progressBuilder = makeBuilder();
      progressBuilder.upsert.mockResolvedValue({ data: null, error: null });

      const reqBuilder = makeBuilder();
      reqBuilder.eq.mockResolvedValue({ data: [], error: null });

      const completionsBuilder = makeBuilder();
      completionsBuilder.single.mockResolvedValue({ data: { id: 'lc-1' }, error: null });

      routeTables({
        content_progress: progressBuilder,
        lesson_completion_requirements: reqBuilder,
        lesson_completions: completionsBuilder,
      });

      await expect(
        lessonCompletionService.trackLessonView('lesson-1', 'student-1')
      ).resolves.not.toThrow();

      expect(progressBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lesson_id: 'lesson-1',
          user_id: 'student-1',
          progress_percentage: 100,
        }),
        { onConflict: 'lesson_id,user_id' }
      );
    });

    it('should throw when the upsert fails', async () => {
      const progressBuilder = makeBuilder();
      progressBuilder.upsert.mockResolvedValue(supabaseError('upsert failed'));

      routeTables({ content_progress: progressBuilder });

      await expect(
        lessonCompletionService.trackLessonView('lesson-1', 'student-1')
      ).rejects.toThrow();
    });
  });
});
