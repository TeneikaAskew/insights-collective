// ABOUTME: Batches WatchProgressTracker output into videoAnalyticsService.applyEngagementDeltas writes.
// ABOUTME: Never marks completion; sends coverage percent only when explicitly enabled.

import type { ApplyDeltasOptions, EngagementDeltas, EngagementTotals } from '@/services/videoAnalyticsService';
import { WatchProgressTracker, type PlaybackEvent, type WatchSnapshot } from './watchProgress';

/** The one service method the reporter needs; the real default is videoAnalyticsService. */
export interface EngagementSink {
  applyEngagementDeltas(
    userId: string,
    contentItemId: string,
    deltas: EngagementDeltas,
    options?: ApplyDeltasOptions,
  ): Promise<unknown>;
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

/** Duck-typed EngagementWriteUncertainError: the write may have committed; it carries what it tried to write. */
function attemptedTargetOf(error: unknown): EngagementTotals | null {
  if (error && typeof error === 'object' && 'attemptedTarget' in error) {
    const target = (error as { attemptedTarget: unknown }).attemptedTarget;
    if (target && typeof target === 'object') return target as EngagementTotals;
  }
  return null;
}

/** A fresh durable id for one batch; a retry reuses it unchanged. */
function newBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface Batch {
  deltas: EngagementDeltas;
  /** Sent with every attempt of this batch so the server applies it at most once. */
  batchId: string;
  /** Set after a write whose outcome is unknown; lets the service skip it if it did commit. */
  expectTarget: EngagementTotals | null;
}

/**
 * Accumulates deltas since the last confirmed write. One write is in flight
 * at a time.
 *
 * A failed batch is frozen and retried as the identical batch, never merged
 * with newer progress, so the service can recognise a retry of a write that
 * did commit (expectTarget) and skip it. Retries are event driven only: the
 * next pause/ended, the next progress tick after flushIntervalMs, a page hide,
 * retry(), or dispose(). There is no timer.
 *
 * Each batch carries a batchId that every retry reuses, and the service's
 * idempotent path (apply_video_engagement_batch) applies a batch id at most
 * once, so a retry of a write that did commit is never added twice. Only if
 * that function is not deployed does the service fall back to compare-and-set,
 * which keeps its documented uncertain-retry gap.
 */
export class WatchReporter {
  readonly tracker: WatchProgressTracker;
  private readonly opts: Required<Pick<WatchReporterOptions, 'flushIntervalMs' | 'reportCoveragePercent'>> &
    WatchReporterOptions;
  private sent = { played: 0, play: 0, pause: 0, seek: 0 };
  private retryBatch: Batch | null = null;
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

  /** New progress since the last confirmed write (excluding a frozen retry batch), or null. */
  pendingUpdate(snapshot: WatchSnapshot = this.tracker.snapshot()): EngagementDeltas | null {
    const base = this.retryBatch ? this.afterBatch(this.retryBatch.deltas) : this.sent;
    const playedDelta = Math.floor(snapshot.playedSeconds - base.played);
    const playDelta = snapshot.playCount - base.play;
    const pauseDelta = snapshot.pauseCount - base.pause;
    const seekDelta = snapshot.seekCount - base.seek;
    if (playedDelta <= 0 && playDelta <= 0 && pauseDelta <= 0 && seekDelta <= 0) return null;

    const update: EngagementDeltas = {
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

  /** True while a frozen retry batch or newer progress is unconfirmed. */
  get hasPending(): boolean {
    return this.retryBatch !== null || this.pendingUpdate() !== null;
  }

  /** Write the frozen retry batch if there is one, else whatever is new. */
  flush(): Promise<void> {
    if (this.inFlight) {
      this.flushAgain = true;
      return this.inFlight;
    }
    let batch = this.retryBatch;
    if (!batch) {
      const deltas = this.pendingUpdate();
      if (!deltas) return Promise.resolve();
      batch = { deltas, batchId: newBatchId(), expectTarget: null };
    }
    const attempt = batch;

    this.lastFlushAt = this.now();
    this.setStatus('saving');
    const { userId, contentItemId, sink } = this.opts;
    const options: ApplyDeltasOptions = attempt.expectTarget
      ? { batchId: attempt.batchId, expectTarget: attempt.expectTarget }
      : { batchId: attempt.batchId };
    this.inFlight = sink
      .applyEngagementDeltas(userId, contentItemId, attempt.deltas, options)
      .then(() => {
        // Only what this write carried is confirmed; fractions and newer progress stay pending.
        this.sent = this.afterBatch(attempt.deltas);
        this.retryBatch = null;
        this.setStatus('saved');
      })
      .catch((error) => {
        const target = attemptedTargetOf(error);
        // An uncertain write may have committed: remember what it tried to write so the retry can be skipped.
        this.retryBatch = {
          deltas: attempt.deltas,
          batchId: attempt.batchId,
          expectTarget: target ?? attempt.expectTarget,
        };
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

  /** Try again now (the UI's retry button). */
  retry(): Promise<void> {
    return this.flush();
  }

  /**
   * Stop recording and drain: wait for every queued write (including a
   * follow-up chained behind the one in flight), then write whatever is still
   * unconfirmed (the frozen retry batch first, then newer progress), one
   * attempt each. Resolves when all have settled or at the first failure,
   * which is reported through onStatus and not retried again.
   */
  async dispose(): Promise<void> {
    this.disposed = true;
    await this.settle();
    while (this.hasPending) {
      await this.flush();
      await this.settle();
      if (this.status === 'error') break;
    }
  }

  private async settle(): Promise<void> {
    while (this.inFlight) await this.inFlight;
  }

  private afterBatch(deltas: EngagementDeltas) {
    return {
      played: this.sent.played + (deltas.watchTimeDelta ?? 0),
      play: this.sent.play + (deltas.playCountDelta ?? 0),
      pause: this.sent.pause + (deltas.pauseCountDelta ?? 0),
      seek: this.sent.seek + (deltas.seekCountDelta ?? 0),
    };
  }

  private setStatus(status: ReportStatus, error?: unknown) {
    this.status = status;
    this.opts.onStatus?.(status, error);
  }

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }
}
