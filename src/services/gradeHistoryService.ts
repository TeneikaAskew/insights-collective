// IMPORTANT: The `grade_history`, `submission_comments`, `grading_sessions`,
// and `grade_change_notifications` tables are absent from the generated
// Supabase schema (see src/integrations/supabase/types.ts). Every function in
// this service will throw at runtime until a migration adds those tables.
// Callers must surface these errors to the user — do NOT catch and swallow
// them into fake-success defaults.
import { supabase } from '@/integrations/supabase/client';

export interface GradeHistoryEntry {
  id: string;
  grade_id: string;
  assignment_id?: string;
  quiz_id?: string;
  student_id: string;
  course_id: string;
  previous_points_earned?: number;
  previous_points_possible?: number;
  previous_percentage?: number;
  previous_letter_grade?: string;
  previous_comments?: string;
  new_points_earned?: number;
  new_points_possible?: number;
  new_percentage?: number;
  new_letter_grade?: string;
  new_comments?: string;
  change_type: 'created' | 'updated' | 'deleted' | 'excused' | 'unexcused';
  change_reason?: string;
  changed_by: string;
  changed_at: string;
  grading_method?: string;
  rubric_data?: any;
  submission_id?: string;
  created_at: string;
  changer?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url?: string;
  };
  assignment?: {
    title: string;
  };
  quiz?: {
    title: string;
  };
}

export interface SubmissionComment {
  id: string;
  submission_id: string;
  submission_type: 'assignment' | 'quiz';
  comment_text: string;
  comment_type: 'feedback' | 'grade_justification' | 'question' | 'note' | 'rubric_feedback';
  author_id: string;
  author_type: 'instructor' | 'student' | 'ta' | 'grader';
  is_private: boolean;
  parent_comment_id?: string;
  thread_position: number;
  attachments?: any;
  rich_content?: any;
  is_draft: boolean;
  is_edited: boolean;
  edit_history?: any;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  author?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url?: string;
  };
  replies?: SubmissionComment[];
}

export interface GradingSession {
  id: string;
  grader_id: string;
  course_id: string;
  assignment_id?: string;
  quiz_id?: string;
  session_type: 'individual' | 'bulk' | 'rubric' | 'speedgrader';
  grading_method?: 'manual' | 'rubric' | 'auto' | 'imported';
  submissions_graded: number;
  total_submissions?: number;
  started_at: string;
  ended_at?: string;
  grading_criteria?: any;
  batch_changes?: any;
  created_at: string;
}

export const gradeHistoryService = {
  // Grade History
  async getGradeHistory(gradeId: string): Promise<GradeHistoryEntry[]> {
    const { data, error } = await supabase
      .from('grade_history')
      .select(`
        *,
        changer:profiles!changed_by(first_name, last_name, avatar_url),
        assignment:assignments(title),
        quiz:quizzes(title)
      `)
      .eq('grade_id', gradeId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as GradeHistoryEntry[];
  },

  async getStudentGradeHistory(studentId: string, courseId: string): Promise<GradeHistoryEntry[]> {
    const { data, error } = await supabase
      .from('grade_history')
      .select(`
        *,
        changer:profiles!changed_by(first_name, last_name, avatar_url),
        assignment:assignments(title),
        quiz:quizzes(title)
      `)
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as GradeHistoryEntry[];
  },

  async getCourseGradeHistory(courseId: string, limit: number = 50): Promise<GradeHistoryEntry[]> {
    const { data, error } = await supabase
      .from('grade_history')
      .select(`
        *,
        changer:profiles!changed_by(first_name, last_name, avatar_url),
        assignment:assignments(title),
        quiz:quizzes(title),
        student:profiles!student_id(first_name, last_name)
      `)
      .eq('course_id', courseId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as unknown as GradeHistoryEntry[];
  },

  async createGradeHistoryEntry(entry: Omit<GradeHistoryEntry, 'id' | 'created_at' | 'changed_at'>): Promise<GradeHistoryEntry> {
    const { data, error } = await supabase
      .from('grade_history')
      .insert(entry as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as GradeHistoryEntry;
  },

  // Submission Comments
  async getSubmissionComments(submissionId: string, submissionType: 'assignment' | 'quiz'): Promise<SubmissionComment[]> {
    const { data, error } = await supabase
      .from('submission_comments')
      .select(`
        *,
        author:profiles!author_id(first_name, last_name, avatar_url)
      `)
      .eq('submission_id', submissionId)
      .eq('submission_type', submissionType)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Organize comments into threads
    const comments = (data || []) as unknown as SubmissionComment[];
    const topLevel = comments.filter(c => !c.parent_comment_id);
    const replies = comments.filter(c => c.parent_comment_id);

    topLevel.forEach(comment => {
      comment.replies = replies.filter(r => r.parent_comment_id === comment.id);
    });

    return topLevel as unknown as SubmissionComment[];
  },

  async createComment(comment: Omit<SubmissionComment, 'id' | 'created_at' | 'updated_at'>): Promise<SubmissionComment> {
    const { data, error } = await supabase
      .from('submission_comments')
      .insert(comment as any)
      .select(`
        *,
        author:profiles!author_id(first_name, last_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data as unknown as SubmissionComment;
  },

  async updateComment(commentId: string, updates: Partial<SubmissionComment>): Promise<SubmissionComment> {
    const { data, error } = await supabase
      .from('submission_comments')
      .update(updates as any)
      .eq('id', commentId)
      .select(`
        *,
        author:profiles!author_id(first_name, last_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data as unknown as SubmissionComment;
  },

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('submission_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);

    if (error) throw error;
  },

  // Grading Sessions
  async startGradingSession(session: Omit<GradingSession, 'id' | 'created_at' | 'submissions_graded'>): Promise<GradingSession> {
    const { data, error } = await supabase
      .from('grading_sessions')
      .insert({
        ...session,
        submissions_graded: 0
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as GradingSession;
  },

  async updateGradingSession(sessionId: string, updates: Partial<GradingSession>): Promise<GradingSession> {
    const { data, error } = await supabase
      .from('grading_sessions')
      .update(updates as any)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as GradingSession;
  },

  async endGradingSession(sessionId: string): Promise<GradingSession> {
    const { data, error } = await supabase
      .from('grading_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as GradingSession;
  },

  async getGradingSessions(graderId: string, courseId?: string): Promise<GradingSession[]> {
    let query = supabase
      .from('grading_sessions')
      .select('*')
      .eq('grader_id', graderId);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query.order('started_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as GradingSession[];
  },

  // Notifications
  async getUnreadNotifications(studentId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('grade_change_notifications')
      .select('*')
      .eq('student_id', studentId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('grade_change_notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', notificationId);

    if (error) throw error;
  },

  async markAllNotificationsAsRead(studentId: string): Promise<void> {
    const { error } = await supabase
      .from('grade_change_notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('student_id', studentId)
      .eq('is_read', false);

    if (error) throw error;
  },

  // Analytics
  async getGradingStats(courseId: string, graderId?: string): Promise<{
    total_grades_changed: number;
    recent_changes: number;
    average_grading_time: number;
    // Profile id (`changed_by`) of the grader with the most history entries in
    // the fetched set, or null when there are no entries.
    most_active_grader: string | null;
  }> {
    let query = supabase
      .from('grade_history')
      .select('*')
      .eq('course_id', courseId);

    if (graderId) {
      query = query.eq('changed_by', graderId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentChanges = data?.filter(entry => 
      new Date(entry.changed_at) > weekAgo
    ).length || 0;

    // Get grading session stats
    const { data: sessions, error: sessionsError } = await supabase
      .from('grading_sessions')
      .select('*')
      .eq('course_id', courseId)
      .not('ended_at', 'is', null);

    if (sessionsError) throw sessionsError;

    const totalDuration = sessions?.reduce((sum, session) => {
      if (session.ended_at && session.started_at) {
        const duration = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
        return sum + duration;
      }
      return sum;
    }, 0) || 0;

    const totalSubmissions = sessions?.reduce((sum, session) => sum + session.submissions_graded, 0) || 0;
    const averageGradingTime = totalSubmissions > 0 ? totalDuration / totalSubmissions : 0;

    // Compute the most active grader from the fetched history rows: the
    // `changed_by` id appearing most often. Null when there are no rows.
    const changeCountsByGrader = new Map<string, number>();
    (data || []).forEach(entry => {
      if (entry.changed_by) {
        changeCountsByGrader.set(
          entry.changed_by,
          (changeCountsByGrader.get(entry.changed_by) || 0) + 1
        );
      }
    });

    let mostActiveGrader: string | null = null;
    let mostActiveCount = 0;
    changeCountsByGrader.forEach((count, grader) => {
      if (count > mostActiveCount) {
        mostActiveCount = count;
        mostActiveGrader = grader;
      }
    });

    return {
      total_grades_changed: data?.length || 0,
      recent_changes: recentChanges,
      average_grading_time: averageGradingTime,
      most_active_grader: mostActiveGrader
    };
  }
};