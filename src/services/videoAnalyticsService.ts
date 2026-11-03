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


/**
 * One keyed batch for the PROPOSED apply-once RPC (docs/lms/wp09-r3-idempotency.md).
 * The same (sessionId, seq) must always carry the same deltas.
 */
export interface KeyedEngagementBatch {
  sessionId: string;
  seq: number;
  deltas: EngagementDeltas;
}

export interface KeyedApplyResult {
  outcome: 'applied' | 'already-applied';
  totals: EngagementTotals;
}

/**
 * The signed-in learner is not the learner the batch was recorded for (sign-out,
 * account switch). The batch was NOT sent and must never be sent: replaying it
 * would credit the new learner.
 */
export class EngagementIdentityMismatchError extends Error {
  /** 'preflight': the local auth read established it (no RPC sent). 'server': the RPC refused p_expected_user_id (nothing written). */
  readonly established: 'preflight' | 'server';
  constructor(established: 'preflight' | 'server' = 'preflight') {
    super('Signed-in user does not match the recorded viewer; batch not applied');
    this.name = 'EngagementIdentityMismatchError';
    this.established = established;
  }
}

/** The signed-in user could not be read. Nothing was sent; the batch must be kept and retried unchanged. */
export class EngagementAuthUnavailableError extends Error {
  readonly reason: unknown;
  constructor(reason: unknown) {
    super('Could not read the signed-in user; batch not sent');
    this.name = 'EngagementAuthUnavailableError';
    this.reason = reason;
  }
}

/** The RPC answered, but not with exactly one well-formed acknowledgement. Outcome unknown; retry the identical key. */
export class EngagementAckMalformedError extends Error {
  readonly ack: unknown;
  constructor(ack: unknown) {
    super('apply_video_engagement_batch acknowledgement is malformed; outcome unknown');
    this.name = 'EngagementAckMalformedError';
    this.ack = ack;
  }
}

/** RFC 4122 UUID shape (any version), as p_session_id must be. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** Exactly one row with a boolean `applied` and four non-negative integer totals, else null. */
function parseKeyedAck(data: unknown): { applied: boolean; totals: EngagementTotals } | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const row = data[0] as Record<string, unknown> | null;
  if (!row || typeof row !== 'object' || typeof row.applied !== 'boolean') return null;
  if (!isCount(row.watch_time) || !isCount(row.play_count) || !isCount(row.pause_count) || !isCount(row.seek_count)) {
    return null;
  }
  return {
    applied: row.applied,
    totals: { watch_time: row.watch_time, play_count: row.play_count, pause_count: row.pause_count, seek_count: row.seek_count },
  };
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
   * Not covered: an uncertain write that DID commit and was then changed again
   * by another writer before the retry is applied twice. A server-side atomic
   * increment alone would not remove this (a blind retry would still add the
   * batch again); it needs a durable idempotency/dedup contract or equivalent
   * reconciliation, which is out of scope here. completion_percentage is passed
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
   * PROPOSAL PATH, NOT DEPLOYED: calls apply_video_engagement_batch, which does
   * not exist in any database yet. Keyed apply-once: a retry of the same
   * (sessionId, seq) is acknowledged without being applied again, so every
   * failure here is safe to retry with the identical batch.
   *
   * Identity, in order:
   * - auth read failed (error, or no data): EngagementAuthUnavailableError,
   *   no RPC, the batch is kept for an identical retry;
   * - auth read succeeded and shows sign-out or another user:
   *   EngagementIdentityMismatchError('preflight'), no RPC;
   * - otherwise the RPC carries p_expected_user_id, and a server refusal of it
   *   is EngagementIdentityMismatchError('server') (nothing written).
   * Only an acknowledgement of exactly one row with a boolean `applied` and four
   * valid totals counts; anything else is EngagementAckMalformedError (outcome
   * unknown, retry the identical key). A non-UUID session id is refused unsent.
   */
  async applyEngagementBatch(
    userId: string,
    contentItemId: string,
    batch: KeyedEngagementBatch
  ): Promise<KeyedApplyResult> {
    if (!UUID_PATTERN.test(batch.sessionId)) throw new Error('Session id is not a UUID; batch not sent');
    let sessionRead: Awaited<ReturnType<typeof supabase.auth.getSession>>;
    try {
      sessionRead = await supabase.auth.getSession();
    } catch (readFailure) {
      throw new EngagementAuthUnavailableError(readFailure);
    }
    if (sessionRead?.error || !sessionRead?.data) throw new EngagementAuthUnavailableError(sessionRead?.error);
    // A successful read: no session is an established sign-out, another id an established switch.
    if ((sessionRead.data.session?.user?.id ?? null) !== userId) throw new EngagementIdentityMismatchError('preflight');

    const d = batch.deltas;
    const { data, error } = await (supabase.rpc as any)('apply_video_engagement_batch', {
      p_expected_user_id: userId,
      p_content_item_id: contentItemId,
      p_session_id: batch.sessionId,
      p_seq: batch.seq,
      p_watch_delta: wholeDelta(d.watchTimeDelta),
      p_play_delta: wholeDelta(d.playCountDelta),
      p_pause_delta: wholeDelta(d.pauseCountDelta),
      p_seek_delta: wholeDelta(d.seekCountDelta),
      p_last_position: d.lastPosition === undefined ? null : Math.max(0, Math.floor(d.lastPosition)),
      p_video_duration: d.videoDuration === undefined ? null : Math.round(d.videoDuration),
      p_playback_speed: d.playbackSpeed ?? null,
    });
    if (error) {
      if ((error as { code?: string }).code === '42501' && /expected user/i.test(String((error as { message?: string }).message))) {
        throw new EngagementIdentityMismatchError('server');
      }
      throw error;
    }
    const ack = parseKeyedAck(data);
    if (!ack) throw new EngagementAckMalformedError(data);
    return { outcome: ack.applied ? 'applied' : 'already-applied', totals: ack.totals };
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
