import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('formatTime');

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay';
  options: string[];
  correct_answer: any;
  explanation?: string;
  points: number;
  position: number;
}

interface Quiz {
  id: string;
  title: string;
  description?: string;
  time_limit?: number;
  attempts_allowed: number;
  passing_score: number;
  randomize_questions: boolean;
}

interface QuizAttempt {
  id?: string;
  quiz_id: string;
  user_id: string;
  score: number;
  answers: Record<string, any>;
  completed_at?: string;
  time_taken?: number;
}

interface QuizTakerProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  onComplete: (attempt: QuizAttempt) => void;
  onCancel: () => void;
}

const QuizTaker: React.FC<QuizTakerProps> = ({
  quiz,
  questions: initialQuestions,
  onComplete,
  onCancel
}) => {
  const [questions] = useState(() => 
    quiz.randomize_questions 
      ? [...initialQuestions].sort(() => Math.random() - 0.5)
      : initialQuestions
  );
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(
    quiz.time_limit ? quiz.time_limit * 60 : null
  );
  const [startTime] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{ score: number; totalPoints: number; answers: any[] } | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const calculateScore = () => {
    let correctAnswers = 0;
    let totalPoints = 0;
    const detailedAnswers: any[] = [];

    questions.forEach(question => {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      let isCorrect = false;

      switch (question.question_type) {
        case 'multiple_choice':
          isCorrect = userAnswer === question.correct_answer;
          break;
        case 'true_false':
          isCorrect = userAnswer === question.correct_answer?.toString();
          break;
        case 'fill_blank':
          isCorrect = userAnswer?.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
          break;
        case 'essay':
          // Essays need manual grading
          isCorrect = false;
          break;
      }

      if (isCorrect) {
        correctAnswers += question.points;
      }

      detailedAnswers.push({
        question: question.question_text,
        userAnswer,
        correctAnswer: question.correct_answer,
        isCorrect,
        points: question.points,
        explanation: question.explanation
      });
    });

    const scorePercentage = totalPoints > 0 ? Math.round((correctAnswers / totalPoints) * 100) : 0;
    
    return {
      score: scorePercentage,
      totalPoints,
      answers: detailedAnswers
    };
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const timeTaken = Math.round((Date.now() - startTime) / 1000);
      const results = calculateScore();
      
      const attempt: QuizAttempt = {
        quiz_id: quiz.id,
        user_id: user!.id,
        score: results.score,
        answers,
        time_taken: timeTaken
      };

      // Save to database
      const { data, error } = await supabase
        .from('quiz_attempts')
        .insert(attempt)
        .select()
        .single();

      if (error) throw error;

      setResults(results);
      setShowResults(true);
      
      onComplete({ ...attempt, id: data.id, completed_at: data.completed_at });
      
    } catch (error) {
      logger.error('Error submitting quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit quiz',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: QuizQuestion) => {
    const answer = answers[question.id];

    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <RadioGroup
            value={answer?.toString() || ''}
            onValueChange={(value) => handleAnswerChange(question.id, parseInt(value))}
          >
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'true_false':
        return (
          <RadioGroup
            value={answer || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="true" />
              <Label htmlFor="true" className="cursor-pointer">True</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="false" />
              <Label htmlFor="false" className="cursor-pointer">False</Label>
            </div>
          </RadioGroup>
        );

      case 'fill_blank':
        return (
          <Input
            value={answer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your answer"
          />
        );

      case 'essay':
        return (
          <Textarea
            value={answer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your essay response"
            rows={8}
          />
        );

      default:
        return <div>Unknown question type</div>;
    }
  };

  const renderResults = () => {
    if (!results) return null;

    const passed = results.score >= quiz.passing_score;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {passed ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <span>Quiz Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold">
                {results.score}%
              </div>
              <div className={`text-lg font-medium ${passed ? 'text-green-600' : 'text-red-600'}`}>
                {passed ? 'Passed!' : 'Failed'}
              </div>
              <div className="text-gray-600">
                Passing score: {quiz.passing_score}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.answers.map((answer, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0">
                <div className="flex items-start space-x-3">
                  {answer.isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-1" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium mb-2">{answer.question}</p>
                    <p className="text-sm text-gray-600 mb-1">
                      Your answer: {answer.userAnswer}
                    </p>
                    {!answer.isCorrect && (
                      <p className="text-sm text-green-600 mb-1">
                        Correct answer: {answer.correctAnswer}
                      </p>
                    )}
                    {answer.explanation && (
                      <p className="text-sm text-blue-600">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        {answer.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button onClick={onCancel}>
            Return to Course
          </Button>
        </div>
      </div>
    );
  };

  if (showResults) {
    return renderResults();
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{quiz.title}</CardTitle>
            {timeLeft !== null && (
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span className={timeLeft < 300 ? 'text-red-600 font-bold' : ''}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Question {currentQuestion + 1} of {questions.length}</span>
              <span>{currentQ?.points} point{currentQ?.points !== 1 ? 's' : ''}</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">{currentQ?.question_text}</h3>
            {renderQuestion(currentQ)}
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
            >
              Previous
            </Button>
            
            {currentQuestion === questions.length - 1 ? (
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestion(prev => Math.min(questions.length - 1, prev + 1))}
              >
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizTaker;