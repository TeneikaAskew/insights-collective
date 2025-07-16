// Canvas-style content management service

import { supabase } from '@/integrations/supabase/client';
import type { 
  ContentItem, 
  ContentItemType, 
  CreateContentItemInput,
  CreateAssignmentInput,
  CreateQuizInput,
  Assignment,
  Quiz,
  QuizQuestion,
  AssignmentSubmission,
  Module
} from '@/types/canvas';

export class CanvasContentService {
  // Content Items
  static async getContentItems(moduleId: string): Promise<ContentItem[]> {
    const { data, error } = await supabase
      .from('content_items')
      .select(`
        *,
        assignment:assignments(*),
        quiz:quizzes(*)
      `)
      .eq('module_id', moduleId)
      .order('position');

    if (error) throw error;
    return data || [];
  }

  static async getContentItem(id: string): Promise<ContentItem | null> {
    const { data, error } = await supabase
      .from('content_items')
      .select(`
        *,
        assignment:assignments(*),
        quiz:quizzes(*, questions:quiz_questions(*))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  static async createContentItem(input: CreateContentItemInput): Promise<ContentItem> {
    // Get the next position
    const { data: existingItems } = await supabase
      .from('content_items')
      .select('position')
      .eq('module_id', input.module_id)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existingItems && existingItems.length > 0 
      ? existingItems[0].position + 1 
      : 0;

    // Create the content item
    const { data: contentItem, error: contentError } = await supabase
      .from('content_items')
      .insert({
        course_id: input.course_id,
        module_id: input.module_id,
        type: input.type,
        title: input.title,
        content: input.content,
        position: nextPosition,
        settings: input.settings || {},
        published: false
      })
      .select()
      .single();

    if (contentError) throw contentError;

    // Create type-specific records
    if (input.type === 'assignment') {
      const assignmentInput = input as CreateAssignmentInput;
      const { error: assignmentError } = await supabase
        .from('assignments')
        .insert({
          content_item_id: contentItem.id,
          points_possible: assignmentInput.points_possible,
          due_at: assignmentInput.due_at?.toISOString(),
          submission_types: assignmentInput.submission_types || ['online_text_entry'],
          allowed_attempts: assignmentInput.allowed_attempts || 1
        });

      if (assignmentError) throw assignmentError;
    } else if (input.type === 'quiz') {
      const quizInput = input as CreateQuizInput;
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          content_item_id: contentItem.id,
          quiz_type: quizInput.quiz_type || 'assignment',
          time_limit: quizInput.time_limit
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Add questions if provided
      if (quizInput.questions && quizInput.questions.length > 0) {
        const { error: questionsError } = await supabase
          .from('quiz_questions')
          .insert(
            quizInput.questions.map((q, index) => ({
              quiz_id: quiz.id,
              question_type: q.question_type,
              question_text: q.question_text,
              points: q.points,
              position: index,
              answers: q.answers,
              correct_comments: q.correct_comments,
              incorrect_comments: q.incorrect_comments,
              neutral_comments: q.neutral_comments
            }))
          );

        if (questionsError) throw questionsError;
      }
    }

    return contentItem;
  }

  static async updateContentItem(
    id: string, 
    updates: Partial<ContentItem>
  ): Promise<ContentItem> {
    const { data, error } = await supabase
      .from('content_items')
      .update({
        title: updates.title,
        content: updates.content,
        published: updates.published,
        settings: updates.settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteContentItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async reorderContentItems(
    moduleId: string, 
    itemIds: string[]
  ): Promise<void> {
    const updates = itemIds.map((id, index) => ({
      id,
      module_id: moduleId,
      position: index
    }));

    const { error } = await supabase
      .from('content_items')
      .upsert(updates);

    if (error) throw error;
  }

  // Assignments
  static async getAssignment(contentItemId: string): Promise<Assignment | null> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('content_item_id', contentItemId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async updateAssignment(
    contentItemId: string,
    updates: Partial<Assignment>
  ): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('content_item_id', contentItemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Quizzes
  static async getQuiz(contentItemId: string): Promise<Quiz | null> {
    const { data, error } = await supabase
      .from('quizzes')
      .select(`
        *,
        questions:quiz_questions(*)
      `)
      .eq('content_item_id', contentItemId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async updateQuiz(
    contentItemId: string,
    updates: Partial<Quiz>
  ): Promise<Quiz> {
    const { data, error } = await supabase
      .from('quizzes')
      .update(updates)
      .eq('content_item_id', contentItemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async addQuizQuestion(
    quizId: string,
    question: Omit<QuizQuestion, 'id' | 'quiz_id' | 'created_at' | 'updated_at'>
  ): Promise<QuizQuestion> {
    // Get next position
    const { data: existingQuestions } = await supabase
      .from('quiz_questions')
      .select('position')
      .eq('quiz_id', quizId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existingQuestions && existingQuestions.length > 0
      ? existingQuestions[0].position + 1
      : 0;

    const { data, error } = await supabase
      .from('quiz_questions')
      .insert({
        quiz_id: quizId,
        ...question,
        position: nextPosition
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Submissions
  static async submitAssignment(
    assignmentId: string,
    submission: {
      submission_type: string;
      body?: string;
      url?: string;
    }
  ): Promise<AssignmentSubmission> {
    const { data: existingSubmission } = await supabase
      .from('assignment_submissions')
      .select('attempt')
      .eq('assignment_id', assignmentId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .order('attempt', { ascending: false })
      .limit(1);

    const nextAttempt = existingSubmission && existingSubmission.length > 0
      ? existingSubmission[0].attempt + 1
      : 1;

    const { data, error } = await supabase
      .from('assignment_submissions')
      .insert({
        assignment_id: assignmentId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        submitted_at: new Date().toISOString(),
        submission_type: submission.submission_type,
        body: submission.body,
        url: submission.url,
        workflow_state: 'submitted',
        attempt: nextAttempt
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Module Management
  static async updateModuleRequirements(
    moduleId: string,
    requirements: any[],
    completionRequirements: any[]
  ): Promise<void> {
    const { error } = await supabase
      .from('modules')
      .update({
        requirements,
        completion_requirements: completionRequirements,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId);

    if (error) throw error;
  }

  // Progress Tracking
  static async markContentItemAsRead(contentItemId: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('content_item_progressions')
      .upsert({
        user_id: userId,
        content_item_id: contentItemId,
        workflow_state: 'read',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,content_item_id'
      });

    if (error) throw error;
  }

  static async markContentItemAsCompleted(contentItemId: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('content_item_progressions')
      .upsert({
        user_id: userId,
        content_item_id: contentItemId,
        workflow_state: 'completed',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,content_item_id'
      });

    if (error) throw error;
  }

  // Publishing
  static async publishContentItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .update({
        published: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  static async unpublishContentItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .update({
        published: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }
}

export default CanvasContentService;