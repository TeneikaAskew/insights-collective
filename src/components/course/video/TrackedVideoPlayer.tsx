// ABOUTME: YouTube/Vimeo frame that reports watch progress (play/pause/seek/ended/progress) to analytics.
// ABOUTME: Source-only producer: not mounted by LessonViewer/CourseLearn; never marks completion.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import videoAnalyticsService from '@/services/videoAnalyticsService';
import { getVideoKind, toVideoEmbedUrl } from '@/utils/videoUrls';
import { cn } from '@/lib/utils';
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

const STATUS_TEXT: Record<ReportStatus, string> = {
  idle: '',
  saving: '',
  saved: '',
  error: 'Viewing progress could not be saved. It will be retried.',
};

/**
 * Honest-state contract:
 * - Only validated YouTube/Vimeo videos are framed, always via the canonical
 *   embed URL rebuilt by toVideoEmbedUrl (CSP-allowed hosts), plus the
 *   provider's JS-API switch.
 * - Events are accepted only from the provider origin AND the frame's own
 *   window. Watched time is credited only for plausible continuous playback;
 *   seeks are counted, never credited.
 * - Nothing is recorded without both userId and contentItemId. A failed save
 *   is shown and retried; it is never reported as saved.
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
  const [status, setStatus] = useState<ReportStatus>('idle');
  const [loaded, setLoaded] = useState(false);

  const resolved = useMemo(() => {
    const raw = typeof src === 'string' ? src.trim() : '';
    const canonical = raw ? toVideoEmbedUrl(raw) : null;
    const provider = raw ? getVideoKind(raw) : null;
    if (!canonical || !provider) return null;
    const adapter = adapterFor(provider);
    const pageOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      provider,
      adapter,
      frameSrc: adapter.frameSrc(canonical, pageOrigin),
      label: provider === 'youtube' ? 'YouTube' : 'Vimeo',
    };
  }, [src]);

  const tracking = Boolean(resolved && userId && contentItemId);

  useEffect(() => {
    setLoaded(false);
  }, [resolved?.frameSrc]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!resolved || !loaded || !frame || !tracking) return;
    const reporter = new WatchReporter({
      userId: userId as string,
      contentItemId: contentItemId as string,
      sink,
      reportCoveragePercent,
      flushIntervalMs,
      onStatus: (next) => setStatus(next),
    });
    const detach = resolved.adapter.attach(frame, (event) => reporter.record(event));
    const onHide = () => {
      if (document.visibilityState === 'hidden') void reporter.flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
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

  const name = (typeof title === 'string' && title.trim()) || `${resolved.label} video`;

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
      <p role="status" aria-live="polite" className={status === 'error' ? 'mt-2 text-sm text-destructive' : 'sr-only'}>
        {STATUS_TEXT[status]}
      </p>
    </div>
  );
}

export default TrackedVideoPlayer;
