// ABOUTME: Batches WatchProgressTracker output into videoAnalyticsService.updateEngagement writes.
// ABOUTME: Never marks completion; sends coverage percent only when explicitly enabled.

import type { VideoEngagementUpdate } from '@/services/videoAnalyticsService';
import { WatchProgressTracker, type PlaybackEvent, type WatchSnapshot } from './watchProgress';

/** The one service method the reporter needs; the real default is videoAnalyticsService. */
export interface EngagementSink {
  updateEngagement(userId: string, contentItemId: string, updates: VideoEngagementUpdate): Promise<unknown>;
}

export type ReportStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface WatchReporterOptions {
  userId: string;
  contentItemId: string;
  sink: EngagementSink;
  /**
   * Off by default. The video_analytics table has a BEFORE UPDATE trigger
   * (20251006_video_analytics_and_discussions.sql) that sets completed=true
   * once completion_percentage >= 90, so sending coverage would silently mark
   * the video complete under a policy nobody has approved.
   */
  reportCoveragePercent?: boolean;
  /** Minimum gap between time-driven flushes. Pause, ended and dispose flush immediately. */
  flushIntervalMs?: number;
  now?: () => number;
  tracker?: WatchProgressTracker;
  onStatus?: (status: ReportStatus, error?: unknown) => void;
}

/**
 * Accumulates deltas since the last *successful* write. A failed write keeps
 * them pending, so the next flush retries the same totals: nothing is lost
 * and nothing is counted twice. One write is in flight at a time.
 */
export class WatchReporter {
  readonly tracker: WatchProgressTracker;
  private readonly opts: Required<Pick<WatchReporterOptions, 'flushIntervalMs' | 'reportCoveragePercent'>> &
    WatchReporterOptions;
  private sent = { played: 0, play: 0, pause: 0, seek: 0 };
  private lastFlushAt = 0;
  private inFlight: Promise<void> | null = null;
  private flushAgain = false;
  private status: ReportStatus = 'idle';
  private disposed = false;

  constructor(options: WatchReporterOptions) {
    this.opts = { flushIntervalMs: 15000, reportCoveragePercent: false, ...options };
    this.tracker = options.tracker ?? new WatchProgressTracker({ now: options.now });
    this.lastFlushAt = this.now();
  }

  get currentStatus(): ReportStatus {
    return this.status;
  }

  /** Feed one adapter event; flushes on pause/ended and when the interval elapsed. */
  record(event: PlaybackEvent): void {
    if (this.disposed) return;
    this.tracker.handle(event);
    if (event.type === 'pause' || event.type === 'ended') {
      void this.flush();
    } else if (this.now() - this.lastFlushAt >= this.opts.flushIntervalMs) {
      void this.flush();
    }
  }

  /** Build the pending update from the tracker, or null when there is nothing new. */
  pendingUpdate(snapshot: WatchSnapshot = this.tracker.snapshot()): VideoEngagementUpdate | null {
    const playedDelta = Math.floor(snapshot.playedSeconds - this.sent.played);
    const playDelta = snapshot.playCount - this.sent.play;
    const pauseDelta = snapshot.pauseCount - this.sent.pause;
    const seekDelta = snapshot.seekCount - this.sent.seek;
    if (playedDelta <= 0 && playDelta <= 0 && pauseDelta <= 0 && seekDelta <= 0) return null;

    const update: VideoEngagementUpdate = {
      lastPosition: Math.floor(snapshot.positionSeconds),
      playbackSpeed: snapshot.playbackRate,
    };
    if (playedDelta > 0) update.watchTimeDelta = playedDelta;
    if (playDelta > 0) update.playCountDelta = playDelta;
    if (pauseDelta > 0) update.pauseCountDelta = pauseDelta;
    if (seekDelta > 0) update.seekCountDelta = seekDelta;
    if (snapshot.durationSeconds) update.videoDuration = Math.round(snapshot.durationSeconds);
    if (this.opts.reportCoveragePercent && snapshot.coveragePercent !== null) {
      update.completionPercentage = Math.floor(snapshot.coveragePercent);
    }
    return update;
  }

  flush(): Promise<void> {
    if (this.inFlight) {
      this.flushAgain = true;
      return this.inFlight;
    }
    const snapshot = this.tracker.snapshot();
    const update = this.pendingUpdate(snapshot);
    if (!update) return Promise.resolve();

    this.lastFlushAt = this.now();
    this.setStatus('saving');
    const { userId, contentItemId, sink } = this.opts;
    this.inFlight = sink
      .updateEngagement(userId, contentItemId, update)
      .then(() => {
        // Only what this write carried is marked sent; fractions stay pending.
        this.sent = {
          played: this.sent.played + (update.watchTimeDelta ?? 0),
          play: this.sent.play + (update.playCountDelta ?? 0),
          pause: this.sent.pause + (update.pauseCountDelta ?? 0),
          seek: this.sent.seek + (update.seekCountDelta ?? 0),
        };
        this.setStatus('saved');
      })
      .catch((error) => {
        this.setStatus('error', error);
      })
      .finally(() => {
        this.inFlight = null;
        if (this.flushAgain) {
          this.flushAgain = false;
          void this.flush();
        }
      });
    return this.inFlight;
  }

  /** Final flush; later events are ignored. */
  dispose(): Promise<void> {
    const done = this.flush();
    this.disposed = true;
    return done;
  }

  private setStatus(status: ReportStatus, error?: unknown) {
    this.status = status;
    this.opts.onStatus?.(status, error);
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }
}
