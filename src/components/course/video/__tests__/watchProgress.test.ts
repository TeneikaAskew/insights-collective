// ABOUTME: Unit tests for WatchProgressTracker: credited playback, seeks, rewatch and coverage.

import { describe, expect, it } from 'vitest';
import { WatchProgressTracker } from '../watchProgress';

function clockTracker() {
  let t = 0;
  const tracker = new WatchProgressTracker({ now: () => t });
  return { tracker, tick: (seconds: number) => { t += seconds * 1000; } };
}

describe('WatchProgressTracker', () => {
  it('credits continuous playback and reports coverage once duration is known', () => {
    const { tracker, tick } = clockTracker();
    tracker.handle({ type: 'ready', duration: 100 });
    tracker.handle({ type: 'play', position: 0 });
    for (let s = 1; s <= 10; s++) { tick(1); tracker.handle({ type: 'timeupdate', position: s }); }
    tracker.handle({ type: 'pause', position: 10 });
    const snap = tracker.snapshot();
    expect(snap.coveredSeconds).toBe(10);
    expect(snap.playedSeconds).toBe(10);
    expect(snap.coveragePercent).toBe(10);
    expect(snap).toMatchObject({ playCount: 1, pauseCount: 1, seekCount: 0, playing: false, positionSeconds: 10 });
  });

  it('never credits a forward seek as watched time', () => {
    const { tracker, tick } = clockTracker();
    tracker.handle({ type: 'ready', duration: 100 });
    tracker.handle({ type: 'play', position: 0 });
    tick(1); tracker.handle({ type: 'timeupdate', position: 1 });
    tick(1); tracker.handle({ type: 'timeupdate', position: 95 }); // scrubbed to the end
    tick(1); tracker.handle({ type: 'timeupdate', position: 96 });
    const snap = tracker.snapshot();
    expect(snap.coveredSeconds).toBe(2);
    expect(snap.seekCount).toBe(1);
    expect(snap.coveragePercent).toBe(2);
  });

  it('counts an explicit seeked event once even when a jumped timeupdate follows', () => {
    const { tracker, tick } = clockTracker();
    tracker.handle({ type: 'play', position: 0 });
    tick(1); tracker.handle({ type: 'seeked', position: 60 });
    tick(1); tracker.handle({ type: 'timeupdate', position: 61 });
    expect(tracker.snapshot()).toMatchObject({ seekCount: 1, coveredSeconds: 1 });
  });

  it('rewatching adds played time but not coverage', () => {
    const { tracker, tick } = clockTracker();
    tracker.handle({ type: 'ready', duration: 20 });
    tracker.handle({ type: 'play', position: 0 });
    for (let s = 1; s <= 5; s++) { tick(1); tracker.handle({ type: 'timeupdate', position: s }); }
    tracker.handle({ type: 'seeked', position: 0 });
    for (let s = 1; s <= 5; s++) { tick(1); tracker.handle({ type: 'timeupdate', position: s }); }
    const snap = tracker.snapshot();
    expect(snap.coveredSeconds).toBe(5);
    expect(snap.playedSeconds).toBe(10);
    expect(snap.coveragePercent).toBe(25);
  });

  it('does not credit time while paused, and a repeated play event is one play', () => {
    const { tracker, tick } = clockTracker();
    tracker.handle({ type: 'play', position: 0 });
    tracker.handle({ type: 'play', position: 0 });
    tick(1); tracker.handle({ type: 'pause', position: 1 });
    tick(30); tracker.handle({ type: 'timeupdate', position: 31 });
    expect(tracker.snapshot()).toMatchObject({ playCount: 1, coveredSeconds: 1, positionSeconds: 31 });
  });

  it('scales the plausibility window by playback rate', () => {
    const { tracker, tick } = clockTracker();
    tracker.handle({ type: 'ratechange', rate: 2 });
    tracker.handle({ type: 'play', position: 0 });
    tick(1); tracker.handle({ type: 'timeupdate', position: 2 });
    tick(1); tracker.handle({ type: 'timeupdate', position: 4 });
    expect(tracker.snapshot()).toMatchObject({ coveredSeconds: 4, seekCount: 0, playbackRate: 2 });
  });

  it('reports unknown coverage while duration is unknown and ignores non-finite input', () => {
    const { tracker, tick } = clockTracker();
    tracker.handle({ type: 'play', position: 0 });
    tick(1); tracker.handle({ type: 'timeupdate', position: Number.NaN });
    tick(1); tracker.handle({ type: 'timeupdate', position: 2 });
    const snap = tracker.snapshot();
    expect(snap.coveragePercent).toBeNull();
    expect(snap.durationSeconds).toBeNull();
    expect(snap.coveredSeconds).toBe(2);
  });

  it('marks ended and clamps to duration', () => {
    const { tracker, tick } = clockTracker();
    tracker.handle({ type: 'ready', duration: 3 });
    tracker.handle({ type: 'play', position: 0 });
    tick(1); tracker.handle({ type: 'timeupdate', position: 1 });
    tick(1); tracker.handle({ type: 'timeupdate', position: 2 });
    tick(1); tracker.handle({ type: 'ended', position: 3.4 });
    expect(tracker.snapshot()).toMatchObject({ ended: true, playing: false, coveredSeconds: 3, coveragePercent: 100 });
  });

  // Review R1 (#164 4c6544a): credit only while playing, from a cumulative wall-time budget.
  describe('R1 credit bounds', () => {
    it('credits nothing for a pause or ended report before any play', () => {
      const { tracker, tick } = clockTracker();
      tracker.handle({ type: 'ready', duration: 100 });
      tracker.handle({ type: 'pause', position: 1.4 });
      tick(5);
      tracker.handle({ type: 'ended', position: 2.8 });
      expect(tracker.snapshot()).toMatchObject({ playedSeconds: 0, coveredSeconds: 0, pauseCount: 0, playCount: 0 });
    });

    it('credits nothing for repeated pause reports after the first', () => {
      const { tracker, tick } = clockTracker();
      tracker.handle({ type: 'ready', duration: 100 });
      tracker.handle({ type: 'play', position: 0 });
      tick(1);
      tracker.handle({ type: 'pause', position: 1 });
      for (let p = 2.4; p < 60; p += 1.4) tracker.handle({ type: 'pause', position: p });
      expect(tracker.snapshot()).toMatchObject({ playedSeconds: 1, coveredSeconds: 1, pauseCount: 1 });
    });

    it('does not let rapid small jumps with no wall time earn the whole video', () => {
      const { tracker } = clockTracker();
      tracker.handle({ type: 'ready', duration: 100 });
      tracker.handle({ type: 'play', position: 0 });
      for (let p = 1.4; p <= 100; p += 1.4) tracker.handle({ type: 'timeupdate', position: p });
      const snap = tracker.snapshot();
      expect(snap.playedSeconds).toBeLessThanOrEqual(1.5);
      expect(snap.coveredSeconds).toBeLessThanOrEqual(1.5);
    });

    it('never credits more than the wall time played (times rate) plus one slack', () => {
      const { tracker, tick } = clockTracker();
      tracker.handle({ type: 'ready', duration: 600 });
      tracker.handle({ type: 'play', position: 0 });
      // Each tick claims 1.4 s of video per 1 s of wall time, at rate 1.
      for (let i = 1; i <= 100; i++) { tick(1); tracker.handle({ type: 'timeupdate', position: i * 1.4 }); }
      const { playedSeconds } = tracker.snapshot();
      expect(playedSeconds).toBeLessThanOrEqual(100 + 1.5);
    });

    // Recheck residual on 0b9ce25: each play refilled the slack and each stop discarded the budget.
    it('keeps the slack cumulative across repeated play/pause with no wall time', () => {
      const { tracker } = clockTracker();
      tracker.handle({ type: 'ready', duration: 100 });
      for (let p = 0; p < 60; p += 1) {
        tracker.handle({ type: 'play', position: p });
        tracker.handle({ type: 'pause', position: p + 1 });
      }
      const snap = tracker.snapshot();
      expect(snap.playedSeconds).toBeLessThanOrEqual(1.5);
      expect(snap.coveredSeconds).toBeLessThanOrEqual(1.5);
      expect(snap.playCount).toBe(60);
    });

    it('keeps the slack cumulative across play/ended/play cycles with no wall time', () => {
      const { tracker } = clockTracker();
      tracker.handle({ type: 'ready', duration: 100 });
      for (let p = 0; p < 30; p += 1) {
        tracker.handle({ type: 'play', position: p });
        tracker.handle({ type: 'timeupdate', position: p + 0.5 });
        tracker.handle({ type: 'ended', position: p + 1 });
      }
      expect(tracker.snapshot().playedSeconds).toBeLessThanOrEqual(1.5);
    });

    it('scales the budget by playback rate', () => {
      const { tracker, tick } = clockTracker();
      tracker.handle({ type: 'ready', duration: 600 });
      tracker.handle({ type: 'ratechange', rate: 2 });
      tracker.handle({ type: 'play', position: 0 });
      for (let i = 1; i <= 10; i++) { tick(1); tracker.handle({ type: 'timeupdate', position: i * 2 }); }
      expect(tracker.snapshot().playedSeconds).toBe(20);
    });
  });
});
