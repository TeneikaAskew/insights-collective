// ABOUTME: Adapter tests with simulated provider postMessage traffic (jsdom; no provider network).
// ABOUTME: Message shapes follow the providers' documented protocols; live behaviour is UNVERIFIED.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { vimeoAdapter, youtubeAdapter } from '../providerAdapters';
import type { PlaybackEvent } from '../watchProgress';

const frames: HTMLIFrameElement[] = [];
const YT_FRAME = 'https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1';
const VIMEO_FRAME = 'https://player.vimeo.com/video/76979871';
function makeFrame(src = YT_FRAME) {
  const frame = document.createElement('iframe');
  frame.src = src;
  document.body.appendChild(frame);
  frames.push(frame);
  return frame;
}
afterEach(() => { while (frames.length) frames.pop()!.remove(); });

function post(frame: HTMLIFrameElement, origin: string, data: unknown, source: Window | null = frame.contentWindow) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
}

describe('youtubeAdapter', () => {
  it('adds the JS API switch and page origin to the canonical embed URL', () => {
    expect(youtubeAdapter.frameSrc('https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://app.example')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1&origin=https%3A%2F%2Fapp.example',
    );
  });

  it('sends the listening handshake and maps infoDelivery/state changes to events', () => {
    const frame = makeFrame();
    const sent = vi.spyOn(frame.contentWindow!, 'postMessage');
    const events: PlaybackEvent[] = [];
    const detach = youtubeAdapter.attach(frame, (e) => events.push(e));
    expect(sent).toHaveBeenCalledWith(expect.stringContaining('"event":"listening"'), 'https://www.youtube.com');

    const o = 'https://www.youtube.com';
    post(frame, o, JSON.stringify({ event: 'onReady' }));
    post(frame, o, JSON.stringify({ event: 'infoDelivery', info: { duration: 212, currentTime: 0, playbackRate: 1 } }));
    post(frame, o, JSON.stringify({ event: 'onStateChange', info: 1 }));
    post(frame, o, JSON.stringify({ event: 'infoDelivery', info: { currentTime: 3.5 } }));
    post(frame, o, JSON.stringify({ event: 'infoDelivery', info: { playerState: 2, currentTime: 4 } }));
    post(frame, o, JSON.stringify({ event: 'onStateChange', info: 0 }));
    detach();
    post(frame, o, JSON.stringify({ event: 'onStateChange', info: 1 }));

    expect(events).toEqual([
      { type: 'ready' },
      { type: 'ratechange', rate: 1 },
      { type: 'timeupdate', position: 0, duration: 212 },
      { type: 'play', position: 0 },
      { type: 'timeupdate', position: 3.5, duration: null },
      { type: 'timeupdate', position: 4, duration: null },
      { type: 'pause', position: 4 },
      { type: 'ended', position: 4 },
    ]);
  });

  it('ignores messages from other origins, other windows and malformed payloads', () => {
    const frame = makeFrame();
    const other = makeFrame();
    const events: PlaybackEvent[] = [];
    youtubeAdapter.attach(frame, (e) => events.push(e));
    post(frame, 'https://evil.example', JSON.stringify({ event: 'onStateChange', info: 1 }));
    post(frame, 'https://www.youtube.com', JSON.stringify({ event: 'onStateChange', info: 1 }), other.contentWindow);
    post(frame, 'https://www.youtube-nocookie.com', JSON.stringify({ event: 'onStateChange', info: 1 }));
    post(frame, 'https://www.youtube.com', '{not json');
    post(frame, 'https://www.youtube.com', JSON.stringify({ event: 'infoDelivery', info: { currentTime: 'x' } }));
    expect(events).toEqual([]);
  });

  it('listens to the frame\'s own privacy-enhanced origin, and only to it', () => {
    const frame = makeFrame('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&enablejsapi=1');
    const sent = vi.spyOn(frame.contentWindow!, 'postMessage');
    const events: PlaybackEvent[] = [];
    youtubeAdapter.attach(frame, (e) => events.push(e));
    expect(sent).toHaveBeenCalledWith(expect.stringContaining('"event":"listening"'), 'https://www.youtube-nocookie.com');
    post(frame, 'https://www.youtube.com', JSON.stringify({ event: 'onStateChange', info: 1 }));
    expect(events).toEqual([]);
    post(frame, 'https://www.youtube-nocookie.com', JSON.stringify({ event: 'onStateChange', info: 1 }));
    expect(events).toEqual([{ type: 'play', position: null }]);
  });

  it('keeps the stored embed URL and its params, adding only the JS API switch', () => {
    expect(
      youtubeAdapter.frameSrc('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=30', 'https://app.example'),
    ).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=30&enablejsapi=1&origin=https%3A%2F%2Fapp.example');
  });

  it('attaches nothing to a frame outside the allowed provider origins', () => {
    const frame = makeFrame('https://evil.example/embed/x');
    const sent = vi.spyOn(frame.contentWindow!, 'postMessage');
    const events: PlaybackEvent[] = [];
    youtubeAdapter.attach(frame, (e) => events.push(e));
    vimeoAdapter.attach(frame, (e) => events.push(e));
    post(frame, 'https://evil.example', JSON.stringify({ event: 'onStateChange', info: 1 }));
    expect(sent).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});

describe('vimeoAdapter', () => {
  it('keeps the canonical src and subscribes after ready', () => {
    expect(vimeoAdapter.frameSrc('https://player.vimeo.com/video/76979871?h=8272103f6e', 'https://app.example')).toBe(
      'https://player.vimeo.com/video/76979871?h=8272103f6e',
    );
    const frame = makeFrame(VIMEO_FRAME);
    const sent = vi.spyOn(frame.contentWindow!, 'postMessage');
    const events: PlaybackEvent[] = [];
    vimeoAdapter.attach(frame, (e) => events.push(e));
    const o = 'https://player.vimeo.com';
    post(frame, o, { event: 'ready' });
    const subscribed = sent.mock.calls.map(([m]) => JSON.parse(m as string).value);
    expect(subscribed).toEqual(expect.arrayContaining(['play', 'pause', 'ended', 'timeupdate', 'seeked', 'playbackratechange']));

    post(frame, o, JSON.stringify({ event: 'play', data: { seconds: 0, duration: 60 } }));
    post(frame, o, { event: 'timeupdate', data: { seconds: '1.25', duration: '60', percent: 0.02 } });
    post(frame, o, { event: 'seeked', data: { seconds: 30 } });
    post(frame, o, { event: 'playbackratechange', data: { playbackRate: 1.5 } });
    post(frame, o, { event: 'pause', data: { seconds: 31 } });
    post(frame, o, { event: 'ended', data: { duration: 60 } });
    expect(events).toEqual([
      { type: 'ready', duration: null },
      { type: 'play', position: 0 },
      { type: 'timeupdate', position: 1.25, duration: 60 },
      { type: 'seeked', position: 30 },
      { type: 'ratechange', rate: 1.5 },
      { type: 'pause', position: 31 },
      { type: 'ended', position: 60 },
    ]);
  });

  it('ignores messages not from player.vimeo.com and the frame window', () => {
    const frame = makeFrame(VIMEO_FRAME);
    const events: PlaybackEvent[] = [];
    vimeoAdapter.attach(frame, (e) => events.push(e));
    post(frame, 'https://vimeo.com', { event: 'play', data: { seconds: 0 } });
    post(frame, 'https://player.vimeo.com', { event: 'play', data: { seconds: 0 } }, window);
    expect(events).toEqual([]);
  });
});
