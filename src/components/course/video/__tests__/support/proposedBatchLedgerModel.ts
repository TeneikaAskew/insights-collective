// ABOUTME: In-memory MODEL of the PROPOSED R3 contract (docs/lms/wp09-r3-idempotency.md): keyed apply-once batches.
// ABOUTME: Not product code and not SQL. One applyBatch call = one transaction; per-session high-water mark dedups.

export interface BatchDeltas {
  watch_time: number;
  play_count: number;
  pause_count: number;
  seek_count: number;
}

export interface BatchKey {
  userId: string;
  contentItemId: string;
  /** Random per reporter instance (one tracked viewing); a remount or another tab is a new session. */
  sessionId: string;
  /** Strictly increasing within a session; a retry reuses the seq of the batch it retries. */
  seq: number;
}

export type ModelOp = { kind: 'apply'; key: BatchKey };

export class ProposedBatchLedgerModel {
  readonly analytics = new Map<string, BatchDeltas>();
  /** video_engagement_sessions.last_seq in the proposal. */
  readonly highWater = new Map<string, number>();
  before: null | ((op: ModelOp) => Promise<void> | void) = null;
  failBeforeCommit: null | ((op: ModelOp) => boolean) = null;
  failAfterCommit: null | ((op: ModelOp) => boolean) = null;

  row(userId: string, contentItemId: string): BatchDeltas | undefined {
    return this.analytics.get(`${userId}|${contentItemId}`);
  }

  /** Mirrors the proposed apply_video_engagement_batch RPC: atomic, apply-once per (session, seq). */
  async applyBatch(key: BatchKey, deltas: BatchDeltas): Promise<{ applied: boolean; totals: BatchDeltas }> {
    const op: ModelOp = { kind: 'apply', key };
    if (this.before) await this.before(op);
    if (this.failBeforeCommit?.(op)) throw new Error('Failed to fetch (never committed)');
    // ---- one transaction, no await inside ----
    const sessionKey = `${key.userId}|${key.contentItemId}|${key.sessionId}`;
    const rowKey = `${key.userId}|${key.contentItemId}`;
    const hwm = this.highWater.get(sessionKey) ?? 0;
    let applied = false;
    if (key.seq > hwm) {
      this.highWater.set(sessionKey, key.seq);
      const cur = this.analytics.get(rowKey) ?? { watch_time: 0, play_count: 0, pause_count: 0, seek_count: 0 };
      this.analytics.set(rowKey, {
        watch_time: cur.watch_time + deltas.watch_time,
        play_count: cur.play_count + deltas.play_count,
        pause_count: cur.pause_count + deltas.pause_count,
        seek_count: cur.seek_count + deltas.seek_count,
      });
      applied = true;
    }
    const totals = { ...this.analytics.get(rowKey)! };
    // ---- commit ----
    if (this.failAfterCommit?.(op)) throw new Error('Failed to fetch (response lost)');
    return { applied, totals };
  }
}

/** Client side of the proposed contract: the reporter's frozen-batch rule plus a (sessionId, seq) key. */
export class KeyedWriterModel {
  private seq = 0;
  private frozen: { seq: number; deltas: BatchDeltas } | null = null;
  constructor(
    private readonly server: ProposedBatchLedgerModel,
    private readonly userId: string,
    private readonly contentItemId: string,
    readonly sessionId: string,
  ) {}

  /** Send a new batch, or the frozen one if a previous attempt failed (same seq). */
  async submit(deltas?: BatchDeltas): Promise<'saved' | 'error'> {
    if (!this.frozen) {
      if (!deltas) return 'saved';
      this.seq += 1;
      this.frozen = { seq: this.seq, deltas };
    }
    const { seq, deltas: d } = this.frozen;
    try {
      await this.server.applyBatch({ userId: this.userId, contentItemId: this.contentItemId, sessionId: this.sessionId, seq }, d);
      this.frozen = null;
      return 'saved';
    } catch {
      return 'error';
    }
  }

  retry() {
    return this.submit();
  }
}
