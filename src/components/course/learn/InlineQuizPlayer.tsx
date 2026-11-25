import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
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
import {
  attemptsRemaining,
  canStartNewAttempt,
  isAttemptInProgress,
  isUnlimitedAttempts,
  secondsRemaining,
} from '@/utils/quizAttemptPolicy';
import type { ContentItem, Quiz, QuizQuestion } from '@/types/canvas';
import { createLogger } from '@/utils/logger';

const logger = createLogger('InlineQuizPlayer');

interface InlineQuizPlayerProps {
  item: ContentItem;
  quiz: Quiz;
  /**
   * Records course progress for the item once the attempt is finalized on the
   * server. A rejection or a resolved `false` is treated as "progress not
   * saved": the submitted result stays on screen and a separate retry is
   * offered. The quiz is never re-submitted to retry progress.
   */
  onCompleted?: (itemId: string) => unknown;
}

type Submission = {
  id: string;
  attempt: number;
  workflow_state: string;
  started_at?: string | null;
  finished_at?: string | null;
  score?: number | null;
  [key: string]: any;
};

type ProgressState = 'idle' | 'saving' | 'failed';

/** Owner of answers given before start_quiz_attempt has returned the attempt they belong to. */
const PENDING_START = '__pending_start__';
const AUTOSAVE_DELAY_MS = 2000;

/**
 * Work on one learner's quiz outlives the player session that started it:
 * leaving a quiz flushes its pending answers on unmount, and a submit keeps
 * running after the learner navigates away. A session keyed per item:quiz is
 * recreated on return, so per-session refs cannot order that work. These
 * module-level structures do, per `${userId}:${quizId}`:
 *  - `quizWorkQueues`: answer writes and finalization run in order. A new
 *    session waits for the queue before reading the attempt, so it resumes the
 *    answers the previous session actually saved, and its own submit cannot
 *    overtake the previous session's write.
 *  - `finalizingAttempts`: an attempt being finalized (or whose finalization
 *    could not be confirmed) accepts no answer write from any session.
 */
const quizWorkQueues = new Map<string, Promise<void>>();
const finalizingAttempts = new Set<string>();
// Submit intent must be visible before its pending start resolves. Keep this separate
// from the write queue: start/answer work must not wait on the submit that needs it.
const quizSubmitIntents = new Map<string, Set<Promise<void>>>();

function registerSubmitIntent(key: string): () => void {
  let resolve!: () => void;
  const intent = new Promise<void>(done => { resolve = done; });
  const intents = quizSubmitIntents.get(key) ?? new Set<Promise<void>>();
  intents.add(intent);
  quizSubmitIntents.set(key, intents);
  return () => {
    intents.delete(intent);
    if (intents.size === 0 && quizSubmitIntents.get(key) === intents) quizSubmitIntents.delete(key);
    resolve();
  };
}

async function waitForQuizSettlement(key: string): Promise<void> {
  do {
    await Promise.all([pendingQuizWork(key), ...(quizSubmitIntents.get(key) ?? [])]);
    // Work or another intent may have been appended while the captured work ran.
  } while (quizWorkQueues.has(key) || quizSubmitIntents.has(key));
}

function pendingQuizWork(key: string): Promise<void> {
  return quizWorkQueues.get(key) ?? Promise.resolve();
}

function enqueueQuizWork(key: string, task: () => Promise<void>): Promise<void> {
  const run = pendingQuizWork(key).then(task);
  const tail = run.catch(() => {});
  quizWorkQueues.set(key, tail);
  void tail.then(() => {
    if (quizWorkQueues.get(key) === tail) quizWorkQueues.delete(key);
  });
  return run;
}

/**
 * One player session per quiz. LessonViewer renders this component in place
 * as the learner moves between items, so without a key every piece of state
 * (answers, attempt, timer, review) and every in-flight response from the
 * previous quiz would carry over into the next one. Keying here keeps the
 * guarantee inside the component instead of relying on each caller.
 */
export function InlineQuizPlayer(props: InlineQuizPlayerProps) {
  return <InlineQuizPlayerSession key={`${props.item?.id ?? ''}:${props.quiz?.id ?? ''}`} {...props} />;
}

function InlineQuizPlayerSession({ item, quiz, onCompleted }: InlineQuizPlayerProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Set false on unmount. Every async continuation checks it before touching
  // state, so a slow response for quiz A cannot land in the session for quiz B.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Questions arrive through get_quiz_questions_for_taking, which strips the
  // `correct` flag from every option server-side. The list query that supplies
  // `quiz` deliberately carries no answer data at all.
  const [fetchedQuestions, setFetchedQuestions] = useState<any[] | null>(null);
  // A failed RPC used to set questions to [], which falls through to the
  // "This quiz has no questions yet" empty state, the same screen a student
  // sees when an instructor genuinely hasn't authored any.
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
  // The learner's latest attempt for this quiz: in progress, or finalized.
  const [submission, setSubmissionState] = useState<Submission | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Visible (non-blocking) indicator that the last auto-save did not persist.
  const [saveError, setSaveError] = useState(false);
  const [submissionAnswers, setSubmissionAnswers] = useState<any[] | null>(null);
  // Fail closed: if the prior-attempt lookup fails we cannot know whether the
  // student has an attempt in progress or attempts left, so nothing may start.
  const [loadError, setLoadError] = useState<Error | null>(null);
  // The latest attempt is still in progress but its saved answers could not be
  // read. Continuing would show it blank and overwrite them; starting a new
  // attempt would burn one. Block with a retry instead.
  const [restoreError, setRestoreError] = useState<Error | null>(null);
  const [reviewError, setReviewError] = useState<Error | null>(null);
  const [reviewReloadKey, setReviewReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [progressState, setProgressState] = useState<ProgressState>('idle');
  // A start_quiz_attempt call failed in a way that does not prove nothing was
  // created (e.g. the response was lost), and the follow-up read could not
  // settle it. Starting again could burn an attempt or strand a limit-1 quiz,
  // so nothing may start until a read confirms the outcome.
  const [startUncertain, setStartUncertain] = useState<Error | null>(null);
  // The FIRST start of this quiz was refused and the read-back confirmed no
  // attempt exists (e.g. start_quiz_attempt denied access). The questions are
  // replaced by a blocking error: nothing was stored, so answer controls and a
  // Submit button would only pretend to work. Retry asks the server again.
  const [startRefused, setStartRefused] = useState<Error | null>(null);
  // score-quiz failed and the read-back could not show whether the attempt was
  // finalized. Writing answers or scoring again could alter or double-submit a
  // finalized attempt, so both stay blocked until a read settles it.
  const [finalizeUncertain, setFinalizeUncertainState] = useState<{ attemptId: string; error: Error } | null>(null);
  const finalizeUncertainRef = useRef<{ attemptId: string; error: Error } | null>(null);
  const setFinalizeUncertain = useCallback((value: { attemptId: string; error: Error } | null) => {
    finalizeUncertainRef.current = value;
    setFinalizeUncertainState(value);
  }, []);
  const workKey = `${user?.id ?? 'anonymous'}:${quiz.id}`;

  // Refs mirror state that async paths read after an await, so they never act
  // on the value captured when the handler was created.
  const submissionRef = useRef<Submission | null>(null);
  const answersRef = useRef<Record<string, any>>({});
  const startPromiseRef = useRef<Promise<Submission | null> | null>(null);
  const submittingRef = useRef(false);
  const autoSubmittedRef = useRef(false);

  const setSubmission = useCallback((row: Submission | null) => {
    submissionRef.current = row;
    setSubmissionState(row);
  }, []);

  const updateAnswers = useCallback((next: Record<string, any>) => {
    answersRef.current = next;
    setAnswers(next);
  }, []);

  // Autosave bookkeeping. Every answer change bumps `revRef`; answers are owned
  // by exactly one attempt (`answersOwnerRef`), and a save only ever writes the
  // owner's newest answers to that same attempt. Saves run one at a time on the
  // learner's quiz queue (`quizWorkQueues`, shared across remounts), so an older
  // save can never land after a newer one, and an attempt being finalized
  // (`finalizingAttempts`) accepts no further autosave.
  const answersOwnerRef = useRef<string | null>(null);
  const revRef = useRef(0);
  const savedRevRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const savesInFlightRef = useRef(0);

  const cancelScheduledSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const enqueueSave = useCallback((attemptId: string): Promise<void> => {
    return enqueueQuizWork(workKey, async () => {
      // Everything is decided when the write is about to be SENT, not when it
      // was scheduled: the answers may since belong to another attempt, or this
      // attempt may be finalizing.
      if (answersOwnerRef.current !== attemptId) return;
      if (finalizingAttempts.has(attemptId)) return;
      const current = submissionRef.current;
      if (!current || current.id !== attemptId || !isAttemptInProgress(current)) return;
      const rev = revRef.current;
      if (rev <= savedRevRef.current) return;
      const snapshot = answersRef.current;
      const records = Object.entries(snapshot).map(([questionId, answer]) => ({
        quiz_submission_id: attemptId,
        quiz_question_id: questionId,
        answer_data: { answer },
      }));
      if (records.length === 0) return;

      savesInFlightRef.current += 1;
      if (aliveRef.current) setSaving(true);
      try {
        const { error } = await supabase
          .from('quiz_submission_answers')
          .upsert(records, { onConflict: 'quiz_submission_id,quiz_question_id' });
        if (error) throw error;
        if (answersOwnerRef.current === attemptId) {
          savedRevRef.current = Math.max(savedRevRef.current, rev);
          if (aliveRef.current) {
            // "Saved" only when the newest answers are the ones on the server.
            setSaved(rev === revRef.current);
            setSaveError(false);
          }
        }
      } catch (error) {
        logger.error('Auto-save failed', error);
        if (aliveRef.current && answersOwnerRef.current === attemptId) {
          setSaved(false);
          setSaveError(true);
        }
      } finally {
        savesInFlightRef.current -= 1;
        if (aliveRef.current && savesInFlightRef.current === 0) setSaving(false);
      }
    });
  }, [workKey]);

  const scheduleSave = useCallback(() => {
    cancelScheduledSave();
    const owner = answersOwnerRef.current;
    if (!owner || owner === PENDING_START) return;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void enqueueSave(owner);
    }, AUTOSAVE_DELAY_MS);
  }, [cancelScheduledSave, enqueueSave]);

  // Leaving the quiz mid-attempt: send the pending answers to their own
  // (still in-progress) attempt instead of dropping them. enqueueSave checks
  // the attempt is not finalizing, and touches no state once unmounted.
  useEffect(
    () => () => {
      if (saveTimerRef.current === null) return;
      cancelScheduledSave();
      const owner = answersOwnerRef.current;
      if (owner && owner !== PENDING_START) void enqueueSave(owner);
    },
    [cancelScheduledSave, enqueueSave],
  );

  useEffect(() => {
    let cancelled = false;

    const loadLatestAttempt = async () => {
      if (!user?.id) {
        // Nothing to resume for a signed-out viewer; answering asks them to
        // sign in (ensureAttempt) instead of leaving a spinner forever.
        setLoaded(true);
        return;
      }

      setLoadError(null);
      setRestoreError(null);
      setLoaded(false);
      // A previous session of this quiz may still be writing answers or
      // finalizing; read only after that work has landed.
      await waitForQuizSettlement(`${user.id}:${quiz.id}`);
      if (cancelled) return;
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

      const latest: Submission | null = data && data.length > 0 ? data[0] : null;

      if (latest && isAttemptInProgress(latest)) {
        // Resume the attempt that already exists: same id, same number, saved
        // answers and the server's started_at. Never start another one here.
        const { data: saved, error: savedError } = await supabase
          .from('quiz_submission_answers')
          .select('*')
          .eq('quiz_submission_id', latest.id);
        if (cancelled) return;
        if (savedError) {
          logger.error('Failed to restore saved quiz answers', savedError);
          setSubmission(latest);
          setRestoreError(new Error(savedError.message));
          setLoaded(true);
          return;
        }
        const restored: Record<string, any> = {};
        for (const row of saved || []) {
          const value = (row?.answer_data as { answer?: unknown } | null)?.answer;
          if (row?.quiz_question_id && value !== undefined && value !== null) {
            restored[row.quiz_question_id] = value;
          }
        }
        // Nothing is finalizing it now (the queue is idle) and the server says
        // it is still in progress, so any earlier unconfirmed finalization did
        // not happen: it may be answered and submitted again.
        finalizingAttempts.delete(latest.id);
        updateAnswers(restored);
        answersOwnerRef.current = latest.id;
        savedRevRef.current = revRef.current;
        setSubmission(latest);
        setQuizStarted(true);
        setSaved(Object.keys(restored).length > 0);
      } else {
        setSubmission(latest);
      }
      setLoaded(true);
    };

    void loadLatestAttempt();
    return () => {
      cancelled = true;
    };
  }, [quiz.id, user?.id, reloadKey, setSubmission, updateAnswers]);

  // Load per-question answers for a finalized attempt so the review can render.
  // A failed load is an error state: rendering with no rows would mark every
  // question "Incorrect · 0" for an attempt that may have scored full marks.
  useEffect(() => {
    let cancelled = false;
    const loadReviewAnswers = async () => {
      if (!submission?.id || submission.workflow_state !== 'complete') return;
      setReviewError(null);
      setSubmissionAnswers(null);
      const { data, error } = await supabase
        .from('quiz_submission_answers')
        .select('*')
        .eq('quiz_submission_id', submission.id);
      if (cancelled) return;
      if (error) {
        logger.error('Failed to load submission answers', error);
        setReviewError(new Error(error.message));
        return;
      }
      setSubmissionAnswers(data || []);
    };
    void loadReviewAnswers();
    return () => {
      cancelled = true;
    };
  }, [submission?.id, submission?.workflow_state, reviewReloadKey]);

  /**
   * Returns the attempt to answer into: the in-progress one if it exists,
   * otherwise exactly one new attempt from start_quiz_attempt, the only
   * creation path (20260802234500 dropped the direct INSERT policy; the RPC
   * numbers the attempt and enforces the limit under a lock). Concurrent
   * callers share the same in-flight start.
   */
  /** Makes `row` the attempt being answered (fresh start or reconciled). */
  const adoptAttempt = useCallback(
    (row: Submission) => {
      setSubmission(row);
      // Answers given while the attempt was being created belong to it; a
      // retake starts from none.
      if (answersOwnerRef.current === null) {
        // A retake: its workspace was emptied when it was requested.
        answersOwnerRef.current = row.id;
        setCurrentQuestionIndex(0);
      } else if (answersOwnerRef.current === PENDING_START) {
        answersOwnerRef.current = row.id;
      }
      setSubmissionAnswers(null);
      setReviewError(null);
      setProgressState('idle');
      setStartUncertain(null);
      setStartRefused(null);
      setQuizStarted(true);
      setSaved(false);
      setSaveError(false);
      autoSubmittedRef.current = false;
      setTimeRemaining(secondsRemaining(row.started_at, quiz.time_limit));
      if (revRef.current > savedRevRef.current) scheduleSave();
    },
    [quiz.time_limit, scheduleSave, setSubmission],
  );

  /**
   * The session unmounted while its start was in flight, so answers given
   * before the attempt existed (owner PENDING_START) have no autosave or unmount
   * flush to carry them. Write them to the attempt the start produced. Runs on
   * the quiz work queue (inside the start's task), so a remounted session reads
   * the attempt only after these answers have landed.
   */
  /**
   * Write this session's answers to `attemptId` now, for a session that has
   * unmounted and so has no autosave timer left. Called only from work already
   * running on the quiz queue (it must not enqueue, or it would wait on itself).
   */
  const writeAnswersNow = useCallback(async (attemptId: string) => {
    const rev = revRef.current;
    const records = Object.entries(answersRef.current).map(([questionId, answer]) => ({
      quiz_submission_id: attemptId,
      quiz_question_id: questionId,
      answer_data: { answer },
    }));
    if (records.length === 0) return;
    const { error } = await supabase
      .from('quiz_submission_answers')
      .upsert(records, { onConflict: 'quiz_submission_id,quiz_question_id' });
    if (error) logger.error('Could not save answers given before leaving the quiz', error);
    else savedRevRef.current = Math.max(savedRevRef.current, rev);
  }, []);

  const flushOrphanedAnswers = useCallback(
    async (attemptId: string) => {
      if (answersOwnerRef.current !== PENDING_START) return;
      answersOwnerRef.current = attemptId;
      await writeAnswersNow(attemptId);
    },
    [writeAnswersNow],
  );

  /**
   * After a failed start, read the learner's latest attempt to learn what the
   * server actually did. A new in-progress attempt means the start committed
   * and only the response was lost: adopt it rather than start another.
   */
  const reconcileStart = useCallback(
    async (before: Submission | null): Promise<'adopted' | 'none' | 'unknown'> => {
      if (!user?.id) return 'unknown';
      const { data, error } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('quiz_id', quiz.id)
        .eq('user_id', user.id)
        .order('attempt', { ascending: false })
        .limit(1);
      if (error) {
        logger.error('Could not confirm whether the quiz attempt started', error);
        return 'unknown';
      }
      const latest: Submission | null = data && data.length > 0 ? data[0] : null;
      const isNew = !!latest && (!before || (latest.attempt ?? 0) > (before.attempt ?? 0));
      if (latest && isNew && isAttemptInProgress(latest)) {
        if (aliveRef.current) adoptAttempt(latest);
        else {
          // Ref only (no state on an unmounted session): a submit waiting on
          // this start still gets the attempt it asked for.
          submissionRef.current = latest;
          await flushOrphanedAnswers(latest.id);
        }
        return 'adopted';
      }
      return 'none';
    },
    [quiz.id, user?.id, adoptAttempt, flushOrphanedAnswers],
  );

  /**
   * Returns the attempt to answer into: the in-progress one if it exists,
   * otherwise exactly one new attempt from start_quiz_attempt, the only
   * creation path (20260802234500 dropped the direct INSERT policy; the RPC
   * numbers the attempt and enforces the limit under a lock). Concurrent
   * callers share the same in-flight start. A failed start is never repeated
   * blindly: its outcome is first read back from the server.
   */
  const ensureAttempt = useCallback(async (): Promise<Submission | null> => {
    const current = submissionRef.current;
    if (current && isAttemptInProgress(current)) return current;
    if (startPromiseRef.current) return startPromiseRef.current;
    if (startUncertain) return null;
    if (!canStartNewAttempt(current, quiz.allowed_attempts)) return null;
    if (!user?.id) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to take this quiz.',
        variant: 'destructive',
      });
      return null;
    }

    // The start runs on the learner's quiz work queue, like answer writes and
    // finalization. A session that remounts while it is in flight waits for it
    // (loadLatestAttempt reads only after the queue drains), so it resumes the
    // attempt instead of finding none and starting another; and answers given
    // before the attempt existed are written to it even if this session is gone.
    const waitedBehindOtherWork = quizWorkQueues.has(workKey);
    const startOnQueue = async (): Promise<Submission | null> => {
      setStarting(true);
      try {
        if (waitedBehindOtherWork) {
          // Earlier work (perhaps another session's start) may have created the
          // attempt while this start waited: adopt it rather than use up another.
          const pre = await reconcileStart(current);
          if (pre === 'adopted') return submissionRef.current;
        }
        const { data, error } = await supabase
          .rpc('start_quiz_attempt', { p_quiz_id: quiz.id })
          .single();
        if (error) throw error;
        if (!data) throw new Error('The quiz attempt could not be started.');
        const row = data as Submission;
        if (!aliveRef.current) {
          // The session is gone, but the attempt exists: save the answers given
          // before it did, and hand it to a submit that is waiting on this start
          // (the old session's UI is not touched).
          submissionRef.current = row;
          await flushOrphanedAnswers(row.id);
          return row;
        }
        adoptAttempt(row);
        return row;
      } catch (error: any) {
        logger.error('Failed to start inline quiz', error);
        const outcome = await reconcileStart(current);
        if (outcome === 'adopted') return submissionRef.current;
        if (!aliveRef.current) return null;
        if (outcome === 'unknown') {
          setStartUncertain(new Error(error?.message || 'The quiz attempt could not be confirmed.'));
          return null;
        }
        if (!current) {
          // First start: block the questions with an honest error (below).
          // A refused RETAKE keeps the finalized result on screen and toasts.
          setStartRefused(
            new Error(
              `${error?.message || 'The quiz could not be started.'} No attempt was started and your answers were not saved.`,
            ),
          );
          return null;
        }
        toast({
          title: 'Error starting quiz',
          description: error?.message,
          variant: 'destructive',
        });
        return null;
      } finally {
        startPromiseRef.current = null;
        if (aliveRef.current) setStarting(false);
      }
    };
    const run = (async (): Promise<Submission | null> => {
      let result: Submission | null = null;
      await enqueueQuizWork(workKey, async () => {
        result = await startOnQueue();
      });
      return result;
    })();
    startPromiseRef.current = run;
    return run;
  }, [
    quiz.id,
    quiz.allowed_attempts,
    user?.id,
    toast,
    startUncertain,
    adoptAttempt,
    reconcileStart,
    flushOrphanedAnswers,
    workKey,
  ]);

  // Asks the server to start again after a confirmed refusal. Answers kept in
  // this tab are still unsaved; they are written only once an attempt exists.
  const retryRefusedStart = () => {
    setStartRefused(null);
    void ensureAttempt();
  };

  const retryConfirmStart = async () => {
    const outcome = await reconcileStart(submissionRef.current);
    if (!aliveRef.current) return;
    if (outcome === 'none') setStartUncertain(null);
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    const current = submissionRef.current;
    const inProgress = !!current && isAttemptInProgress(current);
    answersOwnerRef.current = inProgress ? current!.id : PENDING_START;
    revRef.current += 1;
    setSaved(false);
    updateAnswers({ ...answersRef.current, [questionId]: value });
    if (inProgress) {
      scheduleSave();
    } else {
      void ensureAttempt();
    }
  };

  /**
   * Course progress is recorded only after the finalized row is read back:
   * workflow_state 'complete' with a finished_at, written by score-quiz via
   * finalize_quiz_submission. A failure here never re-submits the quiz.
   */
  const recordProgress = useCallback(
    async (submissionId: string) => {
      if (aliveRef.current) setProgressState('saving');
      const { data: row, error } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('id', submissionId)
        .maybeSingle();
      if (error || !row || row.workflow_state !== 'complete' || !row.finished_at) {
        logger.error('Could not confirm the finalized quiz attempt', error ?? row);
        if (aliveRef.current) setProgressState('failed');
        return;
      }
      if (aliveRef.current && submissionRef.current?.id === submissionId) setSubmission(row);
      try {
        // item.id is captured for THIS session, so progress can never be
        // attributed to whatever item the learner has navigated to since.
        const result = await onCompleted?.(item.id);
        if (result === false) throw new Error('Progress was not saved.');
        if (aliveRef.current) setProgressState('idle');
      } catch (error) {
        logger.error('Failed to record quiz progress', error);
        if (aliveRef.current) setProgressState('failed');
      }
    },
    [item.id, onCompleted, setSubmission],
  );

  /** Marks a finalization whose outcome is unknown: no writes, no rescoring, no progress. */
  const holdUncertainFinalization = useCallback(
    (attemptId: string, error: any) => {
      // finalizingAttempts keeps the attempt closed to autosave from every session.
      finalizingAttempts.add(attemptId);
      cancelScheduledSave();
      if (aliveRef.current) {
        setFinalizeUncertain({
          attemptId,
          error: new Error(error?.message || 'The quiz submission could not be confirmed.'),
        });
      }
    },
    [cancelScheduledSave, setFinalizeUncertain],
  );

  /** Shows a finalized attempt read back from the server, then records progress only. */
  const acceptFinalized = useCallback(
    async (row: Submission) => {
      if (aliveRef.current) {
        setFinalizeUncertain(null);
        setSubmission(row);
        setQuizStarted(false);
        setTimeRemaining(null);
      }
      await recordProgress(row.id);
    },
    [recordProgress, setFinalizeUncertain, setSubmission],
  );

  /**
   * Read-only reconciliation of an unconfirmed finalization. It never writes
   * answers and never calls score-quiz: a finalized attempt keeps its result
   * and only progress is retried; an attempt the server still shows in
   * progress is reopened so the learner can submit it.
   */
  const retryConfirmFinalize = async () => {
    const pending = finalizeUncertainRef.current;
    if (!pending) return;
    await pendingQuizWork(workKey);
    const { data: row, error } = await supabase
      .from('quiz_submissions')
      .select('*')
      .eq('id', pending.attemptId)
      .maybeSingle();
    if (!aliveRef.current) return;
    if (error || !row) {
      logger.error('Still could not confirm the quiz submission', error);
      setFinalizeUncertain({ ...pending, error: new Error(error?.message || 'The quiz submission could not be confirmed.') });
      return;
    }
    if (row.workflow_state === 'complete' && row.finished_at) {
      await acceptFinalized(row);
      return;
    }
    if (isAttemptInProgress(row)) {
      finalizingAttempts.delete(row.id);
      setFinalizeUncertain(null);
      if (submissionRef.current?.id === row.id) setSubmission({ ...submissionRef.current, ...row });
      if (revRef.current > savedRevRef.current) scheduleSave();
    }
  };

  const handleSubmitQuiz = async (autoSubmit = false) => {
    if (submittingRef.current || finalizeUncertainRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const releaseSubmitIntent = registerSubmitIntent(workKey);
    let active: Submission | null = null;
    let releaseFinalization: () => void = () => {};
    try {
      active = await ensureAttempt();
      if (!active || !isAttemptInProgress(active)) return;

      // Close the attempt to autosave from every session, then wait for any
      // save already queued, including one sent by a session of this quiz the
      // learner has since left. score-quiz therefore starts only after the
      // last answer write for this attempt has settled, and later work on the
      // queue (another session's resume read) waits for the outcome.
      finalizingAttempts.add(active.id);
      cancelScheduledSave();
      const before = pendingQuizWork(workKey);
      const settled = new Promise<void>((resolve) => {
        releaseFinalization = resolve;
      });
      void enqueueQuizWork(workKey, () => settled);
      await before;

      const remaining = secondsRemaining(active.started_at, quiz.time_limit);
      // Grading happens server-side (see supabase/functions/score-quiz): the
      // browser holds no answer key and cannot set its own score.
      const { data: scored, error: scoreError } = await supabase.functions.invoke('score-quiz', {
        body: {
          submissionId: active.id,
          answers: answersRef.current,
          timeSpent: quiz.time_limit ? quiz.time_limit * 60 - (remaining ?? 0) : null,
        },
      });
      if (scoreError) throw scoreError;
      if (scored?.error) throw new Error(scored.error);

      if (aliveRef.current) {
        setSubmission({
          ...active,
          workflow_state: 'complete',
          score: typeof scored?.score === 'number' ? scored.score : null,
        });
        setQuizStarted(false);
        setTimeRemaining(null);
        setSaved(true);
        toast({
          title: autoSubmit ? 'Quiz auto-submitted' : 'Quiz submitted',
          description: autoSubmit
            ? 'Time expired, so your quiz was submitted automatically.'
            : 'Your quiz has been submitted successfully.',
        });
      }
      releaseFinalization();
      releaseSubmitIntent();
      await recordProgress(active.id);
    } catch (error: any) {
      logger.error('Failed to submit inline quiz', error);
      if (!active) {
        if (aliveRef.current) {
          toast({ title: 'Error submitting quiz', description: error?.message, variant: 'destructive' });
        }
        return;
      }
      // The request may have failed after the server finalized the attempt
      // (e.g. a dropped response). Read before deciding anything.
      const { data: row, error: readError } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('id', active.id)
        .maybeSingle();
      if (!readError && row && isAttemptInProgress(row) && !aliveRef.current && revRef.current > savedRevRef.current) {
        // Not finalized, and the session that holds the answers is gone: write
        // them before releasing the barrier, so a returning session resumes
        // them instead of a stale or blank attempt.
        finalizingAttempts.delete(active.id);
        await writeAnswersNow(active.id);
      }
      releaseFinalization();
      releaseSubmitIntent();
      if (!readError && row && row.workflow_state === 'complete' && row.finished_at) {
        await acceptFinalized(row);
        return;
      }
      if (readError || !row || !isAttemptInProgress(row)) {
        // Unknown outcome: the attempt stays closed until a read settles it.
        logger.error('Could not confirm whether the quiz was submitted', readError ?? row);
        holdUncertainFinalization(active.id, error);
        return;
      }
      // Read back still in progress: nothing was finalized. Reopen it to autosave.
      finalizingAttempts.delete(active.id);
      if (revRef.current > savedRevRef.current) scheduleSave();
      if (aliveRef.current) {
        toast({
          title: 'Error submitting quiz',
          description: error?.message,
          variant: 'destructive',
        });
      }
    } finally {
      releaseFinalization();
      releaseSubmitIntent();
      submittingRef.current = false;
      if (aliveRef.current) setSubmitting(false);
    }
  };

  // Always call the latest handler from the timer.
  const submitRef = useRef(handleSubmitQuiz);
  submitRef.current = handleSubmitQuiz;

  // The clock is derived from the attempt's server started_at, so a reload or
  // a return to the lesson resumes it rather than granting a fresh limit.
  useEffect(() => {
    if (!quizStarted || !submission || !isAttemptInProgress(submission) || !quiz.time_limit) return;
    const tick = () => {
      const left = secondsRemaining(submission.started_at, quiz.time_limit);
      setTimeRemaining(left);
      if (left === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        void submitRef.current(true);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [quizStarted, submission, quiz.time_limit]);

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

  const allowed = quiz.allowed_attempts;
  const unlimited = isUnlimitedAttempts(allowed);
  const inProgress = isAttemptInProgress(submission);
  const isComplete = submission?.workflow_state === 'complete';
  const showReview = isComplete && !quizStarted;
  const canStartAnother = canStartNewAttempt(submission, allowed);
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const totalPossible = questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const attemptLabel = (n: number) =>
    unlimited ? `Attempt ${n} · Unlimited attempts` : `Attempt ${n} of ${allowed}`;

  const startRetake = async () => {
    // The finalized attempt stays on screen until the new one exists; a failed
    // start leaves the learner on their result rather than a blank player.
    if (starting || !canStartAnother) return;
    // The finalized attempt's answers must never reach the new attempt: drop
    // any scheduled save and start the new attempt from no answers, owned by
    // no attempt until start_quiz_attempt (or a later reconciliation) returns
    // one. The workspace is NOT refilled if the start fails or is uncertain:
    // the review renders the finalized attempt from the server, so nothing is
    // lost, and an attempt adopted later always starts blank.
    cancelScheduledSave();
    answersOwnerRef.current = null;
    revRef.current += 1;
    savedRevRef.current = revRef.current;
    updateAnswers({});
    const row = await ensureAttempt();
    if (!aliveRef.current) return;
    if (row) setCurrentQuestionIndex(0);
  };

  const formatClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Fail closed: don't let a failed prior-attempt lookup masquerade as "no
  // prior attempt", which would allow starting attempts past the limit.
  if (loadError && !quizStarted) {
    return (
      <CourseErrorState
        title="Couldn't load your quiz attempts"
        error={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  if (restoreError) {
    return (
      <CourseErrorState
        title="Couldn't restore your saved answers"
        error={restoreError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  // Checked BEFORE the empty state: a failed question fetch leaves no questions,
  // and "This quiz has no questions yet" would make an outage look like
  // unfinished course content.
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

  // Until the latest attempt is known, answering could start a second attempt
  // beside one already in progress, so no question is interactive yet.
  if (!loaded) {
    return (
      <Card data-testid="quiz-player-loading">
        <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your quiz…
        </CardContent>
      </Card>
    );
  }

  if (finalizeUncertain) {
    return (
      <CourseErrorState
        title="Couldn't confirm whether your quiz was submitted"
        error={finalizeUncertain.error}
        onRetry={() => void retryConfirmFinalize()}
      />
    );
  }

  if (startUncertain) {
    return (
      <CourseErrorState
        title="Couldn't confirm whether your attempt started"
        error={startUncertain}
        onRetry={() => void retryConfirmStart()}
      />
    );
  }

  if (startRefused) {
    return (
      <CourseErrorState title="Couldn't start this quiz" error={startRefused} onRetry={retryRefusedStart} />
    );
  }

  if (showReview) {
    const answerByQuestion = new Map((submissionAnswers ?? []).map((a) => [a.quiz_question_id, a]));
    const scored = typeof submission.score === 'number' ? submission.score : null;
    const remaining = attemptsRemaining(submission, allowed);
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
              {scored === null
                ? 'Score unavailable'
                : `${scored} / ${totalPossible} ${totalPossible === 1 ? 'point' : 'points'}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {attemptLabel(submission.attempt)}
              {remaining === null
                ? ''
                : remaining > 0
                  ? ` · ${remaining} attempt${remaining === 1 ? '' : 's'} remaining`
                  : ' · No attempts remaining'}
            </p>
            {progressState === 'failed' && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-2">
                  <span>Your quiz was submitted, but your course progress wasn't saved.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => void recordProgress(submission.id)}
                  >
                    Retry saving progress
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {progressState === 'saving' && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving your course progress…
              </p>
            )}
            {canStartAnother && (
              <Button variant="outline" size="sm" onClick={() => void startRetake()} disabled={starting}>
                {starting ? 'Starting…' : 'Retake quiz'}
              </Button>
            )}
          </CardContent>
        </Card>

        {reviewError ? (
          <CourseErrorState
            title="Couldn't load your answer review"
            error={reviewError}
            onRetry={() => setReviewReloadKey((k) => k + 1)}
          />
        ) : submissionAnswers === null ? (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading your answers…
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>
    );
  }

  if (!inProgress && !canStartAnother) {
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CardTitle className="text-lg">Quiz</CardTitle>
            {submission && inProgress && (
              <span className="text-xs text-muted-foreground">{attemptLabel(submission.attempt)}</span>
            )}
            {timeRemaining !== null && inProgress && (
              <span className="text-xs font-medium text-foreground" data-testid="quiz-timer">
                Time remaining {formatClock(timeRemaining)}
              </span>
            )}
            {starting && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Starting attempt…
              </span>
            )}
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
