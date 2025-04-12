
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getMappedCourseUuid } from '@/utils/idUtils';

interface EnrollmentBadgeProps {
  courseId: string;
}

const EnrollmentBadge = ({ courseId }: EnrollmentBadgeProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  if (!user || !user.enrolledCourses) {
    return null;
  }
  
  // Get the UUID mapped to this course ID for checking enrollment
  const courseUUID = getMappedCourseUuid(courseId);
  
  const isEnrolled = user.enrolledCourses.includes(courseUUID);
  
  if (!isEnrolled) {
    return null;
  }
  
  const handleContinue = () => {
    navigate(`/courses/${courseId}`);
  };
  
  return (
    <div className="flex flex-col space-y-2">
      <Badge variant="secondary" className="self-start">Currently Enrolled</Badge>
      <Button variant="outline" size="sm" onClick={handleContinue}>
        Continue Learning
      </Button>
    </div>
  );
};

export default EnrollmentBadge;
