
import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CourseDetails from '@/components/course/management/CourseDetails';
import CourseStudents from '@/components/course/management/CourseStudents';
import CourseAnalytics from '@/components/course/management/CourseAnalytics';
import CourseSettings from '@/components/course/management/CourseSettings';
import { useParams, useNavigate } from 'react-router-dom';
import { useCourseData } from '@/hooks/useCourseData';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { Button } from '@/components/ui/button';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CourseManagement() {
  const { courseId } = useParams<{ courseId: string }>();
  const { course, isLoading, error } = useCourseData(courseId);
  const { canEdit, loading: permissionsLoading, isAdmin, isInstructor } = useCoursePermissions(courseId);
  const [activeTab, setActiveTab] = useState('details');
  const navigate = useNavigate();

  // Handle tab change to redirect to materials page when content tab is clicked
  const handleTabChange = (value: string) => {
    if (value === 'content') {
      navigate(`/course/${courseId}/manage-materials`);
      return;
    }
    setActiveTab(value);
  };

  if (isLoading || permissionsLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <div className="flex justify-center items-center h-[50vh]">
            <Spinner size="lg" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Error loading course</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link to="/admin/courses">
              <Button>Return to Courses</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!canEdit) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to manage this course. Only administrators and assigned instructors can access course management.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 max-w-full px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link to={isAdmin ? "/admin/courses" : "/courses"}>
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
              {isInstructor && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Instructor Access
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Admin Access
                </span>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="details">Course Details</TabsTrigger>
            <TabsTrigger value="content">Materials</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="w-full">
            <CourseDetails course={course} />
          </TabsContent>

          {/* Content tab is handled by redirect in handleTabChange */}

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
    </AppLayout>
  );
}
