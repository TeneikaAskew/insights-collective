// ABOUTME: Unit tests for Canvas Content Service
// ABOUTME: Tests CRUD operations for content items, assignments, quizzes, and progress tracking

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasContentService, DeleteNotAppliedError } from '../canvasContentService';
import { mockSupabaseClient, supabaseError, getQueryBuilder } from '@/test/mocks/supabase';
import DB_FUNCTIONS from '@/test/fixtures/db-functions.json';

describe('CanvasContentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Content Items', () => {
    it('should get content items for a module', async () => {
      const mockItems = [
        { id: '1', title: 'Lesson 1', type: 'page', module_id: 'mod-1' },
        { id: '2', title: 'Assignment 1', type: 'assignment', module_id: 'mod-1' }
      ];

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockItems,
        error: null
      });

      const result = await CanvasContentService.getContentItems('mod-1');

      expect(result).toEqual(mockItems);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('content_items');
    });

    it('should get a single content item with relations', async () => {
      const mockItem = {
        id: '1',
        title: 'Test Assignment',
        type: 'assignment',
        assignment: { id: 'a1', points_possible: 100 }
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockItem,
        error: null
      });

      const result = await CanvasContentService.getContentItem('1');

      expect(result).toEqual(mockItem);
    });

    it('should create a content item with correct position', async () => {
      mockSupabaseClient.from().select().eq().order().limit.mockResolvedValue({
        data: [{ position: 2 }],
        error: null
      });

      const newItem = { id: 'new-1', position: 3 };
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: newItem,
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: newItem,
        error: null
      });

      const result = await CanvasContentService.createContentItem({
        course_id: 'c1',
        module_id: 'm1',
        type: 'page',
        title: 'New Page',
        content: 'Content here'
      });

      expect(result.position).toBe(3);
    });

    it('should create assignment with content item', async () => {
      mockSupabaseClient.from().select().eq().order().limit.mockResolvedValue({
        data: [],
        error: null
      });

      const contentItem = { id: 'ci-1', type: 'assignment', settings: {} };
      mockSupabaseClient.from().insert().select().single
        .mockResolvedValueOnce({ data: contentItem, error: null })
        .mockResolvedValueOnce({ 
          data: { id: 'a1', points_possible: 100 }, 
          error: null 
        });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { ...contentItem, assignment: { id: 'a1' } },
        error: null
      });

      const result = await CanvasContentService.createContentItem({
        course_id: 'c1',
        module_id: 'm1',
        type: 'assignment',
        title: 'Test Assignment',
        content: 'Do this',
        settings: {
          assignment: {
            points_possible: 100,
            due_at: '2025-12-31'
          }
        }
      });

      expect(result.assignment).toBeDefined();
    });

    it('should update a content item', async () => {
      const updated = { id: '1', title: 'Updated Title' };
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null
      });

      const result = await CanvasContentService.updateContentItem('1', {
        title: 'Updated Title'
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should delete a content item, asking for the deleted id back', async () => {
      mockSupabaseClient.from().delete().eq().select.mockResolvedValue({
        data: [{ id: '1' }],
        error: null
      });

      await expect(
        CanvasContentService.deleteContentItem('1')
      ).resolves.toBeUndefined();
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('id');
    });

    it('rejects a content item delete that removed no row (RLS-hidden or already gone)', async () => {
      mockSupabaseClient.from().delete().eq().select.mockResolvedValue({ data: [], error: null });

      await expect(CanvasContentService.deleteContentItem('1')).rejects.toBeInstanceOf(DeleteNotAppliedError);
    });

    it('rejects a module delete that removed no row', async () => {
      mockSupabaseClient.from().delete().eq().select.mockResolvedValue({ data: [], error: null });

      await expect(CanvasContentService.deleteModule('m1')).rejects.toMatchObject({
        code: 'DELETE_NOT_APPLIED',
        kind: 'section',
      });
    });

    // Reorder contract (unit-contract proof only; the RPC's own transaction and constraint handling are not exercised).
    // The old test stubbed an `upsert` the implementation never calls, and the shared mock's default rpc returns success
    // for any known name, so it passed for a no-op or a wrong payload. Each test here installs its own rpc, records
    // every call, and asserts the exact name, module, ordered ids and call count, with no table access at all.
    describe('reorderContentItems contract', () => {
      const rpc = mockSupabaseClient.rpc as ReturnType<typeof vi.fn>;
      const from = mockSupabaseClient.from as ReturnType<typeof vi.fn>;
      const ORDER = ['i3', 'i1', 'i2']; // deliberately not sorted, so a sorted or reversed payload is caught
      const strict = (result: () => Promise<unknown>) => {
        rpc.mockReset();
        rpc.mockImplementation(async (..._args: unknown[]) => result());
        // Any table access is forbidden for a reorder: fail at once with a named diagnostic, never wait on a default builder.
        from.mockReset();
        from.mockImplementation((table: string) => {
          throw new Error(`forbidden table access in reorderContentItems: from('${table}')`);
        });
      };

      it('names a function that exists in the database fixture', () => {
        expect(DB_FUNCTIONS as string[]).toContain('reorder_content_items');
      });

      it('makes exactly one reorder_content_items call with the module and the ids in order, and no table access', async () => {
        strict(async () => ({ data: null, error: null }));
        await expect(CanvasContentService.reorderContentItems('m1', ORDER)).resolves.toBeUndefined();
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc.mock.calls[0]).toEqual(['reorder_content_items', { p_module_id: 'm1', p_item_ids: ['i3', 'i1', 'i2'] }]);
        expect(from).not.toHaveBeenCalled(); // no upsert, no per-row PATCH
      });

      it('rejects with the RPC error itself when the database reports one', async () => {
        const dbError = { message: 'duplicate key value violates unique constraint', code: '23505', details: null, hint: null };
        strict(async () => ({ data: null, error: dbError }));
        await expect(CanvasContentService.reorderContentItems('m1', ORDER)).rejects.toBe(dbError);
        expect(rpc).toHaveBeenCalledTimes(1);
      });

      it('rejects with the transport failure when the request itself throws', async () => {
        const transport = new TypeError('Failed to fetch');
        strict(async () => { throw transport; });
        await expect(CanvasContentService.reorderContentItems('m1', ORDER)).rejects.toBe(transport);
        expect(rpc).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Assignments', () => {
    it('should get assignment by content item id', async () => {
      const assignment = { id: 'a1', points_possible: 100 };
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: assignment,
        error: null
      });

      const result = await CanvasContentService.getAssignment('ci-1');

      expect(result).toEqual(assignment);
    });

    it('should handle missing assignment gracefully', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await CanvasContentService.getAssignment('ci-1');

      expect(result).toBeNull();
    });

    it('should update assignment', async () => {
      const updated = { id: 'a1', points_possible: 150 };
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null
      });

      const result = await CanvasContentService.updateAssignment('ci-1', {
        points_possible: 150
      });

      expect(result.points_possible).toBe(150);
    });

    it('should submit assignment with correct attempt number', async () => {
      mockSupabaseClient.from().select().eq().eq().order().limit.mockResolvedValue({
        data: [{ attempt: 1 }],
        error: null
      });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null
      });

      const submission = { id: 's1', attempt: 2 };
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: submission,
        error: null
      });

      const result = await CanvasContentService.submitAssignment('a1', {
        submission_type: 'online_text_entry',
        body: 'My submission'
      });

      expect(result.attempt).toBe(2);
    });
  });

  describe('Quizzes', () => {
    // Questions come from get_quiz_questions_for_taking, which strips the
    // `correct` flag server-side — the quizzes row itself carries no answer
    // key any more.
    it('should get quiz with questions from the sanitized RPC', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { id: 'q1' },
        error: null
      });
      (mockSupabaseClient.rpc as any).mockResolvedValue({
        data: [{ id: 'qq1', question_text: 'What is 2+2?', answers: [{ id: 'a1', text: 'Four' }] }],
        error: null
      });

      const result = await CanvasContentService.getQuiz('ci-1');

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_quiz_questions_for_taking',
        { p_quiz_id: 'q1' }
      );
      expect(result?.questions).toHaveLength(1);
      // The option is present for rendering, with no correctness marker.
      expect(result?.questions?.[0].answers?.[0]).not.toHaveProperty('correct');
    });

    it('should update quiz', async () => {
      const updated = { id: 'q1', time_limit: 60 };
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null
      });

      const result = await CanvasContentService.updateQuiz('ci-1', {
        time_limit: 60
      });

      expect(result.time_limit).toBe(60);
    });

    it('should add quiz question with correct position', async () => {
      mockSupabaseClient.from().select().eq().order().limit.mockResolvedValue({
        data: [{ position: 1 }],
        error: null
      });

      const question = { id: 'qq2', position: 2 };
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: question,
        error: null
      });

      const result = await CanvasContentService.addQuizQuestion('q1', {
        question_type: 'multiple_choice',
        question_text: 'New question?',
        points: 10,
        answers: [],
        position: 0,
        correct_comments: '',
        incorrect_comments: '',
        neutral_comments: ''
      });

      expect(result.position).toBe(2);
    });
  });

  describe('Progress Tracking', () => {
    it('should mark content item as read', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null
      });

      mockSupabaseClient.from().upsert.mockResolvedValue({
        error: null
      });

      await expect(
        CanvasContentService.markContentItemAsRead('ci-1')
      ).resolves.not.toThrow();
    });

    it('should mark content item as completed', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null
      });

      mockSupabaseClient.from().upsert.mockResolvedValue({
        error: null
      });

      await expect(
        CanvasContentService.markContentItemAsCompleted('ci-1')
      ).resolves.not.toThrow();
    });

    it('should throw error if user not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      await expect(
        CanvasContentService.markContentItemAsRead('ci-1')
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('Publishing', () => {
    it('should publish content item', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue({
        error: null
      });

      await expect(
        CanvasContentService.publishContentItem('ci-1')
      ).resolves.not.toThrow();
    });

    it('should unpublish content item', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue({
        error: null
      });

      await expect(
        CanvasContentService.unpublishContentItem('ci-1')
      ).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('getContentItems rejects when the query fails', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.getContentItems('mod-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('getContentItem rejects when the query fails', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.getContentItem('ci-1')
      ).rejects.toThrow('Failed to load content item: db down');
    });

    it('createContentItem rejects when the insert fails', async () => {
      mockSupabaseClient.from().select().eq().order().limit.mockResolvedValue({
        data: [],
        error: null
      });
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.createContentItem({
          course_id: 'c1',
          module_id: 'm1',
          type: 'page',
          title: 'New Page',
          content: 'Content here'
        })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('updateContentItem rejects when the update fails', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.updateContentItem('ci-1', { title: 'x' })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('deleteContentItem rejects when the delete fails', async () => {
      mockSupabaseClient.from().delete().eq().select.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.deleteContentItem('ci-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('getModules rejects when the query fails', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.getModules('c1')
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('getAssignment rejects on non-not-found errors', async () => {
      // supabaseError defaults to code PGRST000, which is not the
      // "row not found" code the service tolerates (PGRST116).
      mockSupabaseClient.from().select().eq().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.getAssignment('ci-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('updateQuiz rejects when the update fails', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.updateQuiz('ci-1', { time_limit: 30 })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('publishContentItem rejects when the update fails', async () => {
      mockSupabaseClient.from().update().eq.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        CanvasContentService.publishContentItem('ci-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('probe failures (regressions)', () => {
    it('createContentItem rejects when the next-position probe fails and does NOT insert at position 0', async () => {
      const builder = getQueryBuilder();
      builder.limit.mockResolvedValue(supabaseError('position probe failed'));

      await expect(
        CanvasContentService.createContentItem({
          course_id: 'c1',
          module_id: 'm1',
          type: 'page',
          title: 'New Page',
          content: 'Content here'
        })
      ).rejects.toMatchObject({ message: 'position probe failed' });

      expect(builder.insert).not.toHaveBeenCalled();
    });

    it('createModule rejects when the next-position probe fails and does NOT insert at position 0', async () => {
      const builder = getQueryBuilder();
      builder.limit.mockResolvedValue(supabaseError('position probe failed'));

      await expect(
        CanvasContentService.createModule('c1', 'Module 1')
      ).rejects.toMatchObject({ message: 'position probe failed' });

      expect(builder.insert).not.toHaveBeenCalled();
    });

    it('addQuizQuestion rejects when the next-position probe fails and does NOT insert at position 0', async () => {
      const builder = getQueryBuilder();
      builder.limit.mockResolvedValue(supabaseError('position probe failed'));

      await expect(
        CanvasContentService.addQuizQuestion('q1', {
          question_type: 'multiple_choice',
          question_text: 'New question?',
          points: 10,
          answers: [],
          position: 0,
          correct_comments: '',
          incorrect_comments: '',
          neutral_comments: ''
        })
      ).rejects.toMatchObject({ message: 'position probe failed' });

      expect(builder.insert).not.toHaveBeenCalled();
    });

    it('submitAssignment rejects when the attempt probe fails and does NOT insert attempt 1', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null
      });

      const builder = getQueryBuilder();
      builder.limit.mockResolvedValue(supabaseError('attempt probe failed'));

      await expect(
        CanvasContentService.submitAssignment('a1', {
          submission_type: 'online_text_entry',
          body: 'My submission'
        })
      ).rejects.toMatchObject({ message: 'attempt probe failed' });

      expect(builder.insert).not.toHaveBeenCalled();
    });
  });
});


describe('unassigned lesson service scope', () => {
  it('requires a course and uses IS NULL alongside course scope when loading', async () => {
    await expect(CanvasContentService.getContentItems(null)).rejects.toThrow('Course required');
    const b = getQueryBuilder();
    b.order.mockReset().mockReturnValueOnce(b).mockResolvedValueOnce({ data: [], error: null });
    await CanvasContentService.getContentItems(null, 'course-a');
    expect(b.order.mock.calls).toEqual([['position'], ['id']]);
    expect(b.eq).toHaveBeenCalledWith('course_id', 'course-a');
    expect(b.is).toHaveBeenCalledWith('module_id', null);
  });

  it.each([null, 'module-a'])('scopes position lookup and preserves association %s when creating', async (moduleId) => {
    const b = getQueryBuilder();
    b.limit.mockResolvedValue({ data: [{ position: 7 }], error: null });
    b.single.mockResolvedValue({ data: { id: 'new-item', module_id: moduleId, position: 8 }, error: null });
    await CanvasContentService.createContentItem({
      course_id: 'course-a', module_id: moduleId, type: 'page', title: 'Synthetic lesson', content: 'Preserved text',
    });
    expect(b.eq).toHaveBeenCalledWith('course_id', 'course-a');
    if (moduleId === null) {
      expect(b.is).toHaveBeenCalledWith('module_id', null);
      expect(b.eq).not.toHaveBeenCalledWith('module_id', null);
    } else {
      expect(b.eq).toHaveBeenCalledWith('module_id', moduleId);
      expect(b.is).not.toHaveBeenCalled();
    }
    expect(b.insert).toHaveBeenCalledExactlyOnceWith({
      course_id: 'course-a', module_id: moduleId, type: 'page', title: 'Synthetic lesson',
      content: 'Preserved text', position: 8, settings: {}, published: false,
    });
    expect(b.update).not.toHaveBeenCalled();
    expect(b.delete).not.toHaveBeenCalled();
  });

  it('refuses unassigned creation if the scoped position lookup fails', async () => {
    const b = getQueryBuilder();
    b.limit.mockResolvedValue(supabaseError('synthetic position failure'));
    await expect(CanvasContentService.createContentItem({
      course_id: 'course-a', module_id: null, type: 'page', title: 'Synthetic lesson', content: '',
    })).rejects.toMatchObject({ message: 'synthetic position failure' });
    expect(b.insert).not.toHaveBeenCalled();
  });

  it('refuses initial and retry reorder attempts before any write or reconciliation read', async () => {
      const from = vi.mocked(mockSupabaseClient.from); const rpc = vi.mocked(mockSupabaseClient.rpc);
      from.mockClear(); rpc.mockClear();
      await expect(CanvasContentService.reorderUnassignedContentItems('one', ['c', 'a', 'b'])).rejects.toThrow('saved order has been kept');
      await expect(CanvasContentService.reorderUnassignedContentItems('one', ['b', 'c', 'a'])).rejects.toThrow('saved order has been kept');
      expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });
});
