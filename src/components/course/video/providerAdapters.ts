// ABOUTME: YouTube/Vimeo iframe event adapters over window.postMessage (no provider scripts loaded).
// ABOUTME: Strict frame-origin + source-window checks; protocol shapes are UNVERIFIED against live providers.

import type { PlaybackEvent } from './watchProgress';

export type Emit = (event: PlaybackEvent) => void;

export interface ProviderAdapter {
  /**
   * Origins a frame of this provider may be loaded from (the CSP frameSrc
   * hosts). Messages are accepted only from the frame's OWN origin, and only
   * when it is one of these.
   */
  readonly origins: readonly string[];
  /**
   * Frame src with the provider's JS-API switch added. The input is the
   * already-resolved frame src (resolveEmbed); everything else in it (host,
   * path, other params, unlisted hash) is kept.
   */
  frameSrc(embedSrc: string, pageOrigin: string): string;
  /** Start listening for one iframe. Returns a detach function. Call after the frame has loaded. */
  attach(frame: HTMLIFrameElement, emit: Emit): () => void;
}

/** The frame's own origin when it is one of `allowed`, else null (then nothing is listened to). */
export function frameOrigin(frame: HTMLIFrameElement, allowed: readonly string[]): string | null {
  try {
    const origin = new URL(frame.src).origin;
    return allowed.includes(origin) ? origin : null;
  } catch {
    return null;
  }
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
const YOUTUBE_ORIGINS = ['https://www.youtube.com', 'https://youtube.com', 'https://www.youtube-nocookie.com'] as const;
const VIMEO_ORIGINS = ['https://player.vimeo.com'] as const;

export const youtubeAdapter: ProviderAdapter = {
  origins: YOUTUBE_ORIGINS,
  frameSrc(embedSrc, pageOrigin) {
    const url = new URL(embedSrc);
    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('origin', pageOrigin);
    return url.toString();
  },
  attach(frame, emit) {
    const origin = frameOrigin(frame, YOUTUBE_ORIGINS);
    if (!origin) return () => {};
    let state: number | null = null;
    // Unknown until the player reports a time; never guessed as 0.
    let lastTime: number | null = null;
    const applyState = (next: number) => {
      if (next === state) return;
      state = next;
      if (next === 1) emit({ type: 'play', position: lastTime });
      else if (next === 2) emit({ type: 'pause', position: lastTime });
      else if (next === 0) emit({ type: 'ended', position: lastTime });
    };
    const detach = listen(frame, origin, (data) => {
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
    frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'ic-video', channel: 'widget' }), origin);
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
  origins: VIMEO_ORIGINS,
  frameSrc(embedSrc) {
    return embedSrc;
  },
  attach(frame, emit) {
    const origin = frameOrigin(frame, VIMEO_ORIGINS);
    if (!origin) return () => {};
    const post = (message: Record<string, unknown>) =>
      frame.contentWindow?.postMessage(JSON.stringify(message), origin);
    const subscribe = () => VIMEO_EVENTS.forEach((value) => post({ method: 'addEventListener', value }));
    const detach = listen(frame, origin, (data) => {
      const payload = data.data && typeof data.data === 'object' ? data.data : {};
      const seconds = numLike(payload.seconds);
      const duration = numLike(payload.duration);
      switch (data.event) {
        case 'ready':
          subscribe();
          emit({ type: 'ready', duration });
          return;
        case 'play':
          emit({ type: 'play', position: seconds });
          return;
        case 'pause':
          emit({ type: 'pause', position: seconds });
          return;
        case 'ended':
          emit({ type: 'ended', position: seconds ?? duration });
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
