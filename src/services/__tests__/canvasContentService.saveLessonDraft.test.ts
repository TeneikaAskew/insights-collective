// ABOUTME: Tests for the authoring-only lesson writers of CanvasContentService: exact columns, null-safe
// ABOUTME: conditional writes, refusal of unversioned writes, and honest zero-row diagnosis.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CanvasContentService,
  LessonSaveConflictError,
  LessonSaveRejectedError,
} from '../canvasContentService';
import { mockSupabaseClient } from '@/test/mocks/supabase';

type Result = { data: any; error: any };

function chain(result: Result) {
  const calls: Array<[string, any[]]> = [];
  const b: any = {};
  for (const m of ['update', 'select', 'eq', 'is']) {
    b[m] = vi.fn((...args: any[]) => {
      calls.push([m, args]);
      return b;
    });
  }
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.single = vi.fn(() => Promise.resolve(result));
  return { b, calls };
}

function wire(...results: Result[]) {
  const chains = results.map(chain);
  let i = 0;
  (mockSupabaseClient.from as any).mockImplementation(() => chains[i++].b);
  return chains;
}

const COLUMNS = 'id, title, content, type, published, updated_at';
const stored = {
  id: 'A',
  title: 'T',
  content: 'C',
  type: 'quiz',
  published: true,
  updated_at: '2026-11-01T10:00:02.000000+00:00',
};
const filters = (calls: Array<[string, any[]]>) =>
  calls.filter(([m]) => m === 'eq' || m === 'is').map(([m, a]) => [m, ...a]);

describe('CanvasContentService.saveLessonDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes only title, content and the timestamp, conditional on updated_at, and returns the stored row', async () => {
    const [w] = wire({ data: stored, error: null });
    const out = await CanvasContentService.saveLessonDraft(
      'A',
      { title: 'T', content: 'C' },
      '2026-11-01T10:00:01.000000+00:00',
    );
    expect(out).toEqual(stored);
    const update = w.calls.find(([m]) => m === 'update')![1][0];
    expect(Object.keys(update).sort()).toEqual(['content', 'title', 'updated_at']);
    expect(update).not.toHaveProperty('type');
    expect(update).not.toHaveProperty('published');
    expect(update).not.toHaveProperty('settings');
    expect(filters(w.calls)).toEqual([
      ['eq', 'id', 'A'],
      ['eq', 'updated_at', '2026-11-01T10:00:01.000000+00:00'],
    ]);
    expect(w.calls.find(([m]) => m === 'select')![1][0]).toBe(COLUMNS);
  });

  // Replaces the 40a1f62 case "omits the updated_at condition when no base is known", which accepted an
  // unconditional write for a NULL baseline. A NULL updated_at is a known value: match it null-safely.
  it('a known NULL baseline is matched with IS NULL, never dropped', async () => {
    const [w] = wire({ data: stored, error: null });
    await CanvasContentService.saveLessonDraft('A', { title: 'T', content: 'C' }, null);
    expect(filters(w.calls)).toEqual([
      ['eq', 'id', 'A'],
      ['is', 'updated_at', null],
    ]);
  });

  it('refuses an unavailable (undefined) version without touching the database', async () => {
    const err = await CanvasContentService.saveLessonDraft('A', { title: 'T', content: 'C' }, undefined).catch((e) => e);
    expect(err).toBeInstanceOf(LessonSaveRejectedError);
    expect(err.name).toBe('LessonSaveRejectedError');
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('throws the database error as-is (its code marks it definitive for the queue)', async () => {
    wire({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } });
    await expect(
      CanvasContentService.saveLessonDraft('A', { title: 'T', content: 'C' }, 'x'),
    ).rejects.toMatchObject({ message: 'new row violates row-level security policy', code: '42501' });
  });

  it('zero rows and no readable row: rejected, deleted or no access', async () => {
    wire({ data: null, error: null }, { data: null, error: null });
    const err = await CanvasContentService.saveLessonDraft('A', { title: 'T', content: 'C' }, 'x').catch((e) => e);
    expect(err).toBeInstanceOf(LessonSaveRejectedError);
    expect(err.message).toMatch(/no longer exists or you no longer have access/);
  });

  it('zero rows and a different version: conflict carrying the current row', async () => {
    wire({ data: null, error: null }, { data: stored, error: null });
    const err = await CanvasContentService.saveLessonDraft(
      'A',
      { title: 'Mine', content: '' },
      '2026-11-01T10:00:01.000000+00:00',
    ).catch((e) => e);
    expect(err).toBeInstanceOf(LessonSaveConflictError);
    expect(err.name).toBe('LessonSaveConflictError');
    expect(err.current).toEqual(stored);
  });

  it('zero rows on a NULL baseline when the row now has a version: conflict', async () => {
    wire({ data: null, error: null }, { data: stored, error: null });
    const err = await CanvasContentService.saveLessonDraft('A', { title: 'Mine', content: '' }, null).catch((e) => e);
    expect(err).toBeInstanceOf(LessonSaveConflictError);
  });

  it('zero rows with an unchanged readable row: rejected, not applied (likely permission)', async () => {
    wire({ data: null, error: null }, { data: stored, error: null });
    const err = await CanvasContentService.saveLessonDraft('A', { title: 'T', content: 'C' }, stored.updated_at).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(LessonSaveRejectedError);
    expect(err.message).toMatch(/changed no rows/);
  });

  it('throws when the diagnostic read itself fails', async () => {
    wire({ data: null, error: null }, { data: null, error: { message: 'timeout' } });
    await expect(
      CanvasContentService.saveLessonDraft('A', { title: 'T', content: 'C' }, 'x'),
    ).rejects.toMatchObject({ message: 'timeout' });
  });
});

describe('CanvasContentService.setLessonPublished', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes only published and the timestamp, conditional on the confirmed version', async () => {
    const [w] = wire({ data: { ...stored, published: false }, error: null });
    const out = await CanvasContentService.setLessonPublished('A', false, stored.updated_at);
    expect(out.published).toBe(false);
    const update = w.calls.find(([m]) => m === 'update')![1][0];
    expect(Object.keys(update).sort()).toEqual(['published', 'updated_at']);
    expect(filters(w.calls)).toEqual([
      ['eq', 'id', 'A'],
      ['eq', 'updated_at', stored.updated_at],
    ]);
  });

  it('refuses an unavailable version and reports a conflict on a moved version', async () => {
    await expect(CanvasContentService.setLessonPublished('A', true, undefined)).rejects.toBeInstanceOf(
      LessonSaveRejectedError,
    );
    wire({ data: null, error: null }, { data: stored, error: null });
    await expect(CanvasContentService.setLessonPublished('A', true, 'older')).rejects.toBeInstanceOf(
      LessonSaveConflictError,
    );
  });
});

describe('CanvasContentService.getLessonDraftRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the exact draft columns for one id and returns null when not readable', async () => {
    const [r] = wire({ data: stored, error: null });
    await expect(CanvasContentService.getLessonDraftRow('A')).resolves.toEqual(stored);
    expect(r.calls).toEqual([
      ['select', [COLUMNS]],
      ['eq', ['id', 'A']],
    ]);
    wire({ data: null, error: null });
    await expect(CanvasContentService.getLessonDraftRow('A')).resolves.toBeNull();
  });

  it('throws a read error instead of reporting the lesson missing', async () => {
    wire({ data: null, error: { message: 'timeout' } });
    await expect(CanvasContentService.getLessonDraftRow('A')).rejects.toMatchObject({ message: 'timeout' });
  });
});
