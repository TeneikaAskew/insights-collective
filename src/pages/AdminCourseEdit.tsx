
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/components/layout/AppLayout';
import ModuleManager from '@/components/course/management/ModuleManager';
import AIContentGenerator from '@/components/ai/AIContentGenerator';
import { ArrowLeft, Save } from 'lucide-react';
import { CourseDetailsForm } from '@/components/course/CourseDetailsForm';
import { CourseInstructorsTab } from '@/components/course/CourseInstructorsTab';

const AdminCourseEdit = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, isInstructor, isAdmin, loading: permissionsLoading } = useCoursePermissions(courseId);
  const [course, setCourse] = useState<Partial<Course>>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    
    const fetchCourse = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('courses')
          .select(`
            *,
            instructor:profiles(
              id,
              first_name,
              last_name
            )
          `)
          .eq('id', courseId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          // Transform the data to match our frontend types
          const transformedCourse: Partial<Course> = {
            id: data.id,
            title: data.title,
            description: data.description,
            category: data.category,
            level: data.level,
            duration: data.duration,
            tags: data.tags,
            thumbnail: data.thumbnail,
            imageUrl: data.image_url,
            enrollmentStatus: data.enrollment_status,
            published: data.published,
            instructor: data.instructor ? {
              id: data.instructor.id,
              name: `${data.instructor.first_name || ''} ${data.instructor.last_name || ''}`.trim(),
              firstName: data.instructor.first_name,
              lastName: data.instructor.last_name
            } : undefined
          };
          
          setCourse(transformedCourse);
        }
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
    
    fetchCourse();
  }, [courseId, toast]);

  const handleSave = async (updatedCourse: Partial<Course>) => {
    try {
      setSaving(true);
      
      // Transform frontend model back to database model for saving
      const dbCourse = {
        title: updatedCourse.title,
        description: updatedCourse.description,
        category: updatedCourse.category,
        level: updatedCourse.level,
        duration: updatedCourse.duration,
        tags: updatedCourse.tags,
        thumbnail: updatedCourse.thumbnail,
        image_url: updatedCourse.imageUrl,
        enrollment_status: updatedCourse.enrollmentStatus,
        published: updatedCourse.published,
      };
      
      const { data, error } = await supabase
        .from('courses')
        .update(dbCourse)
        .eq('id', courseId as string)
        .select()
        .single();
      
      if (error) throw error;
      
      // Transform the response back to our frontend model
      const transformedData: Partial<Course> = {
        ...updatedCourse,
        id: data.id,
        title: data.title,
        description: data.description,
        category: data.category,
        level: data.level,
        duration: data.duration,
        tags: data.tags,
        thumbnail: data.thumbnail,
        imageUrl: data.image_url,
        enrollmentStatus: data.enrollment_status,
        published: data.published
      };
      
      setCourse(transformedData);
      
      toast({
        title: 'Success',
        description: 'Course updated successfully',
      });
    } catch (error: any) {
      console.error('Error saving course:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save course',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || permissionsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading course data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/courses')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Courses
            </Button>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Edit Course</h1>
              {course?.title && (
                <p className="text-lg text-muted-foreground mt-1">{course.title}</p>
              )}
            </div>
            <Button onClick={() => handleSave(course as Course)} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Course'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Course Details</TabsTrigger>
            <TabsTrigger value="modules">Modules & Content</TabsTrigger>
            {isAdmin && <TabsTrigger value="instructors">Instructors</TabsTrigger>}
          </TabsList>

          <TabsContent value="details">
            {course && (
              <CourseDetailsForm 
                course={course} 
                onSave={handleSave}
                loading={saving}
              />
            )}
          </TabsContent>

          <TabsContent value="modules">
            {courseId && <ModuleManager courseId={courseId} />}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="instructors">
              {courseId && <CourseInstructorsTab courseId={courseId} />}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminCourseEdit;
