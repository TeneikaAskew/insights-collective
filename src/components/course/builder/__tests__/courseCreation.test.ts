import { describe, it, expect, beforeEach } from 'vitest';
import { createPlan, planFor, runCreationPlan, CreationInputChangedError, CreationConflictError } from '../courseCreation';
import type { NewCourseWizardResult } from '../teachable/NewCourseWizard';
import { createFakeDb, type FakeDb } from './fakeCreationDb';

const input = (over: Partial<NewCourseWizardResult> = {}): NewCourseWizardResult => ({
  title: 'Course A',
  description: 'About A',
  outlineMethod: 'scratch',
  outline: [
    { title: 'S1', lessons: [{ title: 'Intro', type: 'page' }, { title: 'Check', type: 'quiz' }] },
    { title: 'S2', lessons: [{ title: 'Essay', type: 'assignment' }] },
  ],
  ...over,
});

let db: FakeDb;
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const report = { step: () => undefined };
const run = (plan: any, r = input()) => runCreationPlan({ plan, result: r, instructorId: 'u1', client: db.client, report });
const counts = () => Object.fromEntries(Object.entries(db.tables).map(([k, v]) => [k, v.size]));

beforeEach(() => {
  db = createFakeDb();
  n = 0;
});

describe('runCreationPlan', () => {
  it('creates the course, sections, lessons and their assessment rows with planned positions', async () => {
    const plan = createPlan(input(), uuid);
    const id = await run(plan);
    expect(id).toBe(plan.courseId);
    expect(counts()).toMatchObject({ courses: 1, modules: 2, content_items: 3, assignments: 1, quizzes: 1 });
    const items = [...db.tables.content_items.values()];
    expect(items.map((i) => [i.title, i.position])).toEqual([['Intro', 0], ['Check', 1], ['Essay', 0]]);
    const quiz = [...db.tables.quizzes.values()][0];
    expect(db.tables.content_items.get(quiz.content_item_id).type).toBe('quiz');
  });

  it('C1 a failure mid-curriculum, then a retry with the same plan: one course, nothing duplicated', async () => {
    const plan = createPlan(input(), uuid);
    db.faults.set('content_items#2', 'fail');
    await expect(run(plan)).rejects.toThrow('content_items insert failed');
    expect(counts()).toMatchObject({ courses: 1, modules: 1, content_items: 1 });
    await run(plan);
    expect(counts()).toMatchObject({ courses: 1, modules: 2, content_items: 3, assignments: 1, quizzes: 1 });
  });

  it('C2 an insert that committed but lost its response is found on retry, not duplicated', async () => {
    const plan = createPlan(input(), uuid);
    db.faults.set('courses#1', 'commit-then-lose-response');
    await expect(run(plan)).rejects.toThrow('Failed to fetch');
    db.faults.set('modules#1', 'commit-then-lose-response');
    await expect(run(plan)).rejects.toThrow('Failed to fetch');
    await run(plan);
    expect(counts()).toMatchObject({ courses: 1, modules: 2, content_items: 3, assignments: 1, quizzes: 1 });
  });

  it('C3 the assessment child failing leaves the parent; the retry adds exactly the child', async () => {
    const plan = createPlan(input(), uuid);
    db.faults.set('quizzes#1', 'fail');
    await expect(run(plan)).rejects.toThrow('quizzes insert failed');
    expect(counts()).toMatchObject({ content_items: 2, quizzes: 0 });
    await run(plan);
    expect(counts()).toMatchObject({ content_items: 3, quizzes: 1, assignments: 1 });
  });

  it('C4 a planned id held by a row this plan did not make is a conflict, never adopted', async () => {
    const plan = createPlan(input(), uuid);
    db.tables.courses.set(plan.courseId, { id: plan.courseId, instructor_id: 'someone-else' });
    await expect(run(plan)).rejects.toBeInstanceOf(CreationConflictError);
    expect(counts()).toMatchObject({ modules: 0 });
  });

  it('C5 the thumbnail goes to one fixed path per plan, so a retry overwrites instead of adding a file', async () => {
    const file = new File(['x'], 'cover.png', { type: 'image/png' });
    const r = input({ thumbnailFile: file });
    const plan = createPlan(r, uuid);
    db.faults.set('courses#1', 'fail');
    await expect(run(plan, r)).rejects.toThrow();
    await run(plan, r);
    expect(db.uploads).toHaveLength(1);
    expect([...db.tables.courses.values()][0].thumbnail).toBe(`https://storage.test/${db.uploads[0]}`);
  });
});

describe('planFor', () => {
  it('reuses the plan for the same input, and replaces an unstarted plan for new input', () => {
    const p = createPlan(input(), uuid);
    expect(planFor(p, input())).toBe(p);
    expect(planFor(p, input({ title: 'Other' }), uuid)).not.toBe(p);
  });

  it('refuses different input once writes were attempted', async () => {
    const p = createPlan(input(), uuid);
    db.faults.set('modules#1', 'fail');
    await expect(run(p)).rejects.toThrow();
    expect(() => planFor(p, input({ title: 'Other' }))).toThrow(CreationInputChangedError);
  });
});
