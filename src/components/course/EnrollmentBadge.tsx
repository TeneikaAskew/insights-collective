
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getMappedCourseUuid, isValidUUID } from '@/utils/idUtils';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EnrollmentBadgeProps {
  courseId: string;
}

const EnrollmentBadge = ({ courseId }: EnrollmentBadgeProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check enrollment status when user or courseId changes
    const checkEnrollment = async () => {
      if (!user || !courseId) {
        setIsEnrolled(false);
        setLoading(false);
        return;
      }
      
      // Get the UUID mapped to this course ID for checking enrollment
      const courseUUID = getMappedCourseUuid(courseId);
      
      // Skip invalid UUIDs
      if (!isValidUUID(courseUUID)) {
        setIsEnrolled(false);
        setLoading(false);
        console.error(`Invalid course UUID: ${courseUUID} for course ID: ${courseId}`);
        return;
      }
      
      try {
        // Check enrollment in Supabase
        const { data, error } = await supabase
          .from('enrollments')
          .select('id')
          .eq('user_id', user.id)
          .eq('course_id', courseUUID)
          .maybeSingle();
        
        if (error) {
          console.error('Error checking enrollment:', error);
          setIsEnrolled(false);
        } else {
          setIsEnrolled(!!data);
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
