import React from 'react';
import { useUserCourses } from '@/hooks/useUserCourses';
import { Spinner } from '@/components/ui/spinner';
import { Course } from '@/types/course';

interface EnrolledCourseSidebarProps {
  onCourseSelect: (course: Course) => void;
}

const EnrolledCourseSidebar: React.FC<EnrolledCourseSidebarProps> = ({ onCourseSelect }) => {
  const { courses, loading, error } = useUserCourses();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 p-4">My Courses</h2>
      <ul>
        {courses.map((course) => (
          <li
            key={course.id}
            className="p-4 hover:bg-gray-200 cursor-pointer"
            onClick={() => onCourseSelect(course)}
          >
            {course.title}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EnrolledCourseSidebar;
