import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RubricBuilder } from '@/components/course/rubrics/RubricBuilder';
import { useRubric } from '@/hooks/useRubrics';

export default function RubricEdit() {
  const { courseId, rubricId } = useParams();
  const navigate = useNavigate();
  const { rubric, isLoading } = useRubric(rubricId!);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!rubric) {
    return <div>Rubric not found</div>;
  }

  return (
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
  );
}