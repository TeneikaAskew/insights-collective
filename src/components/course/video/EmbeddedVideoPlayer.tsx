// ABOUTME: Accessible, responsive read-only frame for a saved YouTube/Vimeo embed.
// ABOUTME: Reports only what it can observe: frame loading, slow, or unsupported. Never playback.

import { useCallback, useEffect, useId, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { accessibleVideoName, resolveEmbed } from './embedSource';

/** How long to wait for the provider frame's load event before offering retry. */
export const FRAME_SLOW_AFTER_MS = 15000;

const FRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

export interface EmbeddedVideoPlayerProps {
  /** The saved video src exactly as stored on the node. */
  src: string | null | undefined;
  /** Optional author-provided title, used as the frame's accessible name. */
  title?: string | null;
  /** Authors see the stored address of an unsupported embed so they can fix it. */
  showSourceDetails?: boolean;
  className?: string;
  /** Extra classes for the iframe (the extension's HTMLAttributes.class). */
  frameClassName?: string;
  /** Mirrors the Video extension's allowFullscreen option (default true, as the serializer). */
  allowFullscreen?: boolean;
}

type FrameState = 'loading' | 'loaded' | 'slow';

/**
 * Honest-state contract:
 * - `loading` until the iframe fires `load`; `loaded` afterwards. A `load`
 *   event means the provider document arrived, NOT that the video exists,
 *   is public, or played. Cross-origin provider errors (private, removed,
 *   region-blocked video) render inside the provider frame and cannot be
 *   observed here, so this component never claims "playing" or "watched".
 * - `slow` if no load event arrives within FRAME_SLOW_AFTER_MS: the frame is
 *   kept, and a Retry control remounts it. Status stays unknown, not failed.
 * - Unsupported or missing sources are never framed; an inline notice is
 *   shown instead and the stored node is left untouched.
 * Captions, speed, fullscreen and keyboard shortcuts are the provider's own
 * controls inside the frame; nothing here adds or claims app-managed captions.
 */
export function EmbeddedVideoPlayer({
  src,
  title,
  showSourceDetails = false,
  className,
  frameClassName,
  allowFullscreen = true,
}: EmbeddedVideoPlayerProps) {
  const resolved = resolveEmbed(src);
  const frameSrc = resolved.status === 'supported' ? resolved.frameSrc : null;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FrameState>('loading');
  const statusId = useId();

  useEffect(() => {
    if (!frameSrc) return;
    setState('loading');
    const timer = window.setTimeout(() => {
      setState((current) => (current === 'loading' ? 'slow' : current));
    }, FRAME_SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [frameSrc, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (resolved.status === 'unsupported') {
    const message =
      resolved.reason === 'missing'
        ? 'This video has no saved address, so it cannot be shown.'
        : 'This video cannot be shown here. Only YouTube and Vimeo videos can be embedded.';
    return (
      <div
        role="note"
        data-video-state="unsupported"
        className={cn(
          'my-4 flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground',
          className,
        )}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="m-0">{message}</p>
          {showSourceDetails && typeof src === 'string' && src.trim() !== '' && (
            <p className="m-0 mt-1 break-all font-mono text-xs">Saved address: {src}</p>
          )}
        </div>
      </div>
    );
  }

  const name = accessibleVideoName(title, resolved.providerLabel);

  return (
    <div className={cn('my-4 w-full max-w-full', className)} data-video-state={state} data-video-provider={resolved.provider}>
      <div className="relative w-full overflow-hidden rounded-md bg-muted" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          key={attempt}
          src={resolved.frameSrc}
          title={name}
          className={cn('absolute inset-0 h-full w-full border-0', frameClassName)}
          allow={FRAME_ALLOW}
          allowFullScreen={allowFullscreen}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          aria-describedby={state === 'loaded' ? undefined : statusId}
          onLoad={() => setState('loaded')}
        />
        {state !== 'loaded' && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/80"
            aria-hidden="true"
          >
            {state === 'loading' ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span id={statusId} role="status" aria-live="polite" className={state === 'loaded' ? 'sr-only' : undefined}>
          {state === 'loading' && `Loading ${resolved.providerLabel} player…`}
          {state === 'slow' && `The ${resolved.providerLabel} player is taking longer than expected to load.`}
        </span>
        {state === 'slow' && (
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
            Retry loading video
          </Button>
        )}
        <a
          href={resolved.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-4"
        >
          Watch on {resolved.providerLabel}
          <span className="sr-only">: {name} (opens in a new tab)</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

export default EmbeddedVideoPlayer;
