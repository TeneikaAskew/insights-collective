// ABOUTME: YouTube/Vimeo iframe event adapters over window.postMessage (no provider scripts loaded).
// ABOUTME: Strict origin + source-window checks; protocol shapes are UNVERIFIED against live providers.

import type { PlaybackEvent } from './watchProgress';

export type Emit = (event: PlaybackEvent) => void;

export interface ProviderAdapter {
  /** Origin the provider frame posts from; messages from anything else are ignored. */
  readonly origin: string;
  /** Frame src with the provider's JS-API switch added (input is a validated canonical embed URL). */
  frameSrc(canonicalEmbedUrl: string, pageOrigin: string): string;
  /** Start listening for one iframe. Returns a detach function. Call after the frame has loaded. */
  attach(frame: HTMLIFrameElement, emit: Emit): () => void;
}

function parseData(data: unknown): Record<string, any> | null {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, any>) : null;
}

const num = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null);
const numLike = (n: unknown): number | null => num(typeof n === 'string' ? Number(n) : n);

function listen(frame: HTMLIFrameElement, origin: string, onData: (data: Record<string, any>) => void) {
  const handler = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    if (!frame.contentWindow || event.source !== frame.contentWindow) return;
    const data = parseData(event.data);
    if (data) onData(data);
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

/**
 * YouTube IFrame Player postMessage protocol (no iframe_api script):
 * src carries enablejsapi=1&origin=<page origin>; the page posts
 * {event:'listening'} and the player answers with onReady / infoDelivery /
 * onStateChange messages. playerState: 1 playing, 2 paused, 0 ended.
 */
const YOUTUBE_ORIGIN = 'https://www.youtube.com';
const VIMEO_ORIGIN = 'https://player.vimeo.com';

export const youtubeAdapter: ProviderAdapter = {
  origin: YOUTUBE_ORIGIN,
  frameSrc(canonical, pageOrigin) {
    const url = new URL(canonical);
    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('origin', pageOrigin);
    return url.toString();
  },
  attach(frame, emit) {
    let state: number | null = null;
    let lastTime = 0;
    const applyState = (next: number) => {
      if (next === state) return;
      state = next;
      if (next === 1) emit({ type: 'play', position: lastTime });
      else if (next === 2) emit({ type: 'pause', position: lastTime });
      else if (next === 0) emit({ type: 'ended', position: lastTime });
    };
    const detach = listen(frame, YOUTUBE_ORIGIN, (data) => {
      if (data.event === 'onReady') {
        emit({ type: 'ready' });
        return;
      }
      if (data.event === 'onStateChange') {
        const next = num(data.info);
        if (next !== null) applyState(next);
        return;
      }
      if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
        const info = data.info;
        const rate = num(info.playbackRate);
        if (rate !== null) emit({ type: 'ratechange', rate });
        const duration = num(info.duration);
        const time = num(info.currentTime);
        if (time !== null) {
          lastTime = time;
          emit({ type: 'timeupdate', position: time, duration });
        } else if (duration !== null) {
          emit({ type: 'ready', duration });
        }
        const next = num(info.playerState);
        if (next !== null) applyState(next);
      }
    });
    frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'ic-video', channel: 'widget' }), YOUTUBE_ORIGIN);
    return detach;
  },
};

const VIMEO_EVENTS = ['play', 'pause', 'ended', 'timeupdate', 'seeked', 'playbackratechange'] as const;

/**
 * Vimeo Player postMessage API (no player.js script): after the player posts
 * {event:'ready'}, the page sends {method:'addEventListener', value:<event>}
 * for each event and receives {event, data:{seconds, duration, percent}}.
 */
export const vimeoAdapter: ProviderAdapter = {
  origin: VIMEO_ORIGIN,
  frameSrc(canonical) {
    return canonical;
  },
  attach(frame, emit) {
    const post = (message: Record<string, unknown>) =>
      frame.contentWindow?.postMessage(JSON.stringify(message), VIMEO_ORIGIN);
    const subscribe = () => VIMEO_EVENTS.forEach((value) => post({ method: 'addEventListener', value }));
    const detach = listen(frame, VIMEO_ORIGIN, (data) => {
      const payload = data.data && typeof data.data === 'object' ? data.data : {};
      const seconds = numLike(payload.seconds);
      const duration = numLike(payload.duration);
      switch (data.event) {
        case 'ready':
          subscribe();
          emit({ type: 'ready', duration });
          return;
        case 'play':
          emit({ type: 'play', position: seconds ?? 0 });
          return;
        case 'pause':
          emit({ type: 'pause', position: seconds ?? 0 });
          return;
        case 'ended':
          emit({ type: 'ended', position: seconds ?? duration ?? 0 });
          return;
        case 'timeupdate':
          if (seconds !== null) emit({ type: 'timeupdate', position: seconds, duration });
          return;
        case 'seeked':
          if (seconds !== null) emit({ type: 'seeked', position: seconds });
          return;
        case 'playbackratechange': {
          const rate = numLike(payload.playbackRate);
          if (rate !== null) emit({ type: 'ratechange', rate });
          return;
        }
      }
    });
    // If the player was ready before we attached, this subscribes immediately.
    subscribe();
    return detach;
  },
};

export function adapterFor(provider: 'youtube' | 'vimeo'): ProviderAdapter {
  return provider === 'youtube' ? youtubeAdapter : vimeoAdapter;
}
