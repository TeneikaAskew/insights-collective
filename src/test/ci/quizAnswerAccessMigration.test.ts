// Static assertions for 20261107000000_quiz_answer_key_and_learner_writes.sql.
// Source-only: reads files, never a database. Pins that the key columns stay out of the authenticated grant, that the
// taking RPC withholds free-response option text before the reveal, that learner answer writes need an in-progress
// attempt, and that the policies it replaces exist under those names in the live snapshot.
// Behaviour is asserted by scripts/local-db/tests/10_quiz_answer_access.sql.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const NAME = '20261107000000_quiz_answer_key_and_learner_writes.sql';
const raw = readFileSync(path.join(ROOT, 'supabase/migrations', NAME), 'utf8');
const sql = raw.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const live = readFileSync(path.join(ROOT, 'scripts/local-stack/schema/04_rls_policies.sql'), 'utf8');
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
const KEY_COLUMNS = ['answers', 'correct_answer', 'explanation', 'feedback', 'options'];

describe('quiz answer access migration (static)', () => {
  it('has a unique version among migrations and sorts after the migrations it replaces', () => {
    const files = readdirSync(path.join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql'));
    expect(files.filter((f) => f.startsWith(NAME.slice(0, 14)))).toEqual([NAME]);
    // It must run after the column grant it repairs and the November quiz migrations whose objects it touches.
    // Later migrations are fine, so this does not assert that it is the newest file.
    for (const earlier of ['20260731000800', '20261101000200', '20261102000000']) {
      expect(NAME.slice(0, 14) > earlier).toBe(true);
    }
  });

  it('revokes the table-wide SELECT and grants only key-free columns to authenticated', () => {
    expect(sql).toMatch(/REVOKE SELECT ON public\.quiz_questions FROM authenticated;/);
    expect(sql).toMatch(/REVOKE SELECT ON public\.quiz_questions FROM anon;/);
    const grant = sql.match(/GRANT SELECT \(([^)]*)\) ON public\.quiz_questions TO authenticated;/);
    expect(grant).not.toBeNull();
    const cols = grant![1].split(',').map((c) => c.trim().replace(/"/g, ''));
    expect(cols.sort()).toEqual(['created_at', 'id', 'points', 'position', 'question_text', 'question_type', 'quiz_id']);
    for (const c of KEY_COLUMNS) expect(cols).not.toContain(c);
    // No other statement may hand the table back.
    expect(sql).not.toMatch(/GRANT (SELECT|ALL)[^;(]* ON (TABLE )?public\.quiz_questions/i);
  });

  it('fails loudly in the same transaction if a key column is still readable', () => {
    expect(flat(sql)).toContain("has_column_privilege(r, 'public.quiz_questions', c, 'SELECT')");
    for (const c of KEY_COLUMNS) expect(sql).toContain(`'${c}'`);
  });

  it('taking RPC: free-response option text is withheld until the reveal point', () => {
    const body = flat(sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_taking')));
    expect(body).toContain(
      "WHEN NOT v_reveal AND q.question_type::text NOT IN ('multiple_choice', 'true_false', 'multiple_answers') THEN '[]'::jsonb",
    );
    // The guard is the first branch, ahead of both option shapes.
    expect(body.indexOf('WHEN NOT v_reveal AND q.question_type')).toBeLessThan(body.indexOf("jsonb_typeof(q.answers) = 'array'"));
    expect(body).toContain('SECURITY DEFINER');
    expect(body).toContain('public.can_access_quiz_question(auth.uid(), q.id)');
  });

  it('client: no direct quiz_questions read names a key column or *', () => {
    const service = readFileSync(path.join(ROOT, 'src/services/canvasContentService.ts'), 'utf8');
    for (const m of service.matchAll(/quiz_questions\(([^)]*)\)/g)) {
      expect(m[1]).not.toMatch(/\*|answers|correct_answer|explanation|feedback|options/);
    }
    expect(service).toContain(".select(QUIZ_QUESTION_PUBLIC_COLUMNS)");
  });

  it('answer writes: replaces exactly the three live learner policies, each now requiring an in-progress attempt', () => {
    const drops = [...sql.matchAll(/DROP POLICY "([^"]+)" ON public\.(\w+);/g)].map((m) => `${m[2]}:${m[1]}`);
    expect(drops.sort()).toEqual([
      'quiz_submission_answers:Users can create their own quiz submission answers',
      'quiz_submission_answers:Users can delete their own quiz submission answers',
      'quiz_submission_answers:Users can update their own quiz submission answers',
    ]);
    expect(sql).not.toMatch(/DROP POLICY IF EXISTS/i);
    for (const d of drops) {
      const [table, name] = d.split(':');
      expect(live).toContain(`create policy "${name}" on public.${table} `);
    }
    const creates = [...sql.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.quiz_submission_answers\s+FOR (\w+)\s+TO (\w+)([\s\S]*?);\n/g)];
    expect(creates.map((m) => m[2]).sort()).toEqual(['DELETE', 'INSERT', 'UPDATE']);
    for (const m of creates) {
      expect(m[3]).toBe('authenticated');
      const body = flat(m[4]);
      expect(body).toContain('qs.user_id = auth.uid()');
      expect(body).toContain("qs.workflow_state IS DISTINCT FROM 'complete'");
      expect(body).toContain('qs.finished_at IS NULL');
    }
  });

  it('attempt fields: a BEFORE UPDATE trigger keeps them for API callers other than staff and service_role', () => {
    const body = flat(sql.slice(sql.indexOf('FUNCTION public.pin_quiz_submission_attempt_fields')));
    expect(body).toContain("IF v_role IS NULL OR v_role = 'service_role' OR public.is_grading_staff() THEN RETURN NEW;");
    for (const c of ['attempt', 'started_at', 'end_at', 'finished_at', 'time_spent', 'extra_time', 'extra_attempts', 'manually_unlocked']) {
      expect(body).toContain(`NEW.${c}`);
    }
    expect(flat(sql)).toContain(
      'CREATE TRIGGER pin_quiz_submission_attempt_fields BEFORE UPDATE ON public.quiz_submissions FOR EACH ROW EXECUTE FUNCTION public.pin_quiz_submission_attempt_fields();',
    );
  });
});
