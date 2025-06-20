
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';

interface EnrollmentBadgeProps {
  courseId: string;
  status?: string;
}

const EnrollmentBadge = ({ courseId, status }: EnrollmentBadgeProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { canEdit, isInstructor } = useCoursePermissions(courseId);
  
  useEffect(() => {
    const checkEnrollment = async () => {
      if (!user || !courseId) {
        setIsEnrolled(false);
        setLoading(false);
        return;
      }
      
      try {
        console.log('Checking enrollment for user:', user.id, 'course:', courseId);
        
        // Use the same query pattern as the admin panel
        const { data, error } = await supabase
          .from('enrollments')
          .select('id')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .maybeSingle();
        
        if (error) {
          console.error('Error checking enrollment:', error);
          setIsEnrolled(false);
        } else {
          const enrolled = !!data;
          console.log('Enrollment check result:', enrolled, 'Data:', data);
          setIsEnrolled(enrolled);
        }
      } catch (error) {
        console.error('Error checking enrollment:', error);
        setIsEnrolled(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkEnrollment();
  }, [user, courseId]);
  
  if (loading) {
    return null;
  }
  
  const handleContinue = () => {
    navigate(`/courses/${courseId}`);
  };
  
  const handleEdit = () => {
    navigate(`/admin/courses/${courseId}/edit`);
  };
  
  const handleManageMaterials = () => {
    navigate(`/courses/${courseId}/materials`);
  };
  
  const handleManageCourse = () => {
    navigate(`/course-management?courseId=${courseId}`);
  };
  
  if (!isEnrolled && !isInstructor) {
    return null;
  }
  
  return (
    <div className="flex flex-col space-y-2">
      {isInstructor ? (
        <>
          <Badge className="self-start bg-amber-500 hover:bg-amber-600">Teaching</Badge>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleContinue}>
              View Course
            </Button>
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={handleEdit}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit Course
                </Button>
                <Button variant="outline" size="sm" onClick={handleManageCourse}>
                  Manage Course
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <Badge variant="secondary" className="self-start">Currently Enrolled</Badge>
          <Button variant="outline" size="sm" onClick={handleContinue}>
            Continue Learning
          </Button>
        </>
      )}
    </div>
  );
};

export default EnrollmentBadge;
