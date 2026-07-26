import { useState, useMemo, useEffect } from 'react';
import { useCourseCalendar } from '@/hooks/useCourseCalendar';
import { supabase } from '@/integrations/supabase/client';
import { buildGoogleCalendarSubscribeUrl, buildWebcalUrl } from '@/utils/calendarIcs';
import { Button } from '@/components/ui/button';
import { Calendar, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { securityConfig } from '@/config/security';

interface CourseCalendarSyncProps {
  courseId: string;
  courseTitle: string;
}

export function CourseCalendarSync({ courseId, courseTitle }: CourseCalendarSyncProps) {
  const { events = [], isLoading } = useCourseCalendar(courseId);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // The feed URL carries a per-enrollment token: a calendar client subscribing
  // to an ICS URL cannot send an Authorization header, so the token is what
  // identifies the subscriber to the edge function.
  const [feedToken, setFeedToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadToken = async () => {
      const { data, error } = await supabase.rpc('get_my_calendar_feed_token', {
        p_course_id: courseId,
      });
      if (cancelled) return;
      if (error) {
        setFeedToken(null);
        return;
      }
      setFeedToken(typeof data === 'string' ? data : null);
    };
    loadToken();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const feedUrl = useMemo(() => {
    // main's token requirement, on this branch's base-URL source: reading the
    // raw env var produced an empty feed URL wherever VITE_SUPABASE_URL is
    // unset, while securityConfig carries the fallback the client already uses.
    const base = securityConfig.supabase.url.replace(/\/$/, '');
    if (!feedToken) return '';
    return `${base}/functions/v1/course-calendar-feed?course_id=${encodeURIComponent(courseId)}` +
      `&token=${encodeURIComponent(feedToken)}`;
  }, [courseId, feedToken]);

  const handleDownloadICS = async () => {
    if (!feedUrl) return;
    setDownloading(true);
    try {
      const response = await fetch(feedUrl);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `HTTP ${response.status}`);
      }
      const ics = await response.text();
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const safeTitle = courseTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'course';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}-calendar.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err?.message || 'Could not fetch calendar feed.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyFeed = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast({ title: 'Feed URL copied', description: 'Paste it into Google Calendar, Apple Calendar, or Outlook.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const googleUrl = feedUrl ? buildGoogleCalendarSubscribeUrl(feedUrl) : '';
  const webcalUrl = feedUrl ? buildWebcalUrl(feedUrl) : '';

  return (
    <div className="border-t border-neutral-200 pt-5">
      <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 mb-3">
        Sync calendar
      </p>
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-sm font-normal"
          onClick={handleDownloadICS}
          disabled={isLoading || downloading || !feedUrl}
        >
          <Download className="h-4 w-4 text-neutral-500" />
          Download .ics file
        </Button>

        {googleUrl && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-sm font-normal"
            asChild
          >
            <a href={googleUrl} target="_blank" rel="noopener noreferrer">
              <Calendar className="h-4 w-4 text-neutral-500" />
              Add to Google Calendar
              <ExternalLink className="h-3 w-3 ml-auto text-neutral-400" />
            </a>
          </Button>
        )}

        {webcalUrl && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-sm font-normal"
            asChild
          >
            <a href={webcalUrl}>
              <Calendar className="h-4 w-4 text-neutral-500" />
              Subscribe with Apple Calendar
            </a>
          </Button>
        )}

        {feedUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sm font-normal text-neutral-600 hover:text-neutral-900"
            onClick={handleCopyFeed}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-neutral-500" />}
            {copied ? 'Copied feed URL' : 'Copy feed URL'}
          </Button>
        )}
      </div>
      {!feedUrl && !isLoading && (
        <p className="text-xs text-neutral-500 mt-2">
          Calendar sync is available once you are enrolled in this course.
        </p>
      )}
      {events.length === 0 && !isLoading && (
        <p className="text-xs text-neutral-500 mt-2">
          No events yet. Add assignments, quizzes, or events to populate the calendar.
        </p>
      )}
    </div>
  );
}
