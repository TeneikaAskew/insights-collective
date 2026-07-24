import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RubricBuilder } from '@/components/course/rubrics/RubricBuilder';
import { useRubric } from '@/hooks/useRubrics';
import { CourseLayout } from '@/components/course/CourseLayout';
import CourseErrorState from '@/components/course/CourseErrorState';

export default function RubricEdit() {
  const { courseId, rubricId } = useParams();
  const navigate = useNavigate();
  const { rubric, isLoading, error, refetch } = useRubric(rubricId!);

  if (isLoading) {
    return <CourseLayout><div className="p-8">Loading...</div></CourseLayout>;
  }

  // A fetch failure is not "rubric not found" — surface it explicitly.
  if (error) {
    return (
      <CourseLayout>
        <div className="p-8 max-w-2xl">
          <CourseErrorState
            title="Failed to load rubric"
            error={error}
            onRetry={() => refetch()}
          />
        </div>
      </CourseLayout>
    );
  }

  if (!rubric) {
    return <CourseLayout><div className="p-8">Rubric not found</div></CourseLayout>;
  }

  return (
    <CourseLayout>
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/courses/${courseId}/rubrics`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Rubrics
        </Button>
        
        <h1 className="text-3xl font-bold">Edit Rubric</h1>
      </div>

      <RubricBuilder 
        rubricId={rubricId!}
        onSave={() => navigate(`/courses/${courseId}/rubrics`)}
      />
    </div>
    </CourseLayout>
  );
}