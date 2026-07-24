import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { corsHeaders } from '../_shared/utils.ts';

const ICS_LINE_LIMIT = 75;

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function foldLine(line: string): string {
  if (line.length <= ICS_LINE_LIMIT) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + ICS_LINE_LIMIT);
    parts.push(i === 0 ? chunk : ` ${chunk}`);
    i += ICS_LINE_LIMIT;
  }
  return parts.join('\r\n');
}

function buildProperty(name: string, value: string, params?: Record<string, string>): string {
  let line = name;
  if (params && Object.keys(params).length > 0) {
    for (const [key, val] of Object.entries(params)) {
      line += `;${key}=${val}`;
    }
  }
  line += `:${icsEscape(value)}`;
  return foldLine(line);
}

function formatIcsDate(date: Date, allDay = false): string {
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return date.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function generateUid(courseId: string, eventId: string): string {
  return `${courseId}-${eventId}@insightscollective.org`;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  link?: string | null;
  all_day?: boolean;
  type: string;
}

function generateICS(courseTitle: string, courseId: string, events: CalendarEvent[]): string {
  const now = new Date();
  const dtStamp = formatIcsDate(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Insights Collective//Course Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    buildProperty('X-WR-CALNAME', courseTitle),
    buildProperty('X-WR-TIMEZONE', 'UTC'),
  ];

  for (const event of events) {
    const start = new Date(event.start_date);
    const end = event.end_date
      ? new Date(event.end_date)
      : new Date(start.getTime() + 60 * 60 * 1000);

    lines.push('BEGIN:VEVENT');
    lines.push(buildProperty('UID', generateUid(courseId, event.id)));
    lines.push(buildProperty('DTSTAMP', dtStamp));
    lines.push(buildProperty('SUMMARY', event.title));

    if (event.all_day) {
      lines.push(buildProperty('DTSTART', formatIcsDate(start, true), { VALUE: 'DATE' }));
      lines.push(buildProperty('DTEND', formatIcsDate(end, true), { VALUE: 'DATE' }));
    } else {
      lines.push(buildProperty('DTSTART', formatIcsDate(start)));
      lines.push(buildProperty('DTEND', formatIcsDate(end)));
    }

    if (event.description?.trim()) {
      lines.push(buildProperty('DESCRIPTION', event.description));
    }

    if (event.location?.trim()) {
      lines.push(buildProperty('LOCATION', event.location));
    }

    if (event.link?.trim()) {
      lines.push(buildProperty('URL', event.link));
    }

    const category = event.type ? event.type.charAt(0).toUpperCase() + event.type.slice(1) : 'Course';
    lines.push(buildProperty('CATEGORIES', category));
    lines.push(buildProperty('STATUS', 'CONFIRMED'));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const courseId = url.searchParams.get('course_id');

  if (!courseId) {
    return new Response(JSON.stringify({ error: 'Missing course_id query parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, published')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return new Response(JSON.stringify({ error: 'Course not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!course.published) {
      return new Response(JSON.stringify({ error: 'Course calendar is not available' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const events: CalendarEvent[] = [];

    // Quizzes link to a course through content_items, not directly.
    const { data: courseContentItems, error: contentItemsError } = await supabase
      .from('content_items')
      .select('id')
      .eq('course_id', courseId);
    if (contentItemsError) {
      throw new Error(`content_items: ${contentItemsError.message}`);
    }
    const contentItemIds = (courseContentItems ?? []).map((c: any) => c.id);

    const [
      { data: assignments, error: assignmentsError },
      { data: quizzes, error: quizzesError },
      { data: announcements, error: announcementsError },
      { data: customEvents, error: customEventsError },
    ] = await Promise.all([
      supabase
        .from('assignments')
        .select('id, title, description, due_date')
        .eq('course_id', courseId)
        .eq('is_published', true),
      contentItemIds.length > 0
        ? supabase
            .from('quizzes')
            .select('id, title, description, due_at, unlock_at, lock_at, time_limit')
            .in('content_item_id', contentItemIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('course_announcements')
        .select('id, title, content, created_at, is_pinned')
        .eq('course_id', courseId),
      supabase
        .from('events')
        .select('id, title, description, date, location, link')
        .eq('course_id', courseId),
    ]);

    // A failed source must fail the feed — a 200 ICS missing a category would
    // look like those deadlines simply don't exist.
    const sourceErrors = [
      ['assignments', assignmentsError],
      ['quizzes', quizzesError],
      ['announcements', announcementsError],
      ['events', customEventsError],
    ].filter(([, e]) => e);
    if (sourceErrors.length > 0) {
      throw new Error(
        sourceErrors.map(([name, e]: any) => `${name}: ${e.message}`).join('; ')
      );
    }

    assignments?.forEach((assignment: any) => {
      if (assignment.due_date) {
        events.push({
          id: `assignment-due-${assignment.id}`,
          title: `${assignment.title} - Due`,
          description: assignment.description || undefined,
          start_date: assignment.due_date,
          type: 'assignment',
        });
      }
    });

    quizzes?.forEach((quiz: any) => {
      if (quiz.due_at) {
        events.push({
          id: `quiz-due-${quiz.id}`,
          title: `${quiz.title} - Due`,
          description: quiz.description || `Quiz with ${quiz.time_limit || 'unlimited'} time limit`,
          start_date: quiz.due_at,
          type: 'quiz',
        });
      }
      if (quiz.unlock_at) {
        events.push({
          id: `quiz-unlock-${quiz.id}`,
          title: `${quiz.title} - Available`,
          description: 'Quiz becomes available',
          start_date: quiz.unlock_at,
          type: 'quiz',
        });
      }
      if (quiz.lock_at) {
        events.push({
          id: `quiz-lock-${quiz.id}`,
          title: `${quiz.title} - Closes`,
          description: 'Quiz submissions close',
          start_date: quiz.lock_at,
          type: 'quiz',
        });
      }
    });

    announcements?.forEach((announcement: any) => {
      events.push({
        id: `announcement-${announcement.id}`,
        title: `${announcement.title}${announcement.is_pinned ? ' (Pinned)' : ''}`,
        description: announcement.content,
        start_date: announcement.created_at,
        all_day: true,
        type: 'announcement',
      });
    });

    customEvents?.forEach((e: any) => {
      if (e.date) {
        events.push({
          id: `event-${e.id}`,
          title: e.title,
          description: e.description,
          start_date: e.date,
          location: e.location,
          link: e.link,
          type: 'event',
        });
      }
    });

    const ics = generateICS(course.title, course.id, events);

    return new Response(ics, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${course.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-calendar.ics"`,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err: any) {
    console.error('course-calendar-feed error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
