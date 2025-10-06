/**
 * Content Discussion Service
 * Handles inline discussions on content items (pages, videos, assignments, etc.)
 */

import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ContentDiscussionService');

export type DiscussionType = 'question' | 'comment' | 'note' | 'suggestion';

export interface ContentDiscussion {
  id: string;
  content_item_id: string;
  user_id: string;
  comment_text: string;
  comment_type: DiscussionType;
  parent_comment_id: string | null;
  thread_position: number;
  is_resolved: boolean;
  is_pinned: boolean;
  is_hidden: boolean;
  instructor_endorsed: boolean;
  endorsed_at: string | null;
  endorsed_by: string | null;
  is_edited: boolean;
  edited_at: string | null;
  upvote_count: number;
  timestamp_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface ContentDiscussionWithUser extends ContentDiscussion {
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
  is_instructor?: boolean;
}

export interface CreateDiscussionParams {
  contentItemId: string;
  userId: string;
  commentText: string;
  commentType?: DiscussionType;
  parentCommentId?: string;
  timestampSeconds?: number;
}

export interface UpdateDiscussionParams {
  commentText?: string;
  isResolved?: boolean;
  isPinned?: boolean;
  isHidden?: boolean;
}

class ContentDiscussionService {
  /**
   * Get all discussions for a content item
   */
  async getDiscussions(
    contentItemId: string
  ): Promise<ContentDiscussionWithUser[]> {
    try {
      const { data, error } = await supabase
        .from('content_discussions')
        .select(
          `
          *,
          profiles!content_discussions_user_id_fkey(
            id,
            email,
            full_name,
            avatar_url,
            roles
          )
        `
        )
        .eq('content_item_id', contentItemId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform data to include user info
      const discussions = (data || []).map((item: any) => ({
        ...item,
        user_name: item.profiles?.full_name || 'Anonymous',
        user_email: item.profiles?.email,
        user_avatar: item.profiles?.avatar_url,
        is_instructor:
          item.profiles?.roles?.includes('instructor') ||
          item.profiles?.roles?.includes('admin'),
      }));

      return discussions as ContentDiscussionWithUser[];
    } catch (error) {
      logger.error('Error getting content discussions', error);
      return [];
    }
  }

  /**
   * Get discussions with a specific timestamp (for videos)
   */
  async getDiscussionsAtTimestamp(
    contentItemId: string,
    timestampSeconds: number,
    toleranceSeconds: number = 5
  ): Promise<ContentDiscussionWithUser[]> {
    try {
      const { data, error } = await supabase
        .from('content_discussions')
        .select(
          `
          *,
          profiles!content_discussions_user_id_fkey(
            id,
            email,
            full_name,
            avatar_url,
            roles
          )
        `
        )
        .eq('content_item_id', contentItemId)
        .eq('is_hidden', false)
        .gte('timestamp_seconds', timestampSeconds - toleranceSeconds)
        .lte('timestamp_seconds', timestampSeconds + toleranceSeconds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const discussions = (data || []).map((item: any) => ({
        ...item,
        user_name: item.profiles?.full_name || 'Anonymous',
        user_email: item.profiles?.email,
        user_avatar: item.profiles?.avatar_url,
        is_instructor:
          item.profiles?.roles?.includes('instructor') ||
          item.profiles?.roles?.includes('admin'),
      }));

      return discussions as ContentDiscussionWithUser[];
    } catch (error) {
      logger.error('Error getting discussions at timestamp', error);
      return [];
    }
  }

  /**
   * Create a new discussion
   */
  async createDiscussion(
    params: CreateDiscussionParams
  ): Promise<ContentDiscussion> {
    try {
      const { data, error } = await supabase
        .from('content_discussions')
        .insert({
          content_item_id: params.contentItemId,
          user_id: params.userId,
          comment_text: params.commentText,
          comment_type: params.commentType || 'comment',
          parent_comment_id: params.parentCommentId || null,
          timestamp_seconds: params.timestampSeconds || null,
          thread_position: 0,
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Created content discussion', {
        discussionId: data.id,
        contentItemId: params.contentItemId,
      });

      return data as ContentDiscussion;
    } catch (error) {
      logger.error('Error creating content discussion', error);
      throw error;
    }
  }

  /**
   * Update a discussion
   */
  async updateDiscussion(
    discussionId: string,
    updates: UpdateDiscussionParams
  ): Promise<ContentDiscussion> {
    try {
      const { data, error } = await supabase
        .from('content_discussions')
        .update(updates)
        .eq('id', discussionId)
        .select()
        .single();

      if (error) throw error;

      logger.info('Updated content discussion', { discussionId });

      return data as ContentDiscussion;
    } catch (error) {
      logger.error('Error updating content discussion', error);
      throw error;
    }
  }

  /**
   * Delete a discussion
   */
  async deleteDiscussion(discussionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('content_discussions')
        .delete()
        .eq('id', discussionId);

      if (error) throw error;

      logger.info('Deleted content discussion', { discussionId });
    } catch (error) {
      logger.error('Error deleting content discussion', error);
      throw error;
    }
  }

  /**
   * Toggle instructor endorsement
   */
  async toggleEndorsement(
    discussionId: string,
    endorsedBy: string
  ): Promise<ContentDiscussion> {
    try {
      // Get current state
      const { data: current, error: fetchError } = await supabase
        .from('content_discussions')
        .select('instructor_endorsed')
        .eq('id', discussionId)
        .single();

      if (fetchError) throw fetchError;

      const newEndorsedState = !current.instructor_endorsed;

      // Update
      const { data, error } = await supabase
        .from('content_discussions')
        .update({
          instructor_endorsed: newEndorsedState,
          endorsed_at: newEndorsedState ? new Date().toISOString() : null,
          endorsed_by: newEndorsedState ? endorsedBy : null,
        })
        .eq('id', discussionId)
        .select()
        .single();

      if (error) throw error;

      logger.info('Toggled discussion endorsement', {
        discussionId,
        endorsed: newEndorsedState,
      });

      return data as ContentDiscussion;
    } catch (error) {
      logger.error('Error toggling endorsement', error);
      throw error;
    }
  }

  /**
   * Upvote a discussion
   */
  async upvoteDiscussion(
    discussionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Check if already upvoted
      const { data: existing } = await supabase
        .from('content_discussion_upvotes')
        .select('id')
        .eq('discussion_id', discussionId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        // Remove upvote
        const { error } = await supabase
          .from('content_discussion_upvotes')
          .delete()
          .eq('discussion_id', discussionId)
          .eq('user_id', userId);

        if (error) throw error;
        return false; // Removed upvote
      } else {
        // Add upvote
        const { error } = await supabase
          .from('content_discussion_upvotes')
          .insert({
            discussion_id: discussionId,
            user_id: userId,
          });

        if (error) throw error;
        return true; // Added upvote
      }
    } catch (error) {
      logger.error('Error upvoting discussion', error);
      throw error;
    }
  }

  /**
   * Check if user has upvoted a discussion
   */
  async hasUserUpvoted(
    discussionId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('content_discussion_upvotes')
        .select('id')
        .eq('discussion_id', discussionId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return !!data;
    } catch (error) {
      logger.error('Error checking upvote status', error);
      return false;
    }
  }

  /**
   * Get discussion count for a content item
   */
  async getDiscussionCount(contentItemId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('content_discussions')
        .select('*', { count: 'exact', head: true })
        .eq('content_item_id', contentItemId)
        .eq('is_hidden', false);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      logger.error('Error getting discussion count', error);
      return 0;
    }
  }

  /**
   * Get most discussed content items in a course
   */
  async getMostDiscussedContent(
    courseId: string,
    limit: number = 10
  ): Promise<
    Array<{
      contentItemId: string;
      contentTitle: string;
      discussionCount: number;
      unresolvedCount: number;
      endorsedCount: number;
    }>
  > {
    try {
      const { data, error } = await supabase.rpc('get_most_discussed_content', {
        course_id_param: courseId,
        limit_count: limit,
      });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        contentItemId: item.content_item_id,
        contentTitle: item.content_title,
        discussionCount: item.discussion_count || 0,
        unresolvedCount: item.unresolved_count || 0,
        endorsedCount: item.endorsed_count || 0,
      }));
    } catch (error) {
      logger.error('Error getting most discussed content', error);
      return [];
    }
  }

  /**
   * Resolve all discussions in a thread
   */
  async resolveThread(parentDiscussionId: string): Promise<void> {
    try {
      // Update parent and all children
      await supabase
        .from('content_discussions')
        .update({ is_resolved: true })
        .or(`id.eq.${parentDiscussionId},parent_comment_id.eq.${parentDiscussionId}`);

      logger.info('Resolved discussion thread', { parentDiscussionId });
    } catch (error) {
      logger.error('Error resolving discussion thread', error);
      throw error;
    }
  }
}

export default new ContentDiscussionService();
