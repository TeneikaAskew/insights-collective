// ABOUTME: Resumable course creation for the new-course wizard (T-56). Every row gets a client-chosen id
// ABOUTME: up front, so a retry re-sends the same ids and finishes the same course instead of starting a new one.
//
// There is no server transaction here (that would be an RPC, owned elsewhere). Instead each insert is
// idempotent: it carries a planned primary key, and a unique violation on retry is resolved by reading the
// row back and checking it is the one this plan meant (same course / module / parent item). An insert whose
// response was lost but which committed is therefore found, not duplicated. The plan is reused only for the
// same wizard input; once a write has been attempted, different input is refused rather than half-applied.

import type { NewCourseWizardResult, OutlineLesson } from '@/components/course/builder/teachable/NewCourseWizard';

export interface PlannedLesson {
  id: string;
  title: string;
  type: OutlineLesson['type'];
  position: number;
  /** Starting lesson text (copied lessons carry their source text). */
  content: string;
  /** Planned id of the assignment or quiz row for an assessment lesson. */
  childId: string | null;
}
export interface PlannedSection {
  id: string;
  title: string;
  position: number;
  lessons: PlannedLesson[];
}
export interface CreationPlan {
  /** The signed-in user who started this creation. Only that user may run or resume it. */
  ownerId: string | null;
  fingerprint: string;
  courseId: string;
  thumbnailNonce: string;
  sections: PlannedSection[];
  /** True once any write (upload or insert) has been sent. */
  started: boolean;
  /** Keys of rows confirmed present: 'course', 'module:<id>', 'item:<id>', 'child:<id>'. */
  confirmed: Set<string>;
  /** Thumbnail outcome, once settled (upload succeeded or failed non-fatally). */
  thumbnail: { settled: boolean; url: string | null };
}

export class CreationInputChangedError extends Error {
  constructor(readonly courseId: string) {
    super(
      'This course was already partly created from the earlier details. Retry without changes to finish it, ' +
        'then edit it in the builder; or reload the page to start a separate new course.',
    );
    this.name = 'CreationInputChangedError';
  }
}

export class CreationOwnerMismatchError extends Error {
  constructor() {
    super(
      'This course creation was started by a different account (or you are signed out). Sign in as that account ' +
        'to finish it, or reload the page to start a new course as yourself.',
    );
    this.name = 'CreationOwnerMismatchError';
  }
}

export class CreationConflictError extends Error {
  constructor(readonly table: string, readonly id: string) {
    super(`A ${table} record with the planned id already exists but is not the one this course creation made.`);
    this.name = 'CreationConflictError';
  }
}

const isAssessment = (t: OutlineLesson['type']) => t === 'assignment' || t === 'quiz';

export function fingerprintOf(r: NewCourseWizardResult): string {
  const f = r.thumbnailFile;
  return JSON.stringify({
    t: r.title,
    d: r.description || '',
    o: (r.outline ?? []).map((s) => [s.title, s.lessons.map((l) => [l.title, l.type, l.content ?? ''])]),
    f: f ? [f.name, f.size, f.type, f.lastModified] : null,
  });
}

export function createPlan(
  r: NewCourseWizardResult,
  uuid: () => string = () => crypto.randomUUID(),
  ownerId: string | null = null,
): CreationPlan {
  return {
    ownerId,
    fingerprint: fingerprintOf(r),
    courseId: uuid(),
    thumbnailNonce: uuid(),
    sections: (r.outline ?? []).map((s, si) => ({
      id: uuid(),
      title: s.title,
      position: si,
      lessons: s.lessons.map((l, li) => ({
        id: uuid(),
        title: l.title,
        type: l.type,
        position: li,
        content: l.content ?? '',
        childId: isAssessment(l.type) ? uuid() : null,
      })),
    })),
    started: false,
    confirmed: new Set(),
    thumbnail: { settled: false, url: null },
  };
}

/**
 * Returns the plan to run for this wizard input and signed-in user: the existing one if it is the same
 * user's plan for the same input; a fresh one if nothing was written yet. Throws, before any write, if the
 * user is signed out, or writes already happened under another user or for different input.
 */
export function planFor(
  existing: CreationPlan | null,
  r: NewCourseWizardResult,
  userId: string | null,
  uuid?: () => string,
): CreationPlan {
  if (!userId) throw new CreationOwnerMismatchError();
  if (existing && existing.started) {
    if (existing.ownerId !== userId) throw new CreationOwnerMismatchError();
    if (existing.fingerprint !== fingerprintOf(r)) throw new CreationInputChangedError(existing.courseId);
    return existing;
  }
  if (existing && existing.ownerId === userId && existing.fingerprint === fingerprintOf(r)) return existing;
  return createPlan(r, uuid, userId);
}

type Client = { from: (table: string) => any; storage: { from: (bucket: string) => any } };

/**
 * Insert `row` (which carries its planned id) unless it is already there. On a unique violation, read it
 * back by id; if it is not visible by id, an assessment child may be found by its parent item. The row is
 * accepted only if `owns(row)` holds.
 */
async function ensureRow(
  client: Client,
  table: string,
  row: Record<string, any>,
  owns: (stored: any) => boolean,
  naturalKey?: [string, any],
): Promise<void> {
  const { error } = await client.from(table).insert(row).select('id').single();
  if (!error) return;
  if (error.code !== '23505') throw error;
  const byId = await client.from(table).select('*').eq('id', row.id).maybeSingle();
  if (byId.error) throw byId.error;
  let stored = byId.data;
  if (!stored && naturalKey) {
    const byKey = await client.from(table).select('*').eq(naturalKey[0], naturalKey[1]).maybeSingle();
    if (byKey.error) throw byKey.error;
    stored = byKey.data;
  }
  if (!stored || !owns(stored)) throw new CreationConflictError(table, row.id);
}

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';
export interface CreationReporter {
  step: (id: 'thumbnail' | 'course' | 'curriculum', status: StepStatus, detail?: string) => void;
}

export interface CreationInput {
  plan: CreationPlan;
  result: NewCourseWizardResult;
  instructorId: string | null;
  client: Client;
  report: CreationReporter;
  onThumbnailError?: (err: any) => void;
}

/** Runs (or resumes) the plan. Resolves with the course id once every planned row is confirmed. */
export async function runCreationPlan({ plan, result: r, instructorId, client, report, onThumbnailError }: CreationInput): Promise<string> {
  const { confirmed } = plan;
  // The plan belongs to the user who started it; nobody else may resume it (checked before any write).
  if (!instructorId || plan.ownerId !== instructorId) throw new CreationOwnerMismatchError();

  // 1) Thumbnail: a fixed object path per plan, so a retry overwrites rather than adds a file.
  if (r.thumbnailFile && !plan.thumbnail.settled) {
    report.step('thumbnail', 'running');
    const ext = r.thumbnailFile.name.split('.').pop() || 'jpg';
    const path = `course-thumbnails/${instructorId}-${plan.thumbnailNonce}.${ext}`;
    plan.started = true;
    const { error: uploadError } = await client.storage
      .from('course-materials')
      .upload(path, r.thumbnailFile, { upsert: true, contentType: r.thumbnailFile.type });
    if (uploadError) {
      onThumbnailError?.(uploadError);
      plan.thumbnail = { settled: true, url: null };
      report.step(
        'thumbnail',
        'error',
        `${uploadError.message || 'Upload failed'}. Continuing without a thumbnail; you can add one later in Setup.`,
      );
    } else {
      const { data: pub } = client.storage.from('course-materials').getPublicUrl(path);
      plan.thumbnail = { settled: true, url: pub.publicUrl };
      report.step('thumbnail', 'done');
    }
  } else if (plan.thumbnail.settled && r.thumbnailFile) {
    report.step('thumbnail', plan.thumbnail.url ? 'done' : 'error');
  }

  // 2) Course
  report.step('course', 'running');
  if (!confirmed.has('course')) {
    plan.started = true;
    const thumbnailUrl = plan.thumbnail.url;
    try {
      await ensureRow(
        client,
        'courses',
        {
          id: plan.courseId,
          title: r.title,
          description: r.description || '',
          category: 'General',
          level: 'beginner',
          published: false,
          status: 'draft',
          instructor_id: instructorId,
          ...(thumbnailUrl ? { image_url: thumbnailUrl, thumbnail: thumbnailUrl } : {}),
        },
        (c) => c.instructor_id === instructorId,
      );
    } catch (err: any) {
      report.step('course', 'error', err?.message);
      throw err;
    }
    confirmed.add('course');
  }
  report.step('course', 'done');

  // 3) Curriculum. Each lesson is complete only with its assessment row, so a lesson whose child failed
  // is finished on the next attempt instead of being left as a quiz/assignment with nothing behind it.
  const total = plan.sections.reduce((n, s) => n + s.lessons.length, 0);
  if (plan.sections.length === 0) return plan.courseId;
  const countDone = () =>
    plan.sections.reduce(
      (n, s) =>
        n + s.lessons.filter((l) => confirmed.has(`item:${l.id}`) && (!l.childId || confirmed.has(`child:${l.childId}`))).length,
      0,
    );
  report.step('curriculum', 'running', `${countDone()} of ${total} lessons`);
  try {
    for (const s of plan.sections) {
      if (!confirmed.has(`module:${s.id}`)) {
        await ensureRow(
          client,
          'modules',
          { id: s.id, course_id: plan.courseId, title: s.title, position: s.position, published: true },
          (m) => m.course_id === plan.courseId,
        );
        confirmed.add(`module:${s.id}`);
      }
      for (const l of s.lessons) {
        if (!confirmed.has(`item:${l.id}`)) {
          await ensureRow(
            client,
            'content_items',
            {
              id: l.id,
              course_id: plan.courseId,
              module_id: s.id,
              type: l.type,
              title: l.title,
              content: l.content,
              position: l.position,
              settings: {},
              published: false,
            },
            (i) => i.module_id === s.id,
          );
          confirmed.add(`item:${l.id}`);
        }
        if (l.childId && !confirmed.has(`child:${l.childId}`)) {
          if (l.type === 'assignment') {
            await ensureRow(
              client,
              'assignments',
              {
                id: l.childId,
                content_item_id: l.id,
                course_id: plan.courseId,
                module_id: s.id,
                title: l.title,
                description: '',
                points: 100,
                due_date: null,
                submission_types: ['online_text_entry'],
                max_attempts: 1,
                grading_type: 'points',
                is_published: false,
              },
              (a) => a.content_item_id === l.id,
              ['content_item_id', l.id],
            );
          } else {
            await ensureRow(
              client,
              'quizzes',
              {
                id: l.childId,
                content_item_id: l.id,
                module_id: s.id,
                title: l.title,
                description: '',
                quiz_type: 'assignment',
                time_limit: null,
              },
              (q) => q.content_item_id === l.id,
              ['content_item_id', l.id],
            );
          }
          confirmed.add(`child:${l.childId}`);
        }
        report.step('curriculum', 'running', `${countDone()} of ${total} lessons`);
      }
    }
  } catch (err: any) {
    report.step('curriculum', 'error', `${err?.message ?? 'Failed'} (${countDone()} of ${total} lessons created; retry continues from here)`);
    throw err;
  }
  report.step('curriculum', 'done', `${total} lesson${total === 1 ? '' : 's'} created`);
  return plan.courseId;
}
