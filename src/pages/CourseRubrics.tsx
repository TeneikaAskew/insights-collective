import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RubricList } from '@/components/course/rubrics/RubricList';
import { useCourseData } from '@/hooks/useCourseData';

export default function CourseRubrics() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { course, isLoading } = useCourseData(courseId!);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!course) {
    return <div>Course not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/courses/${courseId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course
        </Button>
        
        <h1 className="text-3xl font-bold">{course.title} - Rubrics</h1>
        <p className="text-gray-600 mt-2">
          Create and manage rubrics for consistent grading across assignments
        </p>
      </div>

      <RubricList 
        courseId={courseId!} 
        onSelectRubric={(rubric) => navigate(`/courses/${courseId}/rubrics/${rubric.id}`)}
      />
    </div>
  );
}