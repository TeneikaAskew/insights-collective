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

        switch (req.requirement_type) {
          case 'view':
            // Check if student has viewed the lesson (tracked separately)
            const { data: viewData } = await supabase
              .from('content_progress')
              .select('*')
              .eq('lesson_id', lessonId)
              .eq('user_id', studentId)
              .single();
            
            met = !!viewData;
            break;

          case 'participate':
            // Check participation (e.g., discussion posts, etc.)
            // Implementation depends on your participation tracking
            met = false; // Placeholder
            break;

          case 'submit':
            // Check if student has submitted assignment
            const { data: submissionData } = await supabase
              .from('assignment_submissions')
              .select('*')
              .eq('student_id', studentId)
              .in('status', ['submitted', 'graded'])
              .single();
            
            met = !!submissionData;
            break;

          case 'minimum_score':
            // Check if minimum score is achieved
            const minScore = req.requirement_data?.minimum_score || 0;
            const { data: gradeData } = await supabase
              .from('grades')
              .select('percentage')
              .eq('student_id', studentId)
              .gte('percentage', minScore)
              .single();
            
            met = !!gradeData;
            break;

          case 'mark_done':
            // Simple manual completion
            met = true;
            break;
        }

        return {
          type: req.requirement_type,
          met,
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