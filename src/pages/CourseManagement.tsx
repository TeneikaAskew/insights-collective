
import React, { useState, useEffect } from 'react';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CourseDetails from '@/components/course/management/CourseDetails';
import CourseStudents from '@/components/course/management/CourseStudents';
import CourseAnalytics from '@/components/course/management/CourseAnalytics';
import CourseSettings from '@/components/course/management/CourseSettings';
import { CanvasModuleManager } from '@/components/course/management/CanvasModuleManager';
import { AssignmentManager } from '@/components/course/management/AssignmentManager';
import { QuizManager } from '@/components/course/management/QuizManager';
import { useParams, useNavigate } from 'react-router-dom';
import { useCourseData } from '@/hooks/useCourseData';
import { Button } from '@/components/ui/button';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withCourseEditPermission } from '@/components/course/withCoursePermission';
import { supabase } from '@/integrations/supabase/client';

// Inner component that can use useSidebar
function CourseManagementContent({ courseId, course }: { courseId: string; course: any }) {
  const [activeTab, setActiveTab] = useState('details');
  const [modules, setModules] = useState<Array<{ id: string; title: string }>>([]);

  // Fetch modules for assignment/quiz assignment
  useEffect(() => {
    const fetchModules = async () => {
      if (!courseId) return;

      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .eq('course_id', courseId)
        .order('position');

      if (data && !error) {
        setModules(data);
      }
    };

    fetchModules();
  }, [courseId]);

  return (
    <div className="container mx-auto py-8 max-w-full px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/courses">
            <Button variant="ghost" size="sm" className="mb-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to courses
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{course?.title || 'Manage Course'}</h1>
          {course?.description && (
            <p className="text-gray-600 mt-1 max-w-3xl">{course.description}</p>
          )}
          <div className="flex gap-2 mt-2">
            {course?.published ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Published
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Draft
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Management Access
            </span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="details">Course Details</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="w-full">
          <CourseDetails course={course} />
        </TabsContent>

        <TabsContent value="content" className="w-full">
          <CanvasModuleManager
            courseId={courseId!}
            courseDuration={parseInt(course.duration?.toString() || '12')}
          />
        </TabsContent>

        <TabsContent value="assignments" className="w-full">
          <AssignmentManager courseId={courseId!} modules={modules} />
        </TabsContent>

        <TabsContent value="quizzes" className="w-full">
          <QuizManager courseId={courseId!} modules={modules} />
        </TabsContent>

        <TabsContent value="students" className="w-full">
          <CourseStudents courseId={courseId} />
        </TabsContent>

        <TabsContent value="analytics" className="w-full">
          <CourseAnalytics courseId={courseId} />
        </TabsContent>

        <TabsContent value="settings" className="w-full">
          <CourseSettings courseId={courseId} course={course} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CourseManagement() {
  const { courseId } = useParams<{ courseId: string }>();
  const { course, isLoading, error } = useCourseData(courseId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="container mx-auto py-8">
          <div className="flex justify-center items-center h-[50vh]">
            <Spinner size="lg" />
          </div>
        </div>
      </CourseLayout>
    );
  }

  if (error) {
    return (
      <CourseLayout>
        <div className="container mx-auto py-8">
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Error loading course</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link to="/admin/courses">
              <Button>Return to Courses</Button>
            </Link>
          </div>
        </div>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <CourseManagementContent courseId={courseId!} course={course} />
    </CourseLayout>
  );
}

export default withCourseEditPermission(CourseManagement);
