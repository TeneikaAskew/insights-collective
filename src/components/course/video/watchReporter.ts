// ABOUTME: Batches WatchProgressTracker output into videoAnalyticsService.applyEngagementDeltas writes.
// ABOUTME: Never marks completion; sends coverage percent only when explicitly enabled.

import type {
  ApplyDeltasOptions,
  EngagementDeltas,
  EngagementTotals,
  KeyedEngagementBatch,
} from '@/services/videoAnalyticsService';
import { WatchProgressTracker, type PlaybackEvent, type WatchSnapshot } from './watchProgress';

/** The one service method the reporter needs; the real default is videoAnalyticsService. */
export interface EngagementSink {
  applyEngagementDeltas(
    userId: string,
    contentItemId: string,
    deltas: EngagementDeltas,
    options?: ApplyDeltasOptions,
  ): Promise<unknown>;
  /** Keyed apply-once path (PROPOSAL; see docs/lms/wp09-r3-idempotency.md). Required only in 'keyed' mode. */
  applyEngagementBatch?(userId: string, contentItemId: string, batch: KeyedEngagementBatch): Promise<unknown>;
}

/** 'cas' is the c5b7caf contract (default). 'keyed' needs the proposed RPC, which is not deployed anywhere. */
export type PersistenceMode = 'cas' | 'keyed';

const randomSessionId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

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
  /**
   * Fixed for the reporter's lifetime. A batch first sent keyed is only ever
   * retried keyed (never re-routed to the CAS path), because its outcome can
   * only be resolved by the server's (session, seq) marker.
   */
  persistence?: PersistenceMode;
  /** Keyed mode: one id per reporter instance; defaults to crypto.randomUUID(). */
  makeSessionId?: () => string;
}

/** Duck-typed EngagementWriteUncertainError: the write may have committed; it carries what it tried to write. */
function attemptedTargetOf(error: unknown): EngagementTotals | null {
  if (error && typeof error === 'object' && 'attemptedTarget' in error) {
    const target = (error as { attemptedTarget: unknown }).attemptedTarget;
    if (target && typeof target === 'object') return target as EngagementTotals;
  }
  return null;
}

interface Batch {
  /** Keyed mode: the seq this batch was first sent with; retries reuse it. Null in CAS mode. */
  seq: number | null;
  deltas: EngagementDeltas;
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
 * What this does NOT guarantee: an uncertain write that committed and was
 * then changed by another writer before the retry is applied twice; see
 * applyEngagementDeltas. An atomic increment alone would not fix that; it
 * needs durable idempotency/dedup or equivalent reconciliation (out of scope).
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
  /** Set when the signed-in learner no longer matches userId: nothing is ever sent again. */
  private retired = false;
  private lastSeq = 0;
  readonly persistence: PersistenceMode;
  /** Keyed mode only; null in CAS mode. */
  readonly sessionId: string | null;

  constructor(options: WatchReporterOptions) {
    this.opts = { flushIntervalMs: 15000, reportCoveragePercent: false, ...options };
    this.tracker = options.tracker ?? new WatchProgressTracker({ now: options.now });
    this.lastFlushAt = this.now();
    this.persistence = options.persistence ?? 'cas';
    this.sessionId = this.persistence === 'keyed' ? (options.makeSessionId ?? randomSessionId)() : null;
  }

  get isRetired(): boolean {
    return this.retired;
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
    if (this.retired) return false;
    return this.retryBatch !== null || this.pendingUpdate() !== null;
  }

  /** Write the frozen retry batch if there is one, else whatever is new. */
  flush(): Promise<void> {
    if (this.retired) return Promise.resolve();
    if (this.inFlight) {
      this.flushAgain = true;
      return this.inFlight;
    }
    // Later progress is held until the frozen batch is acknowledged.
    let batch = this.retryBatch;
    if (!batch) {
      const deltas = this.pendingUpdate();
      if (!deltas) return Promise.resolve();
      batch = { seq: this.persistence === 'keyed' ? ++this.lastSeq : null, deltas, expectTarget: null };
    }
    const attempt = batch;

    this.lastFlushAt = this.now();
    this.setStatus('saving');
    this.inFlight = this.send(attempt)
      .then(() => {
        // Only what this write carried is confirmed; fractions and newer progress stay pending.
        this.sent = this.afterBatch(attempt.deltas);
        this.retryBatch = null;
        this.setStatus('saved');
      })
      .catch((error) => {
        if ((error as { name?: string } | null)?.name === 'EngagementIdentityMismatchError') {
          // Recorded for a learner who is no longer signed in: drop it, never replay it under anyone else.
          this.retired = true;
          this.disposed = true;
          this.retryBatch = null;
          this.setStatus('error', error);
          return;
        }
        const target = attemptedTargetOf(error);
        // An uncertain write may have committed: remember what it tried to write so the retry can be skipped.
        this.retryBatch = { seq: attempt.seq, deltas: attempt.deltas, expectTarget: target ?? attempt.expectTarget };
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

  private send(attempt: Batch): Promise<unknown> {
    const { userId, contentItemId, sink } = this.opts;
    if (this.persistence === 'keyed') {
      if (!sink.applyEngagementBatch) {
        return Promise.reject(new Error('Keyed persistence is not available; the batch stays queued (never re-routed to CAS)'));
      }
      return sink.applyEngagementBatch(userId, contentItemId, {
        sessionId: this.sessionId as string,
        seq: attempt.seq as number,
        deltas: attempt.deltas,
      });
    }
    const options: ApplyDeltasOptions = attempt.expectTarget ? { expectTarget: attempt.expectTarget } : {};
    return sink.applyEngagementDeltas(userId, contentItemId, attempt.deltas, options);
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
