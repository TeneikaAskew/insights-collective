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
      `Not copied: ${lessons.join('; ')} contain a link with a sign-in key, password or signed access token, or a ` +
        'link written in a form that cannot be checked. Replace those links in the source course with ordinary links, then copy again.',
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
// (page, anchor, video start time, public storage object, relative course link) is copied unchanged.
const CREDENTIAL_KEYS = new Set([
  'token', 'access_token', 'refresh_token', 'id_token', 'auth', 'auth_token', 'authorization', 'jwt',
  'apikey', 'api_key', 'api-key', 'key', 'secret', 'client_secret', 'password', 'passwd', 'pwd',
  'session', 'sessionid', 'sig', 'signature', 'x-amz-signature', 'x-amz-credential', 'x-amz-security-token',
  'x-goog-signature', 'x-goog-credential', 'googleaccessid', 'key-pair-id',
]);
const JWT_SHAPE = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const URL_SHAPE = /(?:https?:)?\/\/[^\s"'<>()]+/gi;
// Absolute or relative: a Supabase signed object path, a credential key in any query or fragment, or a
// user part before a host (`//user@host`, `//user:pass@host`).
const SIGNED_PATH = /\/storage\/v1\/object\/sign\//i;
const PARAM = /[?&#]\s*([A-Za-z0-9_.-]+)\s*=/g;
const USERINFO = /\/\/[^\s/?#@"'<>]+@/;

// Entities that may spell a reference (decoded before scanning), and common typographic ones (harmless).
// Any other named entity is an unsupported form and refuses the copy rather than being guessed at.
const NAMED: Record<string, string> = {
  amp: '&', sol: '/', colon: ':', quest: '?', equals: '=', num: '#', period: '.', commat: '@', percnt: '%',
  lt: '<', gt: '>', quot: '"', apos: "'", lowbar: '_', hyphen: '-', dash: '-', bsol: '\\',
};
const TYPOGRAPHIC = new Set([
  'nbsp', 'ensp', 'emsp', 'thinsp', 'shy', 'zwj', 'zwnj', 'ndash', 'mdash', 'lsquo', 'rsquo', 'sbquo', 'ldquo',
  'rdquo', 'bdquo', 'laquo', 'raquo', 'hellip', 'middot', 'bull', 'copy', 'reg', 'trade', 'deg', 'times',
  'divide', 'plusmn', 'euro', 'pound', 'cent', 'yen', 'sect', 'para', 'frac12', 'frac14', 'frac34', 'prime',
]);

class Unsupported extends Error {}

function decodeEntitiesOnce(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+);?|&([A-Za-z][A-Za-z0-9]*);/g, (_m, num: string, name: string) => {
    if (num) {
      const code = num[1] === 'x' || num[1] === 'X' ? parseInt(num.slice(2), 16) : parseInt(num.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) throw new Unsupported();
      return String.fromCodePoint(code);
    }
    const key = name.toLowerCase();
    if (key in NAMED) return NAMED[key];
    if (TYPOGRAPHIC.has(key)) return ' ';
    throw new Unsupported();
  });
}

/** Entity-decoded until stable (nested encodings included); more than a few rounds is unsupported. */
function normalized(text: string): string {
  let t = text;
  for (let i = 0; i < 4; i++) {
    const next = decodeEntitiesOnce(t);
    if (next === t) return t;
    t = next;
  }
  throw new Unsupported();
}

/** Percent-escapes decoded where they form valid UTF-8; anything else is left as written. */
const percentDecoded = (t: string) =>
  t.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run;
    }
  });

/** A C0 control other than tab, LF and CR, or DEL. */
function hasAmbiguousControl(t: string): boolean {
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) return true;
  }
  return false;
}

function scan(t: string): boolean {
  if (JWT_SHAPE.test(t) || SIGNED_PATH.test(t) || USERINFO.test(t)) return true;
  for (const m of t.matchAll(PARAM)) if (CREDENTIAL_KEYS.has(m[1].toLowerCase())) return true;
  for (const m of t.matchAll(URL_SHAPE)) {
    try {
      new URL(m[0].startsWith('//') ? `https:${m[0]}` : m[0]);
    } catch {
      return true; // a link that cannot be read cannot be shown safe
    }
  }
  return false;
}

/**
 * True if `text` holds a credential or signed reference this copy refuses to carry, in any supported spelling
 * (absolute, protocol-relative or relative; HTML entities, nested entities or percent-escapes), or a form it
 * cannot normalise. It only reads the text; nothing is rewritten.
 */
export function hasCredentialReference(text: unknown): boolean {
  if (text == null) return false;
  let t: string;
  try {
    t = normalized(String(text));
  } catch {
    return true;
  }
  // Any other C0 control or DEL after decoding is ambiguous in a reference: refused.
  if (hasAmbiguousControl(t)) return true;
  const forms = [t, percentDecoded(t)];
  // As URL parsing reads them: tab, LF and CR removed (so `to&#9;ken` is `token`) and, for the special
  // schemes, a backslash read as a slash (so `https:\\user:pw@host` carries credentials). Scanned in addition to
  // the text as written, never instead of it.
  for (const f of [...forms]) forms.push(f.replace(/[\t\n\r]/g, '').replace(/\\/g, '/'));
  return forms.some(scan);
}

/** Throws CopyUnsupportedContentError naming each flagged section or lesson by position only (never its text). */
export function assertNoCredentialReferences(sections: OutlineSection[]): void {
  const flagged: string[] = [];
  sections.forEach((s, si) => {
    if (hasCredentialReference(s.title)) flagged.push(`section ${si + 1}`);
    s.lessons.forEach((l, li) => {
      if (hasCredentialReference(l.title) || hasCredentialReference(l.content)) flagged.push(`section ${si + 1}, lesson ${li + 1}`);
    });
  });
  if (flagged.length > 0) throw new CopyUnsupportedContentError(flagged);
}

/** The copy a wizard result claims to carry, as the builder page receives it. */
export interface CopyHandoff {
  courseId: string;
  actorId: string;
}

/**
 * The builder page's check before any upload or insert for a copied course: the account signed in now is the
 * one that adopted the copy, it still owns the source, the outline carries no credential reference, and the
 * account is unchanged after those awaited reads. Any failure throws and nothing is written.
 */
export async function assertCopyHandoff(
  client: Client,
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> },
  copy: CopyHandoff | undefined,
  outline: OutlineSection[],
  actorId: string | null,
): Promise<void> {
  if (!copy || !copy.courseId || !actorId || copy.actorId !== actorId) {
    throw new CopyReadError('The copied outline was loaded for a different account. Go back and choose the course again.');
  }
  await assertCourseOwned(client, copy.courseId, actorId);
  assertNoCredentialReferences(outline);
  const { data } = await auth.getUser();
  if (data.user?.id !== actorId) {
    throw new CopyReadError('You are signed in as a different account now. Go back and choose the course again.');
  }
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
