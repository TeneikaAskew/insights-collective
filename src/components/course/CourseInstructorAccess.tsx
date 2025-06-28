import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';

interface CourseInstructorAccessProps {
  courseId: string;
}

const CourseInstructorAccess = ({ courseId }: CourseInstructorAccessProps) => {
  const { canEdit, isInstructor, loading, isAdmin } = useCoursePermissions(courseId);
  const navigate = useNavigate();
  
  if (loading) {
    return null;
  }

  // Don't show if user is not an instructor or admin
  if (!isInstructor && !isAdmin) {
    return null;
  }
  
  return (
    <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
      {isAdmin && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate(`/admin/courses/${courseId}/instructors`)}
          className="flex items-center"
        >
          <Users className="h-4 w-4 mr-2" />
          Manage Instructors
        </Button>
      )}
    </div>
  );
};

export default CourseInstructorAccess;
