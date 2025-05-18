
import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CourseDetails from '@/components/course/management/CourseDetails';
import CourseStudents from '@/components/course/management/CourseStudents';
import CourseAnalytics from '@/components/course/management/CourseAnalytics';
import CourseSettings from '@/components/course/management/CourseSettings';
import { useParams, useNavigate } from 'react-router-dom';
import { useCourseData } from '@/hooks/useCourseData';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';

export default function CourseManagement() {
  const { id: courseId } = useParams<{ id: string }>();
  const { course, isLoading, error } = useCourseData(courseId);
  const [activeTab, setActiveTab] = useState('details');
  const navigate = useNavigate();

  // Handle tab change to redirect to materials page when content tab is clicked
  const handleTabChange = (value: string) => {
    if (value === 'content') {
      navigate(`/courses/${courseId}/materials`);
      return;
    }
    setActiveTab(value);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <div className="flex justify-center items-center h-[50vh]">
            <Spinner className="h-8 w-8" />
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

  return (
    <AppLayout>
      <div className="container mx-auto py-8 max-w-full px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link to="/admin/courses">
              <Button variant="ghost" size="sm" className="mb-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to courses
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">{course?.title || 'Manage Course'}</h1>
            {course?.description && (
              <p className="text-gray-600 mt-1 max-w-3xl">{course.description}</p>
            )}
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
