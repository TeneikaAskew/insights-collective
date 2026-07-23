// ABOUTME: Unit tests for Video Analytics Service
// ABOUTME: Verifies happy paths and that supabase errors propagate instead of
// being swallowed into null/zero/[] defaults.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import videoAnalyticsService, {
  VideoAnalytics,
} from '../videoAnalyticsService';
import {
  mockSupabaseClient,
  getQueryBuilder,
  supabaseError,
} from '@/test/mocks/supabase';

function makeVideoAnalytics(
  overrides: Partial<VideoAnalytics> = {}
): VideoAnalytics {
  return {
    id: 'va-1',
    user_id: 'user-1',
    content_item_id: 'item-1',
    watch_time: 120,
    completion_percentage: 40,
    last_position: 118,
    video_duration: 300,
    play_count: 2,
    pause_count: 1,
    seek_count: 0,
    playback_speed: 1.0,
    completed: false,
    completed_at: null,
    first_watched_at: '2026-01-10T00:00:00Z',
    last_watched_at: '2026-01-11T00:00:00Z',
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-11T00:00:00Z',
    ...overrides,
  };
}

const notFoundError = { message: 'no rows', code: 'PGRST116', details: '', hint: '' };

describe('videoAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateAnalytics', () => {
    it('returns the existing record when one is found', async () => {
      const existing = makeVideoAnalytics();
      getQueryBuilder().single.mockResolvedValueOnce({
        data: existing,
        error: null,
      });

      const result = await videoAnalyticsService.getOrCreateAnalytics(
        'user-1',
        'item-1'
      );

      expect(result).toEqual(existing);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('video_analytics');
    });

    it('creates a new record when none exists', async () => {
      const created = makeVideoAnalytics({ play_count: 1, watch_time: 0 });
      const builder = getQueryBuilder();
      builder.single
        .mockResolvedValueOnce({ data: null, error: notFoundError })
        .mockResolvedValueOnce({ data: created, error: null });

      const result = await videoAnalyticsService.getOrCreateAnalytics(
        'user-1',
        'item-1'
      );

      expect(result).toEqual(created);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          content_item_id: 'item-1',
          play_count: 1,
        })
      );
    });

    it('throws when the insert fails', async () => {
      const builder = getQueryBuilder();
      builder.single
        .mockResolvedValueOnce({ data: null, error: notFoundError })
        .mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        videoAnalyticsService.getOrCreateAnalytics('user-1', 'item-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('updateEngagement', () => {
    it('updates metrics and returns the updated record', async () => {
      const existing = makeVideoAnalytics();
      const updated = makeVideoAnalytics({ watch_time: 200, play_count: 3 });
      const builder = getQueryBuilder();
      builder.single
        .mockResolvedValueOnce({ data: existing, error: null }) // getOrCreateAnalytics fetch
        .mockResolvedValueOnce({ data: updated, error: null }); // update result

      const result = await videoAnalyticsService.updateEngagement(
        'user-1',
        'item-1',
        { watchTime: 200, incrementPlayCount: true }
      );

      expect(result).toEqual(updated);
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ watch_time: 200, play_count: 3 })
      );
    });

    it('throws when the update fails', async () => {
      const builder = getQueryBuilder();
      builder.single
        .mockResolvedValueOnce({ data: makeVideoAnalytics(), error: null })
        .mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        videoAnalyticsService.updateEngagement('user-1', 'item-1', {
          watchTime: 10,
        })
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('getVideoProgress', () => {
    it('returns mapped progress for an existing row', async () => {
      getQueryBuilder().single.mockResolvedValueOnce({
        data: {
          content_item_id: 'item-1',
          last_position: 118,
          completion_percentage: 40,
          completed: false,
        },
        error: null,
      });

      const result = await videoAnalyticsService.getVideoProgress(
        'user-1',
        'item-1'
      );

      expect(result).toEqual({
        contentItemId: 'item-1',
        lastPosition: 118,
        completionPercentage: 40,
        completed: false,
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('video_analytics');
    });

    it('returns null when no row exists (PGRST116)', async () => {
      getQueryBuilder().single.mockResolvedValueOnce({
        data: null,
        error: notFoundError,
      });

      const result = await videoAnalyticsService.getVideoProgress(
        'user-1',
        'item-1'
      );

      expect(result).toBeNull();
    });

    it('throws on a genuine database error instead of returning null', async () => {
      getQueryBuilder().single.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        videoAnalyticsService.getVideoProgress('user-1', 'item-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('markCompleted', () => {
    it('updates the record to completed', async () => {
      const builder = getQueryBuilder();
      // .update().eq().eq() — first eq keeps chaining, second resolves.
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        videoAnalyticsService.markCompleted('user-1', 'item-1')
      ).resolves.toBeUndefined();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('video_analytics');
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ completed: true, completion_percentage: 100 })
      );
    });
  });

  describe('getStudentVideoSummary', () => {
    it('returns the mapped summary from the RPC result', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [
          {
            total_videos: 10,
            completed_videos: 4,
            total_watch_time_minutes: 55,
            average_completion_percentage: 62,
          },
        ],
        error: null,
      });

      const result = await videoAnalyticsService.getStudentVideoSummary(
        'user-1',
        'course-1'
      );

      expect(result).toEqual({
        totalVideos: 10,
        completedVideos: 4,
        totalWatchTimeMinutes: 55,
        averageCompletionPercentage: 62,
      });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_student_video_progress',
        { student_id: 'user-1', course_id_param: 'course-1' }
      );
    });

    it('returns a zeroed summary for a successful empty result', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await videoAnalyticsService.getStudentVideoSummary(
        'user-1',
        'course-1'
      );

      expect(result).toEqual({
        totalVideos: 0,
        completedVideos: 0,
        totalWatchTimeMinutes: 0,
        averageCompletionPercentage: 0,
      });
    });

    it('throws on RPC error instead of returning a zeroed summary', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        videoAnalyticsService.getStudentVideoSummary('user-1', 'course-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('getStudentCourseVideoAnalytics', () => {
    it('returns analytics rows for the student and course', async () => {
      const rows = [makeVideoAnalytics(), makeVideoAnalytics({ id: 'va-2' })];
      getQueryBuilder().order.mockResolvedValueOnce({ data: rows, error: null });

      const result = await videoAnalyticsService.getStudentCourseVideoAnalytics(
        'user-1',
        'course-1'
      );

      expect(result).toEqual(rows);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('video_analytics');
    });

    it('returns [] when data is null on success', async () => {
      getQueryBuilder().order.mockResolvedValueOnce({ data: null, error: null });

      const result = await videoAnalyticsService.getStudentCourseVideoAnalytics(
        'user-1',
        'course-1'
      );

      expect(result).toEqual([]);
    });

    it('throws on error instead of returning []', async () => {
      getQueryBuilder().order.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        videoAnalyticsService.getStudentCourseVideoAnalytics('user-1', 'course-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('getCourseVideoAnalytics', () => {
    it('returns analytics rows for all students in the course', async () => {
      const rows = [
        makeVideoAnalytics({ user_id: 'user-1' }),
        makeVideoAnalytics({ id: 'va-2', user_id: 'user-2' }),
      ];
      getQueryBuilder().order.mockResolvedValueOnce({ data: rows, error: null });

      const result =
        await videoAnalyticsService.getCourseVideoAnalytics('course-1');

      expect(result).toEqual(rows);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('video_analytics');
    });

    it('returns [] when data is null on success', async () => {
      getQueryBuilder().order.mockResolvedValueOnce({ data: null, error: null });

      const result =
        await videoAnalyticsService.getCourseVideoAnalytics('course-1');

      expect(result).toEqual([]);
    });

    it('throws on error instead of returning []', async () => {
      getQueryBuilder().order.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        videoAnalyticsService.getCourseVideoAnalytics('course-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });
});
