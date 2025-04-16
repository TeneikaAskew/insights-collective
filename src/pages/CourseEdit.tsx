
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { ChevronLeft } from 'lucide-react';
import CourseEditModal from '@/components/course/CourseEditModal';
import { Course } from '@/types';

const CourseEdit = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, isInstructor, loading: permissionsLoading, isAdmin } = useCoursePermissions(courseId);
  
  const [course, setCourse] = useState<Partial<Course> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Fetch course data
  useEffect(() => {
    if (!courseId) return;
    
    const fetchCourse = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();
        
        if (error) throw error;
        setCourse(data);
      } catch (error: any) {
        console.error('Error fetching course:', error);
        toast({
          title: 'Error',
          description: 'Failed to load course details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    // Check permissions before fetching
    if (!permissionsLoading) {
      if (canEdit) {
        fetchCourse();
      } else {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to edit this course',
          variant: 'destructive',
        });
        navigate(`/courses/${courseId}`);
      }
    }
  }, [courseId, canEdit, permissionsLoading, toast, navigate]);
  
  const handleSaveCourse = async (updatedCourse: Partial<Course>) => {
    try {
      if (!courseId) return;
      
      const { error } = await supabase
        .from('courses')
        .update({
          title: updatedCourse.title,
          description: updatedCourse.description,
          category: updatedCourse.category,
          level: updatedCourse.level,
          imageUrl: updatedCourse.imageUrl || updatedCourse.thumbnail,
          // Don't update instructor_id if course already exists
        })
        .eq('id', courseId);
      
      if (error) throw error;
      
      setCourse(prev => ({ ...prev, ...updatedCourse }));
      setIsEditModalOpen(false);
      
      toast({
        title: 'Course Updated',
        description: 'The course has been successfully updated.',
      });
    } catch (error: any) {
      console.error('Error updating course:', error);
      toast({
        title: 'Error',
        description: 'Failed to update course',
        variant: 'destructive',
      });
    }
  };
  
  if (permissionsLoading || loading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/courses/${courseId}`)}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
            <h1 className="text-2xl font-bold">Edit Course</h1>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
            <CardDescription>
              Update the information for your course.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {course ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold">{course.title}</h2>
                    <p className="text-muted-foreground mt-1">{course.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Category:</span>
                        <p>{course.category}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Level:</span>
                        <p>{course.level}</p>
                      </div>
                    </div>
                  </div>
                  
                  {course.imageUrl && (
                    <div className="w-32 h-32 overflow-hidden rounded-md">
                      <img 
                        src={course.imageUrl} 
                        alt={course.title || 'Course'} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                
                <div className="pt-4">
                  <Button onClick={() => setIsEditModalOpen(true)}>
                    Edit Course Details
                  </Button>
                </div>
              </div>
            ) : (
              <p>Course not found or you don't have permission to edit it.</p>
            )}
          </CardContent>
        </Card>
        
        {course && (
          <CourseEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleSaveCourse}
            course={course}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default CourseEdit;
