import { useParams, Navigate } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Gradebook } from '@/components/course/gradebook/Gradebook';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAssignments } from '@/hooks/useAssignments';
import { useUpsertGrade, useBulkUpdateGrades } from '@/hooks/useGrades';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

const CourseGradebook = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { canEdit, isInstructor } = useCoursePermissions(courseId);
  
  const upsertGradeMutation = useUpsertGrade();
  const bulkUpdateGradesMutation = useBulkUpdateGrades();

  // Get enrolled students
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['course-students', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('course_id', courseId);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return [];
      }

      // Get profiles for enrolled users
      const userIds = data.map(e => e.user_id).filter(Boolean);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);
      
      if (profileError) throw profileError;

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
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments(courseId);

  // Get quizzes
  const { data: quizzes = [], isLoading: quizzesLoading } = useQuery({
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
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId,
  });

  // grades table does not exist in the current schema — placeholder until migration is applied
  const grades: any[] = [];

  // Get submissions
  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['course-submissions', courseId],
    queryFn: async () => {
      const assignmentIds = assignments.map(a => a.id);
      if (assignmentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .in('assignment_id', assignmentIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId && assignments.length > 0,
  });

  const handleGradeUpdate = async (gradeData: any) => {
    if (!courseId || !user?.id) return;

    const grade = {
      course_id: courseId,
      student_id: gradeData.studentId,
      grade_type: gradeData.itemType as any,
      points_earned: gradeData.grade,
      points_possible: gradeData.pointsPossible,
      percentage: gradeData.pointsPossible > 0 
        ? (gradeData.grade / gradeData.pointsPossible) * 100 
        : 0,
      graded_by: user.id,
    };

    // Note: assignment_id and quiz_id fields don't exist in current schema
    // Consider adding them via migration if needed

    await upsertGradeMutation.mutateAsync(grade);

    // Also update the submission if it's an assignment
    if (gradeData.itemType === 'assignment' && gradeData.submissionId) {
      await supabase
        .from('assignment_submissions')
        .update({
          grade: gradeData.grade,
          graded_at: new Date().toISOString(),
          graded_by: user.id,
          status: 'graded',
        })
        .eq('id', gradeData.submissionId);
    }
  };

  const handleBulkGradeUpdate = async (updates: any[]) => {
    if (!courseId || !user?.id) return;

    const grades = updates.map(update => ({
      course_id: courseId,
      student_id: update.studentId,
      grade_type: update.itemType,
      assignment_id: update.itemType === 'assignment' ? update.itemId : null,
      quiz_id: update.itemType === 'quiz' ? update.itemId : null,
      points_earned: update.grade,
      points_possible: update.pointsPossible,
      percentage: update.pointsPossible > 0 
        ? (update.grade / update.pointsPossible) * 100 
        : 0,
      graded_by: user.id,
    }));

    await bulkUpdateGradesMutation.mutateAsync(grades);
  };

  if (!canEdit) {
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

  const isLoading = studentsLoading || assignmentsLoading || quizzesLoading || submissionsLoading;

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

  return (
    <CourseLayout>
      <Gradebook
        courseId={courseId || ''}
        students={students || []}
        assignments={assignments}
        quizzes={quizzes}
        grades={grades}
        submissions={submissions}
        onGradeUpdate={handleGradeUpdate}
        onBulkGradeUpdate={handleBulkGradeUpdate}
      />
    </CourseLayout>
  );
};

export default CourseGradebook;