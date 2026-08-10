import { supabase } from '@/integrations/supabase/client';
import { AssignmentSubmission, EnhancedAssignment } from '@/types/course';

// Maps a raw assignment_submissions DB row to the AssignmentSubmission interface.
// The DB uses different column names than the interface (user_id vs student_id,
// workflow_state vs status, etc). This mapper keeps all consumers working without change.
function mapSubmission(row: any): AssignmentSubmission {
  return {
    ...row,
    student_id: row.user_id,
    submission_data: {
      text: row.body ?? undefined,
      url: row.url ?? undefined,
    },
    status: row.workflow_state === 'unsubmitted' ? 'draft' : (row.workflow_state ?? 'draft'),
    attempt_number: row.attempt ?? 1,
    feedback: row.grader_comments ?? undefined,
  };
}

// Strips fields that are not real DB columns and converts empty strings to null
// for optional UUID/timestamp FK fields so Postgres doesn't reject them.
function sanitizeAssignment(assignment: Partial<EnhancedAssignment> & { rubric_id?: string }) {
  const { rubric_id, ...rest } = assignment as any;

  const latePolicy = rest.late_policy
    ? {
        deduction_per_day: isNaN(rest.late_policy.deduction_per_day) ? undefined : rest.late_policy.deduction_per_day,
        maximum_deduction: isNaN(rest.late_policy.maximum_deduction) ? undefined : rest.late_policy.maximum_deduction,
        grace_period_hours: isNaN(rest.late_policy.grace_period_hours) ? undefined : rest.late_policy.grace_period_hours,
      }
    : null;

  return {
    dbData: {
      ...rest,
      module_id: rest.module_id || null,
      due_date: rest.due_date || null,
      peer_review_due_date: rest.peer_review_due_date || null,
      late_policy: latePolicy,
    },
    rubric_id: rubric_id as string | undefined,
  };
}

export const assignmentService = {
  // Assignment CRUD operations
  async createAssignment(assignment: Partial<EnhancedAssignment> & { rubric_id?: string }) {
    const { dbData, rubric_id } = sanitizeAssignment(assignment);

    const { data, error } = await supabase
      .from('assignments')
      .insert(dbData)
      .select()
      .single();

    if (error) throw error;

    // Attach rubric if provided. The assignment row already exists at this
    // point, so surface a descriptive error rather than swallowing the failure.
    if (rubric_id && data?.id) {
      try {
        await this.attachRubricToAssignment(data.id, rubric_id);
      } catch (rubricError) {
        const reason =
          rubricError instanceof Error
            ? rubricError.message
            : (rubricError as any)?.message ?? String(rubricError);
        throw new Error(
          `Assignment was created, but attaching the rubric (${rubric_id}) failed: ${reason}`
        );
      }
    }

    return data;
  },

  async updateAssignment(id: string, updates: Partial<EnhancedAssignment> & { rubric_id?: string }) {
    const { dbData } = sanitizeAssignment(updates);

    const { data, error } = await supabase
      .from('assignments')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAssignment(id: string) {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getAssignment(id: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        course:courses(id, title),
        module:modules(id, title),
        submissions:assignment_submissions(
          id,
          user_id,
          workflow_state,
          submitted_at,
          grade,
          student:profiles!user_id(id, first_name, last_name, avatar_url)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (data && data.submissions) {
      return {
        ...data,
        submissions: (data.submissions as any[]).map(mapSubmission),
      };
    }

    return data;
  },

  async getAssignmentsByCourse(courseId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        module:modules(id, title, position),
        submission_count:assignment_submissions(count)
      `)
      .eq('course_id', courseId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getAssignmentsByModule(moduleId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('module_id', moduleId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Assignment submission operations
  async createSubmission(submission: Partial<AssignmentSubmission>) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .insert(submission as any)
      .select()
      .single();

    if (error) throw error;
    return mapSubmission(data);
  },

  async updateSubmission(id: string, updates: Partial<AssignmentSubmission>) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapSubmission(data);
  },

  async submitAssignment(assignmentId: string, studentId: string, submissionData: any) {
    // Check for existing draft submission. maybeSingle keeps "no draft" clean
    // (null data, null error); a real error must throw — falling through here
    // used to insert a DUPLICATE submission on transient failures.
    const { data: existing, error: draftError } = await supabase
      .from('assignment_submissions')
      .select('id, attempt')
      .eq('assignment_id', assignmentId)
      .eq('user_id', studentId)
      .eq('workflow_state', 'draft')
      .maybeSingle();

    if (draftError) throw draftError;

    if (existing) {
      // Update existing draft to submitted
      const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
          body: submissionData.text ?? null,
          url: submissionData.url ?? null,
          submitted_at: new Date().toISOString(),
          workflow_state: 'submitted',
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return mapSubmission(data);
    }

    // Get latest attempt number. A failed probe must throw — defaulting to
    // attempt 1 on error would violate the attempt-uniqueness expectations.
    const { data: attempts, error: attemptsError } = await supabase
      .from('assignment_submissions')
      .select('attempt')
      .eq('assignment_id', assignmentId)
      .eq('user_id', studentId)
      .order('attempt', { ascending: false })
      .limit(1);

    if (attemptsError) throw attemptsError;

    const attempt = attempts && attempts.length > 0
      ? (attempts[0].attempt ?? 0) + 1
      : 1;

    // Create new submission
    const { data, error } = await supabase
      .from('assignment_submissions')
      .insert({
        assignment_id: assignmentId,
        user_id: studentId,
        submission_type: submissionData.type,
        body: submissionData.text ?? null,
        url: submissionData.url ?? null,
        submitted_at: new Date().toISOString(),
        workflow_state: 'submitted',
        attempt,
      })
      .select()
      .single();

    if (error) throw error;
    return mapSubmission(data);
  },

  async getSubmission(assignmentId: string, studentId: string) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select(`
        *,
        assignment:assignments(
          id,
          title,
          points,
          due_date,
          instructions,
          grading_type
        )
      `)
      .eq('assignment_id', assignmentId)
      .eq('user_id', studentId)
      .order('attempt', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] ? mapSubmission(data[0]) : null;
  },

  async getSubmissionsByAssignment(assignmentId: string) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select(`
        *,
        student:profiles!user_id(
          id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapSubmission);
  },

  async gradeSubmission(
    submissionId: string,
    grade: number,
    feedback: string | null,
    graderId: string
  ) {
    // The assignment_submissions row is the sole source of truth for grades.
    const { data, error } = await supabase
      .from('assignment_submissions')
      .update({
        grade,
        grader_comments: feedback,
        graded_at: new Date().toISOString(),
        workflow_state: 'graded',
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    return mapSubmission(data);
  },

  // Rubric operations
  async createRubric(rubric: any) {
    const { criteria, ...rubricData } = rubric;

    const { data: rubricResult, error: rubricError } = await supabase
      .from('rubrics')
      .insert(rubricData)
      .select()
      .single();

    if (rubricError) throw rubricError;

    if (criteria && criteria.length > 0) {
      const criteriaData = criteria.map((c: any, index: number) => ({
        ...c,
        rubric_id: rubricResult.id,
        order_index: index,
      }));

      const { error: criteriaError } = await supabase
        .from('rubric_criteria')
        .insert(criteriaData);

      if (criteriaError) throw criteriaError;
    }

    return rubricResult;
  },

  async attachRubricToAssignment(assignmentId: string, rubricId: string) {
    const { error } = await supabase
      .from('assignment_rubrics')
      .insert({
        assignment_id: assignmentId,
        rubric_id: rubricId,
      });

    if (error) throw error;
  },

  async getRubricsByAssignment(assignmentId: string) {
    const { data, error } = await supabase
      .from('assignment_rubrics')
      .select(`
        rubric:rubrics(
          *,
          criteria:rubric_criteria(*)
        )
      `)
      .eq('assignment_id', assignmentId);

    if (error) throw error;
    return data?.map(item => item.rubric) || [];
  },
};

export default assignmentService;
