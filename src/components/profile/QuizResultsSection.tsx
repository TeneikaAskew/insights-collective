
import React from 'react';
import { quizQuestions } from '@/data/careerQuizData';

type QuizResultsSectionProps = {
  quizAnswers: Record<number, number | string>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<number, number | string>>>;
};

const QuizResultsSection: React.FC<QuizResultsSectionProps> = ({ quizAnswers, setQuizAnswers }) => {
  const handleAnswerChange = (questionId: number, value: number | string) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  return (
    <div className="space-y-4">
      {quizQuestions.map((question) => (
        <div key={question.id} className="space-y-1">
          <label htmlFor={`question-${question.id}`} className="block font-medium text-gray-700">
            {question.text}
          </label>
          {question.type === 'multiple-choice' && question.options && (
            <select
              id={`question-${question.id}`}
              value={quizAnswers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            >
              <option value="" disabled>
                Select an option
              </option>
              {question.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.text}
                </option>
              ))}
            </select>
          )}
          {question.type === 'scale' && (
            <textarea
              id={`question-${question.id}`}
              value={quizAnswers[question.id] || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default QuizResultsSection;
