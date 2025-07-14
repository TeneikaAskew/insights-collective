import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import EnrolledCourseSidebar from '@/components/course/EnrolledCourseSidebar';
import CourseContent from '@/components/course/CourseContent';
import { Course } from '@/types/course';

const MyCourses = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  return (
    <AppLayout>
      <div className="flex h-full">
        <div className="w-1/4 bg-gray-100 border-r">
          <EnrolledCourseSidebar onCourseSelect={setSelectedCourse} />
        </div>
        <div className="flex-1">
          <CourseContent course={selectedCourse} />
        </div>
      </div>
    </AppLayout>
  );
};

export default MyCourses;
