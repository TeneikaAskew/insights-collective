// ABOUTME: Unit tests for Content Discussion Service
// ABOUTME: Verifies happy paths, legitimate empty results, and that supabase
// errors propagate instead of being swallowed into []/false/0 defaults.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import contentDiscussionService, {
  ContentDiscussion,
} from '../contentDiscussionService';
import {
  mockSupabaseClient,
  getQueryBuilder,
  supabaseError,
} from '@/test/mocks/supabase';

function makeDiscussion(
  overrides: Partial<ContentDiscussion> & Record<string, unknown> = {}
): ContentDiscussion {
  return {
    id: 'd-1',
    content_item_id: 'item-1',
    user_id: 'user-1',
    comment_text: 'Great lesson!',
    comment_type: 'comment',
    parent_comment_id: null,
    thread_position: 0,
    is_resolved: false,
    is_pinned: false,
    is_hidden: false,
    instructor_endorsed: false,
    endorsed_at: null,
    endorsed_by: null,
    is_edited: false,
    edited_at: null,
    upvote_count: 0,
    timestamp_seconds: null,
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

const profileJoin = {
  id: 'user-1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  avatar_url: 'https://example.com/ada.png',
  roles: ['instructor'],
};

const notFoundError = { message: 'no rows', code: 'PGRST116', details: '', hint: '' };

describe('contentDiscussionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDiscussions', () => {
    it('returns discussions with mapped user info', async () => {
      const rows = [makeDiscussion({ profiles: profileJoin })];
      getQueryBuilder().order.mockResolvedValueOnce({ data: rows, error: null });

      const result = await contentDiscussionService.getDiscussions('item-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'd-1',
        user_name: 'Ada Lovelace',
        user_avatar: 'https://example.com/ada.png',
        is_instructor: true,
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussions'
      );
    });

    it('returns [] when data is null on success', async () => {
      getQueryBuilder().order.mockResolvedValueOnce({ data: null, error: null });

      const result = await contentDiscussionService.getDiscussions('item-1');

      expect(result).toEqual([]);
    });

    it('throws on error instead of returning []', async () => {
      getQueryBuilder().order.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.getDiscussions('item-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('getDiscussionsAtTimestamp', () => {
    it('returns discussions near the timestamp with mapped user info', async () => {
      const rows = [
        makeDiscussion({ timestamp_seconds: 42, profiles: profileJoin }),
      ];
      const builder = getQueryBuilder();
      builder.order.mockResolvedValueOnce({ data: rows, error: null });

      const result = await contentDiscussionService.getDiscussionsAtTimestamp(
        'item-1',
        45,
        5
      );

      expect(result).toHaveLength(1);
      expect(result[0].user_name).toBe('Ada Lovelace');
      expect(builder.gte).toHaveBeenCalledWith('timestamp_seconds', 40);
      expect(builder.lte).toHaveBeenCalledWith('timestamp_seconds', 50);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussions'
      );
    });

    it('throws on error instead of returning []', async () => {
      getQueryBuilder().order.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.getDiscussionsAtTimestamp('item-1', 45)
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('createDiscussion', () => {
    it('inserts and returns the new discussion', async () => {
      const created = makeDiscussion();
      const builder = getQueryBuilder();
      builder.single.mockResolvedValueOnce({ data: created, error: null });

      const result = await contentDiscussionService.createDiscussion({
        contentItemId: 'item-1',
        userId: 'user-1',
        commentText: 'Great lesson!',
      });

      expect(result).toEqual(created);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          content_item_id: 'item-1',
          user_id: 'user-1',
          comment_text: 'Great lesson!',
          comment_type: 'comment',
        })
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussions'
      );
    });

    it('throws when the insert fails', async () => {
      getQueryBuilder().single.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.createDiscussion({
          contentItemId: 'item-1',
          userId: 'user-1',
          commentText: 'Great lesson!',
        })
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('updateDiscussion', () => {
    it('updates and returns the discussion', async () => {
      const updated = makeDiscussion({ comment_text: 'Edited' });
      getQueryBuilder().single.mockResolvedValueOnce({
        data: updated,
        error: null,
      });

      const result = await contentDiscussionService.updateDiscussion('d-1', {
        commentText: 'Edited',
      });

      expect(result).toEqual(updated);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussions'
      );
    });

    it('throws when the update fails', async () => {
      getQueryBuilder().single.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.updateDiscussion('d-1', { isPinned: true })
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('deleteDiscussion', () => {
    it('deletes the discussion', async () => {
      getQueryBuilder().eq.mockResolvedValueOnce({ error: null });

      await expect(
        contentDiscussionService.deleteDiscussion('d-1')
      ).resolves.toBeUndefined();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussions'
      );
    });

    it('throws when the delete fails', async () => {
      getQueryBuilder().eq.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.deleteDiscussion('d-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('toggleEndorsement', () => {
    it('endorses a discussion that was not endorsed', async () => {
      const endorsed = makeDiscussion({
        instructor_endorsed: true,
        endorsed_by: 'instructor-1',
      });
      const builder = getQueryBuilder();
      builder.single
        .mockResolvedValueOnce({
          data: { instructor_endorsed: false },
          error: null,
        })
        .mockResolvedValueOnce({ data: endorsed, error: null });

      const result = await contentDiscussionService.toggleEndorsement(
        'd-1',
        'instructor-1'
      );

      expect(result).toEqual(endorsed);
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          instructor_endorsed: true,
          endorsed_by: 'instructor-1',
        })
      );
    });

    it('throws when the fetch fails', async () => {
      getQueryBuilder().single.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.toggleEndorsement('d-1', 'instructor-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('upvoteDiscussion', () => {
    it('adds an upvote when none exists and returns true', async () => {
      const builder = getQueryBuilder();
      // maybeSingle: "not upvoted" is a clean null-data/null-error result
      builder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      builder.insert.mockResolvedValueOnce({ error: null });

      const result = await contentDiscussionService.upvoteDiscussion(
        'd-1',
        'user-1'
      );

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussion_upvotes'
      );
    });

    it('removes an existing upvote and returns false', async () => {
      const builder = getQueryBuilder();
      builder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'up-1' },
        error: null,
      });
      // eq is called four times: twice in the check query (chaining into
      // .maybeSingle()), then twice in .delete().eq().eq() where the last resolves.
      builder.eq.mockImplementationOnce(() => builder); // check: discussion_id
      builder.eq.mockImplementationOnce(() => builder); // check: user_id
      builder.eq.mockImplementationOnce(() => builder); // delete: discussion_id
      builder.eq.mockResolvedValueOnce({ error: null }); // delete: user_id

      const result = await contentDiscussionService.upvoteDiscussion(
        'd-1',
        'user-1'
      );

      expect(result).toBe(false);
      expect(builder.delete).toHaveBeenCalled();
    });

    it('throws when the insert fails', async () => {
      const builder = getQueryBuilder();
      builder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      builder.insert.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.upvoteDiscussion('d-1', 'user-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('REGRESSION: throws when the existence probe fails and performs NO write', async () => {
      const builder = getQueryBuilder();
      builder.maybeSingle.mockResolvedValueOnce(supabaseError('probe failed'));

      await expect(
        contentDiscussionService.upvoteDiscussion('d-1', 'user-1')
      ).rejects.toMatchObject({ message: 'probe failed' });

      // A probe failure must not be treated as "not upvoted" → insert,
      // nor as "upvoted" → delete.
      expect(builder.insert).not.toHaveBeenCalled();
      expect(builder.delete).not.toHaveBeenCalled();
    });
  });

  describe('hasUserUpvoted', () => {
    it('returns true when an upvote row exists', async () => {
      getQueryBuilder().single.mockResolvedValueOnce({
        data: { id: 'up-1' },
        error: null,
      });

      const result = await contentDiscussionService.hasUserUpvoted(
        'd-1',
        'user-1'
      );

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussion_upvotes'
      );
    });

    it('returns false when no upvote row exists (PGRST116)', async () => {
      getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: notFoundError,
      });

      const result = await contentDiscussionService.hasUserUpvoted(
        'd-1',
        'user-1'
      );

      expect(result).toBe(false);
    });

    it('throws on a genuine database error instead of returning false', async () => {
      getQueryBuilder().single.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.hasUserUpvoted('d-1', 'user-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('getDiscussionCount', () => {
    it('returns the count for a content item', async () => {
      const builder = getQueryBuilder();
      // .select().eq().eq() — first eq keeps chaining, second resolves.
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce({ count: 7, error: null });

      const result = await contentDiscussionService.getDiscussionCount('item-1');

      expect(result).toBe(7);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussions'
      );
    });

    it('returns 0 when count is null on success', async () => {
      const builder = getQueryBuilder();
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce({ count: null, error: null });

      const result = await contentDiscussionService.getDiscussionCount('item-1');

      expect(result).toBe(0);
    });

    it('throws on error instead of returning 0', async () => {
      const builder = getQueryBuilder();
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.getDiscussionCount('item-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('getMostDiscussedContent', () => {
    it('returns mapped rows from the RPC result', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [
          {
            content_item_id: 'item-1',
            content_title: 'Lesson 1',
            discussion_count: 12,
            unresolved_count: 3,
            endorsed_count: 2,
          },
        ],
        error: null,
      });

      const result = await contentDiscussionService.getMostDiscussedContent(
        'course-1',
        5
      );

      expect(result).toEqual([
        {
          contentItemId: 'item-1',
          contentTitle: 'Lesson 1',
          discussionCount: 12,
          unresolvedCount: 3,
          endorsedCount: 2,
        },
      ]);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_most_discussed_content',
        { course_id_param: 'course-1', limit_count: 5 }
      );
    });

    it('returns [] when data is null on success', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result =
        await contentDiscussionService.getMostDiscussedContent('course-1');

      expect(result).toEqual([]);
    });

    it('throws on RPC error instead of returning []', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.getMostDiscussedContent('course-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('resolveThread', () => {
    it('marks the parent and children resolved', async () => {
      const builder = getQueryBuilder();
      builder.or.mockResolvedValueOnce({ error: null });

      await expect(
        contentDiscussionService.resolveThread('d-1')
      ).resolves.toBeUndefined();

      expect(builder.update).toHaveBeenCalledWith({ is_resolved: true });
      expect(builder.or).toHaveBeenCalledWith(
        'id.eq.d-1,parent_comment_id.eq.d-1'
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'content_discussions'
      );
    });

    it('throws when the update fails', async () => {
      getQueryBuilder().or.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        contentDiscussionService.resolveThread('d-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });
});
