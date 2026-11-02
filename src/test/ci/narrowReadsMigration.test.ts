// Static assertions for 20261102000000_narrow_quiz_feedback_blog_settings_reads.sql.
// Source-only: reads files, never a database. Pins that the migration is policies-only, narrows exactly the
// three reviewed reads, keeps anonymous quiz compatibility, and matches the live policy names it replaces.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const NAME = '20261102000000_narrow_quiz_feedback_blog_settings_reads.sql';
const raw = readFileSync(path.join(ROOT, 'supabase/migrations', NAME), 'utf8');
const sql = raw.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const live = readFileSync(path.join(ROOT, 'scripts/local-stack/schema/04_rls_policies.sql'), 'utf8');
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

type Policy = { name: string; table: string; cmd: string; to: string; body: string };
const creates: Policy[] = [...sql.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.(\w+)\s+FOR (\w+)\s+TO (\w+)\s+(USING|WITH CHECK)\s*\(([\s\S]*?)\);/g)]
  .map((m) => ({ name: m[1], table: m[2], cmd: m[3], to: m[4], body: flat(m[6]) }));
const drops = [...sql.matchAll(/DROP POLICY IF EXISTS "([^"]+)" ON public\.(\w+);/g)].map((m) => `${m[2]}:${m[1]}`);
const byName = (n: string) => creates.find((p) => p.name === n)!;

describe('narrow reads migration (static)', () => {
  it('has a unique version among migrations', () => {
    const v = NAME.slice(0, 14);
    const same = readdirSync(path.join(ROOT, 'supabase/migrations')).filter((f) => f.startsWith(v));
    expect(same).toEqual([NAME]);
  });

  it('contains only 4 DROP POLICY and 4 CREATE POLICY statements', () => {
    const statements = sql.split(';').map(flat).filter(Boolean);
    expect(statements).toHaveLength(8);
    for (const s of statements) expect(s).toMatch(/^(DROP POLICY IF EXISTS|CREATE POLICY) /);
    expect(sql).not.toMatch(/\b(DELETE|UPDATE|INSERT INTO|TRUNCATE|ALTER|GRANT|REVOKE|FUNCTION|TABLE)\b/i);
    expect(creates).toHaveLength(4);
  });

  it('drops exactly the four live policies, each of which exists in the live snapshot', () => {
    expect(drops.sort()).toEqual([
      'blog_settings:Anyone can view blog settings',
      'career_quiz_attempts:Users can insert their own quiz attempts',
      'career_quiz_attempts:Users can view their own quiz attempts',
      'user_feedback:Users can view feedback',
    ]);
    for (const d of drops) {
      const [table, name] = d.split(':');
      expect(live).toContain(`create policy "${name}" on public.${table} `);
    }
  });

  it('quiz: keeps name, command and role; session branch now requires an anonymous row', () => {
    for (const [name, cmd] of [['Users can view their own quiz attempts', 'SELECT'], ['Users can insert their own quiz attempts', 'INSERT']]) {
      const p = byName(name);
      expect(p).toMatchObject({ table: 'career_quiz_attempts', cmd, to: 'public' });
      expect(live).toContain(`create policy "${name}" on public.career_quiz_attempts as permissive for ${cmd} to public`);
      expect(p.body).toBe(
        "(auth.uid() = user_id) OR (user_id IS NULL AND session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))",
      );
    }
  });

  it('feedback: SELECT is owner or admin, same name and role; INSERT/UPDATE untouched', () => {
    expect(byName('Users can view feedback')).toEqual({
      name: 'Users can view feedback', table: 'user_feedback', cmd: 'SELECT', to: 'authenticated',
      body: '(auth.uid() = user_id) OR public.has_admin_access(auth.uid())',
    });
    expect(drops.filter((d) => d.startsWith('user_feedback:'))).toEqual(['user_feedback:Users can view feedback']);
  });

  it('blog_settings: SELECT limited to the blog-authoring roles of 20260731000000; write policy untouched', () => {
    expect(byName('Blog authors can view blog settings')).toEqual({
      name: 'Blog authors can view blog settings', table: 'blog_settings', cmd: 'SELECT', to: 'authenticated',
      body: "public.has_admin_access(auth.uid()) OR 'instructor' = ANY(public.get_user_roles(auth.uid()))",
    });
    const authoring = readFileSync(path.join(ROOT, 'supabase/migrations/20260731000000_tighten_blog_posts_rls.sql'), 'utf8');
    expect(flat(authoring)).toContain("public.has_admin_access(auth.uid()) OR 'instructor' = ANY(public.get_user_roles(auth.uid()))");
    expect(drops).not.toContain('blog_settings:Admins can manage blog settings');
  });

  it('client paths the predicates rely on are unchanged', () => {
    const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
    // Both live quiz writers run only when signed in, so they use the unchanged auth.uid() branch.
    expect(read('src/hooks/useCareerCoach.ts')).toMatch(/if \(isAuthenticated\)[\s\S]*storeQuizAttempt\(/);
    expect(read('src/pages/AssistantInterface.tsx')).toMatch(/assistantId === 'career-coach' && isAuthenticated[\s\S]*storeQuizAttempt\(/);
    // Feedback submission inserts its own user_id and reads nothing back.
    const fb = read('src/hooks/useFeedbackSubmission.ts');
    expect(fb).toMatch(/from\('user_feedback'\)[\s\S]*\.insert\(/);
    expect(fb).not.toMatch(/from\('user_feedback'\)[\s\S]{0,400}\.select\(/);
    // BlogPostForm tolerates "no row" (PGRST116), and the blog admin route admits admins and instructors.
    expect(read('src/components/blog/BlogPostForm.tsx')).toContain("error.code !== 'PGRST116'");
    expect(read('src/App.tsx')).toMatch(/path="\/admin\/blog\/\*"[\s\S]{0,120}requireAdmin allowInstructor/);
  });
});
