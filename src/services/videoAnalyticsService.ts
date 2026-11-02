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

/**
 * Additive engagement batch from a producer: whole seconds and counts gained
 * since its last confirmed write, plus the latest scalar readings.
 */
export interface EngagementDeltas {
  watchTimeDelta?: number;
  playCountDelta?: number;
  pauseCountDelta?: number;
  seekCountDelta?: number;
  lastPosition?: number;
  videoDuration?: number;
  playbackSpeed?: number;
  completionPercentage?: number;
}

/** The additive columns of one video_analytics row. */
export interface EngagementTotals {
  watch_time: number;
  play_count: number;
  pause_count: number;
  seek_count: number;
}

export interface ApplyDeltasOptions {
  /**
   * The totals an earlier attempt of THIS SAME batch tried to write when that
   * attempt's outcome is unknown (EngagementWriteUncertainError). If the row
   * now holds exactly these totals, the batch is reported as already applied
   * and nothing is written.
   */
  expectTarget?: EngagementTotals | null;
  /** Compare-and-set rounds before giving up on a row that keeps changing. */
  maxAttempts?: number;
}

export interface ApplyDeltasResult {
  outcome: 'applied' | 'already-applied';
  totals: EngagementTotals;
}

/** A write was sent and may or may not have been committed. */
export class EngagementWriteUncertainError extends Error {
  readonly attemptedTarget: EngagementTotals;
  readonly reason: unknown;
  constructor(attemptedTarget: EngagementTotals, reason: unknown) {
    super('Video engagement write outcome is unknown');
    this.name = 'EngagementWriteUncertainError';
    this.attemptedTarget = attemptedTarget;
    this.reason = reason;
  }
}

/** Every compare-and-set round lost (row kept changing, or the update matched no row). Nothing was written. */
export class EngagementConflictError extends Error {
  constructor() {
    super('Video engagement row changed or could not be updated; nothing was written');
    this.name = 'EngagementConflictError';
  }
}

const TOTAL_KEYS = ['watch_time', 'play_count', 'pause_count', 'seek_count'] as const;
const TOTAL_COLUMNS = 'watch_time, play_count, pause_count, seek_count' as const;

/** A positive finite number floored to a whole unit, else 0. */
const wholeDelta = (n: number | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;

const totalsOf = (row: Record<string, unknown>): EngagementTotals => ({
  watch_time: Number(row.watch_time ?? 0),
  play_count: Number(row.play_count ?? 0),
  pause_count: Number(row.pause_count ?? 0),
  seek_count: Number(row.seek_count ?? 0),
});

const sameTotals = (a: EngagementTotals, b: EngagementTotals) => TOTAL_KEYS.every((k) => a[k] === b[k]);

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
   * Add a producer's batch to the row with compare-and-set instead of a blind
   * read-then-write, so concurrent writers for the same user and video (two
   * players, a remount, two tabs) cannot overwrite each other's increments:
   * the update only matches if the additive columns still hold what was read,
   * otherwise it re-reads and tries again.
   *
   * - An absent row is created holding exactly this batch (no implicit first
   *   play; getOrCreateAnalytics keeps its legacy play_count 1 for its callers).
   * - A read failure throws as is: nothing was written, so a plain retry is safe.
   * - A failed insert/update throws EngagementWriteUncertainError carrying the
   *   totals it tried to write. Retrying the same batch with that as
   *   expectTarget skips the write when the row already holds it.
   *
   * Not covered, because only a server-side atomic increment could cover it:
   * an uncertain write that DID commit and was then changed again by another
   * writer before the retry is applied twice. completion_percentage is passed
   * through only when given (the table auto-completes at >= 90 on UPDATE).
   */
  async applyEngagementDeltas(
    userId: string,
    contentItemId: string,
    deltas: EngagementDeltas,
    options: ApplyDeltasOptions = {}
  ): Promise<ApplyDeltasResult> {
    const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    const add: EngagementTotals = {
      watch_time: wholeDelta(deltas.watchTimeDelta),
      play_count: wholeDelta(deltas.playCountDelta),
      pause_count: wholeDelta(deltas.pauseCountDelta),
      seek_count: wholeDelta(deltas.seekCountDelta),
    };
    const fields: Record<string, number> = {};
    if (deltas.lastPosition !== undefined) fields.last_position = Math.max(0, Math.floor(deltas.lastPosition));
    if (deltas.videoDuration !== undefined) fields.video_duration = Math.round(deltas.videoDuration);
    if (deltas.playbackSpeed !== undefined) fields.playback_speed = deltas.playbackSpeed;
    if (deltas.completionPercentage !== undefined) {
      fields.completion_percentage = Math.min(100, Math.max(0, Math.floor(deltas.completionPercentage)));
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data: row, error: readError } = await supabase
        .from('video_analytics')
        .select(TOTAL_COLUMNS)
        .eq('user_id', userId)
        .eq('content_item_id', contentItemId)
        .maybeSingle();
      if (readError) throw readError;

      const base = row ? totalsOf(row as Record<string, unknown>) : null;
      if (options.expectTarget && base && sameTotals(base, options.expectTarget)) {
        return { outcome: 'already-applied', totals: base };
      }
      const target: EngagementTotals = {
        watch_time: (base?.watch_time ?? 0) + add.watch_time,
        play_count: (base?.play_count ?? 0) + add.play_count,
        pause_count: (base?.pause_count ?? 0) + add.pause_count,
        seek_count: (base?.seek_count ?? 0) + add.seek_count,
      };

      if (!row) {
        const { error } = await supabase
          .from('video_analytics')
          .insert({ user_id: userId, content_item_id: contentItemId, ...target, ...fields });
        if (!error) return { outcome: 'applied', totals: target };
        if ((error as { code?: string }).code === '23505') continue; // created concurrently: re-read
        throw new EngagementWriteUncertainError(target, error);
      }

      let update = supabase
        .from('video_analytics')
        .update({ ...target, ...fields, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('content_item_id', contentItemId);
      for (const key of TOTAL_KEYS) {
        const seen = (row as Record<string, unknown>)[key];
        update = seen === null || seen === undefined ? update.is(key, null) : update.eq(key, seen as number);
      }
      const { data: written, error: writeError } = await update.select(TOTAL_COLUMNS);
      if (writeError) throw new EngagementWriteUncertainError(target, writeError);
      if (Array.isArray(written) && written.length === 1) return { outcome: 'applied', totals: target };
      // Matched no row: another writer changed it after the read. Re-read and retry.
    }
    throw new EngagementConflictError();
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
