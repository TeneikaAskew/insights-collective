import { supabase } from '@/integrations/supabase/client';
import { AssignmentSubmission, EnhancedAssignment } from '@/types/course';

export const assignmentService = {
  // Assignment CRUD operations
  async createAssignment(assignment: Partial<EnhancedAssignment>) {
    const { data, error } = await supabase
      .from('assignments')
      .insert(assignment)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateAssignment(id: string, updates: Partial<EnhancedAssignment>) {
    const { data, error } = await supabase
      .from('assignments')
      .update(updates)
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
          student_id,
          status,
          submitted_at,
          grade,
          student:profiles(id, full_name, avatar_url)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getAssignmentsByCourse(courseId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        module:modules(id, title, order_index)
      `)
      .eq('course_id', courseId)
      .order('module.order_index', { ascending: true })
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
      .insert(submission)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateSubmission(id: string, updates: Partial<AssignmentSubmission>) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async submitAssignment(assignmentId: string, studentId: string, submissionData: any) {
    // Check for existing draft submission
    const { data: existing } = await supabase
      .from('assignment_submissions')
      .select('id, attempt_number')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .eq('status', 'draft')
      .single();

    if (existing) {
      // Update existing draft
      return await this.updateSubmission(existing.id, {
        submission_data: submissionData,
        submitted_at: new Date().toISOString(),
        status: 'submitted'
      });
    } else {
      // Get latest attempt number
      const { data: attempts } = await supabase
        .from('assignment_submissions')
        .select('attempt_number')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      const attemptNumber = attempts && attempts.length > 0 
        ? attempts[0].attempt_number + 1 
        : 1;

      // Create new submission
      return await this.createSubmission({
        assignment_id: assignmentId,
        student_id: studentId,
        submission_type: submissionData.type,
        submission_data: submissionData,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
        attempt_number: attemptNumber
      });
    }
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
        ),
        grader:profiles!graded_by(id, full_name, avatar_url)
      `)
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('attempt_number', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    return data?.[0] || null;
  },

  async getSubmissionsByAssignment(assignmentId: string) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select(`
        *,
        student:profiles!student_id(
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async gradeSubmission(
    submissionId: string, 
    grade: number, 
    feedback: string | null, 
    graderId: string
  ) {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .update({
        grade,
        feedback,
        graded_by: graderId,
        graded_at: new Date().toISOString(),
        status: 'graded'
      })
      .eq('id', submissionId)
      .select()
      .single();
    
    if (error) throw error;

    // Also create/update grade record
    if (data) {
      const { error: gradeError } = await supabase
        .from('grades')
        .upsert({
          course_id: data.assignment.course_id,
          student_id: data.student_id,
          assignment_id: data.assignment_id,
          grade_type: 'assignment',
          points_earned: grade,
          points_possible: data.assignment.points,
          percentage: data.assignment.points ? (grade / data.assignment.points) * 100 : null,
          graded_by: graderId
        });

      if (gradeError) throw gradeError;
    }

    return data;
  },

  // Rubric operations
  async createRubric(rubric: any) {
    const { criteria, ...rubricData } = rubric;
    
    // Create rubric
    const { data: rubricResult, error: rubricError } = await supabase
      .from('rubrics')
      .insert(rubricData)
      .select()
      .single();
    
    if (rubricError) throw rubricError;

    // Create criteria if provided
    if (criteria && criteria.length > 0) {
      const criteriaData = criteria.map((c: any, index: number) => ({
        ...c,
        rubric_id: rubricResult.id,
        order_index: index
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
        rubric_id: rubricId
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
  }
};

export default assignmentService;