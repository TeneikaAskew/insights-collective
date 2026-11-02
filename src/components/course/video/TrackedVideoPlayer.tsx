// ABOUTME: YouTube/Vimeo frame that reports watch progress (play/pause/seek/ended/progress) to analytics.
// ABOUTME: Source-only producer: not mounted by LessonViewer/CourseLearn; never marks completion.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import videoAnalyticsService from '@/services/videoAnalyticsService';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { accessibleVideoName, resolveEmbed } from './embedSource';
import { adapterFor } from './providerAdapters';
import { WatchReporter, type EngagementSink, type ReportStatus } from './watchReporter';

const FRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

export interface TrackedVideoPlayerProps {
  /** Saved video src (YouTube/Vimeo page, share or embed URL). */
  src: string | null | undefined;
  title?: string | null;
  /** Both are required for anything to be recorded; without them the frame plays untracked. */
  userId?: string | null;
  contentItemId?: string | null;
  /** Defaults to videoAnalyticsService; injected in tests. */
  sink?: EngagementSink;
  /** See WatchReporterOptions.reportCoveragePercent. Off by default (90% DB auto-complete trigger). */
  reportCoveragePercent?: boolean;
  flushIntervalMs?: number;
  allowFullscreen?: boolean;
  className?: string;
}

/** Retries are event driven (see WatchReporter); the text says exactly what triggers one. */
const ERROR_TEXT =
  'Viewing progress could not be saved. It will be tried again the next time you pause or after more watching, or you can retry now.';

/**
 * Honest-state contract:
 * - Only validated YouTube/Vimeo videos are framed, using the same frame URL
 *   as the read-only embed (resolveEmbed from WP09A): a stored embed URL on a
 *   CSP host is kept with its host (including youtube-nocookie), params and
 *   unlisted hash; only the provider's JS-API switch is added.
 * - Events are accepted only from the frame's own origin AND window. Watched
 *   time is credited only while playing, from a wall-time budget; seeks are
 *   counted, never credited.
 * - Nothing is recorded without both userId and contentItemId. A failed save
 *   is shown with a retry button and is never reported as saved. Status
 *   belongs to the current video and identity: it resets when either
 *   changes, and a replaced or unmounted player's late results are ignored.
 * - completion is never marked here, and coverage percent is not sent unless
 *   reportCoveragePercent is set (see watchReporter.ts for why).
 */
export function TrackedVideoPlayer({
  src,
  title,
  userId,
  contentItemId,
  sink = videoAnalyticsService,
  reportCoveragePercent = false,
  flushIntervalMs,
  allowFullscreen = true,
  className,
}: TrackedVideoPlayerProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const reporterRef = useRef<WatchReporter | null>(null);
  const [status, setStatus] = useState<ReportStatus>('idle');
  const [loaded, setLoaded] = useState(false);

  const resolved = useMemo(() => {
    const embed = resolveEmbed(src);
    if (embed.status !== 'supported') return null;
    const adapter = adapterFor(embed.provider);
    const pageOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      provider: embed.provider,
      adapter,
      frameSrc: adapter.frameSrc(embed.frameSrc, pageOrigin),
      label: embed.providerLabel,
    };
  }, [src]);

  const tracking = Boolean(resolved && userId && contentItemId);

  useEffect(() => {
    setLoaded(false);
  }, [resolved?.frameSrc]);

  // A status belongs to one video and one identity.
  useEffect(() => {
    setStatus('idle');
  }, [resolved?.frameSrc, userId, contentItemId]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!resolved || !loaded || !frame || !tracking) return;
    let active = true;
    const reporter = new WatchReporter({
      userId: userId as string,
      contentItemId: contentItemId as string,
      sink,
      reportCoveragePercent,
      flushIntervalMs,
      onStatus: (next) => {
        if (active) setStatus(next);
      },
    });
    reporterRef.current = reporter;
    const detach = resolved.adapter.attach(frame, (event) => reporter.record(event));
    const onHide = () => {
      if (document.visibilityState === 'hidden') void reporter.flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      active = false;
      if (reporterRef.current === reporter) reporterRef.current = null;
      document.removeEventListener('visibilitychange', onHide);
      detach();
      void reporter.dispose();
    };
  }, [resolved, loaded, tracking, userId, contentItemId, sink, reportCoveragePercent, flushIntervalMs]);

  if (!resolved) {
    return (
      <div
        role="note"
        className={cn(
          'my-4 flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground',
          className,
        )}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="m-0">This video cannot be shown here. Only YouTube and Vimeo videos can be embedded.</p>
      </div>
    );
  }

  const name = accessibleVideoName(title, resolved.label);

  return (
    <div
      className={cn('my-4 w-full max-w-full', className)}
      data-video-provider={resolved.provider}
      data-watch-tracking={tracking ? 'on' : 'off'}
      data-watch-status={status}
    >
      <div className="relative w-full overflow-hidden rounded-md bg-muted" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          ref={frameRef}
          src={resolved.frameSrc}
          title={name}
          className="absolute inset-0 h-full w-full border-0"
          allow={FRAME_ALLOW}
          allowFullScreen={allowFullscreen}
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div role="status" aria-live="polite" className={status === 'error' ? 'mt-2 flex flex-wrap items-center gap-2' : 'sr-only'}>
        {status === 'error' ? (
          <>
            <p className="m-0 text-sm text-destructive">{ERROR_TEXT}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void reporterRef.current?.retry()}>
              Retry saving
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default TrackedVideoPlayer;
