import { useParams, useNavigate } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { CourseProgressOverview } from '@/components/course/CourseProgressOverview';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CourseProgress = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleViewCertificate = () => {
    // Navigate to certificate page
    navigate(`/courses/${courseId}/certificate`);
  };

  const handleNavigateToLesson = (lessonId: string) => {
    // Navigate to lesson detail page
    // You'll need to determine the module ID for proper navigation
    navigate(`/courses/${courseId}/lessons/${lessonId}`);
  };

  if (!user) {
    return (
      <CourseLayout>
        <Alert>
          <AlertDescription>
            Please log in to view your course progress.
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <CourseProgressOverview
        courseId={courseId || ''}
        studentId={user.id}
        onViewCertificate={handleViewCertificate}
        onNavigateToLesson={handleNavigateToLesson}
      />
    </CourseLayout>
  );
};

export default CourseProgress;