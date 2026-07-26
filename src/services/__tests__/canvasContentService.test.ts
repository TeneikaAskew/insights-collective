// ABOUTME: Unit tests for Canvas Content Service
// ABOUTME: Tests CRUD operations for content items, assignments, quizzes, and progress tracking

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasContentService } from '../canvasContentService';
import { mockSupabaseClient, supabaseError, getQueryBuilder } from '@/test/mocks/supabase';

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

    it('should delete a content item', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue({
        error: null
      });

      await expect(
        CanvasContentService.deleteContentItem('1')
      ).resolves.not.toThrow();
    });

    it('should reorder content items', async () => {
      mockSupabaseClient.from().upsert.mockResolvedValue({
        error: null
      });

      await expect(
        CanvasContentService.reorderContentItems('m1', ['i1', 'i2', 'i3'])
      ).resolves.not.toThrow();
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
      mockSupabaseClient.from().delete().eq.mockResolvedValue(
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
