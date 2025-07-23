import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gradeHistoryService, GradeHistoryEntry, SubmissionComment, GradingSession } from '@/services/gradeHistoryService';
import { toast } from 'sonner';

// Grade History hooks
export const useGradeHistory = (gradeId?: string) => {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['grade-history', gradeId],
    queryFn: () => gradeHistoryService.getGradeHistory(gradeId!),
    enabled: !!gradeId,
  });

  return {
    history,
    isLoading,
    error,
  };
};

export const useStudentGradeHistory = (studentId?: string, courseId?: string) => {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['student-grade-history', studentId, courseId],
    queryFn: () => gradeHistoryService.getStudentGradeHistory(studentId!, courseId!),
    enabled: !!studentId && !!courseId,
  });

  return {
    history,
    isLoading,
    error,
  };
};

export const useCourseGradeHistory = (courseId?: string, limit: number = 50) => {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['course-grade-history', courseId, limit],
    queryFn: () => gradeHistoryService.getCourseGradeHistory(courseId!, limit),
    enabled: !!courseId,
  });

  return {
    history,
    isLoading,
    error,
  };
};

// Submission Comments hooks
export const useSubmissionComments = (submissionId?: string, submissionType?: 'assignment' | 'quiz') => {
  const queryClient = useQueryClient();

  const { data: comments, isLoading, error } = useQuery({
    queryKey: ['submission-comments', submissionId, submissionType],
    queryFn: () => gradeHistoryService.getSubmissionComments(submissionId!, submissionType!),
    enabled: !!submissionId && !!submissionType,
  });

  const createCommentMutation = useMutation({
    mutationFn: (comment: Omit<SubmissionComment, 'id' | 'created_at' | 'updated_at'>) =>
      gradeHistoryService.createComment(comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-comments', submissionId, submissionType] });
      toast.success('Comment added successfully');
    },
    onError: () => {
      toast.error('Failed to add comment');
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SubmissionComment> }) =>
      gradeHistoryService.updateComment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-comments', submissionId, submissionType] });
      toast.success('Comment updated successfully');
    },
    onError: () => {
      toast.error('Failed to update comment');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => gradeHistoryService.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-comments', submissionId, submissionType] });
      toast.success('Comment deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete comment');
    },
  });

  return {
    comments,
    isLoading,
    error,
    createComment: createCommentMutation.mutate,
    updateComment: updateCommentMutation.mutate,
    deleteComment: deleteCommentMutation.mutate,
    isCreating: createCommentMutation.isPending,
    isUpdating: updateCommentMutation.isPending,
    isDeleting: deleteCommentMutation.isPending,
  };
};

// Grading Sessions hooks
export const useGradingSessions = (graderId?: string, courseId?: string) => {
  const queryClient = useQueryClient();

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['grading-sessions', graderId, courseId],
    queryFn: () => gradeHistoryService.getGradingSessions(graderId!, courseId),
    enabled: !!graderId,
  });

  const startSessionMutation = useMutation({
    mutationFn: (session: Omit<GradingSession, 'id' | 'created_at' | 'submissions_graded'>) =>
      gradeHistoryService.startGradingSession(session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading-sessions', graderId, courseId] });
      toast.success('Grading session started');
    },
    onError: () => {
      toast.error('Failed to start grading session');
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<GradingSession> }) =>
      gradeHistoryService.updateGradingSession(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading-sessions', graderId, courseId] });
    },
    onError: () => {
      toast.error('Failed to update grading session');
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: (sessionId: string) => gradeHistoryService.endGradingSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading-sessions', graderId, courseId] });
      toast.success('Grading session ended');
    },
    onError: () => {
      toast.error('Failed to end grading session');
    },
  });

  return {
    sessions,
    isLoading,
    error,
    startSession: startSessionMutation.mutate,
    updateSession: updateSessionMutation.mutate,
    endSession: endSessionMutation.mutate,
  };
};

// Notifications hooks
export const useGradeNotifications = (studentId?: string) => {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, error } = useQuery({
    queryKey: ['grade-notifications', studentId],
    queryFn: () => gradeHistoryService.getUnreadNotifications(studentId!),
    enabled: !!studentId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => gradeHistoryService.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-notifications', studentId] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => gradeHistoryService.markAllNotificationsAsRead(studentId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-notifications', studentId] });
      toast.success('All notifications marked as read');
    },
  });

  return {
    notifications,
    isLoading,
    error,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    unreadCount: notifications?.length || 0,
  };
};

// Grading Stats hooks
export const useGradingStats = (courseId?: string, graderId?: string) => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['grading-stats', courseId, graderId],
    queryFn: () => gradeHistoryService.getGradingStats(courseId!, graderId),
    enabled: !!courseId,
  });

  return {
    stats,
    isLoading,
    error,
  };
};