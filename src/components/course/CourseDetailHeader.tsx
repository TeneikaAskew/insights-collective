
import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Bookmark, CheckCircle } from 'lucide-react';
import { useCourseWishlist } from '@/hooks/useCourseWishlist';
import { useAuth } from '@/contexts/AuthContext';
import EnrollmentBadge from './EnrollmentBadge';
import CourseInstructorAccess from './management/CourseInstructorAccess';

interface CourseDetailHeaderProps {
  course: {
    id: string;
    title: string;
    description: string;
    image_url?: string;
    thumbnail?: string;
    category: string;
    level: string;
    duration?: string;
    enrollment_status?: string;
    instructor_id?: string;
  };
  isEnrolled: boolean;
  onEnroll: () => void;
  enrollmentLoading: boolean;
}

const CourseDetailHeader: React.FC<CourseDetailHeaderProps> = ({
  course,
  isEnrolled,
  onEnroll,
  enrollmentLoading
}) => {
  const { isInWishlist, addToWishlist, removeFromWishlist, loading: wishlistLoading } = useCourseWishlist();
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="pb-6">
      {isAuthenticated && (
        <CourseInstructorAccess 
          courseId={course.id}
          title={course.title}
          description={course.description}
        />
      )}
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-2/3">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
            <p className="text-muted-foreground">{course.description}</p>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center text-sm bg-muted px-3 py-1 rounded-full">
              <Calendar className="h-4 w-4 mr-2" />
              {course.category}
            </div>
            <div className="flex items-center text-sm bg-muted px-3 py-1 rounded-full">
              <Clock className="h-4 w-4 mr-2" />
              {course.duration || 'Self-paced'}
            </div>
            {course.enrollment_status && (
              <EnrollmentBadge enrollmentStatus={course.enrollment_status} />
            )}
          </div>
          
          {isAuthenticated && (
            <div className="flex gap-3 mt-6">
              {isEnrolled ? (
                <Button className="bg-green-600 hover:bg-green-700" disabled>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Enrolled
                </Button>
              ) : (
                <Button 
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={onEnroll}
                  disabled={enrollmentLoading || course.enrollment_status === 'closed'}
                >
                  {enrollmentLoading ? 'Enrolling...' : 'Enroll Now'}
                </Button>
              )}
              
              {isInWishlist(course.id) ? (
                <Button 
                  variant="outline"
                  onClick={() => removeFromWishlist(course.id)}
                  disabled={wishlistLoading}
                >
                  <Bookmark className="h-4 w-4 mr-2 fill-current" />
                  Wishlisted
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  onClick={() => addToWishlist(course.id)}
                  disabled={wishlistLoading || isEnrolled}
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  Add to Wishlist
                </Button>
              )}
            </div>
          )}
        </div>
        
        <div className="w-full md:w-1/3">
          <div className="rounded-md overflow-hidden border">
            <img 
              src={course.image_url || course.thumbnail || '/placeholder.svg'} 
              alt={course.title}
              className="w-full aspect-video object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailHeader;
