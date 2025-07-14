import React from 'react';
import { Course } from '@/types/course';
import ModuleCard from '@/components/common/ModuleCard';

interface CourseContentProps {
  course: Course | null;
}

const CourseContent: React.FC<CourseContentProps> = ({ course }) => {
  if (!course) {
    return (
      <div className="flex justify-center items-center h-full">
        <h1 className="text-2xl font-bold">Select a course to view its content</h1>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">{course.title}</h1>
      <p className="text-lg mb-6">{course.description}</p>
      <div>
        <h2 className="text-2xl font-bold mb-4">Modules</h2>
        <div className="space-y-4">
          {course.modules.map((module) => (
            <ModuleCard key={module.id} courseId={course.id} module={module} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CourseContent;
