import { useState, useMemo } from 'react';
import { useCourseCalendar } from '@/hooks/useCourseCalendar';
import { generateCourseICS, downloadICS, buildGoogleCalendarSubscribeUrl, buildWebcalUrl } from '@/utils/calendarIcs';
import { Button } from '@/components/ui/button';
import { Calendar, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CourseCalendarSyncProps {
  courseId: string;
  courseTitle: string;
}

export function CourseCalendarSync({ courseId, courseTitle }: CourseCalendarSyncProps) {
  const { events = [], isLoading } = useCourseCalendar(courseId);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const feedUrl = useMemo(() => {
    const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
    if (!base) return '';
    return `${base}/functions/v1/course-calendar-feed?course_id=${encodeURIComponent(courseId)}`;
  }, [courseId]);

  const handleDownloadICS = () => {
    if (!events.length) {
      toast({ title: 'No calendar events', description: 'This course has no events to export yet.' });
      return;
    }
    setDownloading(true);
    try {
      const ics = generateCourseICS(courseTitle, events);
      const safeTitle = courseTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'course';
      downloadICS(`${safeTitle}-calendar.ics`, ics);
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
          disabled={isLoading || downloading}
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
      {events.length === 0 && !isLoading && (
        <p className="text-xs text-neutral-500 mt-2">
          No events yet. Add assignments, quizzes, or events to populate the calendar.
        </p>
      )}
    </div>
  );
}
