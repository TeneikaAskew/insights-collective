// ABOUTME: In-memory stand-in for the quiz backend the inline player talks to, mirroring the SQL contract:
// ABOUTME: start_quiz_attempt (20260802234500 / 20261101000100) and score-quiz + finalize_quiz_submission.
//
// This is a MOCK. It encodes the server rules so unit tests can assert the
// player's lifecycle (one attempt per start, resume, retake numbering, no direct
// INSERT), but it proves nothing about the real database. The real-stack
// fixtures live outside the unit suite.
import { vi } from 'vitest';
import { mockSupabaseClient } from '@/test/mocks/supabase';

export interface FakeSubmission {
  id: string;
  quiz_id: string;
  user_id: string;
  attempt: number;
  workflow_state: 'pending_review' | 'complete';
  started_at: string;
  finished_at: string | null;
  score: number | null;
  kept_score: number | null;
  time_spent: number | null;
}

export interface FakeAnswer {
  quiz_submission_id: string;
  quiz_question_id: string;
  answer_data: { answer: unknown };
  correct?: boolean;
  points?: number;
}

interface FakeQuiz {
  id: string;
  allowed_attempts: number | null;
  questions: Array<{ id: string; points: number; key?: unknown }>;
}

type Gate = { promise: Promise<void>; release: () => void };
export function gate(): Gate {
  let release!: () => void;
  const promise = new Promise<void>((r) => {
    release = r;
  });
  return { promise, release };
}

// Ids are unique across every fake server in a test file, like real UUIDs, so per-attempt client state
// (write chains, finalizing set) from one test can never alias an attempt in another.
let globalSeq = 0;

export function createQuizServer(opts: { userId?: string; quizzes: FakeQuiz[] }) {
  const userId = opts.userId ?? 'user-1';
  const quizzes = new Map(opts.quizzes.map((q) => [q.id, q]));
  const submissions: FakeSubmission[] = [];
  const answers: FakeAnswer[] = [];

  const calls = {
    startRpc: [] as string[],
    directInsert: [] as unknown[],
    score: [] as Array<{ submissionId: string; answers: Record<string, unknown> }>,
    latestLookups: [] as string[],
    // Every answer upsert, in the order the server APPLIED it, with the attempt's state at that moment.
    answerWrites: [] as Array<{ submissionId: string; answers: Record<string, unknown>; stateAtApply: string }>,
    // Ordered server-side events, for ordering assertions.
    events: [] as string[],
  };

  // Hooks a test can set to delay or fail a given operation.
  const hooks: {
    beforeStart?: (quizId: string) => Promise<void> | void;
    beforeLatest?: (quizId: string) => Promise<void> | void;
    failAnswersLoad?: (submissionId: string) => boolean;
    failReadback?: boolean;
    failStart?: string | null;
    // Commit the attempt, then lose the response (transport failure after commit).
    loseStartResponse?: boolean;
    // Score and finalize, then lose the response (transport failure after commit).
    loseScoreResponse?: boolean;
    // Delay score-quiz, or refuse it before anything is finalized.
    beforeScore?: () => Promise<void> | void;
    failScore?: boolean;
    beforeAnswerWrite?: (n: number) => Promise<void> | void;
    failLatest?: boolean;
  } = {};
  let answerWriteSeq = 0;

  function seedSubmission(s: Partial<FakeSubmission> & { quiz_id: string; attempt: number }) {
    const row: FakeSubmission = {
      id: `sub-${++globalSeq}`,
      user_id: userId,
      workflow_state: 'pending_review',
      started_at: new Date().toISOString(),
      finished_at: null,
      score: null,
      kept_score: null,
      time_spent: null,
      ...s,
    };
    submissions.push(row);
    return row;
  }

  function seedAnswer(a: FakeAnswer) {
    answers.push(a);
  }

  function startQuizAttempt(quizId: string) {
    const quiz = quizzes.get(quizId);
    if (!quiz) return { data: null, error: { message: 'Quiz not found.', code: 'P0002' } };
    const mine = submissions.filter((s) => s.quiz_id === quizId && s.user_id === userId);
    const last = mine.reduce((m, s) => Math.max(m, s.attempt), 0);
    const allowed = quiz.allowed_attempts;
    if (allowed != null && allowed > 0 && last >= allowed) {
      return {
        data: null,
        error: { message: `You have used all ${allowed} attempts for this quiz.`, code: 'P0001' },
      };
    }
    const row = seedSubmission({ quiz_id: quizId, attempt: last + 1 });
    return { data: { ...row }, error: null };
  }

  function score(submissionId: string, given: Record<string, unknown>, timeSpent: number | null) {
    const sub = submissions.find((s) => s.id === submissionId && s.user_id === userId);
    if (!sub) return { data: { error: 'Submission not found' }, error: null };
    if (sub.workflow_state === 'complete') {
      return { data: null, error: { message: 'This attempt is already submitted' } };
    }
    const quiz = quizzes.get(sub.quiz_id)!;
    const completed = submissions.filter(
      (s) => s.quiz_id === sub.quiz_id && s.user_id === userId && s.workflow_state === 'complete',
    ).length;
    if (quiz.allowed_attempts != null && quiz.allowed_attempts > 0 && completed >= quiz.allowed_attempts) {
      return { data: null, error: { message: 'Attempt limit reached' } };
    }
    let total = 0;
    for (const q of quiz.questions) {
      const correct = q.key !== undefined && given[q.id] === q.key;
      const points = correct ? q.points : 0;
      total += points;
      const existing = answers.find((a) => a.quiz_submission_id === sub.id && a.quiz_question_id === q.id);
      const row = {
        quiz_submission_id: sub.id,
        quiz_question_id: q.id,
        answer_data: { answer: given[q.id] ?? null },
        correct,
        points,
      };
      if (existing) Object.assign(existing, row);
      else answers.push(row);
    }
    Object.assign(sub, {
      workflow_state: 'complete',
      finished_at: new Date().toISOString(),
      score: total,
      kept_score: total,
      time_spent: timeSpent,
    });
    return { data: { score: total, pointsPossible: quiz.questions.reduce((s, q) => s + q.points, 0), results: [] }, error: null };
  }

  function builder(table: string) {
    const filters: Record<string, unknown> = {};
    let op: 'select' | 'insert' | 'upsert' | 'update' = 'select';
    let payload: any = null;
    let limit: number | null = null;
    let single = false;
    const b: any = {};
    b.select = vi.fn(() => b);
    b.eq = vi.fn((col: string, val: unknown) => {
      filters[col] = val;
      return b;
    });
    b.order = vi.fn(() => b);
    b.limit = vi.fn((n: number) => {
      limit = n;
      return b;
    });
    b.single = vi.fn(() => {
      single = true;
      return b;
    });
    b.maybeSingle = vi.fn(() => {
      single = true;
      return b;
    });
    b.insert = vi.fn((p: unknown) => {
      op = 'insert';
      payload = p;
      return b;
    });
    b.upsert = vi.fn((p: unknown) => {
      op = 'upsert';
      payload = p;
      return b;
    });
    b.update = vi.fn((p: unknown) => {
      op = 'update';
      payload = p;
      return b;
    });

    const run = async (): Promise<{ data: any; error: any }> => {
      if (table === 'quiz_submissions') {
        if (op === 'insert') {
          // Recorded so tests can prove the player never takes this path.
          calls.directInsert.push(payload);
          const p = Array.isArray(payload) ? payload[0] : payload;
          const row = seedSubmission({ ...p });
          return { data: single ? { ...row } : [{ ...row }], error: null };
        }
        if (op === 'update') {
          return { data: null, error: { message: 'learners cannot update submissions here' } };
        }
        if (filters.id) {
          if (hooks.failReadback) return { data: null, error: { message: 'readback unavailable' } };
          const row = submissions.find((s) => s.id === filters.id && s.user_id === userId);
          return { data: row ? { ...row } : null, error: row ? null : { message: 'not found' } };
        }
        const quizId = filters.quiz_id as string;
        calls.latestLookups.push(quizId);
        await hooks.beforeLatest?.(quizId);
        if (hooks.failLatest) return { data: null, error: { message: 'attempts unavailable' } };
        const rows = submissions
          .filter((s) => s.quiz_id === quizId && s.user_id === filters.user_id)
          .sort((a, b2) => b2.attempt - a.attempt)
          .slice(0, limit ?? undefined)
          .map((s) => ({ ...s }));
        return { data: rows, error: null };
      }
      if (table === 'quiz_submission_answers') {
        if (op === 'upsert') {
          const n = ++answerWriteSeq;
          await hooks.beforeAnswerWrite?.(n);
          // No masking: the database pins grading columns (correct/points) on finalized attempts, NOT
          // answer_data, so a late write is applied here exactly as it would be there and the tests must
          // prove the player never sends one.
          const rows = payload as FakeAnswer[];
          if (rows.length > 0) {
            const subId = rows[0].quiz_submission_id;
            const sub = submissions.find((s) => s.id === subId);
            calls.answerWrites.push({
              submissionId: subId,
              answers: Object.fromEntries(rows.map((r) => [r.quiz_question_id, r.answer_data?.answer])),
              stateAtApply: sub?.workflow_state ?? 'missing',
            });
            calls.events.push(`write:${subId}`);
          }
          for (const r of rows) {
            const existing = answers.find(
              (a) => a.quiz_submission_id === r.quiz_submission_id && a.quiz_question_id === r.quiz_question_id,
            );
            if (existing) existing.answer_data = r.answer_data;
            else answers.push({ ...r });
          }
          return { data: null, error: null };
        }
        const subId = filters.quiz_submission_id as string;
        if (hooks.failAnswersLoad?.(subId)) return { data: null, error: { message: 'answers unavailable' } };
        return {
          data: answers.filter((a) => a.quiz_submission_id === subId).map((a) => ({ ...a })),
          error: null,
        };
      }
      return { data: null, error: null };
    };

    b.then = (onFulfilled: any, onRejected: any) => run().then(onFulfilled, onRejected);
    return b;
  }

  function install() {
    (mockSupabaseClient.from as any).mockImplementation((table: string) => builder(table));
    (mockSupabaseClient.rpc as any).mockImplementation((name: string, args: any) => {
      const exec = async () => {
        if (name === 'get_quiz_questions_for_taking') return { data: [], error: null };
        if (name === 'start_quiz_attempt') {
          calls.startRpc.push(args.p_quiz_id);
          await hooks.beforeStart?.(args.p_quiz_id);
          if (hooks.failStart) return { data: null, error: { message: hooks.failStart } };
          const res = startQuizAttempt(args.p_quiz_id);
          if (res.data) calls.events.push(`start:${res.data.id}`);
          if (hooks.loseStartResponse && res.data) {
            // supabase-js reports a fetch failure as an error with no status.
            return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } };
          }
          return res;
        }
        return { data: null, error: { message: `unexpected rpc ${name}` } };
      };
      const p: any = {
        single: () => p,
        then: (f: any, r: any) => exec().then(f, r),
      };
      return p;
    });
    (mockSupabaseClient.functions.invoke as any).mockImplementation(async (name: string, { body }: any) => {
      if (name !== 'score-quiz') return { data: null, error: { message: 'unexpected function' } };
      await hooks.beforeScore?.();
      calls.score.push({ submissionId: body.submissionId, answers: body.answers });
      if (hooks.failScore) return { data: null, error: { message: 'scoring unavailable' } };
      calls.events.push(`score:${body.submissionId}`);
      const res = score(body.submissionId, body.answers, body.timeSpent ?? null);
      if (!res.error && !(res.data as any)?.error) calls.events.push(`finalized:${body.submissionId}`);
      if (hooks.loseScoreResponse && !res.error) {
        return { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' } };
      }
      return res;
    });
  }

  return { submissions, answers, calls, hooks, seedSubmission, seedAnswer, install };
}
