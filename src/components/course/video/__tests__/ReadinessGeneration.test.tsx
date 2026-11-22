import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { TrackedVideoPlayer } from '../TrackedVideoPlayer';
import { youtubeAdapter } from '../providerAdapters';
import { WatchReporter, type EngagementSink } from '../watchReporter';
vi.mock('node:child_process', () => {
  const blocked = () => { throw new Error('process launch forbidden'); };
  return { spawn: blocked, spawnSync: blocked, exec: blocked, execSync: blocked, execFile: blocked, execFileSync: blocked, fork: blocked };
});
vi.mock('@/services/videoAnalyticsService', () => ({ default: { applyEngagementDeltas: () => { throw new Error('use fake sink'); } } }));
const A = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
const B = 'https://www.youtube.com/embed/abcdefghijk';
const frame = () => screen.getByTitle('Video') as HTMLIFrameElement;
function pair(target: HTMLIFrameElement, origin = 'https://www.youtube.com', source: MessageEventSource | null = target.contentWindow) {
  for (const info of [1, 2]) window.dispatchEvent(new MessageEvent('message', { origin, source, data: JSON.stringify({ event: 'onStateChange', info }) }));
}
function fixture() {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('network forbidden'); }));
  const write = vi.fn(async (_u: string, _c: string, _data: unknown) => {});
  const sink = { applyEngagementDeltas: write } as EngagementSink;
  return { write, sink };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('never attaches or records at a source-change commit boundary before the new load, including A→B→A', async () => {
  const { write, sink } = fixture();
  let probing = false;
  const attached: string[] = [];
  const record = vi.spyOn(WatchReporter.prototype, 'record');
  const original = youtubeAdapter.attach.bind(youtubeAdapter);
  vi.spyOn(youtubeAdapter, 'attach').mockImplementation((target, emit) => {
    const detach = original(target, emit);
    if (probing) { attached.push(target.src); pair(target); }
    return detach;
  });
  const view = render(<TrackedVideoPlayer src={A} title="Video" userId="u" contentItemId="lesson" sink={sink} />);
  fireEvent.load(frame());
  for (const src of [B, A]) {
    probing = true;
    view.rerender(<TrackedVideoPlayer src={src} title="Video" userId="u" contentItemId="lesson" sink={sink} />);
    probing = false;
    console.info('COMMIT_BOUNDARY', JSON.stringify({ src, attached: [...attached], events: record.mock.calls.map(([event]) => event.type), writes: write.mock.calls.length }));
    expect.soft(attached).toEqual([]);
    expect.soft(write).not.toHaveBeenCalled();
    fireEvent.load(frame());
  }
});
it('rejects late loads/messages from replaced generations and after unmount', async () => {
  const { write, sink } = fixture();
  const record = vi.spyOn(WatchReporter.prototype, 'record');
  const view = render(<TrackedVideoPlayer src={A} title="Video" userId="u" contentItemId="lesson" sink={sink} />);
  const oldA = frame(); const windowA = oldA.contentWindow; fireEvent.load(oldA);
  view.rerender(<TrackedVideoPlayer src={B} title="Video" userId="u" contentItemId="lesson" sink={sink} />);
  const oldB = frame(); const windowB = oldB.contentWindow;
  expect(oldB).not.toBe(oldA);
  fireEvent.load(oldA); act(() => pair(oldA, 'https://www.youtube.com', windowA));
  expect(record).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  fireEvent.load(oldB);
  view.rerender(<TrackedVideoPlayer src={A} title="Video" userId="u" contentItemId="lesson" sink={sink} />);
  const newA = frame(); expect(newA).not.toBe(oldA);
  fireEvent.load(oldA); fireEvent.load(oldB); act(() => { pair(oldA, 'https://www.youtube.com', windowA); pair(oldB, 'https://www.youtube.com', windowB); pair(newA); });
  expect(record).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  fireEvent.load(newA);
  act(() => { pair(oldA, 'https://www.youtube.com', windowA); pair(oldB, 'https://www.youtube.com', windowB); pair(newA, 'https://wrong.example'); pair(newA, 'https://www.youtube.com', window); });
  expect(record).not.toHaveBeenCalled();
  act(() => pair(newA)); await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  expect(write.mock.calls[0][2]).not.toHaveProperty('completionPercentage');
  const currentWindow = newA.contentWindow;
  view.unmount(); const count = record.mock.calls.length;
  fireEvent.load(newA); act(() => pair(newA, 'https://www.youtube.com', currentWindow));
  expect(record).toHaveBeenCalledTimes(count); expect(write).toHaveBeenCalledTimes(1);
});
it.each([false, true])('preserves normal/early load and identity-only rebinding (early=%s)', async early => {
  const { write, sink } = fixture();
  function Boundary({ userId }: { userId: string }) {
    const box = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => { if (early) box.current!.querySelector('iframe')!.dispatchEvent(new Event('load')); }, []);
    return <div ref={box}><TrackedVideoPlayer src={A} title="Video" userId={userId} contentItemId="lesson" sink={sink} /></div>;
  }
  const view = render(<Boundary userId="u" />);
  const original = frame(); if (!early) fireEvent.load(original);
  act(() => pair(original)); await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  view.rerender(<Boundary userId="v" />);
  expect(frame()).toBe(original);
  act(() => pair(original)); await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  expect(write.mock.calls.map(call => call.slice(0, 2))).toEqual([['u', 'lesson'], ['v', 'lesson']]);
});
