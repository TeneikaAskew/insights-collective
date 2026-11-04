// ABOUTME: Creates the legitimate submissions a learner needs before their assessed content items
// ABOUTME: (assignments, quizzes) may be marked complete, so journey specs satisfy the database
// ABOUTME: guard `enforce_assessed_progression` instead of bypassing it.
//
// Since migration 20261031120009 a `content_item_progressions` row for an assignment or quiz
// can only reach a done state when a real submission exists: an `assignment_submissions` row
// with `submitted_at` set, or a `quiz_submissions` row in `pending_review`/`complete`. The
// certificate journeys used to upsert `completed` for every item directly, which the guard now
// rejects with 23514 — correctly. This helper makes the fixture honest rather than weakening
// the guard: it submits each assignment and starts each quiz through the same paths the app
// uses (REST insert the student is allowed to make; the `start_quiz_attempt` RPC).
//
// Idempotent on purpose: an existing qualifying submission is reused, so repeated runs do not
// leak a row per run (see docs/lessons-learned on the quiz fixture that once did).
import type { Page } from '@playwright/test';

export interface AssessedPrereqOptions {
  supabaseUrl: string;
  /** Headers carrying `apikey` and the learner's `Authorization: Bearer …`. */
  headers: Record<string, string>;
  userId: string;
  /** Published content item ids the spec is about to mark complete. */
  itemIds: string[];
  /** Body text recorded on any assignment submission this helper has to create. */
  submissionBody?: string;
}

export interface AssessedPrereqResult {
  assignmentsFound: number;
  assignmentsSubmitted: number;
  quizzesFound: number;
  quizzesStarted: number;
}

async function readJson<T>(res: { ok(): boolean; status(): number; text(): Promise<string>; json(): Promise<unknown> }, what: string): Promise<T> {
  if (!res.ok()) {
    throw new Error(`${what} failed (${res.status()}: ${(await res.text()).slice(0, 300)})`);
  }
  return (await res.json()) as T;
}

export async function ensureAssessedPrerequisites(
  page: Page,
  opts: AssessedPrereqOptions,
): Promise<AssessedPrereqResult> {
  const { supabaseUrl, headers, userId, itemIds } = opts;
  const json = { ...headers, 'Content-Type': 'application/json' };
  const idList = itemIds.join(',');
  const result: AssessedPrereqResult = { assignmentsFound: 0, assignmentsSubmitted: 0, quizzesFound: 0, quizzesStarted: 0 };
  if (itemIds.length === 0) return result;

  // --- assignments: a submission with submitted_at is what the guard looks for ---
  const assignments = await readJson<Array<{ id: string; content_item_id: string }>>(
    await page.request.get(
      `${supabaseUrl}/rest/v1/assignments?content_item_id=in.(${idList})&select=id,content_item_id`,
      { headers },
    ),
    'assignments lookup',
  );
  result.assignmentsFound = assignments.length;
  for (const a of assignments) {
    const existing = await readJson<Array<{ id: string; attempt: number | null; submitted_at: string | null }>>(
      await page.request.get(
        `${supabaseUrl}/rest/v1/assignment_submissions?assignment_id=eq.${a.id}&user_id=eq.${userId}&select=id,attempt,submitted_at&order=attempt.desc`,
        { headers },
      ),
      `own submissions for assignment ${a.id}`,
    );
    if (existing.some((s) => s.submitted_at)) continue;
    const nextAttempt = (existing[0]?.attempt ?? 0) + 1; // unique (assignment_id, user_id, attempt)
    const res = await page.request.post(`${supabaseUrl}/rest/v1/assignment_submissions`, {
      headers: { ...json, Prefer: 'return=minimal' },
      data: JSON.stringify({
        assignment_id: a.id,
        user_id: userId,
        workflow_state: 'submitted',
        body: opts.submissionBody ?? 'E2E assessed-completion prerequisite',
        submitted_at: new Date().toISOString(),
        attempt: nextAttempt,
      }),
    });
    if (!res.ok()) {
      throw new Error(`submission insert for assignment ${a.id} failed (${res.status()}: ${(await res.text()).slice(0, 300)})`);
    }
    result.assignmentsSubmitted += 1;
  }

  // --- quizzes: direct inserts are not permitted; start_quiz_attempt is the only path ---
  const quizzes = await readJson<Array<{ id: string; content_item_id: string }>>(
    await page.request.get(
      `${supabaseUrl}/rest/v1/quizzes?content_item_id=in.(${idList})&select=id,content_item_id`,
      { headers },
    ),
    'quizzes lookup',
  );
  result.quizzesFound = quizzes.length;
  for (const q of quizzes) {
    const existing = await readJson<Array<{ id: string }>>(
      await page.request.get(
        `${supabaseUrl}/rest/v1/quiz_submissions?quiz_id=eq.${q.id}&user_id=eq.${userId}&workflow_state=in.(complete,pending_review)&select=id`,
        { headers },
      ),
      `own submissions for quiz ${q.id}`,
    );
    if (existing.length) continue;
    const res = await page.request.post(`${supabaseUrl}/rest/v1/rpc/start_quiz_attempt`, {
      headers: json,
      data: JSON.stringify({ p_quiz_id: q.id }),
    });
    if (!res.ok()) {
      throw new Error(`start_quiz_attempt for quiz ${q.id} failed (${res.status()}: ${(await res.text()).slice(0, 300)})`);
    }
    result.quizzesStarted += 1;
  }

  return result;
}
