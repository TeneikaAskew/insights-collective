// ABOUTME: Unit tests for Assignment Service
// ABOUTME: Covers CRUD, submission and grading flows; regression-guards the removed grades-table upsert

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assignmentService } from '../assignmentService';
import { mockSupabaseClient, supabaseError } from '@/test/mocks/supabase';
import { makeSubmission } from '@/test/utils/course-fixtures';

// Builds a standalone chainable builder that resolves to `result` whether the
// chain terminates in `.single()` or is awaited directly (via `.then`).
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

// Routes each from(table) call to a dedicated builder.
function mockTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation((table: string) => {
    const builder = tables[table];
    if (!builder) {
      throw new Error(`Unexpected query to table "${table}" in this test`);
    }
    return builder;
  });
}

// For methods that hit the SAME table several times in sequence
// (e.g. submitAssignment): the Nth from() call returns the Nth builder.
function sequenceFrom(...builders: any[]) {
  let call = 0;
  (mockSupabaseClient.from as any).mockImplementation(() => {
    const builder = builders[Math.min(call, builders.length - 1)];
    call += 1;
    return builder;
  });
}

const fixtureAssignment = {
  id: 'a1',
  course_id: 'c1',
  title: 'Essay',
  points: 100,
  due_date: '2026-03-01T00:00:00Z',
};

describe('assignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAssignment', () => {
    it('creates an assignment without a rubric', async () => {
      const builder = createBuilder({ data: fixtureAssignment, error: null });
      mockTables({ assignments: builder });

      const result = await assignmentService.createAssignment({
        course_id: 'c1',
        title: 'Essay',
        points: 100,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('assignments');
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ course_id: 'c1', title: 'Essay' })
      );
      expect(result).toEqual(fixtureAssignment);
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('assignment_rubrics');
    });

    it('creates an assignment and attaches the rubric when rubric_id is given', async () => {
      const assignmentsBuilder = createBuilder({ data: fixtureAssignment, error: null });
      const rubricLinkBuilder = createBuilder({ data: null, error: null });
      mockTables({
        assignments: assignmentsBuilder,
        assignment_rubrics: rubricLinkBuilder,
      });

      const result = await assignmentService.createAssignment({
        course_id: 'c1',
        title: 'Essay',
        rubric_id: 'rubric-1',
      });

      // rubric_id must be stripped from the assignments insert payload
      expect(assignmentsBuilder.insert).toHaveBeenCalledWith(
        expect.not.objectContaining({ rubric_id: 'rubric-1' })
      );
      expect(rubricLinkBuilder.insert).toHaveBeenCalledWith({
        assignment_id: 'a1',
        rubric_id: 'rubric-1',
      });
      expect(result).toEqual(fixtureAssignment);
    });

    it('rejects when the assignment insert fails', async () => {
      mockTables({ assignments: createBuilder(supabaseError('insert failed')) });

      await expect(
        assignmentService.createAssignment({ course_id: 'c1', title: 'Essay' })
      ).rejects.toMatchObject({ message: 'insert failed' });
    });

    it('rejects with a descriptive error naming the rubric when the rubric attach fails', async () => {
      mockTables({
        assignments: createBuilder({ data: fixtureAssignment, error: null }),
        assignment_rubrics: createBuilder(supabaseError('rubric link insert failed')),
      });

      await expect(
        assignmentService.createAssignment({
          course_id: 'c1',
          title: 'Essay',
          rubric_id: 'rubric-1',
        })
      ).rejects.toThrow(
        /Assignment was created, but attaching the rubric \(rubric-1\) failed: rubric link insert failed/
      );
    });
  });

  describe('updateAssignment', () => {
    it('updates and returns the assignment', async () => {
      const updated = { ...fixtureAssignment, title: 'Essay v2' };
      const builder = createBuilder({ data: updated, error: null });
      mockTables({ assignments: builder });

      const result = await assignmentService.updateAssignment('a1', { title: 'Essay v2' });

      expect(builder.eq).toHaveBeenCalledWith('id', 'a1');
      expect(result).toEqual(updated);
    });

    it('rejects when the update fails', async () => {
      mockTables({ assignments: createBuilder(supabaseError('update failed')) });

      await expect(
        assignmentService.updateAssignment('a1', { title: 'x' })
      ).rejects.toMatchObject({ message: 'update failed' });
    });
  });

  describe('deleteAssignment', () => {
    it('deletes the assignment', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockTables({ assignments: builder });

      await expect(assignmentService.deleteAssignment('a1')).resolves.toBeUndefined();
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'a1');
    });

    it('rejects when the delete fails', async () => {
      mockTables({ assignments: createBuilder(supabaseError('delete failed')) });

      await expect(
        assignmentService.deleteAssignment('a1')
      ).rejects.toMatchObject({ message: 'delete failed' });
    });
  });

  describe('getAssignment', () => {
    it('returns the assignment with mapped submissions', async () => {
      const row = {
        ...fixtureAssignment,
        submissions: [makeSubmission({ user_id: 'student-9', workflow_state: 'submitted' })],
      };
      mockTables({ assignments: createBuilder({ data: row, error: null }) });

      const result = await assignmentService.getAssignment('a1');

      expect(result.id).toBe('a1');
      expect((result.submissions[0] as any).student_id).toBe('student-9');
      expect((result.submissions[0] as any).status).toBe('submitted');
    });

    it('returns the raw row when there are no submissions', async () => {
      mockTables({
        assignments: createBuilder({ data: { ...fixtureAssignment, submissions: null }, error: null }),
      });

      const result = await assignmentService.getAssignment('a1');

      expect(result.id).toBe('a1');
    });

    it('rejects when the fetch fails', async () => {
      mockTables({ assignments: createBuilder(supabaseError('fetch failed')) });

      await expect(
        assignmentService.getAssignment('a1')
      ).rejects.toMatchObject({ message: 'fetch failed' });
    });
  });

  describe('getAssignmentsByCourse', () => {
    it('returns assignments for the course', async () => {
      const rows = [fixtureAssignment];
      const builder = createBuilder({ data: rows, error: null });
      mockTables({ assignments: builder });

      const result = await assignmentService.getAssignmentsByCourse('c1');

      expect(builder.eq).toHaveBeenCalledWith('course_id', 'c1');
      expect(result).toEqual(rows);
    });

    it('returns an empty array when the course has no assignments', async () => {
      mockTables({ assignments: createBuilder({ data: [], error: null }) });

      const result = await assignmentService.getAssignmentsByCourse('c1');

      expect(result).toEqual([]);
    });

    it('rejects when the query fails', async () => {
      mockTables({ assignments: createBuilder(supabaseError('query failed')) });

      await expect(
        assignmentService.getAssignmentsByCourse('c1')
      ).rejects.toMatchObject({ message: 'query failed' });
    });
  });

  describe('getAssignmentsByModule', () => {
    it('returns assignments for the module', async () => {
      const rows = [fixtureAssignment];
      const builder = createBuilder({ data: rows, error: null });
      mockTables({ assignments: builder });

      const result = await assignmentService.getAssignmentsByModule('m1');

      expect(builder.eq).toHaveBeenCalledWith('module_id', 'm1');
      expect(result).toEqual(rows);
    });

    it('returns an empty array when the module has no assignments', async () => {
      mockTables({ assignments: createBuilder({ data: [], error: null }) });

      const result = await assignmentService.getAssignmentsByModule('m1');

      expect(result).toEqual([]);
    });

    it('rejects when the query fails', async () => {
      mockTables({ assignments: createBuilder(supabaseError('query failed')) });

      await expect(
        assignmentService.getAssignmentsByModule('m1')
      ).rejects.toMatchObject({ message: 'query failed' });
    });
  });

  describe('createSubmission', () => {
    it('inserts and returns the mapped submission', async () => {
      const row = makeSubmission({ user_id: 'student-1', body: 'hello' });
      mockTables({ assignment_submissions: createBuilder({ data: row, error: null }) });

      const result = await assignmentService.createSubmission({
        assignment_id: 'a1',
      });

      expect(result.student_id).toBe('student-1');
      expect(result.submission_data.text).toBe('hello');
    });

    it('rejects when the insert fails', async () => {
      mockTables({ assignment_submissions: createBuilder(supabaseError('insert failed')) });

      await expect(
        assignmentService.createSubmission({ assignment_id: 'a1' })
      ).rejects.toMatchObject({ message: 'insert failed' });
    });
  });

  describe('updateSubmission', () => {
    it('updates and returns the mapped submission', async () => {
      const row = makeSubmission({ user_id: 'student-1', workflow_state: 'unsubmitted' });
      const builder = createBuilder({ data: row, error: null });
      mockTables({ assignment_submissions: builder });

      const result = await assignmentService.updateSubmission('s1', { body: 'edit' } as any);

      expect(builder.eq).toHaveBeenCalledWith('id', 's1');
      // unsubmitted maps to draft
      expect(result.status).toBe('draft');
    });

    it('rejects when the update fails', async () => {
      mockTables({ assignment_submissions: createBuilder(supabaseError('update failed')) });

      await expect(
        assignmentService.updateSubmission('s1', {})
      ).rejects.toMatchObject({ message: 'update failed' });
    });
  });

  describe('submitAssignment', () => {
    it('promotes an existing draft to submitted', async () => {
      const draftLookup = createBuilder({ data: { id: 's1', attempt: 1 }, error: null });
      const updated = makeSubmission({ id: 's1', workflow_state: 'submitted', body: 'final text' });
      const updateBuilder = createBuilder({ data: updated, error: null });
      sequenceFrom(draftLookup, updateBuilder);

      const result = await assignmentService.submitAssignment('a1', 'student-1', {
        text: 'final text',
      });

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'final text', workflow_state: 'submitted' })
      );
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 's1');
      expect(result.status).toBe('submitted');
    });

    it('creates a first-attempt submission when no draft or prior attempts exist', async () => {
      const draftLookup = createBuilder({ data: null, error: null });
      const attemptsLookup = createBuilder({ data: [], error: null });
      const inserted = makeSubmission({ workflow_state: 'submitted', attempt: 1 });
      const insertBuilder = createBuilder({ data: inserted, error: null });
      sequenceFrom(draftLookup, attemptsLookup, insertBuilder);

      const result = await assignmentService.submitAssignment('a1', 'student-1', {
        type: 'online_text_entry',
        text: 'my answer',
      });

      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          assignment_id: 'a1',
          user_id: 'student-1',
          workflow_state: 'submitted',
          attempt: 1,
        })
      );
      expect(result.status).toBe('submitted');
    });

    it('increments the attempt number based on the latest prior attempt', async () => {
      const draftLookup = createBuilder({ data: null, error: null });
      const attemptsLookup = createBuilder({ data: [{ attempt: 2 }], error: null });
      const inserted = makeSubmission({ workflow_state: 'submitted', attempt: 3 });
      const insertBuilder = createBuilder({ data: inserted, error: null });
      sequenceFrom(draftLookup, attemptsLookup, insertBuilder);

      await assignmentService.submitAssignment('a1', 'student-1', { text: 'retry' });

      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 3 })
      );
    });

    it('rejects when the submission insert fails', async () => {
      const draftLookup = createBuilder({ data: null, error: null });
      const attemptsLookup = createBuilder({ data: [], error: null });
      const insertBuilder = createBuilder(supabaseError('insert failed'));
      sequenceFrom(draftLookup, attemptsLookup, insertBuilder);

      await expect(
        assignmentService.submitAssignment('a1', 'student-1', { text: 'x' })
      ).rejects.toMatchObject({ message: 'insert failed' });
    });

    it('REGRESSION: rejects when the draft lookup fails and does NOT insert a duplicate submission', async () => {
      const draftLookup = createBuilder(supabaseError('draft lookup failed'));
      sequenceFrom(draftLookup);

      await expect(
        assignmentService.submitAssignment('a1', 'student-1', { text: 'x' })
      ).rejects.toMatchObject({ message: 'draft lookup failed' });

      // A transient draft-lookup failure must never fall through to a write
      expect(draftLookup.insert).not.toHaveBeenCalled();
      expect(draftLookup.update).not.toHaveBeenCalled();
    });

    it('REGRESSION: rejects when the attempt probe fails instead of defaulting to attempt 1', async () => {
      const draftLookup = createBuilder({ data: null, error: null });
      const attemptsLookup = createBuilder(supabaseError('attempt probe failed'));
      sequenceFrom(draftLookup, attemptsLookup);

      await expect(
        assignmentService.submitAssignment('a1', 'student-1', { text: 'x' })
      ).rejects.toMatchObject({ message: 'attempt probe failed' });

      expect(attemptsLookup.insert).not.toHaveBeenCalled();
    });
  });

  describe('getSubmission', () => {
    it('returns the latest mapped submission', async () => {
      const row = makeSubmission({ user_id: 'student-1', grader_comments: 'Good work' });
      mockTables({ assignment_submissions: createBuilder({ data: [row], error: null }) });

      const result = await assignmentService.getSubmission('a1', 'student-1');

      expect(result?.student_id).toBe('student-1');
      expect(result?.feedback).toBe('Good work');
    });

    it('returns null when the student has no submission', async () => {
      mockTables({ assignment_submissions: createBuilder({ data: [], error: null }) });

      const result = await assignmentService.getSubmission('a1', 'student-1');

      expect(result).toBeNull();
    });

    it('rejects when the query fails', async () => {
      mockTables({ assignment_submissions: createBuilder(supabaseError('query failed')) });

      await expect(
        assignmentService.getSubmission('a1', 'student-1')
      ).rejects.toMatchObject({ message: 'query failed' });
    });
  });

  describe('getSubmissionsByAssignment', () => {
    it('returns all mapped submissions', async () => {
      const rows = [
        makeSubmission({ user_id: 'student-1' }),
        makeSubmission({ user_id: 'student-2', workflow_state: 'unsubmitted' }),
      ];
      mockTables({ assignment_submissions: createBuilder({ data: rows, error: null }) });

      const result = await assignmentService.getSubmissionsByAssignment('a1');

      expect(result).toHaveLength(2);
      expect(result[0].student_id).toBe('student-1');
      expect(result[1].status).toBe('draft');
    });

    it('returns an empty array when there are no submissions', async () => {
      mockTables({ assignment_submissions: createBuilder({ data: [], error: null }) });

      const result = await assignmentService.getSubmissionsByAssignment('a1');

      expect(result).toEqual([]);
    });

    it('rejects when the query fails', async () => {
      mockTables({ assignment_submissions: createBuilder(supabaseError('query failed')) });

      await expect(
        assignmentService.getSubmissionsByAssignment('a1')
      ).rejects.toMatchObject({ message: 'query failed' });
    });
  });

  describe('gradeSubmission', () => {
    it('updates the submission with grade fields and returns the mapped row', async () => {
      const graded = makeSubmission({
        id: 's1',
        user_id: 'student-1',
        grade: 95,
        grader_comments: 'Nice work',
        workflow_state: 'graded',
      });
      const builder = createBuilder({ data: graded, error: null });
      mockTables({ assignment_submissions: builder });

      const result = await assignmentService.gradeSubmission('s1', 95, 'Nice work', 'grader-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('assignment_submissions');
      expect(builder.update).toHaveBeenCalledWith({
        grade: 95,
        grader_comments: 'Nice work',
        graded_at: expect.any(String),
        workflow_state: 'graded',
      });
      expect(builder.eq).toHaveBeenCalledWith('id', 's1');
      expect(result.grade).toBe(95);
      expect(result.status).toBe('graded');
      expect(result.feedback).toBe('Nice work');
    });

    it('rejects when the submission update fails', async () => {
      mockTables({ assignment_submissions: createBuilder(supabaseError('update failed')) });

      await expect(
        assignmentService.gradeSubmission('s1', 95, null, 'grader-1')
      ).rejects.toMatchObject({ message: 'update failed' });
    });

    it('regression: never touches the nonexistent grades table', async () => {
      const graded = makeSubmission({ id: 's1', grade: 80, workflow_state: 'graded' });
      mockTables({ assignment_submissions: createBuilder({ data: graded, error: null }) });

      await assignmentService.gradeSubmission('s1', 80, null, 'grader-1');

      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('grades');
    });

    it('regression: does not touch the grades table on failure either', async () => {
      mockTables({ assignment_submissions: createBuilder(supabaseError('update failed')) });

      await expect(
        assignmentService.gradeSubmission('s1', 80, null, 'grader-1')
      ).rejects.toBeTruthy();

      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('grades');
    });
  });

  describe('createRubric', () => {
    it('creates a rubric without criteria', async () => {
      const rubric = { id: 'r1', title: 'Essay Rubric' };
      mockTables({ rubrics: createBuilder({ data: rubric, error: null }) });

      const result = await assignmentService.createRubric({ title: 'Essay Rubric' });

      expect(result).toEqual(rubric);
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('rubric_criteria');
    });

    it('creates a rubric and inserts its criteria with order indexes', async () => {
      const rubric = { id: 'r1', title: 'Essay Rubric' };
      const criteriaBuilder = createBuilder({ data: null, error: null });
      mockTables({
        rubrics: createBuilder({ data: rubric, error: null }),
        rubric_criteria: criteriaBuilder,
      });

      const result = await assignmentService.createRubric({
        title: 'Essay Rubric',
        criteria: [{ description: 'Grammar', points: 25 }, { description: 'Content', points: 75 }],
      });

      expect(criteriaBuilder.insert).toHaveBeenCalledWith([
        expect.objectContaining({ description: 'Grammar', rubric_id: 'r1', order_index: 0 }),
        expect.objectContaining({ description: 'Content', rubric_id: 'r1', order_index: 1 }),
      ]);
      expect(result).toEqual(rubric);
    });

    it('rejects when the rubric insert fails', async () => {
      mockTables({ rubrics: createBuilder(supabaseError('rubric insert failed')) });

      await expect(
        assignmentService.createRubric({ title: 'Essay Rubric' })
      ).rejects.toMatchObject({ message: 'rubric insert failed' });
    });

    it('rejects when the criteria insert fails', async () => {
      mockTables({
        rubrics: createBuilder({ data: { id: 'r1' }, error: null }),
        rubric_criteria: createBuilder(supabaseError('criteria insert failed')),
      });

      await expect(
        assignmentService.createRubric({
          title: 'Essay Rubric',
          criteria: [{ description: 'Grammar', points: 25 }],
        })
      ).rejects.toMatchObject({ message: 'criteria insert failed' });
    });
  });

  describe('attachRubricToAssignment', () => {
    it('inserts the assignment-rubric link', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockTables({ assignment_rubrics: builder });

      await expect(
        assignmentService.attachRubricToAssignment('a1', 'r1')
      ).resolves.toBeUndefined();
      expect(builder.insert).toHaveBeenCalledWith({
        assignment_id: 'a1',
        rubric_id: 'r1',
      });
    });

    it('rejects when the insert fails', async () => {
      mockTables({ assignment_rubrics: createBuilder(supabaseError('link insert failed')) });

      await expect(
        assignmentService.attachRubricToAssignment('a1', 'r1')
      ).rejects.toMatchObject({ message: 'link insert failed' });
    });
  });

  describe('getRubricsByAssignment', () => {
    it('returns the unwrapped rubrics', async () => {
      const rows = [
        { rubric: { id: 'r1', title: 'Essay Rubric', criteria: [] } },
        { rubric: { id: 'r2', title: 'Code Rubric', criteria: [] } },
      ];
      mockTables({ assignment_rubrics: createBuilder({ data: rows, error: null }) });

      const result = await assignmentService.getRubricsByAssignment('a1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({ id: 'r1' }));
    });

    it('returns an empty array when no rubrics are attached', async () => {
      mockTables({ assignment_rubrics: createBuilder({ data: [], error: null }) });

      const result = await assignmentService.getRubricsByAssignment('a1');

      expect(result).toEqual([]);
    });

    it('rejects when the query fails', async () => {
      mockTables({ assignment_rubrics: createBuilder(supabaseError('query failed')) });

      await expect(
        assignmentService.getRubricsByAssignment('a1')
      ).rejects.toMatchObject({ message: 'query failed' });
    });
  });
});
