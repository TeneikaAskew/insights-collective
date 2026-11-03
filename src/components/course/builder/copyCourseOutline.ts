// ABOUTME: "Copy from another course" for the new-course wizard (T-18): lists the author's own courses and
// ABOUTME: reads one course's sections and lessons (title, type, lesson text) into a wizard outline, failing closed.
//
// Every read here fails closed. A read error throws. An empty source throws. Too many rows for the explicit
// limit, or a reply whose exact count does not match the rows returned, throws instead of copying part of a
// course. The source must be owned by the given user at the moment it is read. Lesson text that carries a
// credential or signed reference (WP-08 section 3) is refused, never stripped: the author is told which lessons.
import type { OutlineSection } from '@/components/course/builder/teachable/NewCourseWizard';

type Client = { from: (table: string) => any };

export interface CopyableCourse {
  id: string;
  title: string;
}

/**
 * Explicit read limits. Each read asks for one row more than its limit with an exact count, so a source that is
 * larger than the limit, or a reply shortened by the server's row cap, is detected and refused.
 */
export const COPY_LIMITS = { courses: 200, modules: 100, lessons: 500 } as const;

export class CopyReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CopyReadError';
  }
}

export class CopyUnsupportedContentError extends Error {
  constructor(readonly lessons: string[]) {
    super(
      `These lessons contain a link with a sign-in key, password or signed access token, which is not copied: ${lessons.join(', ')}. ` +
        'Replace those links in the source course with ordinary links, then copy again.',
    );
    this.name = 'CopyUnsupportedContentError';
  }
}

async function readAll(query: any, limit: number, what: string): Promise<any[]> {
  const res = await query.limit(limit + 1);
  if (res.error) throw new CopyReadError(`${what} could not be read: ${res.error.message || 'unknown error'}`);
  const rows = (res.data ?? []) as any[];
  if (typeof res.count !== 'number') throw new CopyReadError(`${what} could not be read completely.`);
  if (res.count > limit || rows.length > limit) {
    throw new CopyReadError(`${what} has more than ${limit} entries, which is more than can be copied here.`);
  }
  if (rows.length !== res.count) throw new CopyReadError(`${what} could not be read completely.`);
  return rows;
}

/** Courses this author owns, by title. Copying is limited to the author's own courses. */
export async function listCopyableCourses(client: Client, userId: string): Promise<CopyableCourse[]> {
  if (!userId) throw new CopyReadError('Sign in again to copy from your courses.');
  const rows = await readAll(
    client.from('courses').select('id, title', { count: 'exact' }).eq('instructor_id', userId).order('title', { ascending: true }),
    COPY_LIMITS.courses,
    'Your course list',
  );
  return rows.map((c) => ({ id: c.id, title: c.title || 'Untitled course' }));
}

/** Throws unless `courseId` is a course whose instructor is `userId` right now. */
export async function assertCourseOwned(client: Client, courseId: string, userId: string): Promise<void> {
  if (!userId || !courseId) throw new CopyReadError('Sign in again to copy from your courses.');
  const { data, error } = await client
    .from('courses')
    .select('id, instructor_id')
    .eq('id', courseId)
    .eq('instructor_id', userId)
    .maybeSingle();
  if (error) throw new CopyReadError(`That course could not be checked: ${error.message || 'unknown error'}`);
  if (!data || data.id !== courseId || data.instructor_id !== userId) {
    throw new CopyReadError('That course is not one of your courses, so it cannot be copied.');
  }
}

// Query and fragment keys that carry a credential or a signature. Bounded on purpose: an ordinary link
// (page, anchor, video start time, public storage object) is copied unchanged.
const CREDENTIAL_KEYS = new Set([
  'token', 'access_token', 'refresh_token', 'id_token', 'auth', 'auth_token', 'authorization', 'jwt',
  'apikey', 'api_key', 'api-key', 'key', 'secret', 'client_secret', 'password', 'passwd', 'pwd',
  'session', 'sessionid', 'sig', 'signature', 'x-amz-signature', 'x-amz-credential', 'x-amz-security-token',
  'x-goog-signature', 'x-goog-credential', 'googleaccessid', 'key-pair-id',
]);
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const URL_SHAPE = /(?:https?:)?\/\/[^\s"'<>()]+/gi;
const SIGNED_PATH = /\/storage\/v1\/object\/sign\//i;

const decodeAmp = (s: string) => s.replace(/&amp;|&#0*38;|&#x0*26;/gi, '&');

const hasCredentialKey = (params: URLSearchParams) => [...params.keys()].some((k) => CREDENTIAL_KEYS.has(k.toLowerCase()));

/** True if `text` holds a credential or signed reference this copy refuses to carry. */
export function hasCredentialReference(text: unknown): boolean {
  if (text == null) return false;
  const t = decodeAmp(String(text));
  if (JWT_SHAPE.test(t)) return true;
  for (const m of t.matchAll(URL_SHAPE)) {
    const raw = m[0].startsWith('//') ? `https:${m[0]}` : m[0];
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return true; // a link that cannot be read cannot be shown safe
    }
    if (u.username || u.password) return true;
    if (SIGNED_PATH.test(u.pathname)) return true;
    if (hasCredentialKey(u.searchParams)) return true;
    if (u.hash.length > 1 && hasCredentialKey(new URLSearchParams(u.hash.slice(1)))) return true;
  }
  return false;
}

/** Throws CopyUnsupportedContentError naming every lesson (or section) that carries a credential reference. */
export function assertNoCredentialReferences(sections: OutlineSection[]): void {
  const flagged: string[] = [];
  for (const s of sections) {
    if (hasCredentialReference(s.title)) flagged.push(`section "${String(s.title).slice(0, 80)}"`);
    for (const l of s.lessons) {
      if (hasCredentialReference(l.title) || hasCredentialReference(l.content)) flagged.push(`"${String(l.title).slice(0, 80)}"`);
    }
  }
  if (flagged.length > 0) throw new CopyUnsupportedContentError(flagged);
}

/**
 * The source course's sections and lessons in their saved order, read only if `userId` owns the course now.
 * Lesson text is copied; quiz questions, assignment settings and other per-lesson settings are not (the new
 * lessons start with defaults).
 */
export async function loadCourseOutline(client: Client, courseId: string, userId: string): Promise<OutlineSection[]> {
  await assertCourseOwned(client, courseId, userId);
  const mods = await readAll(
    client.from('modules').select('id, title, position', { count: 'exact' }).eq('course_id', courseId).order('position', { ascending: true }),
    COPY_LIMITS.modules,
    'That course’s sections',
  );
  if (mods.length === 0) throw new CopyReadError('That course has no sections to copy.');
  const items = await readAll(
    client
      .from('content_items')
      .select('id, module_id, title, type, content, position', { count: 'exact' })
      .eq('course_id', courseId)
      .order('position', { ascending: true }),
    COPY_LIMITS.lessons,
    'That course’s lessons',
  );
  const byModule = new Map<string, any[]>();
  for (const it of items) {
    if (!it.module_id) continue;
    const list = byModule.get(it.module_id) ?? [];
    list.push(it);
    byModule.set(it.module_id, list);
  }
  const sections: OutlineSection[] = mods.map((m: any) => ({
    title: m.title || 'Untitled section',
    lessons: (byModule.get(m.id) ?? [])
      .sort((a, z) => (a.position ?? 0) - (z.position ?? 0))
      .map((it) => ({ title: it.title || 'Untitled lesson', type: it.type, content: it.content ?? '' })),
  }));
  assertNoCredentialReferences(sections);
  return sections;
}
