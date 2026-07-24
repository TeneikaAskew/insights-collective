/**
 * Video Analytics Service
 * Handles video playback tracking, progress, and engagement metrics
 */

import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('VideoAnalyticsService');

export interface VideoAnalytics {
  id: string;
  user_id: string;
  content_item_id: string;
  watch_time: number;
  completion_percentage: number;
  last_position: number;
  video_duration: number | null;
  play_count: number;
  pause_count: number;
  seek_count: number;
  playback_speed: number;
  completed: boolean;
  completed_at: string | null;
  first_watched_at: string;
  last_watched_at: string;
  created_at: string;
  updated_at: string;
}

export interface VideoProgress {
  contentItemId: string;
  lastPosition: number;
  completionPercentage: number;
  completed: boolean;
}

export interface VideoEngagementUpdate {
  watchTime?: number;
  lastPosition?: number;
  completionPercentage?: number;
  videoDuration?: number;
  playbackSpeed?: number;
  incrementPlayCount?: boolean;
  incrementPauseCount?: boolean;
  incrementSeekCount?: boolean;
}

class VideoAnalyticsService {
  /**
   * Get or create video analytics record for a user and content item
   */
  async getOrCreateAnalytics(
    userId: string,
    contentItemId: string
  ): Promise<VideoAnalytics> {
    try {
      // Try to get existing record. maybeSingle keeps "no row" clean (null
      // data, null error); any error here is real and must throw — routing it
      // into the insert branch used to attempt duplicate inserts on outages.
      const { data: existing, error: fetchError } = await supabase
        .from('video_analytics')
        .select('*')
        .eq('user_id', userId)
        .eq('content_item_id', contentItemId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        return existing as VideoAnalytics;
      }

      // Create new record if it doesn't exist
      const { data: newRecord, error: createError } = await supabase
        .from('video_analytics')
        .insert({
          user_id: userId,
          content_item_id: contentItemId,
          watch_time: 0,
          completion_percentage: 0,
          last_position: 0,
          play_count: 1, // First time watching
          pause_count: 0,
          seek_count: 0,
          playback_speed: 1.0,
          completed: false,
        })
        .select()
        .single();

      if (createError) throw createError;

      logger.info('Created new video analytics record', {
        userId,
        contentItemId,
      });

      return newRecord as VideoAnalytics;
    } catch (error) {
      logger.error('Error getting/creating video analytics', error);
      throw error;
    }
  }

  /**
   * Update video engagement metrics
   */
  async updateEngagement(
    userId: string,
    contentItemId: string,
    updates: VideoEngagementUpdate
  ): Promise<VideoAnalytics> {
    try {
      // Get current record
      const current = await this.getOrCreateAnalytics(userId, contentItemId);

      // Build update object
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.watchTime !== undefined) {
        updateData.watch_time = Math.max(0, updates.watchTime);
      }

      if (updates.lastPosition !== undefined) {
        updateData.last_position = Math.max(0, updates.lastPosition);
      }

      if (updates.completionPercentage !== undefined) {
        updateData.completion_percentage = Math.min(
          100,
          Math.max(0, updates.completionPercentage)
        );
      }

      if (updates.videoDuration !== undefined) {
        updateData.video_duration = updates.videoDuration;
      }

      if (updates.playbackSpeed !== undefined) {
        updateData.playback_speed = updates.playbackSpeed;
      }

      if (updates.incrementPlayCount) {
        updateData.play_count = current.play_count + 1;
      }

      if (updates.incrementPauseCount) {
        updateData.pause_count = current.pause_count + 1;
      }

      if (updates.incrementSeekCount) {
        updateData.seek_count = current.seek_count + 1;
      }

      // Perform update
      const { data, error } = await supabase
        .from('video_analytics')
        .update(updateData)
        .eq('user_id', userId)
        .eq('content_item_id', contentItemId)
        .select()
        .single();

      if (error) throw error;

      return data as VideoAnalytics;
    } catch (error) {
      logger.error('Error updating video engagement', error);
      throw error;
    }
  }

  /**
   * Get video progress for resume functionality
   */
  async getVideoProgress(
    userId: string,
    contentItemId: string
  ): Promise<VideoProgress | null> {
    const { data, error } = await supabase
      .from('video_analytics')
      .select('content_item_id, last_position, completion_percentage, completed')
      .eq('user_id', userId)
      .eq('content_item_id', contentItemId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is acceptable
      throw error;
    }

    if (!data) return null;

    return {
      contentItemId: data.content_item_id,
      lastPosition: data.last_position || 0,
      completionPercentage: data.completion_percentage || 0,
      completed: data.completed || false,
    };
  }

  /**
   * Mark video as completed
   */
  async markCompleted(
    userId: string,
    contentItemId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_analytics')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          completion_percentage: 100,
        })
        .eq('user_id', userId)
        .eq('content_item_id', contentItemId);

      if (error) throw error;

      logger.info('Marked video as completed', { userId, contentItemId });
    } catch (error) {
      logger.error('Error marking video completed', error);
      throw error;
    }
  }

  /**
   * Get student video progress summary for a course
   */
  async getStudentVideoSummary(
    userId: string,
    courseId: string
  ): Promise<{
    totalVideos: number;
    completedVideos: number;
    totalWatchTimeMinutes: number;
    averageCompletionPercentage: number;
  }> {
    const { data, error } = await supabase.rpc('get_student_video_progress', {
      student_id: userId,
      course_id_param: courseId,
    });

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        totalVideos: data[0].total_videos || 0,
        completedVideos: data[0].completed_videos || 0,
        totalWatchTimeMinutes: data[0].total_watch_time_minutes || 0,
        averageCompletionPercentage:
          data[0].average_completion_percentage || 0,
      };
    }

    return {
      totalVideos: 0,
      completedVideos: 0,
      totalWatchTimeMinutes: 0,
      averageCompletionPercentage: 0,
    };
  }

  /**
   * Get all video analytics for a student in a course
   */
  async getStudentCourseVideoAnalytics(
    userId: string,
    courseId: string
  ): Promise<VideoAnalytics[]> {
    const { data, error } = await supabase
      .from('video_analytics')
      .select(
        `
        *,
        content_items!inner(
          id,
          title,
          course_id
        )
      `
      )
      .eq('user_id', userId)
      .eq('content_items.course_id', courseId)
      .order('last_watched_at', { ascending: false });

    if (error) throw error;

    return (data || []) as VideoAnalytics[];
  }

  /**
   * Get video analytics for all students in a course (instructor view)
   */
  async getCourseVideoAnalytics(
    courseId: string
  ): Promise<
    Array<VideoAnalytics & { user_email?: string; user_name?: string }>
  > {
    const { data, error } = await supabase
      .from('video_analytics')
      .select(
        `
        *,
        content_items!inner(course_id),
        profiles(first_name, last_name)
      `
      )
      .eq('content_items.course_id', courseId)
      .order('last_watched_at', { ascending: false });

    if (error) throw error;

    return (data || []) as any[];
  }
}

export default new VideoAnalyticsService();
