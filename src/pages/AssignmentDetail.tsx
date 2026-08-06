import { useParams, Link } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAssignment, useSubmission, useSubmitAssignment } from '@/hooks/useAssignments';
import { AssignmentSubmissionComponent } from '@/components/course/assignments/AssignmentSubmission';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import CourseErrorState from '@/components/course/CourseErrorState';

const AssignmentDetail = () => {
  const { courseId, moduleId, assignmentId } = useParams<{ 
    courseId: string; 
    moduleId: string; 
    assignmentId: string; 
  }>();
  const { user } = useAuth();
  
  const {
    data: assignment,
    isLoading: assignmentLoading,
    isError: assignmentError,
    error: assignmentErrorDetail,
    refetch: refetchAssignment,
  } = useAssignment(assignmentId || '');
  const {
    data: submission,
    isLoading: submissionLoading,
    isError: submissionError,
    error: submissionErrorDetail,
    refetch: refetchSubmission,
  } = useSubmission(
    assignmentId || '',
    user?.id || ''
  );
  const submitMutation = useSubmitAssignment();
  
  const handleSubmit = async (submissionData: any) => {
    if (!assignmentId || !user?.id) return;
    
    await submitMutation.mutateAsync({
      assignmentId,
      studentId: user.id,
      submissionData,
    });
  };
  
  if (assignmentLoading || submissionLoading) {
    return (
      <CourseLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </CourseLayout>
    );
  }
  
  // A failed query is not the same as a missing assignment — show an explicit
  // error with a retry instead of the not-found copy.
  if (assignmentError) {
    return (
      <CourseLayout>
        <div className="max-w-4xl mx-auto py-12 space-y-4">
          <CourseErrorState
            title="Failed to load assignment"
            error={assignmentErrorDetail}
            onRetry={() => refetchAssignment()}
          />
          <Button variant="ghost" asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Module
            </Link>
          </Button>
        </div>
      </CourseLayout>
    );
  }

  if (!assignment) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Assignment Not Found</h1>
          <p className="text-muted-foreground mb-6">The assignment you're looking for doesn't exist or has been removed.</p>
          <Button asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>Back to Module</Link>
          </Button>
        </div>
      </CourseLayout>
    );
  }
  
  return (
    <CourseLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" className="mr-2" asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Module
            </Link>
          </Button>
        </div>
        
        {!user ? (
          <Alert>
            <AlertDescription>
              Please log in to view and submit assignments.
            </AlertDescription>
          </Alert>
        ) : submissionError ? (
          // Don't offer a blank submit form when we couldn't load the existing
          // submission — the student could unknowingly overwrite their work.
          <CourseErrorState
            title="Failed to load your submission"
            error={submissionErrorDetail}
            onRetry={() => refetchSubmission()}
          />
        ) : (
          <AssignmentSubmissionComponent
            assignment={assignment as any}
            submission={submission}
            onSubmit={handleSubmit}
            isSubmitting={submitMutation.isPending}
          />
        )}
      </div>
    </CourseLayout>
  );
};

export default AssignmentDetail;