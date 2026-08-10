import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import CourseErrorState from '@/components/course/CourseErrorState';
import { Gradebook } from '@/components/course/gradebook/Gradebook';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAssignments } from '@/hooks/useAssignments';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface GradeUpdatePayload {
  studentId: string;
  itemId: string;
  itemType: 'assignment' | 'quiz';
  grade: number;
  pointsPossible?: number;
  submissionId?: string;
}

// Updates a single assignment_submissions row with ONLY columns that exist in
// the real schema (grade, graded_at, workflow_state). The legacy code wrote
// `graded_by` and `status` — columns that do not exist — and ignored the
// resulting error, so grading silently did nothing. Throws on failure so
// callers can surface the error.
async function updateSubmissionGrade(submissionId: string, grade: number) {
  const { error } = await supabase
    .from('assignment_submissions')
    .update({
      grade,
      graded_at: new Date().toISOString(),
      workflow_state: 'graded',
    })
    .eq('id', submissionId);

  if (error) {
    throw new Error(error.message || 'Failed to save grade');
  }
}

// Applies a batch of grade updates as per-submission assignment_submissions
// updates. Collects failures instead of failing the whole batch, so callers
// can report partial success honestly. Exported for tests.
export async function applyBulkSubmissionGrades(
  updates: Array<GradeUpdatePayload>,
): Promise<{ succeeded: number; failed: Array<{ update: GradeUpdatePayload; reason: string }> }> {
  const results = await Promise.all(
    updates.map(async (update) => {
      if (update.itemType !== 'assignment') {
        return {
          update,
          reason: 'Quiz scores are recorded at submission time and cannot be edited here.',
        };
      }
      if (!update.submissionId) {
        return { update, reason: 'The student has not submitted this assignment yet.' };
      }
      try {
        await updateSubmissionGrade(update.submissionId, update.grade);
        return null;
      } catch (error) {
        return {
          update,
          reason: error instanceof Error ? error.message : 'Failed to save grade',
        };
      }
    }),
  );

  const failed = results.filter(
    (r): r is { update: GradeUpdatePayload; reason: string } => r !== null,
  );
  return { succeeded: updates.length - failed.length, failed };
}

const CourseGradebook = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { canEdit, loading: permissionsLoading } = useCoursePermissions(courseId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get enrolled students
  const {
    data: students,
    isLoading: studentsLoading,
    error: studentsError,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ['course-students', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('course_id', courseId);

      if (error) throw new Error(error.message);

      if (!data || data.length === 0) {
        return [];
      }

      // Get profiles for enrolled users
      const userIds = data.map(e => e.user_id).filter(Boolean);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);

      if (profileError) throw new Error(profileError.message);

      return profiles?.map(profile => ({
        id: profile.id,
        full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        email: '', // Email not available in profiles for gradebook
        avatar_url: profile.avatar_url
      })) || [];
    },
    enabled: !!courseId && canEdit,
  });

  // Get assignments
  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useAssignments(courseId);

  // Get quizzes
  const {
    data: quizzes = [],
    isLoading: quizzesLoading,
    error: quizzesError,
    refetch: refetchQuizzes,
  } = useQuery({
    queryKey: ['course-quizzes', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          *,
          content_items!inner(course_id)
        `)
        .eq('content_items.course_id', courseId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!courseId,
  });

  // Get assignment submissions (source of truth for assignment grades)
  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = useQuery({
    queryKey: ['course-submissions', courseId],
    queryFn: async () => {
      const assignmentIds = assignments.map(a => a.id);
      if (assignmentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .in('assignment_id', assignmentIds);

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!courseId && assignments.length > 0,
  });

  // Get quiz submissions (source of truth for quiz scores — recorded at
  // submission time, not editable from the gradebook)
  const {
    data: quizSubmissions = [],
    isLoading: quizSubmissionsLoading,
    error: quizSubmissionsError,
    refetch: refetchQuizSubmissions,
  } = useQuery({
    queryKey: ['course-quiz-submissions', courseId],
    queryFn: async () => {
      const quizIds = quizzes.map(q => q.id);
      if (quizIds.length === 0) return [];

      const { data, error } = await supabase
        .from('quiz_submissions')
        .select('*')
        .in('quiz_id', quizIds);

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!courseId && quizzes.length > 0,
  });

  // The quizzes table exposes `points_possible`; the Gradebook component reads
  // `total_points`. Bridge the naming difference here.
  const quizzesForGradebook = useMemo(
    () => quizzes.map(quiz => ({
      ...quiz,
      total_points: (quiz as any).total_points ?? quiz.points_possible ?? 0,
    })),
    [quizzes],
  );

  // assignment_submissions uses user_id/workflow_state; the Gradebook component
  // matches on student_id/status. Map the real columns to the expected shape.
  const submissionsForGradebook = useMemo(
    () => submissions.map(submission => ({
      ...submission,
      student_id: submission.user_id,
      status: submission.workflow_state === 'unsubmitted'
        ? 'draft'
        : (submission.workflow_state ?? 'submitted'),
    })),
    [submissions],
  );

  // Derive grade rows from real data: graded assignment submissions and quiz
  // submissions. There is no `grades` table in the schema — these rows exist
  // only to feed the Gradebook component.
  const derivedGrades = useMemo(() => {
    const rows: any[] = [];

    submissions.forEach(submission => {
      if (submission.grade === null || submission.grade === undefined) return;
      const assignment = assignments.find(a => a.id === submission.assignment_id);
      const pointsPossible = assignment?.points ?? undefined;

      rows.push({
        id: `submission-grade-${submission.id}`,
        course_id: courseId,
        student_id: submission.user_id,
        assignment_id: submission.assignment_id,
        grade_type: 'assignment',
        points_earned: submission.grade,
        points_possible: pointsPossible,
        percentage: pointsPossible
          ? (submission.grade / pointsPossible) * 100
          : undefined,
      });
    });

    // Keep only the latest attempt per student per quiz.
    const bestQuizSubmission = new Map<string, any>();
    quizSubmissions.forEach(qs => {
      const score = qs.kept_score ?? qs.score;
      if (score === null || score === undefined) return;
      const key = `${qs.user_id}-${qs.quiz_id}`;
      const existing = bestQuizSubmission.get(key);
      if (!existing || (qs.attempt ?? 0) > (existing.attempt ?? 0)) {
        bestQuizSubmission.set(key, qs);
      }
    });

    bestQuizSubmission.forEach(qs => {
      const score = qs.kept_score ?? qs.score;
      const quiz = quizzesForGradebook.find(q => q.id === qs.quiz_id);
      const pointsPossible = quiz?.total_points || undefined;

      rows.push({
        id: `quiz-submission-grade-${qs.id}`,
        course_id: courseId,
        student_id: qs.user_id,
        quiz_id: qs.quiz_id,
        grade_type: 'quiz',
        points_earned: score,
        points_possible: pointsPossible,
        percentage: pointsPossible ? (score / pointsPossible) * 100 : undefined,
      });
    });

    return rows;
  }, [submissions, quizSubmissions, assignments, quizzesForGradebook, courseId]);

  const refreshSubmissions = () =>
    queryClient.invalidateQueries({ queryKey: ['course-submissions', courseId] });

  const handleGradeUpdate = async (gradeData: GradeUpdatePayload) => {
    if (!courseId || !user?.id) return;

    if (gradeData.itemType !== 'assignment') {
      throw new Error('Quiz scores are recorded at submission time and cannot be edited here.');
    }
    if (!gradeData.submissionId) {
      throw new Error('The student has not submitted this assignment yet.');
    }

    // Throws on failure; the Gradebook component shows the success /
    // destructive toast based on whether this resolves or rejects.
    await updateSubmissionGrade(gradeData.submissionId, gradeData.grade);
    await refreshSubmissions();
  };

  const handleBulkGradeUpdate = async (updates: GradeUpdatePayload[]) => {
    if (!courseId || !user?.id || updates.length === 0) return;

    // Resolve submission ids for updates that only carry student/item ids.
    const resolved = updates.map(update => ({
      ...update,
      submissionId:
        update.submissionId ??
        submissions.find(
          s => s.user_id === update.studentId && s.assignment_id === update.itemId,
        )?.id,
    }));

    const { succeeded, failed } = await applyBulkSubmissionGrades(resolved);

    if (failed.length === 0) {
      toast({
        title: 'Success',
        description: `${succeeded} grade${succeeded === 1 ? '' : 's'} updated successfully`,
      });
    } else {
      toast({
        title: failed.length === updates.length ? 'Bulk update failed' : 'Partial failure',
        description: `Saved ${succeeded} of ${updates.length} grades. ${failed.length} failed: ${failed[0].reason}`,
        variant: 'destructive',
      });
    }

    if (succeeded > 0) {
      await refreshSubmissions();
    }
  };

  const isLoading =
    permissionsLoading ||
    studentsLoading ||
    assignmentsLoading ||
    quizzesLoading ||
    submissionsLoading ||
    quizSubmissionsLoading;

  if (!permissionsLoading && !canEdit) {
    return (
      <CourseLayout>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to view the gradebook. Only instructors and admins can access this page.
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  const queryError =
    studentsError ||
    assignmentsError ||
    quizzesError ||
    submissionsError ||
    quizSubmissionsError;

  if (queryError) {
    return (
      <CourseLayout>
        <CourseErrorState
          title="Failed to load the gradebook"
          error={queryError}
          onRetry={() => {
            if (studentsError) refetchStudents();
            if (assignmentsError) refetchAssignments();
            if (quizzesError) refetchQuizzes();
            if (submissionsError) refetchSubmissions();
            if (quizSubmissionsError) refetchQuizSubmissions();
          }}
        />
      </CourseLayout>
    );
  }

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </CourseLayout>
    );
  }

  const hasStudents = (students || []).length > 0;
  const hasGradableItems = assignments.length > 0 || quizzes.length > 0;

  if (!hasStudents || !hasGradableItems) {
    return (
      <CourseLayout>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title={
                !hasStudents
                  ? 'No students are enrolled in this course yet.'
                  : 'This course has no assignments or quizzes to grade yet.'
              }
              description="The gradebook will appear once there are enrolled students and gradable items."
            />
          </CardContent>
        </Card>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <Gradebook
        courseId={courseId || ''}
        students={students || []}
        assignments={assignments}
        quizzes={quizzesForGradebook}
        grades={derivedGrades}
        submissions={submissionsForGradebook as any}
        onGradeUpdate={handleGradeUpdate}
        onBulkGradeUpdate={handleBulkGradeUpdate}
      />
    </CourseLayout>
  );
};

export default CourseGradebook;
