import { supabase } from '@/integrations/supabase/client';
import { LessonCompletion, LessonCompletionRequirement } from '@/types/course';

export const lessonCompletionService = {
  // Mark lesson as complete
  async markLessonComplete(lessonId: string, studentId: string, method: 'manual' | 'automatic' | 'requirement_met' = 'manual') {
    const { data, error } = await supabase
      .from('lesson_completions')
      .insert({
        lesson_id: lessonId,
        student_id: studentId,
        completion_method: method,
      })
      .select()
      .single();
    
    if (error && error.code === '23505') {
      // Already completed
      return { data: null, alreadyCompleted: true };
    }
    
    if (error) throw error;
    return { data, alreadyCompleted: false };
  },

  // Mark lesson as incomplete
  async markLessonIncomplete(lessonId: string, studentId: string) {
    const { error } = await supabase
      .from('lesson_completions')
      .delete()
      .eq('lesson_id', lessonId)
      .eq('student_id', studentId);
    
    if (error) throw error;
  },

  // Get lesson completion status
  async getLessonCompletion(lessonId: string, studentId: string) {
    const { data, error } = await supabase
      .from('lesson_completions')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('student_id', studentId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No completion record found
      return null;
    }
    
    if (error) throw error;
    return data;
  },

  // Get all completions for a student in a module
  async getModuleCompletions(moduleId: string, studentId: string) {
    const { data, error } = await supabase
      .from('lesson_completions')
      .select(`
        *,
        lesson:lessons!inner(
          id,
          title,
          module_id
        )
      `)
      .eq('student_id', studentId)
      .eq('lesson.module_id', moduleId);
    
    if (error) throw error;
    return data;
  },

  // Get all completions for a student in a course
  async getCourseCompletions(courseId: string, studentId: string) {
    const { data, error } = await supabase
      .from('lesson_completions')
      .select(`
        *,
        lesson:lessons!inner(
          id,
          title,
          module:modules!inner(
            id,
            title,
            course_id
          )
        )
      `)
      .eq('student_id', studentId)
      .eq('lesson.module.course_id', courseId);
    
    if (error) throw error;
    return data;
  },

  // Set lesson completion requirements
  async setLessonRequirements(lessonId: string, requirements: Omit<LessonCompletionRequirement, 'id' | 'lesson_id' | 'created_at'>[]) {
    // Delete existing requirements
    await supabase
      .from('lesson_completion_requirements')
      .delete()
      .eq('lesson_id', lessonId);

    // Insert new requirements
    if (requirements.length > 0) {
      const { error } = await supabase
        .from('lesson_completion_requirements')
        .insert(
          requirements.map(req => ({
            ...req,
            lesson_id: lessonId,
          }))
        );
      
      if (error) throw error;
    }
  },

  // Get lesson requirements
  async getLessonRequirements(lessonId: string) {
    const { data, error } = await supabase
      .from('lesson_completion_requirements')
      .select('*')
      .eq('lesson_id', lessonId);
    
    if (error) throw error;
    return data;
  },

  // Check if lesson requirements are met
  async checkLessonRequirements(lessonId: string, studentId: string): Promise<{
    requirementsMet: boolean;
    requirements: Array<{
      type: string;
      met: boolean;
      // True when the requirement cannot be evaluated (no backing data
      // source, or missing configuration such as an assignment reference).
      // `met` is always false in that case. Undefined for evaluable checks.
      unavailable?: boolean;
      details?: any;
    }>;
  }> {
    const requirements = await this.getLessonRequirements(lessonId);

    if (!requirements || requirements.length === 0) {
      return { requirementsMet: true, requirements: [] };
    }

    const requirementChecks = await Promise.all(
      requirements.map(async (req) => {
        let met = false;
        let unavailable: true | undefined;

        switch (req.requirement_type) {
          case 'view': {
            // Check if student has viewed the lesson (tracked separately)
            const { data: viewData, error: viewError } = await supabase
              .from('content_progress')
              .select('*')
              .eq('lesson_id', lessonId)
              .eq('user_id', studentId)
              .maybeSingle();

            if (viewError) throw viewError;
            met = !!viewData;
            break;
          }

          case 'participate':
            // Participation tracking has no backing data source in the
            // schema yet, so this requirement cannot be evaluated. Flag it
            // explicitly as unavailable instead of silently reporting it
            // as an unmet requirement.
            met = false;
            unavailable = true;
            break;

          case 'submit': {
            // Check if the student has submitted THIS requirement's
            // assignment. An unscoped query would let a submission for any
            // assignment satisfy the requirement.
            const submitAssignmentId = req.requirement_data?.assignment_id;

            if (!submitAssignmentId) {
              // The requirement carries no assignment reference, so there
              // is nothing concrete to check it against.
              met = false;
              unavailable = true;
              break;
            }

            const { data: submissionData, error: submissionError } = await supabase
              .from('assignment_submissions')
              .select('*')
              .eq('student_id', studentId)
              .eq('assignment_id', submitAssignmentId)
              .in('status', ['submitted', 'graded'])
              .limit(1)
              .maybeSingle();

            if (submissionError) throw submissionError;
            met = !!submissionData;
            break;
          }

          case 'minimum_score': {
            // Check if the minimum score is achieved on this requirement's
            // assignment. There is no `grades` table in the generated
            // schema — graded work lives on assignment_submissions.grade.
            const minScore = req.requirement_data?.minimum_score || 0;
            const scoreAssignmentId = req.requirement_data?.assignment_id;

            if (!scoreAssignmentId) {
              met = false;
              unavailable = true;
              break;
            }

            const { data: gradeData, error: gradeError } = await supabase
              .from('assignment_submissions')
              .select('grade')
              .eq('student_id', studentId)
              .eq('assignment_id', scoreAssignmentId)
              .not('grade', 'is', null)
              .gte('grade', minScore)
              .limit(1)
              .maybeSingle();

            if (gradeError) throw gradeError;
            met = !!gradeData;
            break;
          }

          case 'mark_done':
            // Simple manual completion
            met = true;
            break;
        }

        return {
          type: req.requirement_type,
          met,
          unavailable,
          details: req.requirement_data,
        };
      })
    );

    const requirementsMet = requirementChecks.every(check => check.met);

    return {
      requirementsMet,
      requirements: requirementChecks,
    };
  },

  // Auto-complete lesson if requirements are met
  async autoCompleteLessonIfEligible(lessonId: string, studentId: string) {
    const { requirementsMet } = await this.checkLessonRequirements(lessonId, studentId);
    
    if (requirementsMet) {
      const existingCompletion = await this.getLessonCompletion(lessonId, studentId);
      
      if (!existingCompletion) {
        return await this.markLessonComplete(lessonId, studentId, 'automatic');
      }
    }

    return null;
  },

  // Track lesson view/access
  async trackLessonView(lessonId: string, studentId: string) {
    const { data, error } = await supabase
      .from('content_progress')
      .upsert({
        lesson_id: lessonId,
        user_id: studentId,
        progress_percentage: 100,
        time_spent: 0,
        last_accessed: new Date().toISOString(),
      }, {
        onConflict: 'lesson_id,user_id'
      });
    
    if (error) throw error;

    // Check if this view completes any requirements
    await this.autoCompleteLessonIfEligible(lessonId, studentId);
    
    return data;
  },
};

export default lessonCompletionService;