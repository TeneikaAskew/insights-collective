// ABOUTME: Pure watch-progress tracker: turns player events into watched intervals and counters.
// ABOUTME: Seeks never count as watched time; rewatching counts toward played time, not coverage.

/** Events a provider adapter reports. Positions and durations are in seconds. */
export type PlaybackEvent =
  | { type: 'ready'; duration?: number | null }
  | { type: 'play'; position?: number | null }
  | { type: 'pause'; position?: number | null }
  | { type: 'timeupdate'; position: number; duration?: number | null }
  | { type: 'seeked'; position: number }
  | { type: 'ended'; position?: number | null }
  | { type: 'ratechange'; rate: number };

export interface WatchSnapshot {
  /** Last observed playhead position. */
  positionSeconds: number;
  /** Provider-reported duration, or null while unknown. */
  durationSeconds: number | null;
  /** Union of distinct seconds actually played (no seeks, no double counting). */
  coveredSeconds: number;
  /** Seconds of continuous playback including rewatches (the watch_time column's meaning). */
  playedSeconds: number;
  /** coveredSeconds / duration as 0-100, or null when duration is unknown. */
  coveragePercent: number | null;
  playCount: number;
  pauseCount: number;
  seekCount: number;
  playbackRate: number;
  playing: boolean;
  ended: boolean;
}

export interface WatchTrackerOptions {
  /**
   * Slack for coarse or jittery provider ticks. Watched time is paid from a
   * budget that only grows with wall time while playing (elapsed x rate); at
   * most this much unspent budget carries between ticks, so it is a one-off
   * allowance, not a per-event one. A forward jump the budget cannot cover is
   * not credited, and one larger than this slack is counted as a seek.
   */
  jumpToleranceSeconds?: number;
  /** Clock for wall time, injectable for tests. */
  now?: () => number;
}

type Interval = [number, number];

function mergeInterval(intervals: Interval[], next: Interval): Interval[] {
  const all = [...intervals, next].sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const [s, e] of all) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export class WatchProgressTracker {
  private intervals: Interval[] = [];
  private played = 0;
  private position = 0;
  private duration: number | null = null;
  private rate = 1;
  private isPlaying = false;
  private hasEnded = false;
  private lastTickAt: number | null = null;
  /** Seconds of playback that wall time has paid for and that have not been credited yet. */
  private budget = 0;
  private counts = { play: 0, pause: 0, seek: 0 };
  private readonly tolerance: number;
  private readonly now: () => number;

  constructor(options: WatchTrackerOptions = {}) {
    this.tolerance = options.jumpToleranceSeconds ?? 1.5;
    this.now = options.now ?? (() => Date.now());
  }

  handle(event: PlaybackEvent): void {
    switch (event.type) {
      case 'ready':
        this.setDuration(event.duration);
        return;
      case 'ratechange':
        // Settle the time played at the old rate before switching.
        if (this.isPlaying) this.accrue();
        if (finite(event.rate) && event.rate > 0) this.rate = event.rate;
        return;
      case 'play':
        if (this.isPlaying) {
          // A repeated play report is a progress tick, not a new play.
          this.advance(event.position);
          return;
        }
        this.counts.play += 1;
        this.isPlaying = true;
        this.hasEnded = false;
        this.moveTo(event.position, false);
        this.lastTickAt = this.now();
        this.budget = this.tolerance;
        return;
      case 'pause':
        // Pauses while not playing (before any play, or repeated) earn nothing and count nothing.
        if (!this.isPlaying) {
          this.moveTo(event.position, false);
          return;
        }
        this.advance(event.position);
        this.counts.pause += 1;
        this.stop();
        return;
      case 'timeupdate':
        this.setDuration(event.duration);
        if (this.isPlaying) this.advance(event.position);
        else this.moveTo(event.position, false);
        return;
      case 'seeked':
        if (this.isPlaying) this.accrue();
        this.moveTo(event.position, true);
        return;
      case 'ended':
        if (this.isPlaying) this.advance(event.position);
        else this.moveTo(event.position, false);
        this.stop();
        this.hasEnded = true;
        return;
    }
  }

  snapshot(): WatchSnapshot {
    const covered = this.intervals.reduce((sum, [s, e]) => sum + (e - s), 0);
    const coveragePercent =
      this.duration && this.duration > 0 ? Math.min(100, (covered / this.duration) * 100) : null;
    return {
      positionSeconds: this.position,
      durationSeconds: this.duration,
      coveredSeconds: covered,
      playedSeconds: this.played,
      coveragePercent,
      playCount: this.counts.play,
      pauseCount: this.counts.pause,
      seekCount: this.counts.seek,
      playbackRate: this.rate,
      playing: this.isPlaying,
      ended: this.hasEnded,
    };
  }

  private setDuration(duration: number | null | undefined) {
    if (finite(duration) && duration > 0) this.duration = duration;
  }

  private clamp(position: number): number {
    const p = Math.max(0, position);
    return this.duration ? Math.min(p, this.duration) : p;
  }

  /** Jump without crediting time. Counts a seek only when asked and the jump is real. */
  private moveTo(position: number | null | undefined, isSeek: boolean) {
    if (!finite(position)) return;
    const next = this.clamp(position);
    if (isSeek && Math.abs(next - this.position) > 0.25) this.counts.seek += 1;
    this.position = next;
  }

  private stop() {
    this.isPlaying = false;
    this.lastTickAt = null;
    this.budget = 0;
  }

  /** Add the wall time since the last tick to the budget; unspent budget carries over only up to the slack. */
  private accrue() {
    const at = this.now();
    const elapsed = this.lastTickAt === null ? 0 : Math.max(0, (at - this.lastTickAt) / 1000);
    this.budget = Math.min(this.budget, this.tolerance) + elapsed * this.rate;
    this.lastTickAt = at;
  }

  /** Credit playback from the last position to `position`, paid from the wall-time budget. Only called while playing. */
  private advance(position: number | null | undefined) {
    if (!finite(position)) return;
    this.accrue();
    const next = this.clamp(position);
    const delta = next - this.position;

    if (delta > 0 && delta <= this.budget) {
      this.intervals = mergeInterval(this.intervals, [this.position, next]);
      this.played += delta;
      this.budget -= delta;
    } else if (Math.abs(delta) > this.tolerance) {
      // A forward jump faster than real time, or any backward jump, is a seek.
      this.counts.seek += 1;
    }
    this.position = next;
  }
}
