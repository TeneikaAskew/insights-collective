// Canvas-style quiz results and review page
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import CourseErrorState from '@/components/course/CourseErrorState';
import {
  CheckCircle, 
  XCircle, 
  Clock, 
  Award,
  FileText,
  AlertCircle,
  ChevronLeft,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import type { ContentItem, Quiz, QuizQuestion } from '@/types/canvas';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CanvasQuizResults');

interface QuizSubmissionWithAnswers {
  id: string;
  quiz_id: string;
  user_id: string;
  attempt: number;
  started_at: string;
  finished_at: string;
  time_spent: number;
  score: number;
  kept_score: number;
  workflow_state: string;
  answers: Array<{
    quiz_question_id: string;
    answer_data: any;
    correct: boolean;
    points: number;
  }>;
}

export default function CanvasQuizResults() {
  const { courseId, moduleId, contentItemId, submissionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [contentItem, setContentItem] = useState<ContentItem | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [submission, setSubmission] = useState<QuizSubmissionWithAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  // Load ERROR (backend failure) — distinct from a genuinely missing submission.
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    loadQuizResults();
  }, [submissionId]);

  const loadQuizResults = async () => {
    if (!submissionId || !user) return;

    try {
      setLoading(true);
      setLoadError(null);

      // Load submission with answers
      const { data: submissionData, error: submissionError } = await supabase
        .from('quiz_submissions')
        .select(`
          *,
          quiz_submission_answers (
            quiz_question_id,
            answer_data,
            correct,
            points
          )
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError) {
        // PGRST116 = zero rows: the submission genuinely doesn't exist, which
        // is the not-found screen — anything else is a load ERROR.
        if ((submissionError as any).code === 'PGRST116') {
          return;
        }
        throw new Error(submissionError.message);
      }

      const submissionWithAnswers = {
        ...submissionData,
        answers: submissionData.quiz_submission_answers || []
      };
      setSubmission(submissionWithAnswers);

      // Load quiz details
      // getQuizById, NOT getQuiz: getQuiz is keyed on content_item_id, so
      // passing a quiz_id searched the wrong column, matched nothing and threw
      // "Quiz not found" on every single submission. Found by removing the
      // count-guards from quiz-results.spec.ts, which had been asserting
      // against that error screen.
      const quizData = await CanvasContentService.getQuizById(submissionData.quiz_id);
      if (!quizData) throw new Error('Quiz not found');
      setQuiz(quizData);
      // Post-submission the same RPC reveals the key, subject to the quiz's
      // show_correct_answers setting.
      setQuestions(await CanvasContentService.getQuizQuestionsForTaking(quizData.id));

      // Load content item (used for the page title).
      //
      // Was `.eq('settings->quiz_id', submissionData.quiz_id)`, which failed
      // twice over. `->` yields JSONB, so comparing it to a bare uuid string
      // raised 22P02 "invalid input syntax for type json" on every load — the
      // operator needed is `->>`. And even spelled correctly it read a settings
      // key that is not the schema's relationship: content_items.settings is
      // {} on real rows, while quizzes.content_item_id is the actual link. So
      // the title never loaded regardless.
      const { data: contentData, error: contentError } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', quizData.content_item_id)
        .single();

      if (contentError && (contentError as any).code !== 'PGRST116') {
        throw new Error(contentError.message);
      }

      if (contentData) {
        setContentItem(contentData as unknown as ContentItem);
      }

    } catch (error: any) {
      logger.error('Error loading quiz results:', error);
      setLoadError(error instanceof Error ? error : new Error(String(error?.message ?? error)));
      toast({
        title: 'Error loading quiz results',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getAnswerDisplay = (question: QuizQuestion, submissionAnswer: any) => {
    const answer = submissionAnswer?.answer_data?.answer;
    
    switch (question.question_type) {
      case 'multiple_choice':
      case 'true_false':
        const selectedAnswer = question.answers.find(a => a.id === answer);
        return selectedAnswer?.text || 'No answer';
      
      case 'multiple_answers':
        const selectedAnswers = question.answers.filter(a => 
          (answer as string[] || []).includes(a.id || '')
        );
        return selectedAnswers.map(a => a.text).join(', ') || 'No answer';
      
      case 'short_answer':
        return answer || 'No answer';
      
      case 'essay':
        return (
          <div className="prose prose-sm max-w-none mt-2">
            <UnifiedCanvasEditor
              content={answer || 'No answer'}
              onChange={() => {}}
              readOnly={true}
              minHeight="auto"
            />
          </div>
        );
      
      default:
        return 'No answer';
    }
  };

  const getCorrectAnswerDisplay = (question: QuizQuestion) => {
    switch (question.question_type) {
      case 'multiple_choice':
      case 'true_false':
        const correctAnswer = question.answers.find(a => a.correct);
        return correctAnswer?.text || 'N/A';
      
      case 'multiple_answers':
        const correctAnswers = question.answers.filter(a => a.correct);
        return correctAnswers.map(a => a.text).join(', ') || 'N/A';
      
      case 'short_answer':
      case 'essay':
        return 'Graded manually';
      
      default:
        return 'N/A';
    }
  };

  const canRetakeQuiz = () => {
    if (!quiz || !submission) return false;
    return submission.attempt < quiz.allowed_attempts;
  };

  const handleRetakeQuiz = () => {
    navigate(`/courses/${courseId}/modules/${moduleId}/quizzes/${contentItemId}`);
  };

  if (loading) {
    return (
      <CourseLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </CourseLayout>
    );
  }

  // Load ERROR — the results may well exist; don't claim they weren't found.
  if (loadError) {
    return (
      <CourseLayout>
        <div className="max-w-4xl mx-auto py-8">
          <CourseErrorState
            title="Couldn't load quiz results"
            error={loadError}
            onRetry={() => void loadQuizResults()}
          />
        </div>
      </CourseLayout>
    );
  }

  if (!submission || !quiz) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Quiz Results Not Found</h1>
        </div>
      </CourseLayout>
    );
  }

  // NOTE: no Pass/Fail verdict is rendered — the quizzes table has no
  // passing-threshold column, so any cutoff here would be fabricated.
  const scorePercentage = quiz.points_possible ? (submission.score / quiz.points_possible) * 100 : 0;

  return (
    <CourseLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Results Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{contentItem?.title || 'Quiz'} - Results</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">
                    Attempt {submission.attempt} of {quiz.allowed_attempts}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to={`/courses/${courseId}/modules/${moduleId}`}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Module
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Score Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Award className="h-12 w-12 mx-auto mb-2 text-primary" />
                    <div className="text-3xl font-bold">
                      {submission.score}/{quiz.points_possible || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {scorePercentage.toFixed(1)}%
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Clock className="h-12 w-12 mx-auto mb-2 text-ss-teal" />
                    <div className="text-3xl font-bold">
                      {Math.floor((submission.time_spent || 0) / 60)}:{String((submission.time_spent || 0) % 60).padStart(2, '0')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Time Spent
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Questions Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 text-ss-lav-deep" />
                    <div className="text-3xl font-bold">
                      {submission.answers.filter(a => a.correct).length}/{questions.length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Correct Answers
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Score</span>
                <span>{scorePercentage.toFixed(1)}%</span>
              </div>
              <Progress value={scorePercentage} className="h-3" />
            </div>

            {/* Submission Info */}
            <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
              <div>
                <span className="text-muted-foreground">Submitted:</span>{' '}
                {format(new Date(submission.finished_at), "MMM d, yyyy 'at' h:mm a")}
              </div>
              <div>
                <span className="text-muted-foreground">Kept Score:</span>{' '}
                {submission.kept_score} ({(quiz as any).scoring_policy || 'highest'})
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Show/Hide Answers Toggle */}
        {quiz.show_correct_answers && (
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Question Review</h2>
            <Button
              variant="outline"
              onClick={() => setShowAnswers(!showAnswers)}
            >
              {showAnswers ? 'Hide' : 'Show'} Answers
            </Button>
          </div>
        )}

        {/* Question Review */}
        {showAnswers && quiz.show_correct_answers && (
          <div className="space-y-4">
            {questions.map((question, index) => {
              const submissionAnswer = submission.answers.find(
                a => a.quiz_question_id === question.id
              );
              const isCorrect = submissionAnswer?.correct || false;

              return (
                <Card key={question.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <CheckCircle className="h-5 w-5 text-ss-good" />
                        ) : (
                          <XCircle className="h-5 w-5 text-ss-bad" />
                        )}
                        <CardTitle className="text-lg">
                          Question {index + 1}
                        </CardTitle>
                      </div>
                      <Badge variant={isCorrect ? 'default' : 'destructive'}>
                        {submissionAnswer?.points || 0}/{question.points} points
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Question Text */}
                      <div className="prose prose-sm max-w-none">
                        <UnifiedCanvasEditor
                          content={question.question_text}
                          onChange={() => {}}
                          readOnly={true}
                          minHeight="auto"
                        />
                      </div>

                      {/* Your Answer */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          Your Answer:
                        </div>
                        <div className={isCorrect ? 'text-ss-good' : 'text-ss-bad'}>
                          {getAnswerDisplay(question, submissionAnswer)}
                        </div>
                      </div>

                      {/* Correct Answer */}
                      {!isCorrect && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            Correct Answer:
                          </div>
                          <div className="text-ss-good">
                            {getCorrectAnswerDisplay(question)}
                          </div>
                        </div>
                      )}

                      {/* Feedback */}
                      {(question as any).feedback && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {(question as any).feedback}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>
              Back to Module
            </Link>
          </Button>
          {canRetakeQuiz() && (
            <Button onClick={handleRetakeQuiz}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake Quiz
            </Button>
          )}
        </div>
      </div>
    </CourseLayout>
  );
}