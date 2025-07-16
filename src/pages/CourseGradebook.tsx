import { useParams, Navigate } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Gradebook } from '@/components/course/gradebook/Gradebook';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAssignments } from '@/hooks/useAssignments';
import { useGradesByCourse, useUpsertGrade, useBulkUpdateGrades } from '@/hooks/useGrades';
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
        .from('course_enrollments')
        .select(`
          user:profiles!user_id(
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('course_id', courseId);
      
      if (error) throw error;
      return data?.map(enrollment => enrollment.user) || [];
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
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId,
  });

  // Get grades
  const { data: grades = [], isLoading: gradesLoading } = useGradesByCourse(courseId || '');

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

    if (gradeData.itemType === 'assignment') {
      grade.assignment_id = gradeData.itemId;
    } else {
      grade.quiz_id = gradeData.itemId;
    }

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

  if (!canEdit || !isInstructor) {
    return (
      <CourseLayout>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to view the gradebook. Only instructors can access this page.
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  if (studentsLoading || assignmentsLoading || quizzesLoading || gradesLoading || submissionsLoading) {
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