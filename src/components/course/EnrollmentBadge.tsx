
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface EnrollmentBadgeProps {
  courseId: string;
}

const EnrollmentBadge = ({ courseId }: EnrollmentBadgeProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  if (!user || !user.enrolledCourses) {
    return null;
  }
  
  const isEnrolled = user.enrolledCourses.includes(courseId);
  
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
