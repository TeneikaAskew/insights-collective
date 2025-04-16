
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import CourseDetailsForm from '@/components/course/management/CourseDetailsForm';
import ModuleManager from '@/components/course/management/ModuleManager';
import InstructorAssignment from '@/components/course/management/InstructorAssignment';

const CourseManagementPage = () => {
  const { courseId, section = 'edit' } = useParams<{ courseId: string; section?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canEdit, isInstructor, isAdmin, loading: permissionsLoading } = useCoursePermissions(courseId);
  
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (!courseId) return;
    
    const fetchCourse = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('courses')
          .select(`
            *,
            instructor:profiles(id, first_name, last_name, avatar_url)
          `)
          .eq('id', courseId)
          .single();
        
        if (error) throw error;
        setCourse(data);
      } catch (error: any) {
        console.error('Error fetching course:', error);
        toast({
          title: 'Error',
          description: 'Failed to load course data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourse();
  }, [courseId, toast]);
  
  // Check if user can access this page
  useEffect(() => {
    if (!permissionsLoading && !canEdit && courseId) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to edit this course',
        variant: 'destructive',
      });
      navigate('/courses');
    }
  }, [canEdit, permissionsLoading, courseId, navigate, toast]);
  
  const handleCourseUpdate = (updatedCourse: any) => {
    setCourse(updatedCourse);
    toast({
      title: 'Success',
      description: 'Course updated successfully',
    });
  };
  
  if (loading || permissionsLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6">
          <div className="flex justify-center py-20">
            <Progress value={30} className="w-1/2 animate-pulse" />
          </div>
        </div>
      </AppLayout>
    );
  }
  
  if (!course) {
    return (
      <AppLayout>
        <div className="container mx-auto py-6">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium">Course not found</h3>
            <Button 
              variant="outline" 
              className="mt-4" 
              onClick={() => navigate('/courses')}
            >
              Back to Courses
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => navigate('/courses')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Button>
            <h1 className="text-3xl font-bold">
              Manage Course: {course.title}
            </h1>
          </div>
        </div>
        
        <Tabs defaultValue={section === 'modules' ? 'modules' : 'details'}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger 
              value="details" 
              onClick={() => navigate(`/admin/manage-course/${courseId}/edit`)}
            >
              Course Details
            </TabsTrigger>
            <TabsTrigger 
              value="modules"
              onClick={() => navigate(`/admin/manage-course/${courseId}/modules`)}
            >
              Modules
            </TabsTrigger>
            <TabsTrigger 
              value="instructors"
              onClick={() => navigate(`/admin/manage-course/${courseId}/instructors`)}
            >
              Instructors
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="pt-6">
            <CourseDetailsForm 
              course={course} 
              onCourseUpdate={handleCourseUpdate} 
            />
          </TabsContent>
          
          <TabsContent value="modules" className="pt-6">
            <ModuleManager courseId={courseId} />
          </TabsContent>
          
          <TabsContent value="instructors" className="pt-6">
            <InstructorAssignment 
              courseId={courseId} 
              instructorId={course.instructor_id}
              onInstructorUpdate={(instructorId) => {
                setCourse({...course, instructor_id: instructorId});
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CourseManagementPage;
