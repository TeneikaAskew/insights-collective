import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { QuestionBankList } from '@/components/course/question-banks/QuestionBankList';
import { QuestionBankManager } from '@/components/course/question-banks/QuestionBankManager';
import { QuestionBank } from '@/types/course';
import { useCourseData } from '@/hooks/useCourseData';
import { CourseLayout } from '@/components/course/CourseLayout';
import CourseErrorState from '@/components/course/CourseErrorState';

export default function CourseQuestionBanks() {
  const { courseId } = useParams();
  const { course, isLoading, error } = useCourseData(courseId!);
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);

  if (isLoading) {
    return <CourseLayout><div className="p-8">Loading...</div></CourseLayout>;
  }

  // A fetch failure is not "course not found" — surface it explicitly.
  if (error) {
    return (
      <CourseLayout>
        <div className="p-8 max-w-2xl">
          <CourseErrorState title="Failed to load course" error={error} />
        </div>
      </CourseLayout>
    );
  }

  if (!course) {
    return <CourseLayout><div className="p-8">Course not found</div></CourseLayout>;
  }

  return (
    <CourseLayout>
    <div className="container mx-auto px-4 py-8">
      {selectedBank ? (
        <QuestionBankManager
          bank={selectedBank}
          onBack={() => setSelectedBank(null)}
        />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{course.title} - Question Banks</h1>
            <p className="text-gray-600 mt-2">
              Create and manage reusable question libraries for quizzes and assessments
            </p>
          </div>
          <QuestionBankList
            courseId={courseId!}
            onSelectBank={setSelectedBank}
          />
        </>
      )}
    </div>
    </CourseLayout>
  );
}