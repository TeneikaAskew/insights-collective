
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Clock, TrendingUp, Award, Target } from 'lucide-react';
import { Course } from '@/types';
import { CourseDifficulty } from '@/types/course';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  isWishlistedCourse, 
  toggleWishlistedCourse, 
  getMappedCourseUuid 
} from '@/utils/idUtils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseCard');

// Helper function to get difficulty icon and color
const getDifficultyConfig = (difficulty?: CourseDifficulty | string) => {
  switch (difficulty?.toLowerCase()) {
    case 'beginner':
      return {
        icon: Target,
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        label: 'Beginner'
      };
    case 'intermediate':
      return {
        icon: TrendingUp,
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        label: 'Intermediate'
      };
    case 'advanced':
      return {
        icon: Award,
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        label: 'Advanced'
      };
    default:
      return {
        icon: Target,
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
        label: difficulty || 'Not specified'
      };
  }
};

interface CourseCardProps {
  course: Course;
  isWishlisted?: boolean;
  onWishlistToggle?: (courseId: string, newStatus: boolean) => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ 
  course,
  isWishlisted = false,
  onWishlistToggle
}) => {
  const [wishlisted, setWishlisted] = React.useState(isWishlisted);
  const [isLoading, setIsLoading] = React.useState(false);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check wishlist status on mount
  React.useEffect(() => {
    // First check localStorage
    setWishlisted(isWishlistedCourse(course.id));
    
    // If authenticated, also check Supabase
    if (isAuthenticated && user) {
      const checkWishlist = async () => {
        try {
          // Generate consistent UUID for this course
          const courseUUID = getMappedCourseUuid(course.id);
          
          const { data } = await supabase
            .from('course_wishlists')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', courseUUID)
            .maybeSingle();
          
          // If exists in Supabase, override localStorage state
          if (data) {
            setWishlisted(true);
          }
        } catch (error) {
          logger.error('Error checking wishlist:', error);
        }
      };
      
      checkWishlist();
    }
  }, [isAuthenticated, user, course.id]);
  
  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      // Store current path for redirect after login
      localStorage.setItem('redirectAfterLogin', `/courses`);
      navigate('/login', { state: { from: `/courses` } });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Update localStorage status first for immediate UI feedback
      const newWishlistStatus = toggleWishlistedCourse(course.id);
      setWishlisted(newWishlistStatus);
      
      // Then sync with Supabase if user is authenticated
      if (isAuthenticated && user) {
        // Generate consistent UUID for this course
        const courseUUID = getMappedCourseUuid(course.id);
        
        if (newWishlistStatus) {
          // Add to wishlist in Supabase
          const { error } = await supabase
            .from('course_wishlists')
            .insert({
              user_id: user.id,
              course_id: courseUUID
            });
          
          if (error) throw error;
        } else {
          // Remove from wishlist in Supabase
          const { error } = await supabase
            .from('course_wishlists')
            .delete()
            .eq('user_id', user.id)
            .eq('course_id', courseUUID);
          
          if (error) throw error;
        }
      }
      
      toast({
        title: newWishlistStatus ? "Added to wishlist" : "Removed from wishlist",
        description: `${course.title} has been ${newWishlistStatus ? 'added to' : 'removed from'} your wishlist`,
      });
      
      // Call parent callback if provided
      if (onWishlistToggle) {
        onWishlistToggle(course.id, newWishlistStatus);
      }
    } catch (error: any) {
      logger.error('Error updating wishlist:', error);
      toast({
        title: "Wishlist update failed",
        description: error.message || "There was an error updating your wishlist",
        variant: "destructive"
      });
      
      // Revert local state if Supabase operation failed
      setWishlisted(!wishlisted);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <Link to={`/courses/${course.id}`} className="block">
        <div className="relative">
          <div className="aspect-video overflow-hidden">
            <img 
              src={course.thumbnail} 
              alt={course.title} 
              className="w-full h-full object-cover transition-transform hover:scale-105" 
            />
          </div>
          <button 
            onClick={handleWishlist}
            disabled={isLoading}
            className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm p-2 rounded-full hover:bg-white transition-colors z-10"
          >
            <Heart 
              className={`h-5 w-5 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
            />
          </button>
        </div>
      </Link>
      
      <CardContent className="p-5">
        <Link to={`/courses/${course.id}`} className="block">
          <div className="flex items-center justify-between mb-2">
            <Badge>{course.category}</Badge>
            <div className="flex items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 text-yellow-500 mr-1" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-medium">{(course.rating || 4.5).toFixed(1)}</span>
            </div>
          </div>
          
          <h3 className="text-lg font-semibold mb-2 line-clamp-2">{course.title}</h3>

          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {course.description}
          </p>

          {/* Difficulty and Estimated Hours */}
          <div className="flex flex-wrap gap-2 mb-3">
            {((course as any).difficulty_level || (course as any).difficultyLevel) && (() => {
              const difficulty = (course as any).difficulty_level || (course as any).difficultyLevel;
              const config = getDifficultyConfig(difficulty);
              const DifficultyIcon = config.icon;

              return (
                <Badge variant="secondary" className={`${config.color} flex items-center gap-1`}>
                  <DifficultyIcon className="h-3 w-3" />
                  {config.label}
                </Badge>
              );
            })()}

            {((course as any).estimated_hours || (course as any).estimatedHours) && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {((course as any).estimated_hours || (course as any).estimatedHours).toFixed(1)} hours
              </Badge>
            )}
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-primary">{course.level}</span>
            <span>{course.duration}</span>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
};

export default CourseCard;
