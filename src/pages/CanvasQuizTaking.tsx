// Canvas-style quiz taking interface
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import CourseErrorState from '@/components/course/CourseErrorState';
import { 
  Clock, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight,
  Save,
  Send,
  CheckCircle
} from 'lucide-react';
import type { ContentItem, Quiz, QuizQuestion } from '@/types/canvas';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CanvasQuizTaking');

interface QuizAnswer {
  questionId: string;
  answer: any; // Can be string, array of strings, etc.
}

export default function CanvasQuizTaking() {
  const { courseId, moduleId, contentItemId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [contentItem, setContentItem] = useState<ContentItem | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Fail closed: any load error (including the existing-submission check that
  // enforces the attempt limit) blocks quiz start instead of silently letting
  // the student begin a fresh attempt.
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);

  useEffect(() => {
    loadQuizData();
  }, [contentItemId]);

  // Timer effect
  useEffect(() => {
    if (!quiz?.time_limit || !quizStarted || timeRemaining === null) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) {
          handleSubmitQuiz(true); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz, quizStarted, timeRemaining]);

  const loadQuizData = async () => {
    if (!contentItemId || !user) return;

    try {
      setLoading(true);
      setLoadError(null);

      // Load quiz details
      const item = await CanvasContentService.getContentItem(contentItemId);
      if (!item || item.type !== 'quiz') {
        // Genuine not-found: the "Quiz Not Found" screen renders below.
        return;
      }
      setContentItem(item);

      // Load quiz with questions
      const quizData = await CanvasContentService.getQuiz(contentItemId);
      if (!quizData) {
        return;
      }
      setQuiz(quizData);
      setQuestions(quizData.questions || []);

      // Check for existing submission. This gate enforces the attempt limit,
      // so a failed query must block the quiz — not report "0/N attempts".
      const { data: existingSubmission, error: submissionError } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('quiz_id', quizData.id)
        .eq('user_id', user.id)
        .order('attempt', { ascending: false })
        .limit(1);

      if (submissionError) {
        throw new Error(submissionError.message);
      }

      if (existingSubmission && existingSubmission.length > 0) {
        setSubmission(existingSubmission[0]);
      }

    } catch (error: any) {
      logger.error('Error loading quiz:', error);
      setLoadError(error instanceof Error ? error : new Error(String(error?.message ?? error)));
      toast({
        title: 'Error loading quiz',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    if (!quiz || !user) return;

    try {
      // Create quiz submission
      const { data: newSubmission, error } = await supabase
        .from('quiz_submissions')
        .insert({
          quiz_id: quiz.id,
          user_id: user.id,
          started_at: new Date().toISOString(),
          attempt: submission ? submission.attempt + 1 : 1,
          workflow_state: 'pending_review'
        })
        .select()
        .single();

      if (error) throw error;

      setSubmission(newSubmission);
      setQuizStarted(true);
      
      // Set timer if time limit exists
      if (quiz.time_limit) {
        setTimeRemaining(quiz.time_limit * 60); // Convert minutes to seconds
      }

    } catch (error: any) {
      toast({
        title: 'Error starting quiz',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const saveProgress = async () => {
    if (!submission) return;

    try {
      // Save answers to quiz_submission_answers table
      for (const [questionId, answer] of Object.entries(answers)) {
        await supabase
          .from('quiz_submission_answers')
          .upsert({
            quiz_submission_id: submission.id,
            quiz_question_id: questionId,
            answer_data: { answer }
          }, {
            onConflict: 'quiz_submission_id,quiz_question_id'
          });
      }

      toast({
        title: 'Progress saved',
        description: 'Your answers have been saved.'
      });
    } catch (error: any) {
      toast({
        title: 'Error saving progress',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSubmitQuiz = async (autoSubmit = false) => {
    if (!submission || !quiz) return;

    try {
      setSubmitting(true);

      // Grading happens server-side: the browser never sees the answer key and
      // never decides its own score. score-quiz writes the answers, the
      // per-question correctness, and the submission's score with the service
      // role. Kept-score policy is unchanged ("latest attempt") and now lives
      // in the function.
      const { data: scored, error: scoreError } = await supabase.functions.invoke('score-quiz', {
        body: {
          submissionId: submission.id,
          answers,
          timeSpent: quiz.time_limit ? quiz.time_limit * 60 - (timeRemaining || 0) : null,
        },
      });
      if (scoreError) throw scoreError;
      if (scored?.error) throw new Error(scored.error);

      toast({
        title: autoSubmit ? 'Quiz auto-submitted' : 'Quiz submitted',
        description: autoSubmit 
          ? 'Time has expired. Your quiz has been submitted automatically.'
          : 'Your quiz has been submitted successfully.'
      });

      // Navigate to results page
      navigate(`/courses/${courseId}/modules/${moduleId}/quizzes/${contentItemId}/results/${submission.id}`);

    } catch (error: any) {
      toast({
        title: 'Error submitting quiz',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQuestion = (question: QuizQuestion) => {
    const answer = answers[question.id];

    return (
      <div className="space-y-4">
        <div className="prose prose-lg max-w-none">
          <UnifiedCanvasEditor
            content={question.question_text}
            onChange={() => {}}
            readOnly={true}
            minHeight="auto"
          />
        </div>

        {/* Multiple Choice */}
        {question.question_type === 'multiple_choice' && (
          <RadioGroup
            value={answer || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            <div className="space-y-2">
              {question.answers.map((option, index) => (
                <div key={option.id || index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id || index.toString()} id={`q${question.id}-${index}`} />
                  <Label htmlFor={`q${question.id}-${index}`} className="cursor-pointer">
                    {option.text}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )}

        {/* True/False */}
        {question.question_type === 'true_false' && (
          <RadioGroup
            value={answer || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            <div className="space-y-2">
              {question.answers.map((option, index) => (
                <div key={option.id || index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id || index.toString()} id={`q${question.id}-${index}`} />
                  <Label htmlFor={`q${question.id}-${index}`} className="cursor-pointer">
                    {option.text}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )}

        {/* Multiple Answers */}
        {question.question_type === 'multiple_answers' && (
          <div className="space-y-2">
            {question.answers.map((option, index) => (
              <div key={option.id || index} className="flex items-center space-x-2">
                <Checkbox
                  id={`q${question.id}-${index}`}
                  checked={(answer as string[] || []).includes(option.id || index.toString())}
                  onCheckedChange={(checked) => {
                    const currentAnswers = (answer as string[] || []);
                    const optionId = option.id || index.toString();
                    const newAnswers = checked
                      ? [...currentAnswers, optionId]
                      : currentAnswers.filter(id => id !== optionId);
                    handleAnswerChange(question.id, newAnswers);
                  }}
                />
                <Label htmlFor={`q${question.id}-${index}`} className="cursor-pointer">
                  {option.text}
                </Label>
              </div>
            ))}
          </div>
        )}

        {/* Short Answer */}
        {question.question_type === 'short_answer' && (
          <Input
            value={answer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your answer"
          />
        )}

        {/* Essay */}
        {question.question_type === 'essay' && (
          <UnifiedCanvasEditor
            content={answer || ''}
            onChange={(value) => handleAnswerChange(question.id, value)}
            placeholder="Write your essay answer here..."
            minHeight="300px"
          />
        )}
      </div>
    );
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

  // Load ERROR (backend/query failure): block quiz start entirely — do not
  // show the intro screen with a fabricated attempt count.
  if (loadError) {
    return (
      <CourseLayout>
        <div className="max-w-3xl mx-auto py-8">
          <CourseErrorState
            title="Couldn't load quiz"
            error={loadError}
            onRetry={() => void loadQuizData()}
          />
        </div>
      </CourseLayout>
    );
  }

  if (!contentItem || !quiz) {
    return (
      <CourseLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Quiz Not Found</h1>
        </div>
      </CourseLayout>
    );
  }

  // Quiz intro screen
  if (!quizStarted) {
    const canTakeQuiz = !submission || submission.attempt < quiz.allowed_attempts;

    return (
      <CourseLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{contentItem.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-lg max-w-none">
                <UnifiedCanvasEditor
                  content={contentItem.content || ''}
                  onChange={() => {}}
                  readOnly={true}
                  minHeight="auto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <div className="text-sm text-muted-foreground">Questions</div>
                  <div className="font-semibold">{questions.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Points</div>
                  <div className="font-semibold">{quiz.points_possible || 'Not graded'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Time Limit</div>
                  <div className="font-semibold">
                    {quiz.time_limit ? `${quiz.time_limit} minutes` : 'No limit'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Attempts</div>
                  <div className="font-semibold">
                    {submission ? `${submission.attempt}/${quiz.allowed_attempts}` : `0/${quiz.allowed_attempts}`}
                  </div>
                </div>
              </div>

              {quiz.quiz_type === 'assignment' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This is a graded quiz. Your score will be recorded.
                  </AlertDescription>
                </Alert>
              )}

              {canTakeQuiz ? (
                <div className="flex justify-center pt-4">
                  <Button size="lg" onClick={startQuiz}>
                    Start Quiz
                  </Button>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You have used all available attempts for this quiz.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </CourseLayout>
    );
  }

  // Quiz taking interface
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  return (
    <CourseLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Quiz Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{contentItem.title}</CardTitle>
                <div className="flex items-center gap-4 mt-2">
                  <Badge variant="secondary">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              {timeRemaining !== null && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Time Remaining</div>
                  <div className={`text-2xl font-mono ${timeRemaining < 300 ? 'text-destructive' : ''}`}>
                    <Clock className="inline h-5 w-5 mr-1" />
                    {formatTime(timeRemaining)}
                  </div>
                </div>
              )}
            </div>
            <Progress 
              value={(currentQuestionIndex + 1) / questions.length * 100} 
              className="mt-4"
            />
          </CardHeader>
        </Card>

        {/* Question Card */}
        <Card>
          <CardContent className="pt-6">
            {renderQuestion(currentQuestion)}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              disabled={isFirstQuestion}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              disabled={isLastQuestion}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={saveProgress}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Progress
            </Button>
            {isLastQuestion && (
              <Button
                onClick={() => handleSubmitQuiz()}
                disabled={submitting}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Quiz
              </Button>
            )}
          </div>
        </div>

        {/* Question Navigator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Question Navigator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-2">
              {questions.map((q, index) => (
                <Button
                  key={q.id}
                  variant={currentQuestionIndex === index ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={answers[q.id] ? 'ring-2 ring-primary' : ''}
                >
                  {index + 1}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Click on a number to jump to that question. Questions with a ring have been answered.
            </p>
          </CardContent>
        </Card>
      </div>
    </CourseLayout>
  );
}