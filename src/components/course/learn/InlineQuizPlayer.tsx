import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UnifiedCanvasEditor } from '@/components/ui/unified-canvas-editor';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { ContentItem, Quiz, QuizQuestion } from '@/types/canvas';
import { createLogger } from '@/utils/logger';

const logger = createLogger('InlineQuizPlayer');

interface InlineQuizPlayerProps {
  item: ContentItem;
  quiz: Quiz;
  onCompleted?: (itemId: string) => void | Promise<void>;
}

export function InlineQuizPlayer({ item, quiz, onCompleted }: InlineQuizPlayerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const questions = useMemo(
    () =>
      [...(quiz.questions || [])]
        .map((question) => ({
          ...question,
          answers: Array.isArray(question.answers) ? question.answers : [],
        }))
        .sort((a, b) => a.position - b.position),
    [quiz.questions],
  );

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submission, setSubmission] = useState<any>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [creatingSubmission, setCreatingSubmission] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const debouncedAnswers = useDebounce(answers, 2000);
  const prevDebouncedRef = useRef(debouncedAnswers);

  useEffect(() => {
    let cancelled = false;

    const loadExistingSubmission = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('quiz_id', quiz.id)
        .eq('user_id', user.id)
        .order('attempt', { ascending: false })
        .limit(1);

      if (cancelled) return;
      if (error) {
        logger.error('Failed to load existing inline quiz submission', error);
        return;
      }

      if (data && data.length > 0) {
        setSubmission(data[0]);
      }
    };

    void loadExistingSubmission();
    return () => {
      cancelled = true;
    };
  }, [quiz.id, user?.id]);

  useEffect(() => {
    if (!quizStarted || timeRemaining === null) return;

    const timer = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          window.clearInterval(timer);
          void handleSubmitQuiz(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [quizStarted, timeRemaining]);

  // Auto-save when answers change (debounced)
  useEffect(() => {
    if (prevDebouncedRef.current === debouncedAnswers) return;
    prevDebouncedRef.current = debouncedAnswers;
    if (!submission || Object.keys(debouncedAnswers).length === 0) return;
    void autoSave();
  }, [debouncedAnswers, submission]);

  const autoSave = useCallback(async () => {
    if (!submission) return;
    try {
      setSaving(true);
      const records = Object.entries(answers).map(([questionId, answer]) => ({
        quiz_submission_id: submission.id,
        quiz_question_id: questionId,
        answer_data: { answer },
      }));
      if (records.length > 0) {
        const { error } = await supabase
          .from('quiz_submission_answers')
          .upsert(records, { onConflict: 'quiz_submission_id,quiz_question_id' });
        if (error) throw error;
      }
      setSaved(true);
    } catch (error: any) {
      logger.error('Auto-save failed', error);
    } finally {
      setSaving(false);
    }
  }, [answers, submission]);

  const handleAnswerChange = (questionId: string, value: any) => {
    setSaved(false);
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    if (!submission) {
      void ensureSubmission();
    }
  };

  const ensureSubmission = async () => {
    if (submission || creatingSubmission) return submission;
    if (!user?.id) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to take this quiz.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setCreatingSubmission(true);
      const { data, error } = await supabase
        .from('quiz_submissions')
        .insert({
          quiz_id: quiz.id,
          user_id: user.id,
          started_at: new Date().toISOString(),
          attempt: submission ? submission.attempt + 1 : 1,
          workflow_state: 'pending_review',
        })
        .select()
        .single();

      if (error) throw error;

      setSubmission(data);
      setQuizStarted(true);
      setSaved(false);
      setCurrentQuestionIndex(0);

      if (quiz.time_limit) {
        setTimeRemaining(quiz.time_limit * 60);
      }
      return data;
    } catch (error: any) {
      logger.error('Failed to start inline quiz', error);
      toast({
        title: 'Error starting quiz',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setCreatingSubmission(false);
    }
  };

  // saveProgress is now handled automatically by the debounced auto-save effect above.

  const handleSubmitQuiz = async (autoSubmit = false) => {
    const activeSubmission = submission ?? (await ensureSubmission());
    if (!activeSubmission) return;

    try {
      setSubmitting(true);

      let totalScore = 0;
      const answerRecords = questions.map((question) => {
        const userAnswer = answers[question.id];
        let correct = false;
        let points = 0;

        switch (question.question_type) {
          case 'multiple_choice':
          case 'true_false': {
            const correctAnswer = question.answers.find((answer) => answer.correct);
            correct = userAnswer === correctAnswer?.id;
            points = correct ? question.points : 0;
            break;
          }
          case 'multiple_answers': {
            const correctAnswers = question.answers
              .filter((answer) => answer.correct)
              .map((answer) => answer.id);
            const userAnswers = (userAnswer as string[]) || [];
            correct =
              correctAnswers.length === userAnswers.length &&
              correctAnswers.every((id) => userAnswers.includes(id));
            points = correct ? question.points : 0;
            break;
          }
          case 'short_answer':
          case 'essay':
          case 'matching':
            points = 0;
            break;
        }

        totalScore += points;

        return {
          quiz_submission_id: activeSubmission.id,
          quiz_question_id: question.id,
          answer_data: { answer: userAnswer },
          correct,
          points,
        };
      });

      if (answerRecords.length > 0) {
        const { error: answersError } = await supabase
          .from('quiz_submission_answers')
          .upsert(answerRecords, {
            onConflict: 'quiz_submission_id,quiz_question_id',
          });

        if (answersError) throw answersError;
      }

      const { error: submissionError } = await supabase
        .from('quiz_submissions')
        .update({
          finished_at: new Date().toISOString(),
          time_spent: quiz.time_limit ? quiz.time_limit * 60 - (timeRemaining || 0) : null,
          score: totalScore,
          kept_score: totalScore,
          workflow_state: 'complete',
        })
        .eq('id', activeSubmission.id);

      if (submissionError) throw submissionError;

      await onCompleted?.(item.id);
      setQuizStarted(false);
      setSaved(true);
      setSubmission((prev: any) =>
        prev
          ? {
              ...prev,
              finished_at: new Date().toISOString(),
              score: totalScore,
              workflow_state: 'complete',
            }
          : prev,
      );

      toast({
        title: autoSubmit ? 'Quiz auto-submitted' : 'Quiz submitted',
        description: autoSubmit
          ? 'Time expired, so your quiz was submitted automatically.'
          : 'Your quiz has been submitted successfully.',
      });
    } catch (error: any) {
      logger.error('Failed to submit inline quiz', error);
      toast({
        title: 'Error submitting quiz',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: QuizQuestion) => {
    const answer = answers[question.id];
    const answerOptions = Array.isArray(question.answers) ? question.answers : [];

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

        {question.question_type === 'multiple_choice' && (
          <RadioGroup value={answer || ''} onValueChange={(value) => handleAnswerChange(question.id, value)}>
            <div className="space-y-2">
              {answerOptions.length > 0 ? (
                answerOptions.map((option, index) => (
                  <div key={option.id || index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.id || index.toString()} id={`q${question.id}-${index}`} />
                    <Label htmlFor={`q${question.id}-${index}`} className="cursor-pointer">
                      {option.text}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No options configured for this question.</p>
              )}
            </div>
          </RadioGroup>
        )}

        {question.question_type === 'true_false' && (
          <RadioGroup value={answer || ''} onValueChange={(value) => handleAnswerChange(question.id, value)}>
            <div className="space-y-2">
              {answerOptions.length > 0 ? (
                answerOptions.map((option, index) => (
                  <div key={option.id || index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.id || index.toString()} id={`q${question.id}-${index}`} />
                    <Label htmlFor={`q${question.id}-${index}`} className="cursor-pointer">
                      {option.text}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No options configured for this question.</p>
              )}
            </div>
          </RadioGroup>
        )}

        {question.question_type === 'multiple_answers' && (
          <div className="space-y-2">
            {answerOptions.length > 0 ? (
              answerOptions.map((option, index) => {
              const optionId = option.id || index.toString();
              const currentAnswers = (answer as string[]) || [];
              return (
                <div key={optionId} className="flex items-center space-x-2">
                  <Checkbox
                    id={`q${question.id}-${index}`}
                    checked={currentAnswers.includes(optionId)}
                    onCheckedChange={(checked) => {
                      const nextAnswers = checked
                        ? [...currentAnswers, optionId]
                        : currentAnswers.filter((id) => id !== optionId);
                      handleAnswerChange(question.id, nextAnswers);
                    }}
                  />
                  <Label htmlFor={`q${question.id}-${index}`} className="cursor-pointer">
                    {option.text}
                  </Label>
                </div>
              );
            })
            ) : (
              <p className="text-sm text-muted-foreground">No options configured for this question.</p>
            )}
          </div>
        )}

        {question.question_type === 'short_answer' && (
          <Input
            value={answer || ''}
            onChange={(event) => handleAnswerChange(question.id, event.target.value)}
            placeholder="Enter your answer"
          />
        )}

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

  const canTakeQuiz = !submission || submission.attempt < quiz.allowed_attempts;
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  if (questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (!canTakeQuiz) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submission?.workflow_state === 'complete' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Latest attempt submitted{typeof submission.score === 'number' ? ` with score ${submission.score}.` : '.'}
              </AlertDescription>
            </Alert>
          )}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>You have used all available attempts for this quiz.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Quiz</CardTitle>
            {saving && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            {!saving && saved && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">{renderQuestion(currentQuestion)}</CardContent>
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
            disabled={isFirstQuestion}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
            disabled={isLastQuestion}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {isLastQuestion && (
          <Button onClick={() => void handleSubmitQuiz()} disabled={submitting}>
            <Send className="mr-2 h-4 w-4" />
            Submit Quiz
          </Button>
        )}
      </div>
    </div>
  );
}

export default InlineQuizPlayer;
