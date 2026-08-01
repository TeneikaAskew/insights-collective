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
import { sanitizeHTML } from '@/utils/sanitize';
import CourseErrorState from '@/components/course/CourseErrorState';
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
  // Questions arrive through get_quiz_questions_for_taking, which strips the
  // `correct` flag from every option server-side. The list query that supplies
  // `quiz` deliberately carries no answer data at all.
  const [fetchedQuestions, setFetchedQuestions] = useState<any[] | null>(null);
  // A failed RPC used to set questions to [], which falls through to the
  // "This quiz has no questions yet" empty state — the same screen a student
  // sees when an instructor genuinely hasn't authored any. A platform-wide quiz
  // outage was therefore indistinguishable from unfinished course content, and
  // the student's only recourse was to assume the course was incomplete.
  // Named for the query it belongs to: `loadError` below already means "the
  // prior-attempt lookup failed", which fails closed for a different reason.
  const [questionsError, setQuestionsError] = useState<Error | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!quiz?.id) return;
    (async () => {
      setQuestionsError(null);
      const { data, error } = await supabase
        .rpc('get_quiz_questions_for_taking', { p_quiz_id: quiz.id });
      if (cancelled) return;
      if (error) {
        logger.error('Failed to load quiz questions', error);
        setQuestionsError(new Error(error.message));
        setFetchedQuestions(null);
        return;
      }
      setFetchedQuestions(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [quiz?.id, retryToken]);

  const questions = useMemo(
    () =>
      // Prefer the sanitized RPC result; fall back to whatever the parent
      // supplied when it returns nothing (e.g. an older cached payload).
      [...(fetchedQuestions?.length ? fetchedQuestions : (quiz.questions ?? []))]
        .map((question) => ({
          ...question,
          answers: Array.isArray(question.answers) ? question.answers : [],
        }))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [fetchedQuestions, quiz.questions],
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
  // Visible (non-blocking) indicator that the last auto-save did not persist.
  const [saveError, setSaveError] = useState(false);
  const [submissionAnswers, setSubmissionAnswers] = useState<any[]>([]);
  // Fail closed: if the prior-attempt lookup fails we cannot know whether the
  // student has attempts left, so the player must not start a new attempt.
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedAnswers = useDebounce(answers, 2000);
  const prevDebouncedRef = useRef(debouncedAnswers);

  useEffect(() => {
    let cancelled = false;

    const loadExistingSubmission = async () => {
      if (!user?.id) return;

      setLoadError(null);
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
        setLoadError(new Error(error.message));
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
  }, [quiz.id, user?.id, reloadKey]);

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

  // Load per-question answers once a submission is complete so we can render the review view.
  useEffect(() => {
    let cancelled = false;
    const loadAnswers = async () => {
      if (!submission?.id || submission.workflow_state !== 'complete') return;
      const { data, error } = await supabase
        .from('quiz_submission_answers')
        .select('*')
        .eq('quiz_submission_id', submission.id);
      if (cancelled) return;
      if (error) {
        logger.error('Failed to load submission answers', error);
        return;
      }
      setSubmissionAnswers(data || []);
    };
    void loadAnswers();
    return () => { cancelled = true; };
  }, [submission?.id, submission?.workflow_state]);

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
      setSaveError(false);
    } catch (error: any) {
      logger.error('Auto-save failed', error);
      setSaved(false);
      setSaveError(true);
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

      // Grading happens server-side (see supabase/functions/score-quiz): the
      // browser holds no answer key and cannot set its own score.
      const { data: scored, error: scoreError } = await supabase.functions.invoke('score-quiz', {
        body: {
          submissionId: activeSubmission.id,
          answers,
          timeSpent: quiz.time_limit ? quiz.time_limit * 60 - (timeRemaining || 0) : null,
        },
      });
      if (scoreError) throw scoreError;
      if (scored?.error) throw new Error(scored.error);

      const totalScore = scored?.score ?? 0;

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
  const isComplete = submission?.workflow_state === 'complete';
  const showReview = isComplete && !quizStarted;
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const totalPossible = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  const startRetake = async () => {
    setSubmission(null);
    setSubmissionAnswers([]);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setQuizStarted(false);
    await ensureSubmission();
  };

  // Fail closed: don't let a failed prior-attempt lookup masquerade as "no
  // prior attempt" — that would allow starting attempts past the limit.
  if (loadError && !quizStarted) {
    return (
      <CourseErrorState
        title="Couldn't load your quiz attempts"
        error={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  // Checked BEFORE the empty state: a failed question fetch leaves no questions,
  // and the empty state says "This quiz has no questions yet" — the same screen
  // a student sees when an instructor genuinely hasn't authored any. That made a
  // quiz outage indistinguishable from unfinished course content, with the
  // student left to conclude the course was incomplete.
  if (questionsError) {
    return (
      <CourseErrorState
        title="Couldn't load this quiz"
        error={questionsError}
        onRetry={() => setRetryToken((n) => n + 1)}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <Card data-testid="quiz-player-empty">
        <CardHeader>
          <CardTitle className="text-lg">Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (showReview) {
    const answerByQuestion = new Map(submissionAnswers.map((a) => [a.quiz_question_id, a]));
    const scored = typeof submission.score === 'number' ? submission.score : 0;
    const attemptsLeft = quiz.allowed_attempts - (submission.attempt || 0);
    return (
      <div className="space-y-4" data-testid="quiz-player-review">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Quiz results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">
              {scored} / {totalPossible} {totalPossible === 1 ? 'point' : 'points'}
            </p>
            <p className="text-sm text-muted-foreground">
              Attempt {submission.attempt} of {quiz.allowed_attempts}
              {attemptsLeft > 0 ? ` · ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining` : ' · No attempts remaining'}
            </p>
            {attemptsLeft > 0 && (
              <Button variant="outline" size="sm" onClick={() => void startRetake()} disabled={creatingSubmission}>
                Retake quiz
              </Button>
            )}
          </CardContent>
        </Card>

        {questions.map((question, idx) => {
          const record = answerByQuestion.get(question.id);
          const userAnswerRaw = record?.answer_data?.answer;
          const correct = !!record?.correct;
          const answerOptions = Array.isArray(question.answers) ? question.answers : [];
          const explanation = (question as any).explanation as string | undefined;
          const feedback = (question as any).feedback as string | undefined;

          const answerLabelFor = (val: any): string => {
            if (val == null || val === '') return '—';
            if (Array.isArray(val)) return val.map(answerLabelFor).join(', ');
            const opt = answerOptions.find((o) => (o.id || '') === val);
            return opt?.text ?? String(val);
          };
          const correctOptions = answerOptions.filter((o) => o.correct);

          return (
            <Card key={question.id} className={correct ? 'border-primary/40' : 'border-destructive/40'}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">
                    Q{idx + 1}. <span className="font-normal" dangerouslySetInnerHTML={{ __html: sanitizeHTML(question.question_text) }} />
                  </CardTitle>
                  <span
                    className={
                      'text-xs font-semibold uppercase tracking-wider ' +
                      (correct ? 'text-primary' : 'text-destructive')
                    }
                  >
                    {correct ? 'Correct' : 'Incorrect'} · {record?.points ?? 0}/{question.points}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Your answer: </span>
                  <span className={correct ? 'text-primary font-medium' : 'text-destructive font-medium'}>
                    {answerLabelFor(userAnswerRaw)}
                  </span>
                </p>
                {!correct && correctOptions.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Correct answer: </span>
                    <span className="font-medium text-foreground">
                      {correctOptions.map((o) => o.text).join(', ')}
                    </span>
                  </p>
                )}
                {explanation && (
                  <div className="mt-2 rounded-md bg-muted/60 p-3 text-foreground">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Explanation</p>
                    <p>{explanation}</p>
                  </div>
                )}
                {feedback && !explanation && (
                  <div className="mt-2 rounded-md bg-muted/60 p-3 text-foreground">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Feedback</p>
                    <p>{feedback}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  if (!canTakeQuiz) {
    return (
      <Card data-testid="quiz-player-exhausted">
        <CardHeader>
          <CardTitle className="text-lg">Quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
    <div className="space-y-6" data-testid="quiz-player-active">
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
            {!saving && saveError && (
              <span className="flex items-center gap-1 text-xs text-destructive" role="alert">
                <AlertCircle className="h-3 w-3" /> Auto-save failed — your latest answers may not be saved
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
